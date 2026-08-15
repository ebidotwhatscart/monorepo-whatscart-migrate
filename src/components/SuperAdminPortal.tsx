import {
  Authenticated,
  Unauthenticated,
  SignInButton,
  UserButton,
} from "../lib/firebase/auth-ui";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import {
  useFirebaseAction as useAction,
  useFirebaseMutation as useMutation,
} from "../lib/firebase/mutations";
import {
  AlertTriangle,
  Building2,
  ExternalLink,
  KeyRound,
  Loader2,
  Power,
  PowerOff,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type Id } from "../lib/firebase/operations";
import { getErrorMessage } from "../lib/utils";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://whatscart.in";

type DeletionMode = "email" | "id";

type DeletionTarget = {
  mode: DeletionMode;
  identifier: string;
  businessName?: string;
};

type BusinessSummary = {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  ownerId: Id<"users">;
  ownerName: string;
  ownerEmail: string;
  ownerClerkId: string | null;
  productCount: number;
  orderCount: number;
  isEnabled: boolean;
};

export function SuperAdminPortal() {
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <Unauthenticated>
        <div className="flex min-h-screen items-center justify-center px-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <ShieldCheck size={24} />
            </div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              WhatsCart control centre
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Super admin sign in</h1>
            <p className="mt-3 text-slate-600">
              Manage every onboarded business from one secure workspace.
            </p>
            <SignInButton mode="modal">
              <button className="mt-8 w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800">
                Continue with Google
              </button>
            </SignInButton>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <SuperAdminWorkspace />
      </Authenticated>
    </div>
  );
}

