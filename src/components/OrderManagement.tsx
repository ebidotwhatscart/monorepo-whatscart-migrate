import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api, type Id } from "../lib/firebase/operations";
import {
  CheckCircle,
  Loader2,
  Package,
  Plus,
  Search,
  Send,
  User,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CreateManualOrderModal } from "./CreateManualOrderModal";
import {
  buildReviewRequestMessage,
  buildReviewWhatsAppUrl,
} from "../lib/reviews";
import { storefrontUrl } from "../lib/urls";
import { getErrorMessage } from "../lib/utils";

interface OrderManagementProps {
  businessId: Id<"businesses">;
  business?: {
    name: string;
    slug: string;
  };
}

type FilterTab = "all" | "confirmed" | "pending";

export function OrderManagement({ businessId, business }: OrderManagementProps) {
  const navigate = useNavigate();
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const orders = useQuery(api.orders.getBusinessOrders, { businessId });
  const reviewRequestStates = useQuery(
    api.reviews.getBusinessReviewRequestStates,
    { businessId },
  );
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);
  const createReviewRequest = useMutation(api.reviews.createReviewRequest);
  const [sharingOrderId, setSharingOrderId] = useState<string | null>(null);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus({ orderId, status: newStatus });
      toast.success(`Order ${newStatus}`);
    } catch {
      toast.error("Failed to update order");
    }
  };

  const handleShareFeedback = async (order: any) => {
    if (!business) {
      toast.error("The storefront details are unavailable.");
      return;
    }

    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setSharingOrderId(order._id);
    try {
      const request = await createReviewRequest({ orderId: order._id });
      if (request.status === "submitted") {
        popup?.close();
        navigate(`/dashboard/orders/${order._id}`);
        return;
      }

      const reviewUrl = storefrontUrl(
        business.slug,
        `review/${request.token}`,
      );
      const message = buildReviewRequestMessage({
        customerName: order.customerName,
        businessName: business.name,
        orderNumber: order.orderId,
        items: (order.items ?? []).map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: order.totalAmount,
        reviewUrl,
      });
      const whatsappUrl = buildReviewWhatsAppUrl(
        order.customerMobile,
        message,
      );
      if (popup) popup.location.href = whatsappUrl;
      else window.location.href = whatsappUrl;
      toast.success("Feedback message is ready in WhatsApp.");
    } catch (error) {
      popup?.close();
      toast.error(getErrorMessage(error));
    } finally {
      setSharingOrderId(null);
    }
  };

  if (!orders) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
      </div>
    );
  }

  const filtered = orders.filter((o) => {
    const matchesTab =
      filterTab === "all" ||
      (filterTab === "confirmed" &&
        (o.status === "confirmed" ||
          o.status === "paid" ||
          o.status === "unpaid")) ||
      (filterTab === "pending" && o.status === "pending");

    const matchesSearch =
      !search ||
      o.orderId?.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName?.toLowerCase().includes(search.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all", label: "All" },
    { id: "confirmed", label: "Confirmed" },
    { id: "pending", label: "Pending" },
  ];

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return (
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }) +
      " • " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    );
  };

  const summariseItems = (items: any[]) =>
    items.map((i) => `${i.quantity}x ${i.name}`).join(", ");

  const reviewStatusByOrderId = new Map(
    (reviewRequestStates ?? []).map((request) => [
      request.orderId,
      request.status,
    ]),
  );

  return (
    <div className="h-full bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-900">Orders</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-green-500 px-3 py-2 text-xs font-bold text-white shadow-xs hover:bg-green-600 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Record Offline Order</span>
            </button>
            <button
              onClick={() => setShowSearch((v) => !v)}
              className="p-2 rounded-full hover:bg-gray-100 transition"
            >
              <Search className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID or customer..."
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-gray-100 text-sm outline-none border-none placeholder:text-gray-400"
            />
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative whitespace-nowrap ${
                filterTab === tab.id ? "text-green-600" : "text-gray-400"
              }`}
            >
              {tab.label}
              {filterTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-24">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">
              No orders here
            </p>
          </div>
        ) : (
          filtered.map((order) => (
            <OrderCard
              key={order._id}
              order={order}
              onStatusChange={handleStatusChange}
              formatDate={formatDate}
              summariseItems={summariseItems}
              reviewStatus={reviewStatusByOrderId.get(order._id)}
              isSharingFeedback={sharingOrderId === order._id}
              onShareFeedback={handleShareFeedback}
            />
          ))
        )}
      </div>

      {/* Create Manual Order Modal */}
      <CreateManualOrderModal
        businessId={businessId}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}

function OrderCard({
  order,
  onStatusChange,
  formatDate,
  summariseItems,
  reviewStatus,
  isSharingFeedback,
  onShareFeedback,
}: {
  order: any;
  onStatusChange: (id: string, status: string) => void;
  formatDate: (ts: number) => string;
  summariseItems: (items: any[]) => string;
  reviewStatus?: "open" | "submitted";
  isSharingFeedback: boolean;
  onShareFeedback: (order: any) => void;
}) {
  const navigate = useNavigate();
  const status = order.status ?? "pending";
  const isDeclined = status === "cancelled" || status === "declined";
  const isConfirmed =
    status === "confirmed" ||
    status === "paid" ||
    status === "unpaid" ||
    status === "preparing" ||
    status === "ready" ||
    status === "delivered";
  const isPending = status === "pending";
  const hasSubmittedFeedback = reviewStatus === "submitted";

  // Visual treatment per status
  const orderIdClass = isDeclined
    ? "line-through text-gray-400"
    : "text-gray-900";
  const dateClass = isDeclined ? "line-through text-gray-400" : "text-gray-500";
  const amountClass = isDeclined
    ? "line-through text-green-400"
    : isConfirmed
      ? "text-green-600"
      : "text-indigo-600";
  const statusDot = isConfirmed ? "bg-green-500" : null;

  const openOrder = () => {
    navigate(`/dashboard/orders/${order._id}`);
  };

  return (
    <div className="w-full overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
      {/* Top section */}
      <button
        type="button"
        onClick={openOrder}
        aria-label={`View order ${order.orderId ?? order._id}`}
        className="block w-full cursor-pointer text-left"
      >
        <div className="px-4 pt-4 pb-3">
          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-2">
              {statusDot && (
                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#3DAC35]" />
              )}
              <span className={`text-base font-bold ${orderIdClass}`}>
                #{order.orderId ?? order._id.slice(-6).toUpperCase()}
              </span>
              {order.source === "manual" && (
                <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200/60">
                  Offline
                </span>
              )}
            </div>

            <div className="text-right">
              {isPending && (
                <span className="mb-1 inline-block rounded-lg bg-indigo-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  New Order
                </span>
              )}
              <p className={`text-lg font-bold leading-7 ${amountClass}`}>
                ₹{(order.totalAmount ?? 0).toFixed(2)}
              </p>
            </div>
          </div>

          <p className={`mb-4 text-xs ${dateClass}`}>
            {formatDate(order._creationTime ?? order.createdAt)}
          </p>

          {/* Customer row */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
              <User className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                {order.customerName}
              </p>
              <p className="line-clamp-1 text-sm leading-4 text-gray-500">
                {summariseItems(order.items ?? [])}
              </p>
            </div>
          </div>
        </div>
      </button>

      {/* Divider */}
      <div className="mx-4 border-t border-dashed border-slate-400" />

      {/* Actions */}
      <div className="px-4 py-3">
        {hasSubmittedFeedback ? (
          <button
            type="button"
            onClick={openOrder}
            className="flex w-full items-center justify-center rounded-lg bg-[#E5FFE3] px-4 py-3 text-sm font-bold text-[#3DAC35]"
          >
            View feedback form
          </button>
        ) : isPending ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onStatusChange(order._id, "confirmed")}
              className="w-full py-3 rounded-xl bg-green-500 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Paid/Confirmed
            </button>
            <button
              type="button"
              onClick={() => onStatusChange(order._id, "cancelled")}
              className="w-full py-3 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold border border-gray-200"
            >
              Decline Order
            </button>
          </div>
        ) : isConfirmed && !isDeclined ? (
          <button
            type="button"
            onClick={() => onShareFeedback(order)}
            disabled={isSharingFeedback}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#3DAC35] bg-white px-4 py-3 text-sm font-bold text-[#3DAC35] disabled:opacity-60"
          >
            {isSharingFeedback ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isSharingFeedback ? "Opening WhatsApp..." : "Share feedback form"}
          </button>
        ) : isDeclined ? (
          <p className="text-center text-sm text-gray-400 font-semibold py-1">
            Order Declined
          </p>
        ) : null}
      </div>
    </div>
  );
}
