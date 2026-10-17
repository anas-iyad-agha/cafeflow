export type Cafe = {
  id: number;
  ownerId: number | null;
  name: string;
  slug: string;
  description: string;
  address: string;
  phone: string;
  hours: string;
  imageUrl: string;
  isOpen: boolean;
  createdAt: Date;
};
export type MenuItem = {
  id: number;
  cafeId: number;
  name: string;
  description: string;
  priceCents: number;
  discountPercent: number;
  categoryDiscountPercent: number;
  category: string;
  imageUrl: string;
  available: boolean;
};
export type OrderStatus =
  | "new"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled";
export type Order = {
  id: number;
  publicToken: string;
  cafeId: number;
  customerName: string;
  serviceType: "dine-in" | "takeaway";
  tableNumber: string;
  notes: string;
  status: OrderStatus;
  totalCents: number;
  items: {
    menuItemId: number;
    name: string;
    quantity: number;
    listPriceCents?: number;
    priceCents: number;
    discountPercent?: number;
  }[];
  createdAt: Date;
};
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
export const effectiveDiscountPercent = (
  itemPercent = 0,
  categoryPercent = 0
) => (itemPercent > 0 ? itemPercent : categoryPercent);
export const discountedPriceCents = (priceCents: number, percent = 0) =>
  Math.round((priceCents * (100 - percent)) / 100);
export const discountLabel = (percent: number) => `${percent}% off`;
export const statusLabels: Record<OrderStatus, string> = {
  new: "New order",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const timeLabel = (date: Date) =>
  new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
export const photo = {
  cafe: "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/FP8LqcRwKex3kmt5L4qvhQ.jpg",
  coffee:
    "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/s5RjzEhK4swjt7gXmkNHvg.jpg",
  pastry:
    "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/4YN6U8vaztG92cfsHfqgUk.jpg",
  matcha:
    "https://files.manuscdn.com/search-media/310519664028405303/7k5zAMP4YSWD1p7NTOTEuU/g7v5onqitc3kJaWV4FPPsX.jpg",
};
