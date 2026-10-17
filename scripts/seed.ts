import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq } from "drizzle-orm";
import { cafes, menuItems } from "../drizzle/schema";

const SAMPLE_SLUG = "the-daily-grind";
const CAFE_IMAGE =
  "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/FP8LqcRwKex3kmt5L4qvhQ.jpg";
const COFFEE_IMAGE =
  "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/s5RjzEhK4swjt7gXmkNHvg.jpg";
const PASTRY_IMAGE =
  "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/4YN6U8vaztG92cfsHfqgUk.jpg";
const TEA_IMAGE =
  "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/g7v5onqitc3kJaWV4FPPsX.jpg";

const sampleItems = [
  {
    name: "Cappuccino",
    description: "Double espresso, steamed milk, and a soft cap of foam.",
    priceCents: 450,
    category: "Coffee",
    imageUrl: COFFEE_IMAGE,
  },
  {
    name: "Flat White",
    description: "Velvety microfoam folded into a rich double espresso.",
    priceCents: 450,
    category: "Coffee",
    imageUrl: COFFEE_IMAGE,
  },
  {
    name: "Iced Matcha",
    description: "Ceremonial matcha shaken with milk and served over ice.",
    priceCents: 550,
    category: "Tea & Matcha",
    imageUrl: TEA_IMAGE,
  },
  {
    name: "Butter Croissant",
    description: "A flaky, all-butter croissant baked fresh each morning.",
    priceCents: 375,
    category: "Pastries",
    imageUrl: PASTRY_IMAGE,
  },
  {
    name: "Espresso",
    description: "A short, balanced double shot with caramel sweetness.",
    priceCents: 300,
    category: "Coffee",
    imageUrl: COFFEE_IMAGE,
  },
  {
    name: "Americano",
    description: "Double espresso lengthened with hot water.",
    priceCents: 350,
    category: "Coffee",
    imageUrl: COFFEE_IMAGE,
  },
  {
    name: "Pain au Chocolat",
    description: "Buttery laminated pastry with two bars of dark chocolate.",
    priceCents: 425,
    category: "Pastries",
    imageUrl: PASTRY_IMAGE,
  },
  {
    name: "Chai Latte",
    description: "Spiced black tea concentrate with silky steamed milk.",
    priceCents: 500,
    category: "Tea & Matcha",
    imageUrl: TEA_IMAGE,
  },
] as const;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed CafeFlow");

  const pool = mysql.createPool(databaseUrl);
  const db = drizzle(pool);
  try {
    const result = await db.transaction(async tx => {
      // The dedicated slug is the seed marker. Once present, do not overwrite
      // the cafe or any menu edits made through the application.
      const [existing] = await tx
        .select({ id: cafes.id })
        .from(cafes)
        .where(eq(cafes.slug, SAMPLE_SLUG))
        .limit(1);
      if (existing) return { created: false, cafeId: existing.id };

      const inserted = await tx
        .insert(cafes)
        .values({
          ownerId: null,
          name: "The Daily Grind",
          slug: SAMPLE_SLUG,
          description: "Good coffee. Better company. Your neighborhood pause.",
          address: "124 Maple Street, Brooklyn",
          phone: "(718) 555-0148",
          hours: "Mon–Sun, 7:00 AM – 8:00 PM",
          imageUrl: CAFE_IMAGE,
          isOpen: true,
        })
        .$returningId();
      const cafeId = inserted[0]?.id;
      if (!cafeId) throw new Error("Sample cafe insert did not return an id");

      await tx.insert(menuItems).values(
        sampleItems.map(item => ({
          ...item,
          cafeId,
          available: true,
        })),
      );
      return { created: true, cafeId };
    });
    console.log(
      result.created
        ? `Seeded The Daily Grind (cafe ${result.cafeId}) with ${sampleItems.length} menu items.`
        : `Sample cafe already exists (cafe ${result.cafeId}); leaving it unchanged.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error("CafeFlow seed failed:", error);
  process.exitCode = 1;
});
