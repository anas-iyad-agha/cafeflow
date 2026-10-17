import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { cafeCategoryDiscounts, cafes, menuItems } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { cafeRouter } from "./cafeRouter";
import { requireCafeDb } from "./cafeDb";

vi.mock("./cafeDb", () => ({ requireCafeDb: vi.fn() }));

const ownerContext = {
  user: { id: 7, role: "cafe_admin" },
  req: {},
  res: {},
} as unknown as TrpcContext;
const items = [
  {
    id: 1,
    cafeId: 42,
    name: "Flat white",
    description: "",
    priceCents: 450,
    category: "Coffee",
    discountPercent: 0,
    imageUrl: "",
    available: true,
    createdAt: new Date(),
  },
  {
    id: 2,
    cafeId: 42,
    name: "Croissant",
    description: "",
    priceCents: 375,
    category: "Pastries",
    discountPercent: 15,
    imageUrl: "",
    available: false,
    createdAt: new Date(),
  },
];
const categoryDiscountRules = [{ category: "Coffee", discountPercent: 10 }];

function mockDatabase(owned: boolean) {
  const predicates: { table: unknown; sql: string; params: unknown[] }[] = [];
  const dialect = new MySqlDialect();
  const fake = {
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
          const query = dialect.sqlToQuery(condition);
          predicates.push({ table, sql: query.sql, params: query.params });
          return {
            limit: async () => (owned ? [{ id: 42, ownerId: 7 }] : []),
            orderBy: async () =>
              table === cafeCategoryDiscounts ? categoryDiscountRules : items,
          };
        },
      }),
    })),
  };
  vi.mocked(requireCafeDb).mockResolvedValue(
    fake as unknown as Awaited<ReturnType<typeof requireCafeDb>>
  );
  return predicates;
}

describe("Manager menu retrieval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns available AND sold-out items after checking ownership", async () => {
    const queries = mockDatabase(true);
    const result = await cafeRouter
      .createCaller(ownerContext)
      .menu.list({ cafeId: 42 });
    expect(result).toHaveLength(2);
    expect(result[1].available).toBe(false);
    expect(result[1]).not.toHaveProperty("createdAt");
    expect(result[0]).toMatchObject({
      discountPercent: 0,
      categoryDiscountPercent: 10,
    });
    expect(result[1]).toMatchObject({
      discountPercent: 15,
      categoryDiscountPercent: 0,
    });
    expect(queries[0].table).toBe(cafes);
    expect(queries[0].params).toEqual([42, 7]);
    expect(queries[1].table).toBe(menuItems);
    expect(queries[1].params).toEqual([42]);
    expect(queries[1].sql).not.toContain("available");
    expect(queries[2].table).toBe(cafeCategoryDiscounts);
    expect(queries[2].params).toEqual([42]);
  });

  it("does not retrieve another manager's menu", async () => {
    const queries = mockDatabase(false);
    await expect(
      cafeRouter.createCaller(ownerContext).menu.list({ cafeId: 42 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(queries).toHaveLength(1);
  });

  it("requires an authenticated application session", async () => {
    const anonymous = {
      user: null,
      req: {},
      res: {},
    } as unknown as TrpcContext;
    await expect(
      cafeRouter.createCaller(anonymous).menu.list({ cafeId: 42 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(requireCafeDb).not.toHaveBeenCalled();
  });
});
