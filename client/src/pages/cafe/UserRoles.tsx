import { useState } from "react";
import { ShieldCheck, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const roleLabel = {
  super_admin: "Super Admin",
  cafe_admin: "Café Admin",
  user: "Normal User",
} as const;

export default function UserRolesPage({
  currentUserId,
}: {
  currentUserId: number;
}) {
  const [savingId, setSavingId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const users = trpc.users.list.useQuery(undefined, { retry: false });
  const updateRole = trpc.users.setRole.useMutation({
    onSuccess: async () => {
      await utils.users.list.invalidate();
      toast.success("User role updated");
    },
    onError: error => toast.error(error.message),
    onSettled: () => setSavingId(null),
  });

  return (
    <section className="main-content role-management">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="little-line" />
            ACCESS &amp; PERMISSIONS
          </div>
          <h1>
            People and roles<span className="serif-period">.</span>
          </h1>
          <p>Give every account the access it needs—nothing more.</p>
        </div>
      </div>

      <div className="role-guidance panel">
        <div className="role-guidance-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <strong>Three roles, clear boundaries</strong>
          <p>
            Super Admins can manage every café and assign roles. Café Admins
            manage only cafés they own. Normal Users can browse menus and place
            orders.
          </p>
        </div>
      </div>

      {users.isLoading ? (
        <div className="loading-state">
          <Loader2 className="spin" />
          Loading accounts…
        </div>
      ) : users.error ? (
        <div className="error-banner" role="alert">
          {users.error.message}
          <button onClick={() => users.refetch()}>Try again</button>
        </div>
      ) : (
        <div className="role-user-list">
          <div className="role-user-list-heading">
            <Users size={17} />
            <strong>Application accounts</strong>
            <span>{users.data?.length || 0}</span>
          </div>
          {users.data?.map(account => (
            <article className="role-user-row" key={account.id}>
              <div className="role-user-avatar" aria-hidden="true">
                {(account.name || account.email || "U")
                  .slice(0, 1)
                  .toUpperCase()}
              </div>
              <div className="role-user-identity">
                <strong>
                  {account.name || "Unnamed account"}
                  {account.id === currentUserId && (
                    <span className="you-label">YOU</span>
                  )}
                </strong>
                <span>{account.email || "No email on file"}</span>
              </div>
              <span className={`role-badge ${account.role}`}>
                {roleLabel[account.role]}
              </span>
              <label className="role-picker-label">
                <span className="sr-only">
                  Role for {account.name || account.email}
                </span>
                <select
                  className="role-select"
                  value={account.role}
                  disabled={
                    account.id === currentUserId ||
                    savingId === account.id ||
                    updateRole.isPending
                  }
                  onChange={event => {
                    const role = event.target.value as keyof typeof roleLabel;
                    setSavingId(account.id);
                    updateRole.mutate({ userId: account.id, role });
                  }}
                >
                  {Object.entries(roleLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          ))}
          {!users.data?.length && (
            <p className="role-users-empty">No accounts have signed in yet.</p>
          )}
        </div>
      )}
    </section>
  );
}
