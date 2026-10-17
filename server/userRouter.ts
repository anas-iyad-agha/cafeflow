import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { userRoles, users } from "../drizzle/schema";
import { requireCafeDb } from "./cafeDb";
import { router, superAdminProcedure } from "./_core/trpc";

export const userRouter = router({
  list: superAdminProcedure.query(async () => {
    const db = await requireCafeDb();
    return db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt, users.id);
  }),

  setRole: superAdminProcedure
    .input(
      z.object({
        userId: z.number().int().positive(),
        role: z.enum(userRoles),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.id === input.userId && input.role !== "super_admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You cannot remove your own Super Admin role.",
        });
      }

      const db = await requireCafeDb();
      return db.transaction(async tx => {
        // Serialize role changes against all current super-admin rows so two
        // simultaneous demotions cannot remove the final global administrator.
        const superAdmins = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.role, "super_admin"))
          .for("update");
        const [target] = await tx
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        if (
          target.role === "super_admin" &&
          input.role !== "super_admin" &&
          superAdmins.length <= 1
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least one Super Admin must remain.",
          });
        }
        await tx
          .update(users)
          .set({ role: input.role })
          .where(eq(users.id, input.userId));
        return { userId: input.userId, role: input.role };
      });
    }),
});
