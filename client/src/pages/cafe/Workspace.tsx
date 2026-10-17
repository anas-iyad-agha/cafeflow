import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  ChevronDown,
  Coffee,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShoppingBag,
  Store,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Cafe, MenuItem, Order } from "@/lib/cafe";
import { CafeForm } from "@/components/cafe/Forms";
import Overview from "./Overview";
import { CafesPage, MenuPage, OrdersPage, SettingsPage } from "./Manage";
import UserRolesPage from "./UserRoles";

export type WorkspaceData = {
  cafe: Cafe | undefined;
  items: MenuItem[];
  orders: Order[];
  cafes: Cafe[];
  demo: boolean;
  loading: boolean;
  error: string | undefined;
  createCafe: () => void;
  selectCafe: (id: number) => void;
  refresh: () => void;
};
const links = [
  { path: "/", label: "Overview", icon: LayoutDashboard },
  { path: "/cafes", label: "My cafés", icon: Store },
  { path: "/menu", label: "Menu manager", icon: BookOpen },
  { path: "/orders", label: "Orders", icon: ShoppingBag },
  { path: "/settings", label: "Café settings", icon: Settings2 },
];

export default function Workspace() {
  const [path, navigate] = useLocation();
  const { user, loading: authLoading, logout } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const canManageCafes = isSuperAdmin || user?.role === "cafe_admin";
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<number>(() =>
    Number(localStorage.getItem("cafeflow-cafe") || 0)
  );
  const [create, setCreate] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const mine = trpc.cafes.mine.useQuery(undefined, {
    enabled: !!canManageCafes,
    retry: false,
  });
  const demoQuery = trpc.cafes.demo.useQuery(undefined, { retry: false });
  const cafes = (mine.data || []) as Cafe[];
  const ownCafe = cafes.find(c => c.id === selected) || cafes[0];
  const menuQuery = trpc.menu.list.useQuery(
    { cafeId: ownCafe?.id || 0 },
    { enabled: !!ownCafe, retry: false }
  );
  const cafe = ownCafe || (demoQuery.data?.cafe as Cafe | undefined);
  const isDemo = !ownCafe;
  const items = (ownCafe ? menuQuery.data : demoQuery.data?.items) as
    | MenuItem[]
    | undefined;
  const orderQuery = trpc.orders.list.useQuery(
    { cafeId: ownCafe?.id || 0 },
    {
      enabled: !!ownCafe && !!canManageCafes,
      refetchInterval: 8000,
      retry: false,
    }
  );
  const orders = (orderQuery.data || []) as Order[];
  const newOrders = orders.filter(o => o.status === "new");
  const seen = useRef<{ cafeId: number; ids: Set<number> } | null>(null);
  useEffect(() => {
    if (!ownCafe || !orderQuery.data) return;
    const ids = new Set(orders.map(o => o.id));
    if (seen.current?.cafeId === ownCafe.id) {
      orders
        .filter(o => !seen.current!.ids.has(o.id))
        .forEach(o => {
          toast.success(`New order from ${o.customerName}`, {
            description: `Order #${o.id} is waiting in your inbox.`,
            action: { label: "View order", onClick: () => navigate("/orders") },
          });
        });
    }
    seen.current = { cafeId: ownCafe.id, ids };
  }, [orderQuery.data, ownCafe?.id]);
  const selectCafe = (id: number) => {
    setSelected(id);
    localStorage.setItem("cafeflow-cafe", String(id));
  };
  const refresh = () => {
    utils.cafes.mine.invalidate();
    utils.cafes.publicBySlug.invalidate();
    utils.menu.list.invalidate();
    utils.categoryDiscounts.list.invalidate();
    utils.orders.list.invalidate();
  };
  const data: WorkspaceData = {
    cafe,
    items: items || [],
    orders,
    cafes,
    demo: isDemo,
    loading:
      authLoading ||
      demoQuery.isLoading ||
      (!!user && mine.isLoading) ||
      (!!ownCafe && menuQuery.isLoading),
    error:
      mine.error?.message ||
      menuQuery.error?.message ||
      demoQuery.error?.message ||
      orderQuery.error?.message,
    createCafe: () => {
      if (!user) {
        startLogin();
        return;
      }
      if (!canManageCafes) {
        toast.error("A Café Admin role is required to create a café.");
        return;
      }
      setCreate(true);
    },
    selectCafe,
    refresh,
  };
  const navLinks = isSuperAdmin
    ? [...links, { path: "/users", label: "Users & roles", icon: Users }]
    : links;
  const active = navLinks.find(l => l.path === path) || links[0];

  if (user?.role === "user") {
    return <RegularUserHome name={user.name || "there"} logout={logout} />;
  }

  return (
    <div className="workspace">
      {mobile && (
        <button
          className="mobile-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link href="/" className="wordmark">
          <img src="/logo.svg" alt="" />
          caféflow<span className="wordmark-dot">.</span>
        </Link>
        <div className="sidebar-caption">YOUR DAILY WORKSPACE</div>
        <nav>
          {navLinks.map(({ path: href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobile(false)}
              className={`nav-link ${path === href ? "active" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {href === "/orders" && newOrders.length > 0 && (
                <span className="nav-count">{newOrders.length}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="tiny-coffee">
              <Coffee size={22} />
            </div>
            <h3>A little more flow.</h3>
            <p>
              Less busywork.
              <br />
              More coffee moments.
            </p>
            <button onClick={data.createCafe}>
              Add your café <ArrowUpRight size={15} />
            </button>
          </div>
          <button
            className="nav-link support-link"
            onClick={() => setHelp(!help)}
          >
            <HelpCircle size={18} />
            Help & getting started
          </button>
          {help && (
            <div className="help-tip">
              Create a café, add your menu, then share your customer menu link.
              New orders appear in your inbox automatically.
            </div>
          )}
          <div className="sidebar-footer">CRAFTED FOR YOUR EVERYDAY</div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active.label}</strong>
            {isSuperAdmin && (
              <ShieldCheck className="role-header-icon" size={15} />
            )}
          </div>
          <div className="topbar-actions">
            <div className="cafe-selector">
              <Coffee size={17} />
              <select
                aria-label="Selected café"
                value={ownCafe?.id || 0}
                onChange={e => selectCafe(Number(e.target.value))}
              >
                {!cafes.length && (
                  <option value={0}>The Daily Grind · Demo</option>
                )}
                {cafes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
            <div className="notification-wrap">
              <button
                className={`icon-button bell-button ${newOrders.length ? "has-alert" : ""}`}
                aria-label={`Notifications, ${newOrders.length} new orders`}
                onClick={() => setNotifications(!notifications)}
              >
                <Bell size={19} />
              </button>
              {notifications && (
                <div className="notification-popover">
                  <strong>Your order alerts</strong>
                  <p className="muted">
                    {isDemo
                      ? "Create your café to receive live alerts."
                      : `${newOrders.length} new order${newOrders.length === 1 ? "" : "s"} waiting for you.`}
                  </p>
                  {newOrders.slice(0, 5).map(o => (
                    <button
                      key={o.id}
                      onClick={() => {
                        navigate("/orders");
                        setNotifications(false);
                      }}
                    >
                      Order #{o.id}
                      <span>{o.customerName}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {user ? (
              <button
                className="avatar"
                title="Sign out"
                aria-label="Sign out"
                onClick={() => logout().then(() => toast.success("Signed out"))}
              >
                {(user.name || "C").slice(0, 1).toUpperCase()}
                <LogOut size={12} />
              </button>
            ) : (
              <button
                className="text-button sign-in"
                onClick={() => startLogin()}
              >
                Sign in
              </button>
            )}
          </div>
        </header>
        <main className="main-content">
          {data.error && (
            <div className="error-banner" role="alert">
              {data.error}
              <button onClick={refresh}>Try again</button>
            </div>
          )}
          {path === "/" && <Overview data={data} />}
          {path === "/cafes" && <CafesPage data={data} />}
          {path === "/menu" && <MenuPage data={data} />}
          {path === "/orders" && <OrdersPage data={data} />}
          {path === "/settings" && <SettingsPage data={data} />}
          {path === "/users" && isSuperAdmin && user && (
            <UserRolesPage currentUserId={user.id} />
          )}
          {!navLinks.some(l => l.path === path) && (
            <div className="empty-state">
              <h1>We couldn’t find that page.</h1>
              <Link className="btn primary" href="/">
                Back to overview
              </Link>
            </div>
          )}
          <footer className="main-footer">
            <span>A little more flow for your café.</span>
            <span>Made with care. Served with coffee.</span>
          </footer>
        </main>
      </div>
      <CafeForm
        open={create}
        onOpenChange={setCreate}
        onSaved={c => {
          selectCafe(c.id);
          refresh();
          navigate("/");
        }}
      />
    </div>
  );
}

function RegularUserHome({
  name,
  logout,
}: {
  name: string;
  logout: () => Promise<void>;
}) {
  return (
    <div className="role-home">
      <header className="role-home-header">
        <Link href="/" className="wordmark">
          <img src="/logo.svg" alt="" />
          caféflow<span className="wordmark-dot">.</span>
        </Link>
        <button
          className="btn secondary"
          onClick={() => logout().then(() => toast.success("Signed out"))}
        >
          Sign out
          <LogOut size={15} />
        </button>
      </header>
      <main className="role-home-content">
        <span className="eyebrow">YOUR NEXT COFFEE, CLOSER</span>
        <h1>Good things are on the menu, {name}.</h1>
        <p>
          Browse a café’s menu, choose your favorites, and send your order
          straight to the counter.
        </p>
        <Link className="btn primary" href="/c/the-daily-grind">
          Explore The Daily Grind <ArrowUpRight size={16} />
        </Link>
      </main>
      <footer className="role-home-footer">
        Caféflow <span>·</span> A little more flow for your café.
      </footer>
    </div>
  );
}
