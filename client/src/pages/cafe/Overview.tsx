import { Link } from "wouter";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  Coffee,
  DollarSign,
  ExternalLink,
  MapPin,
  Plus,
  ShoppingBag,
  Store,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WorkspaceData } from "./Workspace";
import { money, photo, statusLabels, timeLabel, Order } from "@/lib/cafe";

const sampleActivity = [
  {
    id: 1048,
    customerName: "Olivia Martin",
    serviceType: "dine-in",
    tableNumber: "04",
    items: [
      { name: "Cappuccino", quantity: 2 },
      { name: "Butter croissant", quantity: 1 },
    ],
    totalCents: 1275,
    status: "new",
    time: "Just now",
  },
  {
    id: 1047,
    customerName: "James Wilson",
    serviceType: "takeaway",
    tableNumber: "",
    items: [
      { name: "Flat white", quantity: 1 },
      { name: "Pain au chocolat", quantity: 1 },
    ],
    totalCents: 875,
    status: "preparing",
    time: "4 min ago",
  },
  {
    id: 1046,
    customerName: "Emma Davis",
    serviceType: "dine-in",
    tableNumber: "02",
    items: [{ name: "Iced matcha", quantity: 2 }],
    totalCents: 1100,
    status: "ready",
    time: "8 min ago",
  },
  {
    id: 1045,
    customerName: "Noah Thompson",
    serviceType: "takeaway",
    tableNumber: "",
    items: [{ name: "Americano", quantity: 1 }],
    totalCents: 350,
    status: "completed",
    time: "12 min ago",
  },
] as const;
const sampleVolume = [
  0, 0, 3, 8, 6, 14, 21, 18, 26, 20, 17, 24, 15, 12, 18, 13, 8,
].map((value, i) => ({ hour: `${i + 6}:00`, orders: value }));

