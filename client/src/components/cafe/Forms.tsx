import { useEffect, useState } from "react";
import { Coffee, Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { Cafe, MenuItem } from "@/lib/cafe";

type CafeFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cafe?: Cafe;
  onSaved: (cafe: Cafe) => void;
};
export function CafeForm({ open, onOpenChange, cafe, onSaved }: CafeFormProps) {
  const [error, setError] = useState("");
  const save = trpc.cafes.save.useMutation({
    onSuccess: c => {
      toast.success(cafe ? "Café details updated" : "Your café is ready");
      onSaved(c as Cafe);
      onOpenChange(false);
    },
    onError: e => setError(e.message),
  });
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <div className="dialog-icon">
            <Coffee size={23} />
          </div>
          <DialogTitle>
            {cafe ? "Make it yours." : "Your next chapter starts here."}
          </DialogTitle>
          <DialogDescription>
            {cafe
              ? "Update the details customers see on your menu."
              : "Give your café a home. Your menu and orders will follow."}
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${cafe?.id || "new"}-${open}`}
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError("");
            save.mutate({
              id: cafe?.id,
              name: String(f.get("name")).trim(),
              description: String(f.get("description")).trim(),
              address: String(f.get("address")).trim(),
              phone: String(f.get("phone")).trim(),
              hours: String(f.get("hours")).trim(),
              imageUrl: String(f.get("imageUrl")).trim(),
              isOpen: f.get("isOpen") === "on",
            });
          }}
        >
          <label className="field">
            Café name <span>*</span>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={cafe?.name}
              placeholder="e.g. The Daily Grind"
            />
          </label>
          <label className="field">
            A little about your café
            <textarea
              name="description"
              maxLength={1000}
              defaultValue={cafe?.description}
              placeholder="Good coffee. Better company."
              rows={2}
            />
          </label>
          <label className="field">
            Address
            <input
              name="address"
              maxLength={300}
              defaultValue={cafe?.address}
              placeholder="Street address, neighborhood, city"
            />
          </label>
          <div className="form-row">
            <label className="field">
              Phone
              <input
                name="phone"
                maxLength={40}
                defaultValue={cafe?.phone}
                placeholder="+1 (555) 123-4567"
              />
            </label>
            <label className="field">
              Opening hours
              <input
                name="hours"
                maxLength={200}
                defaultValue={cafe?.hours}
                placeholder="Mon–Sun, 7 AM – 8 PM"
              />
            </label>
          </div>
          <label className="field">
            Café photo URL
            <input
              name="imageUrl"
              type="url"
              maxLength={2000}
              defaultValue={cafe?.imageUrl}
              placeholder="https://…"
            />
            <small>Add a publicly accessible photo link, or leave blank.</small>
          </label>
          <label className="checkbox-field">
            <input
              name="isOpen"
              type="checkbox"
              defaultChecked={cafe?.isOpen ?? true}
            />
            Open for customer orders
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Plus size={16} />
              )}{" "}
              {cafe ? "Save changes" : "Create café"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ItemForm({
  open,
  onOpenChange,
  cafeId,
  item,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cafeId: number;
  item?: MenuItem;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const save = trpc.menu.save.useMutation({
    onSuccess: () => {
      toast.success(item ? "Menu item updated" : "A new favorite added");
      onSaved();
      onOpenChange(false);
    },
    onError: e => setError(e.message),
  });
  useEffect(() => {
    if (open) setError("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="editor-dialog">
        <DialogHeader>
          <DialogTitle>
            {item ? "Refine a favorite." : "Something good for the menu."}
          </DialogTitle>
          <DialogDescription>
            Add the details that help customers find their next favorite.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${item?.id || "new"}-${open}`}
          onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const price = Number(f.get("price"));
            if (!Number.isFinite(price) || price < 0.01 || price > 10000) {
              setError("Enter a price between $0.01 and $10,000.");
              return;
            }
            save.mutate({
              id: item?.id,
              cafeId,
              name: String(f.get("name")).trim(),
              description: String(f.get("description")).trim(),
              category: String(f.get("category")).trim(),
              priceCents: Math.round(price * 100),
              discountPercent: Number(f.get("discountPercent")),
              imageUrl: String(f.get("imageUrl")).trim(),
              available: f.get("available") === "on",
            });
          }}
        >
          <label className="field">
            Item name <span>*</span>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={item?.name}
              placeholder="e.g. Oat milk flat white"
            />
          </label>
          <label className="field">
            Description
            <textarea
              name="description"
              maxLength={1000}
              defaultValue={item?.description}
              placeholder="A little detail goes a long way."
              rows={3}
            />
          </label>
          <div className="form-row">
            <label className="field">
              Price (USD) <span>*</span>
              <input
                name="price"
                type="number"
                required
                min="0.01"
                max="10000"
                step="0.01"
                defaultValue={item ? (item.priceCents / 100).toFixed(2) : ""}
                placeholder="4.50"
              />
            </label>
            <label className="field">
              Category <span>*</span>
              <input
                name="category"
                required
                maxLength={80}
                list="categories"
                defaultValue={item?.category || "Coffee"}
              />
              <datalist id="categories">
                <option>Coffee</option>
                <option>Tea & Matcha</option>
                <option>Pastries</option>
                <option>Food</option>
              </datalist>
            </label>
          </div>
          <label className="field">
            Item discount
            <div className="percent-input-wrap">
              <input
                name="discountPercent"
                type="number"
                required
                min="0"
                max="100"
                step="1"
                defaultValue={item?.discountPercent ?? 0}
              />
              <span>%</span>
            </div>
            <small>
              Enter a whole-number percentage from 0 to 100. At 0%, the category
              discount applies if one is set. Item and category discounts do not
              stack.
            </small>
          </label>
          <label className="field">
            Item photo URL
            <input
              name="imageUrl"
              type="url"
              maxLength={2000}
              defaultValue={item?.imageUrl}
              placeholder="https://…"
            />
          </label>
          <label className="checkbox-field">
            <input
              name="available"
              type="checkbox"
              defaultChecked={item?.available ?? true}
            />
            Available for customers to order
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-footer">
            <button
              type="button"
              className="btn secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button className="btn primary" disabled={save.isPending}>
              {save.isPending ? (
                <Loader2 className="spin" size={16} />
              ) : (
                <Save size={16} />
              )}{" "}
              {item ? "Save changes" : "Add menu item"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
