import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import {
  cafeCategoryDiscounts,
  cafes,
  menuItems,
  orders,
  type Cafe,
  type CafeCategoryDiscount,
  type MenuItem,
  type Order,
  type OrderItemSnapshot,
  type OrderStatus,
  type User,
} from "../drizzle/schema";
import { z } from "zod";
import { requireCafeDb } from "./cafeDb";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";

export type MenuItemResponse = Omit<MenuItem, "createdAt">;
/** Menu response enriched with the rule that applies to its category. */
export type PublicMenuItem = MenuItemResponse & {
  categoryDiscountPercent: number;
};
export type PublicOrder = Omit<Order, "idempotencyKey">;

const cafeInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2_000),
  address: z.string().trim().max(320),
  phone: z.string().trim().max(80),
  hours: z.string().trim().max(200),
  imageUrl: z.string().trim().max(2_048),
  isOpen: z.boolean(),
});

const menuInput = z.object({
  id: z.number().int().positive().optional(),
  cafeId: z.number().int().positive(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1_000),
  priceCents: z.number().int().min(0).max(10_000_000),
  category: z.string().trim().min(1).max(80),
  // Optional to preserve older manager clients; omitted values reset to zero.
  discountPercent: z.number().int().min(0).max(100).optional(),
  imageUrl: z.string().trim().max(2_048),
  available: z.boolean(),
});

const categoryDiscountInput = z.object({
  cafeId: z.number().int().positive(),
  category: z.string().trim().min(1).max(80),
  discountPercent: z.number().int().min(0).max(100),
});

const orderStatusInput = z.enum([
  "new",
  "preparing",
  "ready",
  "completed",
  "cancelled",
]);

const placeOrderInput = z.object({
  cafeId: z.number().int().positive(),
  customerName: z.string().trim().min(1).max(120),
  serviceType: z.enum(["dine-in", "takeaway"]),
  tableNumber: z.string().trim().max(32),
  notes: z.string().trim().max(1_000),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(30),
      })
    )
    .min(1)
    .max(30),
  idempotencyKey: z.string().trim().min(1).max(128),
});

const notFound = (message: string): never => {
  throw new TRPCError({ code: "NOT_FOUND", message });
};

const badRequest = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};

/** Produces a human-readable stable slug stem. Uniqueness is added at insert time. */
export function slugifyCafeName(name: string): string {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150);
  return normalized || "cafe";
}

/**
 * Duplicated cart lines are merged before price calculation. The resulting
 * quantity is capped too, so duplicates cannot bypass the per-item limit.
 */
export function aggregateOrderLines(
  lines: ReadonlyArray<{ menuItemId: number; quantity: number }>
): Array<{ menuItemId: number; quantity: number }> {
  const quantities = new Map<number, number>();
  for (const line of lines) {
    const nextQuantity = (quantities.get(line.menuItemId) ?? 0) + line.quantity;
    if (nextQuantity > 30) {
      badRequest("A menu item quantity cannot exceed 30");
    }
    quantities.set(line.menuItemId, nextQuantity);
  }
  return [...quantities.entries()].map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}

/**
 * Selects one discount without stacking: a positive item rule overrides the
 * category rule, while zero on an item falls back to the category value.
 */
export function effectiveDiscountPercent(
  itemDiscountPercent: number,
  categoryDiscountPercent: number
): number {
  return itemDiscountPercent > 0
    ? itemDiscountPercent
    : categoryDiscountPercent;
}

/** Calculates a final unit price in cents using standard half-up cent rounding. */
export function discountedPriceCents(
  originalPriceCents: number,
  discountPercent: number
): number {
  return Math.round((originalPriceCents * (100 - discountPercent)) / 100);
}

/**
 * Captures the immutable discounted price details used for a newly placed
 * order. Historical JSON snapshots are intentionally not rewritten.
 */
