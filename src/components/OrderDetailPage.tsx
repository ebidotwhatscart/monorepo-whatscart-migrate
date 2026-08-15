import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import {
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Send,
  Star,
  XCircle,
} from "lucide-react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { toast } from "sonner";
import { useState } from "react";
import { api, type Id } from "../lib/firebase/operations";
import { storefrontPath, storefrontUrl } from "../lib/urls";
import {
  buildReviewRequestMessage,
  buildReviewWhatsAppUrl,
} from "../lib/reviews";
import { getErrorMessage } from "../lib/utils";
import {
  formatDeliveryAddress,
  getGoogleMapsLocationUrl,
  getLocationLabel,
} from "../lib/orderDetails";

type BusinessSummary = {
  _id: Id<"businesses">;
  whatsappPhone: string;
  slug?: string;
};

type OrderDetailPageProps = {
  business?: BusinessSummary;
};

function formatCurrency(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

export function OrderDetailPage({ business }: OrderDetailPageProps) {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const order = useQuery(
    api.orders.getBusinessOrderDetail,
    orderId ? { orderId: orderId as Id<"orders"> } : "skip",
  );
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);
  const setOrderBillingExclusion = useMutation(
    api.orders.setOrderBillingExclusion,
  );
  const createReviewRequest = useMutation(api.reviews.createReviewRequest);
  const moderateReview = useMutation(api.reviews.moderateReview);
  const reviewData = useQuery(
    api.reviews.getOrderReviews,
    orderId ? { orderId: orderId as Id<"orders"> } : "skip",
  );
  const [isOpeningFeedback, setIsOpeningFeedback] = useState(false);
  const [isUpdatingBilling, setIsUpdatingBilling] = useState(false);
  const [moderatingReviewId, setModeratingReviewId] =
    useState<Id<"productReviews"> | null>(null);

  if (order === undefined) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-green-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-sm font-medium text-slate-500">
        Order not found.
      </div>
    );
  }

  const handleStatusChange = async (status: string) => {
    try {
      await updateOrderStatus({ orderId: order._id, status });
      toast.success(`Order ${status}`);
    } catch {
      toast.error("Failed to update order");
    }
  };

  const handleBillingExclusionChange = async () => {
    const excluded = order.excludedFromBilling !== true;
    setIsUpdatingBilling(true);
    try {
      await setOrderBillingExclusion({ orderId: order._id, excluded });
      toast.success(
        excluded
          ? "Order excluded from billing and analytics"
          : "Order included in billing and analytics",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUpdatingBilling(false);
    }
  };

  const handleAskForFeedback = async () => {
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setIsOpeningFeedback(true);
    try {
      const request = await createReviewRequest({ orderId: order._id });
      if (request.status === "submitted") {
        popup?.close();
        toast.info("Feedback has already been submitted for this order.");
        return;
      }

      const businessSlug = order.business?.slug ?? business?.slug;
      if (!businessSlug) throw new Error("The storefront URL is unavailable.");
      const reviewUrl = storefrontUrl(businessSlug, `review/${request.token}`);
      const message = buildReviewRequestMessage({
        customerName: order.customerName,
        businessName: order.business?.name ?? "the store",
        orderNumber: order.orderId,
        items: items.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        totalAmount: order.totalAmount,
        reviewUrl,
      });
      const whatsappUrl = buildReviewWhatsAppUrl(order.customerMobile, message);

      if (popup) {
        popup.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }
      toast.success("Feedback message is ready in WhatsApp.");
    } catch (error) {
      popup?.close();
      toast.error(getErrorMessage(error));
    } finally {
      setIsOpeningFeedback(false);
    }
  };

  const handleModeration = async (
    reviewId: Id<"productReviews">,
    status: "pending" | "approved" | "rejected",
  ) => {
    setModeratingReviewId(reviewId);
    try {
      await moderateReview({ reviewId, status });
      toast.success(
        status === "approved"
          ? "Review published on the storefront."
          : status === "rejected"
            ? "Review hidden from the storefront."
            : "Review moved back to pending.",
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setModeratingReviewId(null);
    }
  };

  let whatsappHref = "";
  try {
    whatsappHref = buildReviewWhatsAppUrl(
      order.customerMobile,
      `Hi ${order.customerName}, regarding your order #${order.orderId}...`,
    );
  } catch {
    // The feedback action displays the detailed validation error when used.
  }
  const items = order.itemsDetailed ?? [];
  const feedbackRequest = reviewData?.request ?? null;
  const orderReviews = reviewData?.reviews ?? [];
  const canRequestFeedback = [
    "confirmed",
    "paid",
    "unpaid",
    "preparing",
    "ready",
    "delivered",
  ].includes(order.status);
  const locationUrl = getGoogleMapsLocationUrl(order.customerLocation);
  const locationLabel = getLocationLabel(order.customerLocation);
  const deliveryAddress = formatDeliveryAddress(order);
  const isPendingOrder = order.status === "pending";
  const isExcludedFromBilling = order.excludedFromBilling === true;

  return (
    <div className="min-h-screen bg-app pb-28">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard/orders")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-medium text-slate-500">Order detail</p>
            <h1 className="text-xl font-bold text-slate-900">
              #{order.orderId ?? order._id}
            </h1>
          </div>
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="space-y-1 flex-1">
              <p className="text-lg font-semibold text-slate-900">
                {order.customerName}
              </p>
              <p className="text-sm text-slate-600">{order.customerMobile}</p>
              {order.customerAlternateMobile && (
                <p className="text-sm text-slate-600">
                  Alternate: {order.customerAlternateMobile}
                </p>
              )}
              {deliveryAddress && (
                <p className="text-sm text-slate-600">{deliveryAddress}</p>
              )}
            </div>
            {order.customerLocation && (
              <div className="h-full flex-1">
                <div className="h-20 w-full overflow-hidden rounded-lg border border-slate-200">
                  <iframe
                    title="Map preview"
                    src={`https://www.google.com/maps?q=${order.customerLocation.latitude},${order.customerLocation.longitude}&output=embed`}
                    loading="lazy"
                    className="h-full w-full"
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Items</h2>
            <span className="text-sm font-medium text-slate-500">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {items.map((item: any, idx: number) => {
              const targetProductId = item.product?._id ?? item.productId;
              const hasImage = Boolean(
                item.product?.imageUrls?.[0] ?? item.image,
              );

              const content = (
                <>
                  {hasImage ? (
                    <img
                      src={item.product?.imageUrls?.[0] ?? item.image}
                      alt={item.name}
                      className="h-20 w-20 rounded-xl border border-slate-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-slate-400 text-xs font-bold">
                      External
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-950">
                        {item.name}
                      </p>
                      {!item.productId && (
                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200/50">
                          External Item
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      {item.product?.category?.name ??
                        (item.productId ? "Product" : "Custom Item")}
                    </p>
                    {item.customizationNotes?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-slate-500">
                        {item.customizationNotes.map((line: string) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-3 flex items-end justify-between">
                      <span className="text-xs font-medium text-slate-500">
                        Qty: {item.quantity}
                      </span>
                      <span className="text-sm font-bold text-slate-950">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </>
              );

              return targetProductId ? (
                <button
                  key={`${order._id}-${targetProductId}-${idx}`}
                  type="button"
                  onClick={() =>
                    navigate(`products/${targetProductId}`, {
                      state: { backgroundLocation: location },
                    })
                  }
                  aria-label={`Open product ${item.name}`}
                  className="flex w-full gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left"
                >
                  {content}
                </button>
              ) : (
                <div
                  key={`${order._id}-custom-${idx}`}
                  className="flex w-full gap-4 rounded-2xl border border-slate-100 bg-white p-4 text-left"
                >
                  {content}
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-500">Total</span>
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(order.totalAmount ?? 0)}
            </span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="mt-1 text-base font-semibold capitalize text-slate-900">
              {order.status}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">
              Order Source
            </p>
            <span
              className={`mt-1 inline-block text-xs font-semibold px-2.5 py-1 rounded-md ${
                order.source === "manual"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {order.source === "manual" ? "Offline / Manual" : order.source}
            </span>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                isExcludedFromBilling
                  ? "bg-amber-50 text-amber-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              <BadgeDollarSign className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Billing &amp; analytics
                </h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    isExcludedFromBilling
                      ? "bg-amber-50 text-amber-700"
                      : "bg-green-50 text-green-700"
                  }`}
                >
                  {isExcludedFromBilling ? "Excluded" : "Included"}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {isExcludedFromBilling
                  ? "This order stays in your history but does not count toward billing, revenue, or analytics."
                  : "This order currently counts toward billing, revenue, and analytics."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleBillingExclusionChange()}
            disabled={isUpdatingBilling}
            className={`mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
              isExcludedFromBilling
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-800"
            }`}
          >
            {isUpdatingBilling && <Loader2 className="h-4 w-4 animate-spin" />}
            {isExcludedFromBilling
              ? "Include in billing"
              : "Exclude from billing"}
          </button>
        </section>

        <section
          aria-labelledby="customer-feedback-heading"
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <div>
              <h2
                id="customer-feedback-heading"
                className="text-sm font-bold uppercase tracking-[0.12em] text-slate-900"
              >
                Customer feedback
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {feedbackRequest?.status === "submitted"
                  ? `${orderReviews.length} review${orderReviews.length === 1 ? "" : "s"} received`
                  : feedbackRequest?.status === "open"
                    ? "Request sent — waiting for the customer"
                    : "No feedback request sent yet"}
              </p>
            </div>
            {feedbackRequest?.status !== "submitted" && canRequestFeedback && (
              <button
                type="button"
                onClick={() => void handleAskForFeedback()}
                disabled={
                  isOpeningFeedback ||
                  !items.some((item: any) => Boolean(item.productId))
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#056664] px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isOpeningFeedback ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {feedbackRequest?.status === "open"
                  ? "Send again"
                  : "Ask for feedback"}
              </button>
            )}
          </div>

          {reviewData === undefined ? (
            <div className="flex h-28 items-center justify-center rounded-2xl bg-white shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin text-[#3DAC35]" />
            </div>
          ) : orderReviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-7 text-center shadow-sm">
              <MessageCircle className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {feedbackRequest?.status === "open"
                  ? "Waiting for feedback"
                  : "Reviews will appear here"}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                The customer reviews every purchased product from one secure
                link.
              </p>
            </div>
          ) : (
            orderReviews.map((review) => {
              const isModerating = moderatingReviewId === review._id;
              return (
                <article
                  key={review._id}
                  className="overflow-hidden rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_28px_rgba(14,23,38,0.07)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        Feedback for
                      </p>
                      <h3 className="mt-0.5 text-xl font-bold leading-6 text-slate-950">
                        {review.productName}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                        review.status === "approved"
                          ? "bg-green-50 text-green-700"
                          : review.status === "rejected"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {review.status === "rejected" ? "Hidden" : review.status}
                    </span>
                  </div>

                  <p className="mt-5 text-sm font-medium text-slate-600">
                    Are you satisfied with the product?
                  </p>
                  <div
                    className="mt-2 flex gap-1"
                    aria-label={`${review.rating} out of 5 stars`}
                  >
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Star
                        key={rating}
                        className="h-8 w-8"
                        fill={
                          rating <= review.rating ? "#F7B928" : "transparent"
                        }
                        stroke={rating <= review.rating ? "#F7B928" : "#CBD2D3"}
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  {review.comment && (
                    <div className="mt-5">
                      <p className="text-sm font-bold text-slate-900">Review</p>
                      <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                        {review.comment}
                      </p>
                    </div>
                  )}

                  {review.imageUrls.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500">
                        Customer photos
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {review.imageUrls.map((url: string, index: number) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              src={url}
                              alt={`Customer photo ${index + 1} for ${review.productName}`}
                              className="h-[77px] w-[77px] rounded-xl object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {review.customerName}
                      </p>
                      <time className="text-xs text-slate-500">
                        {new Intl.DateTimeFormat("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(review.submittedAt))}
                      </time>
                    </div>

                    {review.status === "pending" && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void handleModeration(review._id, "rejected")
                          }
                          disabled={isModerating}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
                        >
                          <EyeOff className="h-4 w-4" />
                          Hide review
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleModeration(review._id, "approved")
                          }
                          disabled={isModerating}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#3DAC35] px-3 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {isModerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          Publish review
                        </button>
                      </div>
                    )}

                    {review.status === "approved" && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleModeration(review._id, "pending")
                        }
                        disabled={isModerating}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
                      >
                        {isModerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        Unpublish review
                      </button>
                    )}

                    {review.status === "rejected" && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleModeration(review._id, "pending")
                        }
                        disabled={isModerating}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 text-xs font-bold text-slate-700 disabled:opacity-50"
                      >
                        {isModerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                        Unhide review
                      </button>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[428px] -translate-x-1/2 space-y-2 inset-x-0 bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row">
          {whatsappHref ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </a>
          ) : (
            <Link
              to={
                business?.slug
                  ? storefrontPath(business.slug)
                  : "/dashboard/orders"
              }
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white"
            >
              Back to orders
            </Link>
          )}
          {isPendingOrder && (
            <>
              <button
                type="button"
                onClick={() => handleStatusChange("confirmed")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-semibold text-white"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Order
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("cancelled")}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
              >
                <XCircle className="h-4 w-4" />
                Decline Order
              </button>
            </>
          )}
        </div>
      </div>

      <Outlet context={{ order, backgroundLocation: location }} />
    </div>
  );
}
