import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  Copy,
  Edit3,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Percent,
  Search,
  ShoppingBag,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { WorkspaceData } from "./Workspace";
import { CafeForm, ItemForm } from "@/components/cafe/Forms";
import CategoryDiscountForm from "@/components/cafe/DiscountForm";
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
  OrderStatus,
  discountedPriceCents,
  effectiveDiscountPercent,
  money,
  statusLabels,
  timeLabel,
} from "@/lib/cafe";

function DemoNotice({ data }: { data: WorkspaceData }) {
  return (
    <div className="demo-notice">
      <span className="demo-tag">DEMO CAFÉ</span>
      <span>
        This menu is a sample. Create your own café to edit items and receive
        orders.
      </span>
      <button onClick={data.createCafe}>
        Create your café <ArrowRight size={15} />
      </button>
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">
          <span className="little-line" />
          {eyebrow}
        </div>
        <h1>
          {title}
          <span className="serif-period">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function CafesPage({ data }: { data: WorkspaceData }) {
  const [edit, setEdit] = useState<Cafe>();
  return (
    <>
      <PageHeading
        eyebrow="YOUR LITTLE EMPIRE"
        title="A home for every café"
        description="One workspace. All the places you pour your heart into."
      >
        <button className="btn primary" onClick={data.createCafe}>
          <Plus size={16} />
          Create café
        </button>
      </PageHeading>
      {!data.cafes.length && (
        <div className="onboarding-card">
          <div className="onboarding-icon">
            <Store size={34} />
          </div>
          <h2>Your café belongs here.</h2>
          <p>
            Create your first café, curate a menu, and start taking orders.
            <br />
            We’ll keep the everyday details in one calm place.
          </p>
          <button className="btn primary" onClick={data.createCafe}>
            <Plus size={16} />
            Create my first café
          </button>
          <Link href="/c/the-daily-grind" className="subtle-link">
            Explore the sample customer menu <ArrowRight size={14} />
          </Link>
        </div>
      )}
      <div className="cafe-grid">
        {data.cafes.map(c => (
          <article className="panel managed-cafe" key={c.id}>
            <div className="managed-cafe-photo">
              {c.imageUrl ? (
                <img src={c.imageUrl} alt={c.name} />
              ) : (
                <Coffee size={48} />
              )}
              <span className={`open-badge ${c.isOpen ? "" : "closed"}`}>
                <i />
                {c.isOpen ? "Open for orders" : "Closed"}
              </span>
            </div>
            <div className="managed-cafe-body">
              <h2>{c.name}</h2>
              <p>{c.description || "A fresh chapter in your café story."}</p>
              <div className="profile-detail">
                <MapPin size={14} />
                {c.address || "No address added"}
              </div>
              <div className="cafe-card-actions">
                <button
                  className="btn primary"
                  onClick={() => {
                    data.selectCafe(c.id);
                    toast.success(`Switched to ${c.name}`);
                  }}
                >
                  Open workspace <ArrowRight size={14} />
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setEdit(c)}
                  aria-label={`Edit ${c.name}`}
                >
                  <Edit3 size={16} />
                </button>
              </div>
              <Link href={`/c/${c.slug}`} className="subtle-link">
                Customer menu <ExternalLink size={13} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <CafeForm
        open={!!edit}
        onOpenChange={o => {
          if (!o) setEdit(undefined);
        }}
        cafe={edit}
        onSaved={() => {
          data.refresh();
          setEdit(undefined);
        }}
      />
    </>
  );
}

export function MenuPage({ data }: { data: WorkspaceData }) {
  const [category, setCategory] = useState("All items");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState(false);
  const [item, setItem] = useState<MenuItem>();
  const [remove, setRemove] = useState<MenuItem>();
  const [categoryOffer, setCategoryOffer] = useState<{
    category?: string;
    percent?: number;
  } | null>(null);
  const categoryDiscountQuery = trpc.categoryDiscounts.list.useQuery(
    { cafeId: data.cafe?.id || 0 },
    { enabled: !!data.cafe && !data.demo, retry: false }
  );
  const categoryDiscounts = (categoryDiscountQuery.data || []) as {
    category: string;
    discountPercent: number;
  }[];
  const allCategories = Array.from(
    new Set([
      ...data.items.map(i => i.category),
      ...categoryDiscounts.map(d => d.category),
    ])
  ).sort();
  const toggle = trpc.menu.toggle.useMutation({
    onSuccess: () => {
      data.refresh();
      toast.success("Availability updated");
    },
    onError: e => toast.error(e.message),
  });
  const deletion = trpc.menu.remove.useMutation({
    onSuccess: () => {
      data.refresh();
      setRemove(undefined);
      toast.success("Item removed from the menu");
    },
    onError: e => toast.error(e.message),
  });
  const categories = [
    "All items",
    ...Array.from(new Set(data.items.map(i => i.category))),
  ];
  const filtered = data.items.filter(
    i =>
      (category === "All items" || i.category === category) &&
      `${i.name} ${i.description}`.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <>
      <PageHeading
        eyebrow="CURATED WITH CARE"
        title="The menu, made yours"
        description="The familiar favorites. The next big thing. All in one place."
      >
        <button
          className="btn primary"
          onClick={() => {
            if (data.demo) {
              data.createCafe();
              return;
            }
            setItem(undefined);
            setEditor(true);
          }}
        >
          <Plus size={16} />
          Add menu item
        </button>
      </PageHeading>
      {data.demo && <DemoNotice data={data} />}
      {!data.demo && data.cafe && (
        <section className="category-offers panel">
          <div className="category-offers-heading">
            <div className="offer-mark">
              <Percent size={18} />
            </div>
            <div>
              <h2>Category offers</h2>
              <p>
                Discount a whole category. An item’s own offer takes precedence,
                so they never stack.
              </p>
            </div>
            <button
              className="btn secondary"
              onClick={() => setCategoryOffer({})}
            >
              <Plus size={15} />
              Add category offer
            </button>
          </div>
          {allCategories.length ? (
            <div className="category-offer-list">
              {allCategories.map(name => {
                const percent =
                  categoryDiscounts.find(d => d.category === name)
                    ?.discountPercent || 0;
                const count = data.items.filter(
                  i => i.category === name
                ).length;
                return (
                  <div className="category-offer-row" key={name}>
                    <div className="offer-category-icon">
                      <Coffee size={15} />
                    </div>
                    <div className="offer-category-name">
                      <strong>{name}</strong>
                      <span>
                        {count} menu {count === 1 ? "item" : "items"}
                      </span>
                    </div>
                    {percent > 0 ? (
                      <span className="active-offer-pill">
                        <Percent size={12} />
                        {percent}% off
                      </span>
                    ) : (
                      <span className="no-offer-pill">No offer</span>
                    )}
                    <button
                      className="text-button offer-edit"
                      onClick={() =>
                        setCategoryOffer({ category: name, percent })
                      }
                    >
                      {percent ? "Edit offer" : "Add offer"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="category-offers-empty">
              Add a menu category first, then offer a percentage off everything
              in it.
            </p>
          )}
        </section>
      )}
      <div className="menu-toolbar">
        <div className="category-tabs">
          {categories.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={category === c ? "selected" : ""}
            >
              {c}
              {c === "All items" && <span>{data.items.length}</span>}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find a menu item…"
            aria-label="Search menu items"
          />
        </label>
      </div>
      {data.loading && (
        <div className="loading-state">
          <Loader2 className="spin" />
          Brewing your menu…
        </div>
      )}
      <div className="menu-grid">
        {filtered.map(i => (
          <article
            key={i.id}
            className={`menu-card panel ${!i.available ? "unavailable" : ""}`}
          >
            <div className="menu-image">
              {i.imageUrl ? (
                <img src={i.imageUrl} alt={i.name} />
              ) : (
                <Coffee size={44} />
              )}
              <span className={`availability ${i.available ? "" : "off"}`}>
                <i />
                {i.available ? "Available" : "Sold out"}
              </span>
            </div>
            <div className="menu-card-body">
              <div className="menu-item-top">
                <span className="item-category">{i.category}</span>
                {(() => {
                  const discount = effectiveDiscountPercent(
                    i.discountPercent,
                    i.categoryDiscountPercent
                  );
                  return (
                    <strong className={discount ? "sale-price" : ""}>
                      {discount > 0 && <del>{money(i.priceCents)}</del>}
                      {money(discountedPriceCents(i.priceCents, discount))}
                    </strong>
                  );
                })()}
              </div>
              {(() => {
                const discount = effectiveDiscountPercent(
                  i.discountPercent,
                  i.categoryDiscountPercent
                );
                return discount > 0 ? (
                  <div className="menu-discount-note">
                    <Percent size={11} />
                    {discount}% off ·{" "}
                    {i.discountPercent > 0 ? "item offer" : "category offer"}
                  </div>
                ) : null;
              })()}
              <h2>{i.name}</h2>
              <p>{i.description || "Made with a little extra care."}</p>
              <div className="menu-item-actions">
                <button
                  className="btn secondary"
                  onClick={() => {
                    if (data.demo) {
                      data.createCafe();
                      return;
                    }
                    setItem(i);
                    setEditor(true);
                  }}
                >
                  <Edit3 size={14} />
                  Edit item
                </button>
                <button
                  className={`availability-switch ${i.available ? "on" : ""}`}
                  role="switch"
                  aria-checked={i.available}
                  aria-label={`Availability of ${i.name}`}
                  disabled={data.demo || toggle.isPending}
                  onClick={() =>
                    toggle.mutate({
                      id: i.id,
                      cafeId: i.cafeId,
                      available: !i.available,
                    })
                  }
                >
                  <span />
                </button>
                {!data.demo && (
                  <button
                    className="icon-button delete-button"
                    aria-label={`Remove ${i.name}`}
                    onClick={() => setRemove(i)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
      {!data.loading && !filtered.length && (
        <div className="empty-state">
          <BookIcon />
          <h2>
            {search ? "No favorites found." : "Your menu is a blank canvas."}
          </h2>
          <p>
            {search
              ? "Try a different name or category."
              : "Add your first item and make someone’s day."}
          </p>
          <button
            className="btn primary"
            onClick={() => {
              if (data.demo) data.createCafe();
              else {
                setItem(undefined);
                setEditor(true);
              }
            }}
          >
            <Plus size={16} />
            Add menu item
          </button>
        </div>
      )}
      {data.cafe && (
        <ItemForm
          open={editor}
          onOpenChange={setEditor}
          cafeId={data.cafe.id}
          item={item}
          onSaved={data.refresh}
        />
      )}
      {data.cafe && (
        <CategoryDiscountForm
          open={!!categoryOffer}
          onOpenChange={open => {
            if (!open) setCategoryOffer(null);
          }}
          cafeId={data.cafe.id}
          initialCategory={categoryOffer?.category}
          initialPercent={categoryOffer?.percent}
          onSaved={data.refresh}
        />
      )}
      <Dialog
        open={!!remove}
        onOpenChange={o => {
          if (!o) setRemove(undefined);
        }}
      >
        <DialogContent className="editor-dialog">
          <DialogHeader>
            <DialogTitle>Take it off the menu?</DialogTitle>
            <DialogDescription>
              Remove {remove?.name} from your menu. Existing order summaries
              will stay unchanged.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-footer">
            <button
              className="btn secondary"
              onClick={() => setRemove(undefined)}
            >
              Keep item
            </button>
            <button
              className="btn danger"
              disabled={deletion.isPending}
              onClick={() =>
                remove &&
                deletion.mutate({ id: remove.id, cafeId: remove.cafeId })
              }
            >
              {deletion.isPending ? "Removing…" : "Remove item"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
function BookIcon() {
  return <Coffee size={30} />;
}

export function OrdersPage({ data }: { data: WorkspaceData }) {
  const [filter, setFilter] = useState("active");
  const [search, setSearch] = useState("");
  const update = trpc.orders.setStatus.useMutation({
    onSuccess: () => {
      data.refresh();
      toast.success("Order status updated");
    },
    onError: e => toast.error(e.message),
  });
  const orders = data.orders.filter(
    o =>
      (filter === "all" ||
        (filter === "active"
          ? ["new", "preparing", "ready"].includes(o.status)
          : o.status === filter)) &&
      `${o.id} ${o.customerName}`.toLowerCase().includes(search.toLowerCase())
  );
  const next: Partial<Record<OrderStatus, OrderStatus>> = {
    new: "preparing",
    preparing: "ready",
    ready: "completed",
  };
  const actions: Partial<Record<OrderStatus, string>> = {
    new: "Start preparing",
    preparing: "Mark as ready",
    ready: "Complete order",
  };
  return (
    <>
      <PageHeading
        eyebrow="FROM YOUR CUSTOMERS, WITH LOVE"
        title="Every order, in the flow"
        description="Fresh orders come in here. Keep customers in the loop."
      >
        <span className="live-indicator">
          <i />
          Updates every 8 seconds
        </span>
      </PageHeading>
      {data.demo && <DemoNotice data={data} />}
      <div className="menu-toolbar">
        <div className="category-tabs">
          {[
            { id: "active", name: "Active orders" },
            { id: "completed", name: "Completed" },
            { id: "cancelled", name: "Cancelled" },
            { id: "all", name: "All orders" },
          ].map(f => (
            <button
              key={f.id}
              className={filter === f.id ? "selected" : ""}
              onClick={() => setFilter(f.id)}
            >
              {f.name}
              {f.id === "active" && (
                <span>
                  {
                    data.orders.filter(o =>
                      ["new", "preparing", "ready"].includes(o.status)
                    ).length
                  }
                </span>
              )}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Search orders"
            placeholder="Name or order number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="order-grid">
        {orders.map(o => (
          <article key={o.id} className="panel order-card">
            <div className="order-card-head">
              <div>
                <span className="item-category">ORDER #{o.id}</span>
                <h2>{o.customerName}</h2>
              </div>
              <span className={`status-badge ${o.status}`}>
                <i />
                {statusLabels[o.status]}
              </span>
            </div>
            <div className="order-meta">
              <span>
                <Clock3 size={13} />
                {new Date(o.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                · {timeLabel(o.createdAt)}
              </span>
              <span>
                {o.serviceType === "dine-in"
                  ? `Table ${o.tableNumber}`
                  : "Takeaway"}
              </span>
            </div>
            <div className="order-lines">
              {o.items.map((i, index) => (
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
            {o.notes && (
              <p className="order-note">
                <strong>Customer note</strong>
                {o.notes}
              </p>
            )}
            <div className="order-total">
              <span>Total · Pay at café</span>
              <strong>{money(o.totalCents)}</strong>
            </div>
            {next[o.status] && (
              <div className="order-card-actions">
                <button
                  className="btn primary"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({
                      id: o.id,
                      cafeId: o.cafeId,
                      status: next[o.status]!,
                    })
                  }
                >
                  <Check size={15} />
                  {actions[o.status]}
                </button>
                <button
                  className="text-button cancel-order"
                  disabled={update.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Cancel order #${o.id}? This cannot be undone.`
                      )
                    )
                      update.mutate({
                        id: o.id,
                        cafeId: o.cafeId,
                        status: "cancelled",
                      });
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {!orders.length && (
        <div className="empty-state">
          <ShoppingBag size={32} />
          <h2>
            {filter === "active"
              ? "A quiet moment at the counter."
              : "Nothing here just yet."}
          </h2>
          <p>
            {data.demo
              ? "Your own café’s customer orders will appear here."
              : "Share your menu link. We’ll bring the orders to you."}
          </p>
          {data.cafe && (
            <Link className="btn secondary" href={`/c/${data.cafe.slug}`}>
              Open customer menu <ExternalLink size={15} />
            </Link>
          )}
        </div>
      )}
    </>
  );
}

export function SettingsPage({ data }: { data: WorkspaceData }) {
  const [edit, setEdit] = useState(false);
  const [copied, setCopied] = useState(false);
  const cafe = data.cafe;
  const copyLink = async () => {
    if (!cafe) return;
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/c/${cafe.slug}`
      );
      setCopied(true);
      toast.success("Customer menu link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy the menu link from the field below.");
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="THE DETAILS MAKE THE DIFFERENCE"
        title="A café with your character"
        description="A good first impression starts with the little things."
      >
        <button
          className="btn primary"
          onClick={() => (data.demo ? data.createCafe() : setEdit(true))}
        >
          <Edit3 size={16} />
          {data.demo ? "Create your café" : "Edit café details"}
        </button>
      </PageHeading>
      {data.demo && <DemoNotice data={data} />}
      {cafe && (
        <div className="settings-columns">
          <section className="panel settings-panel">
            <div className="panel-heading">
              <h2>Café details</h2>
              <Store size={19} />
            </div>
            <dl>
              <dt>Café name</dt>
              <dd>{cafe.name}</dd>
              <dt>Description</dt>
              <dd>{cafe.description || "Not added yet"}</dd>
              <dt>Address</dt>
              <dd>{cafe.address || "Not added yet"}</dd>
              <dt>Phone</dt>
              <dd>{cafe.phone || "Not added yet"}</dd>
              <dt>Opening hours</dt>
              <dd>{cafe.hours || "Not added yet"}</dd>
              <dt>Ordering status</dt>
              <dd>
                <span
                  className={`status-badge ${cafe.isOpen ? "ready" : "cancelled"}`}
                >
                  <i />
                  {cafe.isOpen ? "Open for orders" : "Closed for orders"}
                </span>
              </dd>
            </dl>
          </section>
          <div>
            <section className="panel share-panel">
              <div className="dialog-icon">
                <ExternalLink size={22} />
              </div>
              <h2>Your menu. One little link.</h2>
              <p>
                Share it on your socials, place it on the counter, or send it to
                your regulars.
              </p>
              <input
                className="link-input"
                aria-label="Customer menu link"
                value={`${window.location.origin}/c/${cafe.slug}`}
                readOnly
                onFocus={e => e.target.select()}
              />
              <button className="btn primary" onClick={copyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                {copied ? "Copied" : "Copy menu link"}
              </button>
              <Link className="subtle-link" href={`/c/${cafe.slug}`}>
                Visit your customer menu <ArrowRight size={14} />
              </Link>
            </section>
            <section className="panel payment-note">
              <Coffee size={21} />
              <div>
                <h3>Order here. Pay at the café.</h3>
                <p>
                  Customers submit their order online and pay when they visit.
                  No online payments are collected.
                </p>
              </div>
            </section>
          </div>
        </div>
      )}
      <CafeForm
        open={edit}
        onOpenChange={setEdit}
        cafe={cafe}
        onSaved={data.refresh}
      />
    </>
  );
}