export default function Overview({ data }: { data: WorkspaceData }) {
  const { cafe, items, orders, demo, loading } = data;
  const today = new Date();
  const todaysOrders = orders.filter(
    o => new Date(o.createdAt).toDateString() === today.toDateString()
  );
  const actualRevenue = todaysOrders
    .filter(o => o.status !== "cancelled")
    .reduce((s, o) => s + o.totalCents, 0);
  const active = orders.filter(o =>
    ["new", "preparing", "ready"].includes(o.status)
  );
  const stats = [
    {
      label: "Orders today",
      value: demo ? "128" : String(todaysOrders.length),
      icon: ShoppingBag,
      detail: demo ? "+12.8% from yesterday" : "Orders placed today",
      trend: true,
    },
    {
      label: "Order value today",
      value: demo ? "$847.50" : money(actualRevenue),
      icon: DollarSign,
      detail: demo ? "+8.2% from yesterday" : "Excludes cancelled orders",
      trend: true,
    },
    {
      label: "Active orders",
      value: demo ? "8" : String(active.length),
      icon: Clock3,
      detail: demo
        ? "3 new · 5 in progress"
        : `${orders.filter(o => o.status === "new").length} new · ${active.filter(o => o.status !== "new").length} in progress`,
      trend: false,
    },
    {
      label: "Menu items",
      value: demo ? "8" : String(items.length),
      icon: BookOpen,
      detail: `${items.filter(i => i.available).length} available on your menu`,
      trend: false,
    },
  ];
  const volumes = demo
    ? sampleVolume
    : Array.from({ length: 17 }, (_, i) => ({
        hour: `${i + 6}:00`,
        orders: todaysOrders.filter(
          o => new Date(o.createdAt).getHours() === i + 6
        ).length,
      }));
  const popularity = new Map<number, number>();
  orders
    .filter(o => o.status !== "cancelled")
    .forEach(o =>
      o.items.forEach(i =>
        popularity.set(
          i.menuItemId,
          (popularity.get(i.menuItemId) || 0) + i.quantity
        )
      )
    );
  const popularItems = demo
    ? [
        items.find(i => i.name === "Cappuccino"),
        items.find(i => i.name === "Butter croissant"),
        items.find(i => i.name === "Iced matcha"),
      ].filter(Boolean)
    : [...items]
        .sort(
          (a, b) => (popularity.get(b.id) || 0) - (popularity.get(a.id) || 0)
        )
        .slice(0, 3);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="little-line" />
            YOUR CAFÉ, AT A GLANCE
          </div>
          <h1>
            Good things are brewing<span className="serif-period">.</span>
          </h1>
          <p>Here’s what’s happening at your café today.</p>
        </div>
        <div className="heading-actions">
          <span className="date-chip">
            <CalendarDays size={15} />
            {today.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <button className="btn primary" onClick={data.createCafe}>
            <Plus size={16} />
            Create café
          </button>
        </div>
      </div>
      {demo && (
        <div className="demo-notice">
          <span className="demo-tag">SAMPLE WORKSPACE</span>
          <span>
            A taste of what your café could look like. Sample analytics and
            activity are shown below.
          </span>
          <button onClick={data.createCafe}>
            Make it yours <ArrowRight size={15} />
          </button>
        </div>
      )}
      <section className="stats-row">
        {stats.map(({ label, value, icon: Icon, detail, trend }) => (
          <article className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <div className="stat-icon">
                <Icon size={18} />
              </div>
            </div>
            <div className={`stat-value ${loading ? "skeleton-text" : ""}`}>
              {loading ? "—" : value}
            </div>
            <div className={`stat-detail ${trend ? "positive" : ""}`}>
              {trend && <ArrowUpRight size={13} />}
              <span>{detail}</span>
            </div>
          </article>
        ))}
      </section>
      <div className="overview-columns">
        <div className="overview-left">
          <section className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <h2>A day in orders</h2>
                <p>
                  {demo
                    ? "Sample orders throughout the day"
                    : "Today’s orders, hour by hour"}
                </p>
              </div>
              <span className="chart-legend">
                <i />
                Orders<span className="today-pill">Today</span>
              </span>
            </div>
            <div className="order-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={volumes}
                  margin={{ left: -22, right: 6, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="orderFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor="#916347"
                        stopOpacity={0.23}
                      />
                      <stop
                        offset="100%"
                        stopColor="#916347"
                        stopOpacity={0.01}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 5"
                    vertical={false}
                    stroke="#ebe5dc"
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "#9a9286" }}
                    axisLine={false}
                    tickLine={false}
                    interval={3}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9a9286" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      border: "1px solid #e6ddd2",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="orders"
                    stroke="#906448"
                    strokeWidth={2.4}
                    fill="url(#orderFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-foot">
              <span>
                <span className="small-dot" />A little bustle. A lot of good
                coffee.
              </span>
              <span>{demo ? "Sample data" : "Live order data"}</span>
            </div>
          </section>
          <section className="panel recent-panel">
            <div className="panel-heading">
              <div className="heading-with-count">
                <h2>Fresh off the counter</h2>
                <span className="small-count">{demo ? 4 : orders.length}</span>
              </div>
              <Link className="subtle-link" href="/orders">
                View all orders <ArrowRight size={14} />
              </Link>
            </div>
            <div className="table-scroll">
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>ORDER / CUSTOMER</th>
                    <th>ITEMS</th>
                    <th>AMOUNT</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {demo
                    ? sampleActivity.map(o => (
                        <tr key={o.id}>
                          <td>
                            <strong>
                              #{o.id}
                              <span className="order-time">{o.time}</span>
                            </strong>
                            <span>
                              {o.customerName}{" "}
                              <span className="table-dot">·</span>{" "}
                              {o.serviceType === "dine-in"
                                ? `Table ${o.tableNumber}`
                                : "Takeaway"}
                            </span>
                          </td>
                          <td>
                            <span className="item-summary">
                              {o.items
                                .map(i => `${i.quantity} × ${i.name}`)
                                .join(", ")}
                            </span>
                          </td>
                          <td className="amount">{money(o.totalCents)}</td>
                          <td>
                            <span className={`status-badge ${o.status}`}>
                              <i />
                              {statusLabels[o.status]}
                            </span>
                          </td>
                        </tr>
                      ))
                    : orders.slice(0, 4).map(o => (
                        <tr key={o.id}>
                          <td>
                            <strong>
                              #{o.id}
                              <span className="order-time">
                                {timeLabel(o.createdAt)}
                              </span>
                            </strong>
                            <span>{o.customerName}</span>
                          </td>
                          <td>
                            <span className="item-summary">
                              {o.items
                                .map(i => `${i.quantity} × ${i.name}`)
                                .join(", ")}
                            </span>
                          </td>
                          <td className="amount">{money(o.totalCents)}</td>
                          <td>
                            <span className={`status-badge ${o.status}`}>
                              <i />
                              {statusLabels[o.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
              {!demo && !orders.length && (
                <div className="table-empty">
                  <Coffee size={24} />
                  <p>Your first order is just a menu link away.</p>
                  {cafe && (
                    <Link href={`/c/${cafe.slug}`} className="subtle-link">
                      Open customer menu <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="overview-right">
          <section className="cafe-profile panel">
            <div className="cafe-photo">
              {cafe?.imageUrl && (
                <img src={cafe.imageUrl} alt={`${cafe.name} interior`} />
              )}
              <span className={`open-badge ${cafe?.isOpen ? "" : "closed"}`}>
                <i />
                {cafe?.isOpen ? "Open for orders" : "Currently closed"}
              </span>
              {demo && (
                <span className="photo-label">YOUR CAFÉ, YOUR CORNER</span>
              )}
            </div>
            <div className="cafe-profile-body">
              <div className="cafe-monogram">
                <Coffee size={21} />
              </div>
              <h2>
                {cafe?.name ||
                  (loading ? "Brewing your workspace…" : "Your café goes here")}
              </h2>
              <p className="profile-description">
                {cafe?.description ||
                  "A place for good coffee and good company."}
              </p>
              <div className="profile-detail">
                <MapPin size={14} />
                {cafe?.address || "Add your address"}
              </div>
              <div className="profile-detail">
                <Clock3 size={14} />
                {cafe?.hours || "Add your opening hours"}
              </div>
              {cafe && (
                <Link
                  className="btn secondary customer-menu-link"
                  href={`/c/${cafe.slug}`}
                >
                  View customer menu <ExternalLink size={14} />
                </Link>
              )}
            </div>
          </section>
          <section className="panel quick-actions">
            <div className="panel-heading">
              <h2>Keep things flowing</h2>
              <Coffee size={18} />
            </div>
            <Link href="/menu">
              <span className="quick-icon">
                <Plus size={18} />
              </span>
              <span>
                <strong>Add a menu item</strong>
                <small>Something new to fall in love with</small>
              </span>
              <ChevronRight size={16} />
            </Link>
            <Link href="/orders">
              <span className="quick-icon">
                <ShoppingBag size={17} />
              </span>
              <span>
                <strong>Check your orders</strong>
                <small>From first sip to last crumb</small>
              </span>
              <ChevronRight size={16} />
            </Link>
            <Link href="/settings">
              <span className="quick-icon">
                <Store size={17} />
              </span>
              <span>
                <strong>Update café details</strong>
                <small>Make a good first impression</small>
              </span>
              <ChevronRight size={16} />
            </Link>
          </section>
        </div>
      </div>
      <section className="popular-section">
        <div className="section-heading">
          <div>
            <h2>The crowd favorites</h2>
            <p>
              {demo
                ? "A few familiar faces on the sample menu."
                : "Your menu, ordered by customer favorites."}
            </p>
          </div>
          <Link className="subtle-link" href="/menu">
            Manage menu <ArrowRight size={14} />
          </Link>
        </div>
        <div className="popular-items">
          {popularItems.map(
            (item, index) =>
              item && (
                <Link href="/menu" key={item.id} className="popular-item">
                  <img src={item.imageUrl || photo.coffee} alt={item.name} />
                  <div>
                    <span className="item-category">{item.category}</span>
                    <h3>{item.name}</h3>
                    <span className="popular-price">
                      {money(item.priceCents)}
                      <span className="popular-dot">·</span>
                      {demo
                        ? ["42", "28", "24"][index]
                        : popularity.get(item.id) || 0}{" "}
                      ordered{demo ? " (sample)" : ""}
                    </span>
                  </div>
                  <ArrowUpRight size={18} />
                </Link>
              )
          )}
        </div>
        {!loading && !items.length && (
          <div className="empty-menu-mini">
            Your next crowd favorite belongs here.{" "}
            <Link href="/menu">Add your first menu item →</Link>
          </div>
        )}
      </section>
    </>
  );
}