function SuperAdminWorkspace() {
  const user = useQuery(api.auth.loggedInUser);
  const ensureUser = useMutation(api.auth.ensureUserExists);
  const businesses = useQuery(
    api.superAdmin.listBusinesses,
    user?.role === "super_admin" ? {} : "skip",
  );
  const [deletionTarget, setDeletionTarget] = useState<DeletionTarget | null>(null);

  useEffect(() => {
    if (user === null) {
      ensureUser().catch((error) => toast.error(getErrorMessage(error)));
    }
  }, [user, ensureUser]);

  if (
    user === undefined ||
    (user === null && businesses === undefined) ||
    (user?.role === "super_admin" && businesses === undefined)
  ) {
    return <LoadingState />;
  }

  if (user?.role !== "super_admin") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-lg">
          <ShieldCheck className="mx-auto text-rose-500" size={40} />
          <h1 className="mt-5 text-2xl font-semibold">Access restricted</h1>
          <p className="mt-2 text-slate-600">
            This account is not configured as a WhatsCart super admin.
          </p>
          <div className="mt-6">
            <UserButton />
          </div>
        </div>
      </div>
    );
  }

  const businessList = businesses ?? [];
  const totalProducts = businessList.reduce(
    (sum, business) => sum + business.productCount,
    0,
  );
  const totalOrders = businessList.reduce(
    (sum, business) => sum + business.orderCount,
    0,
  );
  const activeBusinesses = businessList.filter((business) => business.isEnabled).length;

  return (
    <div>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-semibold">WhatsCart</p>
              <p className="text-xs text-slate-500">Super admin control centre</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span className="hidden sm:inline">{user.email}</span>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Overview
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">All businesses</h1>
            <p className="mt-2 text-slate-600">
              Manage store availability or open a complete business dashboard.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() =>
                setDeletionTarget({ mode: "email", identifier: "" })
              }
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
            >
              <Trash2 size={16} />
              Delete user data
            </button>
            <a
              href={appUrl}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-950"
            >
              Open storefront app <ExternalLink size={16} />
            </a>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Building2 size={18} />} label="Businesses" value={businessList.length} />
          <Metric icon={<Power size={18} />} label="Active stores" value={activeBusinesses} />
          <Metric icon={<Store size={18} />} label="Products" value={totalProducts} />
          <Metric icon={<Users size={18} />} label="Orders" value={totalOrders} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="font-semibold">Onboarded businesses</h2>
            <p className="mt-1 text-sm text-slate-500">
              Disabled stores are hidden publicly while their dashboards and data remain available.
            </p>
          </div>
          {businessList.length ? (
            <div className="divide-y divide-slate-100">
              {businessList.map((business) => (
                <BusinessRow
                  key={business._id}
                  business={business}
                  onDeleteOwner={() =>
                    setDeletionTarget({
                      mode: business.ownerEmail ? "email" : "id",
                      identifier: business.ownerEmail || business.ownerId,
                      businessName: business.name,
                    })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="px-6 py-16 text-center text-slate-500">
              No businesses have been onboarded yet.
            </div>
          )}
        </div>
      </main>

      {deletionTarget && (
        <DeleteUserDataModal
          target={deletionTarget}
          onClose={() => setDeletionTarget(null)}
        />
      )}
    </div>
  );
}

function BusinessRow({
  business,
  onDeleteOwner,
}: {
  business: BusinessSummary;
  onDeleteOwner: () => void;
}) {
  const setBusinessEnabled = useMutation(api.superAdmin.setBusinessEnabled);
  const [isUpdating, setIsUpdating] = useState(false);
  const href = `/dashboard?businessId=${encodeURIComponent(business._id)}`;

  const handleStatusChange = async () => {
    const nextEnabled = !business.isEnabled;
    setIsUpdating(true);
    try {
      await setBusinessEnabled({ businessId: business._id, isEnabled: nextEnabled });
      toast.success(`${business.name} is now ${nextEnabled ? "enabled" : "disabled"}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-6 py-5 transition hover:bg-slate-50/70 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            business.isEnabled
              ? "bg-indigo-50 text-indigo-600"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <Building2 size={20} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{business.name}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                business.isEnabled
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
              }`}
            >
              {business.isEnabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 truncate text-sm text-slate-500">
            /{business.slug} · {business.ownerName}
            {business.ownerEmail ? ` · ${business.ownerEmail}` : " · Owner record missing"}
          </p>
          <div className="mt-2 flex gap-4 text-xs font-medium text-slate-500">
            <span>{business.productCount} products</span>
            <span>{business.orderCount} orders</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:pl-15 xl:pl-0">
        <button
          type="button"
          onClick={handleStatusChange}
          disabled={isUpdating}
          className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
            business.isEnabled
              ? "border-amber-200 bg-white text-amber-700 hover:bg-amber-50 focus:ring-amber-500"
              : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 focus:ring-emerald-500"
          }`}
        >
          {isUpdating ? (
            <Loader2 className="animate-spin" size={16} />
          ) : business.isEnabled ? (
            <PowerOff size={16} />
          ) : (
            <Power size={16} />
          )}
          {business.isEnabled ? "Disable" : "Enable"}
        </button>
        <a
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2"
        >
          Open dashboard <ExternalLink size={15} />
        </a>
        <button
          type="button"
          onClick={onDeleteOwner}
          aria-label={`Delete all data for ${business.ownerName}`}
          title="Delete owner and all owned stores"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function DeleteUserDataModal({
  target,
  onClose,
}: {
  target: DeletionTarget;
  onClose: () => void;
}) {
  const deleteUserData = useAction(api.adminDeletion.deleteUserAndOwnedDataByEmail);
  const [mode, setMode] = useState<DeletionMode>(target.mode);
  const [identifier, setIdentifier] = useState(target.identifier);
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDeleting, onClose]);

  const normalizedIdentifier = identifier.trim();
  const normalizedConfirmation = confirmation.trim();
  const confirmationMatches =
    mode === "email"
      ? normalizedIdentifier.toLowerCase() === normalizedConfirmation.toLowerCase()
      : normalizedIdentifier === normalizedConfirmation;
  const canDelete = Boolean(normalizedIdentifier && confirmationMatches && !isDeleting);

  const changeMode = (nextMode: DeletionMode) => {
    setMode(nextMode);
    setIdentifier("");
    setConfirmation("");
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const result =
        mode === "email"
          ? await deleteUserData({
              email: normalizedIdentifier,
              confirmEmail: normalizedConfirmation,
            })
          : await deleteUserData({
              id: normalizedIdentifier,
              confirmId: normalizedConfirmation,
            });

      toast.success(
        `Deleted ${result.businesses} store${result.businesses === 1 ? "" : "s"}, ${result.products} products, and the associated account data.`,
      );
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 px-4 pt-6 backdrop-blur-[2px] sm:items-center sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-user-title"
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 id="delete-user-title" className="text-lg font-semibold">
                Permanently delete user data
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {target.businessName
                  ? `This includes ${target.businessName} and every other store owned by this user.`
                  : "This removes the user and every store they own."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close deletion dialog"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">
            Products, orders, catalogs, carts, analytics, uploaded images, store details, and the user account will be removed. This cannot be undone.
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Find the user by</p>
            <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
              {(["email", "id"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeMode(option)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    mode === option
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {option === "email" ? "Email address" : "User ID"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              {mode === "email" ? <Users size={15} /> : <KeyRound size={15} />}
              {mode === "email" ? "User email" : "Convex or Clerk user ID"}
            </span>
            <input
              autoFocus
              type={mode === "email" ? "email" : "text"}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder={mode === "email" ? "owner@example.com" : "j57... or user_..."}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Type the {mode === "email" ? "email" : "ID"} again to confirm
            </span>
            <input
              type={mode === "email" ? "email" : "text"}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleDelete();
              }}
              className={`w-full rounded-xl border bg-white px-3.5 py-3 text-sm outline-none transition ${
                normalizedConfirmation && !confirmationMatches
                  ? "border-rose-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                  : "border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              }`}
            />
            {normalizedConfirmation && !confirmationMatches && (
              <span className="mt-2 block text-xs font-medium text-rose-600">
                The confirmation does not match.
              </span>
            )}
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-rose-300"
          >
            {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
            {isDeleting ? "Deleting everything…" : "Permanently delete"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-950" />
    </div>
  );
}
