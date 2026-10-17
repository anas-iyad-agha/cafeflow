import {
  boolean,
  check,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const userRoles = ["user", "cafe_admin", "super_admin"] as const;

export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", userRoles).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const serviceTypes = ["dine-in", "takeaway"] as const;
export const orderStatuses = [
  "new",
  "preparing",
  "ready",
  "completed",
  "cancelled",
] as const;

export type ServiceType = (typeof serviceTypes)[number];
export type OrderStatus = (typeof orderStatuses)[number];

/** The price and item details captured at the instant an order is placed. */
export type OrderItemSnapshot = {
  menuItemId: number;
  name: string;
  quantity: number;
  /** Original menu price before the effective discount was applied. */
  listPriceCents: number;
  /** Final discounted unit price captured when the order was placed. */
  priceCents: number;
  /** Item-level discount when set, otherwise the category-level discount. */
  discountPercent: number;
};

export const cafes = mysqlTable(
  "cafes",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Null only for curated public/sample cafes; ordinary cafes belong to a user. */
    ownerId: int("ownerId").references(() => users.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 160 }).notNull(),
    description: text("description").notNull(),
    address: varchar("address", { length: 320 }).notNull(),
    phone: varchar("phone", { length: 80 }).notNull(),
    hours: varchar("hours", { length: 200 }).notNull(),
    imageUrl: text("imageUrl").notNull(),
    isOpen: boolean("isOpen").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  table => [
    uniqueIndex("cafes_slug_unique").on(table.slug),
    index("cafes_owner_idx").on(table.ownerId),
  ]
);

export const menuItems = mysqlTable(
  "menu_items",
  {
    id: int("id").autoincrement().primaryKey(),
    cafeId: int("cafeId")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description").notNull(),
    priceCents: int("priceCents", { unsigned: true }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    /** Item-level percentage discount; zero delegates to the category rule. */
    discountPercent: int("discountPercent", { unsigned: true })
      .notNull()
      .default(0),
    imageUrl: text("imageUrl").notNull(),
    available: boolean("available").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  table => [
    index("menu_items_cafe_idx").on(table.cafeId),
    check(
      "menu_items_discount_percent_range",
      sql`${table.discountPercent} >= 0 AND ${table.discountPercent} <= 100`
    ),
  ]
);

/** One optional percentage discount per named category in a cafe. */
export const cafeCategoryDiscounts = mysqlTable(
  "cafe_category_discounts",
  {
    id: int("id").autoincrement().primaryKey(),
    cafeId: int("cafeId")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 80 }).notNull(),
    discountPercent: int("discountPercent", { unsigned: true })
      .notNull()
      .default(0),
  },
  table => [
    uniqueIndex("cafe_category_discounts_cafe_category_unique").on(
      table.cafeId,
      table.category
    ),
    index("cafe_category_discounts_cafe_idx").on(table.cafeId),
    check(
      "cafe_category_discounts_percent_range",
      sql`${table.discountPercent} >= 0 AND ${table.discountPercent} <= 100`
    ),
  ]
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    /** Opaque bearer receipt token; intentionally not derived from the order id. */
    publicToken: varchar("publicToken", { length: 128 }).notNull(),
    cafeId: int("cafeId")
      .notNull()
      .references(() => cafes.id, { onDelete: "cascade" }),
    /** Client-provided key, unique within the cafe, to make checkout retry-safe. */
    idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull(),
    customerName: varchar("customerName", { length: 120 }).notNull(),
    serviceType: mysqlEnum("serviceType", serviceTypes).notNull(),
    tableNumber: varchar("tableNumber", { length: 32 }),
    notes: text("notes").notNull(),
    status: mysqlEnum("status", orderStatuses).notNull().default("new"),
    totalCents: int("totalCents", { unsigned: true }).notNull(),
    items: json("items").$type<OrderItemSnapshot[]>().notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  table => [
    uniqueIndex("orders_public_token_unique").on(table.publicToken),
    uniqueIndex("orders_cafe_idempotency_unique").on(
      table.cafeId,
      table.idempotencyKey
    ),
    index("orders_cafe_created_idx").on(table.cafeId, table.createdAt),
  ]
);

export type Cafe = typeof cafes.$inferSelect;
export type InsertCafe = typeof cafes.$inferInsert;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = typeof menuItems.$inferInsert;
export type CafeCategoryDiscount = typeof cafeCategoryDiscounts.$inferSelect;
export type InsertCafeCategoryDiscount =
  typeof cafeCategoryDiscounts.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