export function createDiscountedOrderItemSnapshot(
  item: Pick<
    MenuItem,
    "id" | "name" | "category" | "priceCents" | "discountPercent"
  >,
  quantity: number,
  categoryDiscountPercent: number
): OrderItemSnapshot {
  const discountPercent = effectiveDiscountPercent(
    item.discountPercent,
    categoryDiscountPercent
  );
  return {
    menuItemId: item.id,
    name: item.name,
    quantity,
    listPriceCents: item.priceCents,
    priceCents: discountedPriceCents(item.priceCents, discountPercent),
    discountPercent,
  };
}

const validStatusTransitions: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/** Terminal order states cannot be changed, including to themselves. */
export function canTransitionOrderStatus(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return validStatusTransitions[from].includes(to);
}

function toMenuItem(item: MenuItem): MenuItemResponse {
  const { createdAt: _createdAt, ...publicItem } = item;
  return publicItem;
}

type CategoryDiscountRule = Pick<
  CafeCategoryDiscount,
  "category" | "discountPercent"
>;
type CafeDb = Awaited<ReturnType<typeof requireCafeDb>>;

/** Adds category discount data without exposing a menu item's creation time. */
function withCategoryDiscounts(
  items: readonly MenuItem[],
  categoryDiscounts: readonly CategoryDiscountRule[]
): PublicMenuItem[] {
  const discountByCategory = new Map(
    categoryDiscounts.map(rule => [rule.category, rule.discountPercent])
  );
  return items.map(item => ({
    ...toMenuItem(item),
    categoryDiscountPercent: discountByCategory.get(item.category) ?? 0,
  }));
}

/** Loads one cafe's menu and its category rules with one category-rule query. */
async function getCafeMenuItems(
  db: CafeDb,
  cafeId: number,
  availableOnly: boolean
): Promise<PublicMenuItem[]> {
  const itemCondition = availableOnly
    ? and(eq(menuItems.cafeId, cafeId), eq(menuItems.available, true))
    : eq(menuItems.cafeId, cafeId);
  const [items, categoryDiscounts] = await Promise.all([
    db
      .select()
      .from(menuItems)
      .where(itemCondition)
      .orderBy(menuItems.category, menuItems.name),
    db
      .select({
        category: cafeCategoryDiscounts.category,
        discountPercent: cafeCategoryDiscounts.discountPercent,
      })
      .from(cafeCategoryDiscounts)
      .where(eq(cafeCategoryDiscounts.cafeId, cafeId))
      .orderBy(cafeCategoryDiscounts.category),
  ]);
  return withCategoryDiscounts(items, categoryDiscounts);
}

function toOrder(order: Order): PublicOrder {
  const { idempotencyKey: _idempotencyKey, ...publicOrder } = order;
  return publicOrder;
}

export function isCafeAdminRole(role: User["role"]): boolean {
  return role === "cafe_admin" || role === "super_admin";
}

function userHasGlobalCafeAccess(role: User["role"]): boolean {
  return role === "super_admin";
}

async function getManagedCafe(
  cafeId: number,
  user: Pick<User, "id" | "role">
): Promise<Cafe> {
  if (!isCafeAdminRole(user.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "A Café Admin role is required to manage cafés.",
    });
  }
  const db = await requireCafeDb();
  const [cafe] = await db
    .select()
    .from(cafes)
    .where(
      user.role === "super_admin"
        ? eq(cafes.id, cafeId)
        : and(eq(cafes.id, cafeId), eq(cafes.ownerId, user.id))
    )
    .limit(1);
  if (!cafe) notFound("Cafe not found");
  return cafe;
}

async function createUniqueCafe(
  input: z.infer<typeof cafeInput>,
  ownerId: number
) {
  const db = await requireCafeDb();
  const stem = slugifyCafeName(input.name);

  // The unique index is authoritative; retry if a simultaneous creator chooses
  // the same candidate after our availability check.
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate =
      suffix === 0 ? stem : `${stem.slice(0, 150)}-${suffix + 1}`;
    const [existing] = await db
      .select({ id: cafes.id })
      .from(cafes)
      .where(eq(cafes.slug, candidate))
      .limit(1);
    if (existing) continue;

    try {
      const inserted = await db
        .insert(cafes)
        .values({ ...input, ownerId, slug: candidate })
        .$returningId();
      const cafeId = inserted[0]?.id;
      if (!cafeId) throw new Error("Cafe insert did not return an id");
      const [cafe] = await db
        .select()
        .from(cafes)
        .where(eq(cafes.id, cafeId))
        .limit(1);
      if (!cafe) throw new Error("Cafe was not found after creation");
      return cafe;
    } catch (error) {
      if (isDuplicateKeyError(error)) continue;
      throw error;
    }
  }
  throw new TRPCError({
    code: "CONFLICT",
    message: "Unable to generate a unique cafe URL",
  });
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ER_DUP_ENTRY"
  );
}

