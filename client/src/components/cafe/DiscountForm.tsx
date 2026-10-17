import { FormEvent, useEffect, useState } from "react";
import { Loader2, Percent, Tag } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";

export default function CategoryDiscountForm({
  open,
  onOpenChange,
  cafeId,
  initialCategory,
  initialPercent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cafeId: number;
  initialCategory?: string;
  initialPercent?: number;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const save = trpc.categoryDiscounts.save.useMutation({
    onSuccess: () => {
      toast.success("Category discount updated");
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
      <DialogContent className="editor-dialog discount-dialog">
        <DialogHeader>
          <div className="dialog-icon">
            <Tag size={22} />
          </div>
          <DialogTitle>A little treat for this category.</DialogTitle>
          <DialogDescription>
            Give every item in a category a discount. An item’s own discount
            takes precedence, so discounts never stack.
          </DialogDescription>
        </DialogHeader>
        <form
          key={`${initialCategory || "new"}-${initialPercent ?? 0}-${open}`}
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const category = String(form.get("category")).trim();
            const discountPercent = Number(form.get("discountPercent"));
            if (!category) {
              setError("Enter a category name.");
              return;
            }
            if (
              !Number.isInteger(discountPercent) ||
              discountPercent < 0 ||
              discountPercent > 100
            ) {
              setError("Enter a whole-number percentage between 0 and 100.");
              return;
            }
            save.mutate({ cafeId, category, discountPercent });
          }}
        >
          <label className="field">
            Menu category <span>*</span>
            <input
              name="category"
              required
              maxLength={80}
              defaultValue={initialCategory}
              placeholder="e.g. Coffee"
            />
            <small>
              Matches your item category exactly. Set the same name to update an
              existing category offer.
            </small>
          </label>
          <label className="field">
            Discount percentage <span>*</span>
            <div className="percent-input-wrap">
              <input
                name="discountPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                required
                defaultValue={initialPercent ?? 10}
                placeholder="10"
              />
              <Percent size={16} />
            </div>
            <small>
              Whole numbers only. Set to 0% to remove the category offer.
            </small>
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
                <Percent size={15} />
              )}{" "}
              Save category offer
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
