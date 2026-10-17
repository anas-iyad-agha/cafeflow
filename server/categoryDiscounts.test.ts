import { beforeEach, describe, expect, it, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { cafeCategoryDiscounts, cafes } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { cafeRouter } from "./cafeRouter";
import { requireCafeDb } from "./cafeDb";

vi.mock("./cafeDb", () => ({ requireCafeDb: vi.fn() }));

const ownerContext = {
  user: { id: 7, role: "cafe_admin" },
  req: {},
  res: {},
} as unknown as TrpcContext;

type QueryRecord = { table: unknown; sql: string; params: unknown[] };
type WriteRecord = {
  table: unknown;
  values?: unknown;
  update?: unknown;
};

function mockDatabase(owned: boolean) {
  const queries: QueryRecord[] = [];
  const writes = { upserts: [] as WriteRecord[], deletes: [] as WriteRecord[] };
  const dialect = new MySqlDialect();
  const fake = {
    select: vi.fn(() => ({
      from: (table: unknown) => ({
        where: (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
          const query = dialect.sqlToQuery(condition);
          queries.push({ table, sql: query.sql, params: query.params });
          if (table === cafes) {
            return {
              limit: async () => (owned ? [{ id: 42, ownerId: 7 }] : []),
            };
          }
          return {
            orderBy: async () => [{ category: "Coffee", discountPercent: 10 }],
          };
        },
      }),
    })),
    insert: vi.fn((table: unknown) => ({
      values: (values: unknown) => ({
        onDuplicateKeyUpdate: async (update: unknown) => {
          writes.upserts.push({ table, values, update });
        },
      }),
    })),
    delete: vi.fn((table: unknown) => ({
      where: async (condition: Parameters<typeof dialect.sqlToQuery>[0]) => {
        const query = dialect.sqlToQuery(condition);
        writes.deletes.push({ table, values: query.params });
      },
    })),
  };
  vi.mocked(requireCafeDb).mockResolvedValue(
    fake as unknown as Awaited<ReturnType<typeof requireCafeDb>>
  );
  return { queries, writes, fake };
}

describe("Category discount management", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists only the caller's cafe category rules", async () => {
    const { queries } = mockDatabase(true);

    await expect(
      cafeRouter
        .createCaller(ownerContext)
        .categoryDiscounts.list({ cafeId: 42 })
    ).resolves.toEqual([{ category: "Coffee", discountPercent: 10 }]);

    expect(queries).toHaveLength(2);
    expect(queries[0]).toMatchObject({ table: cafes, params: [42, 7] });
    expect(queries[1]).toMatchObject({
      table: cafeCategoryDiscounts,
      params: [42],
    });
  });

  it("does not disclose another manager's category rules", async () => {
    const { queries } = mockDatabase(false);

    await expect(
      cafeRouter
        .createCaller(ownerContext)
        .categoryDiscounts.list({ cafeId: 42 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(queries).toHaveLength(1);
  });

  it("upserts a validated rule only after ownership is established", async () => {
    const { writes } = mockDatabase(true);

    await expect(
      cafeRouter.createCaller(ownerContext).categoryDiscounts.save({
        cafeId: 42,
        category: "  Coffee  ",
        discountPercent: 10,
      })
    ).resolves.toEqual({ category: "Coffee", discountPercent: 10 });

    expect(writes.upserts).toEqual([
      {
        table: cafeCategoryDiscounts,
        values: { cafeId: 42, category: "Coffee", discountPercent: 10 },
        update: { set: { discountPercent: 10 } },
      },
    ]);
  });

  it("does not write a category rule for a cafe the caller does not own", async () => {
    const { writes } = mockDatabase(false);

    await expect(
      cafeRouter.createCaller(ownerContext).categoryDiscounts.save({
        cafeId: 42,
        category: "Coffee",
        discountPercent: 10,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(writes.upserts).toHaveLength(0);
    expect(writes.deletes).toHaveLength(0);
  });

  it("clears a category rule when the percentage is zero", async () => {
    const { writes } = mockDatabase(true);

    await expect(
      cafeRouter.createCaller(ownerContext).categoryDiscounts.save({
        cafeId: 42,
        category: "Coffee",
        discountPercent: 0,
      })
    ).resolves.toEqual({ category: "Coffee", discountPercent: 0 });

    expect(writes.deletes).toEqual([
      { table: cafeCategoryDiscounts, values: [42, "Coffee"] },
    ]);
  });
});
