import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { isCafeAdminRole } from "./cafeRouter";
import { requireCafeDb } from "./cafeDb";

vi.mock("./cafeDb", () => ({ requireCafeDb: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

function contextWithRole(
  role: "user" | "cafe_admin" | "super_admin" | null,
  id = 1
): TrpcContext {
  return {
    user: role
      ? ({
          id,
          openId: `role-test-user-${id}`,
          name: "Role Test",
          email: "role-test@example.test",
          loginMethod: "test",
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as NonNullable<TrpcContext["user"]>)
      : null,
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("application role access", () => {
  it("grants café-management role to café admins and super admins only", () => {
    expect(isCafeAdminRole("cafe_admin")).toBe(true);
    expect(isCafeAdminRole("super_admin")).toBe(true);
    expect(isCafeAdminRole("user")).toBe(false);
  });

  it.each([null, "user", "cafe_admin"] as const)(
    "denies the global role-management API to %s",
    async role => {
      const caller = appRouter.createCaller(contextWithRole(role));
      const expectedCode = role ? "FORBIDDEN" : "UNAUTHORIZED";
      await expect(caller.users.list()).rejects.toMatchObject({
        code: expectedCode,
      });
      await expect(
        caller.users.setRole({ userId: 2, role: "cafe_admin" })
      ).rejects.toMatchObject({ code: expectedCode });
    }
  );

  it("denies normal users access to the café manager API", async () => {
    const caller = appRouter.createCaller(contextWithRole("user"));
    await expect(caller.cafes.mine()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(requireCafeDb).not.toHaveBeenCalled();
  });

  it("lets a super admin view accounts without exposing open IDs", async () => {
    const rows = [
      {
        id: 1,
        name: "Role Test",
        email: "role-test@example.test",
        role: "super_admin" as const,
        createdAt: new Date(),
      },
    ];
    const fakeDb = {
      select: () => ({ from: () => ({ orderBy: async () => rows }) }),
    };
    vi.mocked(requireCafeDb).mockResolvedValue(
      fakeDb as unknown as Awaited<ReturnType<typeof requireCafeDb>>
    );

    const caller = appRouter.createCaller(contextWithRole("super_admin"));
    const result = await caller.users.list();
    expect(result).toEqual(rows);
    expect(result[0]).not.toHaveProperty("openId");
  });

  it("lets a super admin assign a role inside the request transaction", async () => {
    const accounts = [
      { id: 1, role: "super_admin" },
      { id: 2, role: "user" },
    ];
    let selection = 0;
    const transaction = {
      select: () => {
        const queryIndex = selection++;
        return {
          from: () => ({
            where: () =>
              queryIndex === 0
                ? {
                    for: async () =>
                      accounts.filter(a => a.role === "super_admin"),
                  }
                : { limit: async () => accounts.filter(a => a.id === 2) },
          }),
        };
      },
      update: () => ({
        set: (values: { role: string }) => ({
          where: async () => {
            accounts[1]!.role = values.role;
          },
        }),
      }),
    };
    const fakeDb = {
      transaction: (callback: (tx: typeof transaction) => unknown) =>
        callback(transaction),
    };
    vi.mocked(requireCafeDb).mockResolvedValue(
      fakeDb as unknown as Awaited<ReturnType<typeof requireCafeDb>>
    );

    const caller = appRouter.createCaller(contextWithRole("super_admin"));
    await expect(
      caller.users.setRole({ userId: 2, role: "cafe_admin" })
    ).resolves.toEqual({ userId: 2, role: "cafe_admin" });
    expect(accounts[1]?.role).toBe("cafe_admin");
  });

  it("prevents a super admin from removing their own global access", async () => {
    const caller = appRouter.createCaller(contextWithRole("super_admin"));
    await expect(
      caller.users.setRole({ userId: 1, role: "user" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(requireCafeDb).not.toHaveBeenCalled();
  });
});
