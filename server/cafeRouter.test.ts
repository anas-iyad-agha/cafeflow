import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";
import {
  aggregateOrderLines,
  canTransitionOrderStatus,
  createDiscountedOrderItemSnapshot,
  discountedPriceCents,
  effectiveDiscountPercent,
  slugifyCafeName,
} from "./cafeRouter";

describe("CafeFlow pure order helpers", () => {
  it("normalizes a readable slug with a safe fallback", () => {
    expect(slugifyCafeName("  Café & Co.  ")).toBe("cafe-co");
    expect(slugifyCafeName("!!!")).toBe("cafe");
  });

  it("aggregates duplicate cart lines before checkout", () => {
    expect(
      aggregateOrderLines([
        { menuItemId: 7, quantity: 2 },
        { menuItemId: 9, quantity: 1 },
        { menuItemId: 7, quantity: 3 },
      ])
    ).toEqual([
      { menuItemId: 7, quantity: 5 },
      { menuItemId: 9, quantity: 1 },
    ]);
  });

  it("does not permit duplicates to bypass the per-item quantity limit", () => {
    try {
      aggregateOrderLines([
        { menuItemId: 7, quantity: 20 },
        { menuItemId: 7, quantity: 11 },
      ]);
      throw new Error("Expected aggregation to reject the request");
    } catch (error) {
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
    }
  });

  it("enforces the one-way operational order state machine", () => {
    expect(canTransitionOrderStatus("new", "preparing")).toBe(true);
    expect(canTransitionOrderStatus("new", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("preparing", "ready")).toBe(true);
    expect(canTransitionOrderStatus("ready", "completed")).toBe(true);
    expect(canTransitionOrderStatus("ready", "cancelled")).toBe(true);
    expect(canTransitionOrderStatus("new", "ready")).toBe(false);
    expect(canTransitionOrderStatus("completed", "completed")).toBe(false);
    expect(canTransitionOrderStatus("cancelled", "preparing")).toBe(false);
  });

  it("uses an item discount in preference to a category discount", () => {
    expect(effectiveDiscountPercent(15, 10)).toBe(15);
    expect(effectiveDiscountPercent(0, 10)).toBe(10);
    expect(effectiveDiscountPercent(0, 0)).toBe(0);
  });

  it("discounts and rounds cents without stacking percentages", () => {
    expect(discountedPriceCents(1_000, 10)).toBe(900);
    expect(discountedPriceCents(105, 10)).toBe(95);
    expect(discountedPriceCents(999, 17)).toBe(829);
    expect(discountedPriceCents(375, 0)).toBe(375);
  });

  it("captures list price, discounted price, and effective discount in snapshots", () => {
    expect(
      createDiscountedOrderItemSnapshot(
        {
          id: 7,
          name: "Flat white",
          category: "Coffee",
          priceCents: 450,
          discountPercent: 0,
        },
        2,
        10
      )
    ).toEqual({
      menuItemId: 7,
      name: "Flat white",
      quantity: 2,
      listPriceCents: 450,
      priceCents: 405,
      discountPercent: 10,
    });
  });
});
