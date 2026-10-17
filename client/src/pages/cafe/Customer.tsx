import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  MapPin,
  Minus,
  Percent,
  Plus,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Cafe,
  MenuItem,
  Order,
  discountedPriceCents,
  effectiveDiscountPercent,
  money,
  statusLabels,
} from "@/lib/cafe";

function CustomerHeader() {
  return (
    <header className="customer-header">
      <Link href="/" className="wordmark">
        <img src="/logo.svg" alt="" />
        caféflow<span className="wordmark-dot">.</span>
      </Link>
      <Link href="/" className="subtle-link">
        Manage your café <ArrowRight size={15} />
      </Link>
    </header>
  );
}
function Quantity({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  label: string;
}) {
  return (
    <div className="quantity-control">
      <button
        aria-label={`Remove one ${label}`}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={13} />
      </button>
      <span>{value}</span>
      <button
        aria-label={`Add one ${label}`}
        disabled={value >= 30}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={13} />
      </button>
    </div>
  );
}

export function CustomerMenu({ slug }: { slug: string }) {
  const [, navigate] = useLocation();
  const query = trpc.cafes.publicBySlug.useQuery({ slug }, { retry: false });
  const cafe = query.data?.cafe as Cafe | undefined;
  const items = (query.data?.items || []) as MenuItem[];
  const available = items.filter(i => i.available);
  const storageKey = `cafeflow-cart-${slug}`;
  const [cart, setCart] = useState<Record<number, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  });
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [checkout, setCheckout] = useState(false);
  const [service, setService] = useState<"dine-in" | "takeaway">("takeaway");
  const [error, setError] = useState("");
  const idempotency = useRef({ signature: "", key: "" });
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(cart));
  }, [cart, storageKey]);
  const cartItems = available
    .filter(i => Number.isInteger(cart[i.id]) && cart[i.id] > 0)
    .map(i => {
      const discountPercent = effectiveDiscountPercent(
        i.discountPercent,
        i.categoryDiscountPercent
      );
      return {
        ...i,
        discountPercent,
        finalPriceCents: discountedPriceCents(i.priceCents, discountPercent),
        quantity: Math.min(30, cart[i.id]),
      };
    });
  const total = cartItems.reduce(
    (s, i) => s + i.finalPriceCents * i.quantity,
    0
  );
  const originalTotal = cartItems.reduce(
    (s, i) => s + i.priceCents * i.quantity,
    0
  );
  const count = cartItems.reduce((s, i) => s + i.quantity, 0);
  const change = (id: number, n: number) =>
    setCart(old => {
      const next = { ...old };
      if (n <= 0) delete next[id];
      else next[id] = Math.min(30, n);
      return next;
    });
  const place = trpc.orders.place.useMutation({
    onSuccess: r => {
      setCart({});
      localStorage.removeItem(storageKey);
      navigate(`/order/${r.publicToken}`);
    },
    onError: e => setError(e.message),
  });
  const categories = [
    "All",
    ...Array.from(new Set(available.map(i => i.category))),
  ];
  const filtered = available.filter(
    i =>
      (category === "All" || i.category === category) &&
      `${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase())
  );
  if (query.isLoading)
    return (
      <div className="customer-app">
        <CustomerHeader />
        <div className="loading-state">
          <Loader2 className="spin" />A fresh menu is on its way…
        </div>
      </div>
    );
  if (query.error || !cafe)
    return (
      <div className="customer-app">
        <CustomerHeader />
        <div className="empty-state">
          <Coffee size={36} />
          <h1>This café is a little out of reach.</h1>
          <p>{query.error?.message || "Check the menu link and try again."}</p>
          <button className="btn secondary" onClick={() => query.refetch()}>
            Try again
          </button>
          <Link href="/">Back to Caféflow</Link>
        </div>
      </div>
    );
  return (
    <div className="customer-app">
      <CustomerHeader />
      <main className="customer-content">
        <section className="customer-hero">
          <div>
            <div className="eyebrow">
              <span className="little-line" />
              YOUR NEIGHBORHOOD PAUSE
            </div>
            <h1>
              {cafe.name}
              <span className="serif-period">.</span>
            </h1>
            <p>{cafe.description || "Made with care. Served with a smile."}</p>
            <div className="customer-details">
              <span>
                <MapPin size={15} />
                {cafe.address || "Your neighborhood café"}
              </span>
              <span>
                <Clock3 size={15} />
                {cafe.hours || "Check with your café for opening hours"}
              </span>
            </div>
            <span
              className={`status-badge ${cafe.isOpen ? "ready" : "cancelled"}`}
            >
              <i />
              {cafe.isOpen
                ? "Open for orders"
                : "Not accepting orders right now"}
            </span>
          </div>
          {cafe.imageUrl && (
            <div className="customer-hero-photo">
              <img src={cafe.imageUrl} alt={cafe.name} />
              <span>GOOD COFFEE. GOOD COMPANY.</span>
            </div>
          )}
        </section>
        {cafe.ownerId === null && (
          <div className="demo-notice">
            <span className="demo-tag">SAMPLE CAFÉ</span>
            <span>
              This is a demonstration menu. Orders here are for trying out the
              app, not for a real café.
            </span>
          </div>
        )}
        <div className="customer-columns">
          <div className="customer-menu">
            <div className="section-heading">
              <div>
                <h2>A little something good</h2>
                <p>Find your favorite. Or meet your next one.</p>
              </div>
              <span className="muted">{available.length} items</span>
            </div>
            <div className="menu-toolbar customer-toolbar">
              <div className="category-tabs">
                {categories.map(c => (
                  <button
                    key={c}
                    className={category === c ? "selected" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Search size={16} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  aria-label="Search customer menu"
                  placeholder="Find a favorite…"
                />
              </label>
            </div>
            <div className="customer-item-grid">
              {filtered.map(i => (
                <article className="panel customer-item" key={i.id}>
                  <div className="customer-item-photo">
                    {i.imageUrl ? (
                      <img src={i.imageUrl} alt={i.name} />
                    ) : (
                      <Coffee size={42} />
                    )}
                    {effectiveDiscountPercent(
                      i.discountPercent,
                      i.categoryDiscountPercent
                    ) > 0 && (
                      <span className="customer-sale-badge">
                        <Percent size={12} />
                        {effectiveDiscountPercent(
                          i.discountPercent,
                          i.categoryDiscountPercent
                        )}
                        % off
                      </span>
                    )}
                  </div>
                  <div className="customer-item-body">
                    <span className="item-category">{i.category}</span>
                    <h3>{i.name}</h3>
                    <p>{i.description}</p>
                    <div className="customer-item-bottom">
                      <div className="customer-price-block">
                        {effectiveDiscountPercent(
                          i.discountPercent,
                          i.categoryDiscountPercent
                        ) > 0 && <del>{money(i.priceCents)}</del>}
                        <strong>
                          {money(
                            discountedPriceCents(
                              i.priceCents,
                              effectiveDiscountPercent(
                                i.discountPercent,
                                i.categoryDiscountPercent
                              )
                            )
                          )}
                        </strong>
                      </div>
                      {cart[i.id] > 0 ? (
                        <Quantity
                          value={cart[i.id]}
                          onChange={n => change(i.id, n)}
                          label={i.name}
                        />
                      ) : (
                        <button
                          className="add-item-button"
                          aria-label={`Add ${i.name} to order`}
                          disabled={!cafe.isOpen}
                          onClick={() => change(i.id, 1)}
                        >
                          <Plus size={16} />
                          Add
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {!filtered.length && (
              <div className="empty-state">
                <Coffee size={30} />
                <h2>No items just yet.</h2>
                <p>
                  {search
                    ? "Try another search."
                    : "The café is putting something good together."}
                </p>
              </div>
            )}
          </div>
          <aside className="cart-panel panel">
            <div className="panel-heading">
              <h2>Your little order</h2>
              <span className="small-count">{count}</span>
            </div>
            {!cartItems.length ? (
              <div className="cart-empty">
                <div>
                  <ShoppingBag size={30} />
                </div>
                <h3>Good things start here.</h3>
                <p>
                  Add a coffee, a little treat,
                  <br />
                  or a bit of both.
                </p>
              </div>
            ) : (
              <>
                <div className="cart-lines">
                  {cartItems.map(i => (
                    <div className="cart-line" key={i.id}>
                      <div className="cart-line-title">
                        <strong>{i.name}</strong>
                        <button
                          className="icon-button"
                          aria-label={`Remove ${i.name} from cart`}
                          onClick={() => change(i.id, 0)}
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="cart-line-bottom">
                        <Quantity
                          value={i.quantity}
                          onChange={n => change(i.id, n)}
                          label={i.name}
                        />
                        <span className="cart-line-prices">
                          {i.discountPercent > 0 && (
                            <del>{money(i.priceCents * i.quantity)}</del>
                          )}
                          <strong>
                            {money(i.finalPriceCents * i.quantity)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-total">
                  <span>
                    {originalTotal > total
                      ? `You save ${money(originalTotal - total)}`
                      : "Subtotal"}
                  </span>
                  <strong>
                    {originalTotal > total && <del>{money(originalTotal)}</del>}
                    {money(total)}
                  </strong>
                </div>
                <button
                  className="btn primary checkout-button"
                  disabled={!cafe.isOpen || place.isPending}
                  onClick={() => {
                    setError("");
                    setCheckout(true);
                  }}
                >
                  Review order <ArrowRight size={16} />
                </button>
              </>
            )}
            <div className="pay-note">
              <Coffee size={15} />
              <span>Order now. Pay at the café.</span>
            </div>
            <p className="cart-footnote">
              A little care goes into every order.
            </p>
          </aside>
        </div>
        <footer className="customer-footer">
          <span>Good coffee. Less waiting.</span>
          <span>
            Powered by <Link href="/">caféflow.</Link>
          </span>
        </footer>
      </main>
      <Dialog
        open={checkout}
        onOpenChange={o => {
          if (!place.isPending) setCheckout(o);
        }}
      >
        <DialogContent
          className="editor-dialog checkout-dialog"
          showCloseButton={!place.isPending}
        >
          <DialogHeader>
            <DialogTitle>One good order, coming up.</DialogTitle>
            <DialogDescription>
              Tell the café who it’s for. Payment is made at the café.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!cartItems.length) {
                setError("Add at least one item to your order.");
                return;
              }
              const f = new FormData(e.currentTarget);
              const payload = {
                cafeId: cafe.id,
                customerName: String(f.get("customerName")).trim(),
                serviceType: service,
                tableNumber:
                  service === "dine-in"
                    ? String(f.get("tableNumber")).trim()
                    : "",
                notes: String(f.get("notes")).trim(),
                items: cartItems.map(i => ({
                  menuItemId: i.id,
                  quantity: i.quantity,
                })),
              };
              const signature = JSON.stringify(payload);
              if (idempotency.current.signature !== signature)
                idempotency.current = { signature, key: crypto.randomUUID() };
              setError("");
              place.mutate({
                ...payload,
                idempotencyKey: idempotency.current.key,
              });
            }}
          >
            <label className="field">
              Your name <span>*</span>
              <input
                name="customerName"
                required
                maxLength={100}
                placeholder="What should we call out?"
                disabled={place.isPending}
              />
            </label>
            <div className="service-options">
              <button
                type="button"
                className={service === "takeaway" ? "selected" : ""}
                disabled={place.isPending}
                onClick={() => setService("takeaway")}
              >
                Takeaway
              </button>
              <button
                type="button"
                className={service === "dine-in" ? "selected" : ""}
                disabled={place.isPending}
                onClick={() => setService("dine-in")}
              >
                Dine in
              </button>
            </div>
            {service === "dine-in" && (
              <label className="field">
                Table number <span>*</span>
                <input
                  name="tableNumber"
                  required
                  maxLength={30}
                  placeholder="e.g. 04"
                  disabled={place.isPending}
                />
              </label>
            )}
            <label className="field">
              Anything we should know?
              <textarea
                name="notes"
                maxLength={500}
                rows={2}
                placeholder="Special requests, allergies, or a little note…"
                disabled={place.isPending}
              />
              <small>
                Please confirm allergies directly with the café before ordering.
              </small>
            </label>
            <div className="checkout-summary">
              {cartItems.map(i => (
                <div key={i.id}>
                  <span>
                    {i.quantity} × {i.name}
                    {i.discountPercent > 0 && (
                      <small className="summary-discount">
                        {i.discountPercent}% off
                      </small>
                    )}
                  </span>
                  <strong className="checkout-line-price">
                    {i.discountPercent > 0 && (
                      <del>{money(i.quantity * i.priceCents)}</del>
                    )}
                    {money(i.quantity * i.finalPriceCents)}
                  </strong>
                </div>
              ))}
              <div className="checkout-total">
                <span>Total · Pay at café</span>
                <strong>{money(total)}</strong>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-footer">
              <button
                type="button"
                className="btn secondary"
                disabled={place.isPending}
                onClick={() => setCheckout(false)}
              >
                Back to menu
              </button>
              <button
                className="btn primary"
                disabled={place.isPending || !cartItems.length}
              >
                {place.isPending ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <Check size={16} />
                )}{" "}
                {place.isPending ? "Placing your order…" : "Place order"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OrderConfirmation({ token }: { token: string }) {
  const query = trpc.orders.byToken.useQuery(
    { token },
    { retry: false, refetchInterval: 8000 }
  );
  const order = query.data?.order as Order | undefined;
  const cafe = query.data?.cafe as Cafe | undefined;
  const stages = ["new", "preparing", "ready", "completed"];
  const stageIndex = order ? stages.indexOf(order.status) : 0;
  return (
    <div className="customer-app">
      <CustomerHeader />
      <main className="receipt-content">
        {query.isLoading ? (
          <div className="loading-state">
            <Loader2 className="spin" />
            Finding your order…
          </div>
        ) : query.error || !order ? (
          <div className="empty-state">
            <Coffee size={36} />
            <h1>We couldn’t find this order.</h1>
            <p>{query.error?.message || "Check your confirmation link."}</p>
            <button className="btn secondary" onClick={() => query.refetch()}>
              Try again
            </button>
          </div>
        ) : (
          <>
            <div
              className={`confirmation-icon ${order.status === "cancelled" ? "cancelled" : ""}`}
            >
              {order.status === "cancelled" ? (
                <X size={34} />
              ) : (
                <CheckCircle2 size={36} />
              )}
            </div>
            <div className="eyebrow">{cafe?.name}</div>
            <h1>
              {order.status === "cancelled"
                ? "This order was cancelled."
                : order.status === "ready"
                  ? "Your good things are ready."
                  : order.status === "completed"
                    ? "Enjoy every little sip."
                    : "Good things are on their way."}
            </h1>
            <p className="receipt-subtitle">
              {order.status === "cancelled"
                ? "Please contact the café if you have any questions."
                : `Thanks, ${order.customerName}. Your order is with the café.`}
            </p>
            <div className="receipt-number">
              ORDER #{order.id}
              <span className={`status-badge ${order.status}`}>
                <i />
                {statusLabels[order.status]}
              </span>
            </div>
            {order.status !== "cancelled" && (
              <div className="order-progress">
                {["Received", "Preparing", "Ready", "Completed"].map(
                  (label, index) => (
                    <div
                      key={label}
                      className={index <= stageIndex ? "done" : ""}
                    >
                      <span>
                        {index < stageIndex ? <Check size={14} /> : index + 1}
                      </span>
                      <small>{label}</small>
                    </div>
                  )
                )}
              </div>
            )}
            <section className="panel receipt-panel">
              <div className="panel-heading">
                <h2>Your order, at a glance</h2>
                <ShoppingBag size={19} />
              </div>
              <div className="receipt-meta">
                <div>
                  <span>FOR</span>
                  <strong>{order.customerName}</strong>
                </div>
                <div>
                  <span>ORDER TYPE</span>
                  <strong>
                    {order.serviceType === "dine-in"
                      ? `Dine in · Table ${order.tableNumber}`
                      : "Takeaway"}
                  </strong>
                </div>
              </div>
              <div className="order-lines">
                {order.items.map((i, index) => (
                  <div key={index}>
                    <span>
                      <b>{i.quantity}×</b> {i.name}
                      {(i.discountPercent || 0) > 0 && (
                        <small className="summary-discount">
                          {i.discountPercent}% off
                        </small>
                      )}
                    </span>
                    <strong className="checkout-line-price">
                      {i.listPriceCents && i.listPriceCents > i.priceCents && (
                        <del>{money(i.listPriceCents * i.quantity)}</del>
                      )}
                      {money(i.priceCents * i.quantity)}
                    </strong>
                  </div>
                ))}
              </div>
              {order.notes && (
                <p className="order-note">
                  <strong>Your note</strong>
                  {order.notes}
                </p>
              )}
              <div className="order-total">
                <span>Total · Pay at café</span>
                <strong>{money(order.totalCents)}</strong>
              </div>
              <div className="receipt-payment">
                <Coffee size={18} />
                <span>
                  No payment has been collected. Please pay at the café.
                </span>
              </div>
            </section>
            <p className="receipt-live">
              <span className="small-dot" />
              This page refreshes your order status automatically.
            </p>
            {cafe?.ownerId === null && (
              <p className="demo-receipt-note">
                This is a demonstration order, not an order at a real café.
              </p>
            )}
            {cafe && (
              <Link className="btn secondary" href={`/c/${cafe.slug}`}>
                <ArrowLeft size={15} />
                Back to the menu
              </Link>
            )}
            <p className="receipt-privacy">
              Keep this link to check your order. Anyone with it can view the
              summary.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