function generateReceiptToken(): string {
  // 32 random bytes are encoded as an opaque 43-character URL-safe token.
  return randomBytes(32).toString("base64url");
}

export const cafeRouter = router({
  cafes: router({
    mine: protectedProcedure.query(async ({ ctx }) => {
      if (!isCafeAdminRole(ctx.user.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "A Café Admin role is required to manage cafés.",
        });
      }
      const db = await requireCafeDb();
      const query = db.select().from(cafes);
      return userHasGlobalCafeAccess(ctx.user.role)
        ? query.orderBy(desc(cafes.createdAt), desc(cafes.id))
        : query
            .where(eq(cafes.ownerId, ctx.user.id))
            .orderBy(desc(cafes.createdAt), desc(cafes.id));
    }),

    demo: publicProcedure.query(async () => {
      const db = await requireCafeDb();
      const [cafe] = await db
        .select()
        .from(cafes)
        .where(eq(cafes.slug, "the-daily-grind"))
        .limit(1);
      if (!cafe) notFound("Demo cafe not found");
      return { cafe, items: await getCafeMenuItems(db, cafe.id, true) };
    }),

    publicBySlug: publicProcedure
      .input(z.object({ slug: z.string().trim().min(1).max(160) }))
      .query(async ({ input }) => {
        const db = await requireCafeDb();
        const [cafe] = await db
          .select()
          .from(cafes)
          .where(eq(cafes.slug, input.slug))
          .limit(1);
        if (!cafe) notFound("Cafe not found");
        return { cafe, items: await getCafeMenuItems(db, cafe.id, true) };
      }),

    save: protectedProcedure
      .input(cafeInput)
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        if (!isCafeAdminRole(ctx.user.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "A Café Admin role is required to create or edit cafés.",
          });
        }
        if (!input.id) return createUniqueCafe(input, ctx.user.id);

        const { id, ...values } = input;
        await getManagedCafe(id, ctx.user);
        await db.update(cafes).set(values).where(eq(cafes.id, id));
        const [cafe] = await db
          .select()
          .from(cafes)
          .where(eq(cafes.id, id))
          .limit(1);
        if (!cafe) throw new Error("Cafe was not found after update");
        return cafe;
      }),
  }),

  menu: router({
    list: protectedProcedure
      .input(z.object({ cafeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        return getCafeMenuItems(db, input.cafeId, false);
      }),

    save: protectedProcedure
      .input(menuInput)
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        if (input.id) {
          const [current] = await db
            .select()
            .from(menuItems)
            .where(
              and(
                eq(menuItems.id, input.id),
                eq(menuItems.cafeId, input.cafeId)
              )
            )
            .limit(1);
          if (!current) notFound("Menu item not found");
          const {
            id: _id,
            cafeId: _cafeId,
            discountPercent = 0,
            ...values
          } = input;
          await db
            .update(menuItems)
            .set({ ...values, discountPercent })
            .where(eq(menuItems.id, current.id));
          const [updated] = await db
            .select()
            .from(menuItems)
            .where(eq(menuItems.id, current.id))
            .limit(1);
          if (!updated) throw new Error("Menu item was not found after update");
          return toMenuItem(updated);
        }

        const { id: _id, discountPercent = 0, ...values } = input;
        const inserted = await db
          .insert(menuItems)
          .values({ ...values, discountPercent })
          .$returningId();
        const itemId = inserted[0]?.id;
        if (!itemId) throw new Error("Menu item insert did not return an id");
        const [item] = await db
          .select()
          .from(menuItems)
          .where(eq(menuItems.id, itemId))
          .limit(1);
        if (!item) throw new Error("Menu item was not found after creation");
        return toMenuItem(item);
      }),

    toggle: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          cafeId: z.number().int().positive(),
          available: z.boolean(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        const [item] = await db
          .select()
          .from(menuItems)
          .where(
            and(eq(menuItems.id, input.id), eq(menuItems.cafeId, input.cafeId))
          )
          .limit(1);
        if (!item) notFound("Menu item not found");
        await db
          .update(menuItems)
          .set({ available: input.available })
          .where(eq(menuItems.id, item.id));
        return toMenuItem({ ...item, available: input.available });
      }),

    remove: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          cafeId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        const [item] = await db
          .select()
          .from(menuItems)
          .where(
            and(eq(menuItems.id, input.id), eq(menuItems.cafeId, input.cafeId))
          )
          .limit(1);
        if (!item) notFound("Menu item not found");
        await db.delete(menuItems).where(eq(menuItems.id, item.id));
        return { success: true } as const;
      }),
  }),

  categoryDiscounts: router({
    list: protectedProcedure
      .input(z.object({ cafeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        return db
          .select({
            category: cafeCategoryDiscounts.category,
            discountPercent: cafeCategoryDiscounts.discountPercent,
          })
          .from(cafeCategoryDiscounts)
          .where(eq(cafeCategoryDiscounts.cafeId, input.cafeId))
          .orderBy(cafeCategoryDiscounts.category);
      }),

    save: protectedProcedure
      .input(categoryDiscountInput)
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        if (input.discountPercent === 0) {
          await db
            .delete(cafeCategoryDiscounts)
            .where(
              and(
                eq(cafeCategoryDiscounts.cafeId, input.cafeId),
                eq(cafeCategoryDiscounts.category, input.category)
              )
            );
          return { category: input.category, discountPercent: 0 };
        }
        await db
          .insert(cafeCategoryDiscounts)
          .values(input)
          .onDuplicateKeyUpdate({
            set: { discountPercent: input.discountPercent },
          });
        return {
          category: input.category,
          discountPercent: input.discountPercent,
        };
      }),
  }),

  orders: router({
    list: protectedProcedure
      .input(z.object({ cafeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        const cafeOrders = await db
          .select()
          .from(orders)
          .where(eq(orders.cafeId, input.cafeId))
          .orderBy(desc(orders.createdAt), desc(orders.id));
        return cafeOrders.map(toOrder);
      }),

    place: publicProcedure
      .input(placeOrderInput)
      .mutation(async ({ input }) => {
        if (input.serviceType === "dine-in" && !input.tableNumber) {
          badRequest("A table number is required for dine-in orders");
        }
        const aggregatedLines = aggregateOrderLines(input.items);
        const db = await requireCafeDb();

        try {
          return await db.transaction(async tx => {
            // Retries return the original receipt even if availability has changed.
            const [previous] = await tx
              .select({ id: orders.id, publicToken: orders.publicToken })
              .from(orders)
              .where(
                and(
                  eq(orders.cafeId, input.cafeId),
                  eq(orders.idempotencyKey, input.idempotencyKey)
                )
              )
              .limit(1);
            if (previous) return previous;

            const [cafe] = await tx
              .select({ id: cafes.id, isOpen: cafes.isOpen })
              .from(cafes)
              .where(eq(cafes.id, input.cafeId))
              .limit(1);
            if (!cafe) notFound("Cafe not found");
            if (!cafe.isOpen) badRequest("Cafe is currently closed");

            const requestedItemIds = aggregatedLines.map(
              line => line.menuItemId
            );
            const [selectedItems, activeCategoryDiscounts] = await Promise.all([
              tx
                .select()
                .from(menuItems)
                .where(
                  and(
                    eq(menuItems.cafeId, input.cafeId),
                    eq(menuItems.available, true),
                    inArray(menuItems.id, requestedItemIds)
                  )
                ),
              tx
                .select({
                  category: cafeCategoryDiscounts.category,
                  discountPercent: cafeCategoryDiscounts.discountPercent,
                })
                .from(cafeCategoryDiscounts)
                .where(
                  and(
                    eq(cafeCategoryDiscounts.cafeId, input.cafeId),
                    gt(cafeCategoryDiscounts.discountPercent, 0)
                  )
                ),
            ]);
            if (selectedItems.length !== requestedItemIds.length) {
              badRequest("One or more menu items are unavailable");
            }

            const itemById = new Map(
              selectedItems.map(item => [item.id, item])
            );
            const categoryDiscountByName = new Map(
              activeCategoryDiscounts.map(rule => [
                rule.category,
                rule.discountPercent,
              ])
            );
            const snapshots: OrderItemSnapshot[] = aggregatedLines.map(line => {
              const item = itemById.get(line.menuItemId);
              if (!item) {
                throw new TRPCError({
                  code: "BAD_REQUEST",
                  message: "One or more menu items are unavailable",
                });
              }
              return createDiscountedOrderItemSnapshot(
                item,
                line.quantity,
                categoryDiscountByName.get(item.category) ?? 0
              );
            });
            const totalCents = snapshots.reduce(
              (total, item) => total + item.priceCents * item.quantity,
              0
            );
            if (!Number.isSafeInteger(totalCents)) {
              throw new Error("Order total is outside the supported range");
            }

            const inserted = await tx
              .insert(orders)
              .values({
                publicToken: generateReceiptToken(),
                cafeId: input.cafeId,
                idempotencyKey: input.idempotencyKey,
                customerName: input.customerName,
                serviceType: input.serviceType,
                tableNumber:
                  input.serviceType === "dine-in" ? input.tableNumber : null,
                notes: input.notes,
                status: "new",
                totalCents,
                items: snapshots,
              })
              .$returningId();
            const id = inserted[0]?.id;
            if (!id) throw new Error("Order insert did not return an id");
            const [order] = await tx
              .select({ id: orders.id, publicToken: orders.publicToken })
              .from(orders)
              .where(eq(orders.id, id))
              .limit(1);
            if (!order) throw new Error("Order was not found after creation");
            return order;
          });
        } catch (error) {
          // A simultaneous retry can race after both transactions observe no row.
          if (!isDuplicateKeyError(error)) throw error;
          const [previous] = await db
            .select({ id: orders.id, publicToken: orders.publicToken })
            .from(orders)
            .where(
              and(
                eq(orders.cafeId, input.cafeId),
                eq(orders.idempotencyKey, input.idempotencyKey)
              )
            )
            .limit(1);
          if (previous) return previous;
          throw error;
        }
      }),

    byToken: publicProcedure
      .input(z.object({ token: z.string().trim().min(1).max(128) }))
      .query(async ({ input }) => {
        const db = await requireCafeDb();
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.publicToken, input.token))
          .limit(1);
        if (!order) notFound("Order not found");
        const [cafe] = await db
          .select()
          .from(cafes)
          .where(eq(cafes.id, order.cafeId))
          .limit(1);
        if (!cafe) notFound("Cafe not found");
        return { order: toOrder(order), cafe };
      }),

    setStatus: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          cafeId: z.number().int().positive(),
          status: orderStatusInput,
        })
      )
      .mutation(async ({ ctx, input }) => {
        const db = await requireCafeDb();
        await getManagedCafe(input.cafeId, ctx.user);
        const [order] = await db
          .select()
          .from(orders)
          .where(and(eq(orders.id, input.id), eq(orders.cafeId, input.cafeId)))
          .limit(1);
        if (!order) notFound("Order not found");
        if (!canTransitionOrderStatus(order.status, input.status)) {
          badRequest(
            `Cannot change order from ${order.status} to ${input.status}`
          );
        }
        await db
          .update(orders)
          .set({ status: input.status })
          .where(eq(orders.id, order.id));
        return toOrder({ ...order, status: input.status });
      }),
  }),
});
