import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api } from "../lib/firebase/operations";
import {
  Check,
  Package,
  FileText,
  MapPin,
  NotebookPen,
  Download,
  MessageCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAddressSectionTitle,
  getCustomizationSectionTitle,
  formatDeliveryAddress,
  getGoogleMapsLocationUrl,
  getLocationLabel,
  getLocationSectionTitle,
  getOrderBusinessType,
} from "../lib/orderDetails";
import { storefrontPath } from "../lib/urls";
import {
  buildReferenceImagePath,
  extractConvexStorageFileId,
  extractReferenceImageUrlFromLine,
  isReferenceImageLine,
} from "../lib/orderFiles";
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppOrderUrl,
} from "../lib/whatsappOrder";

export function OrderSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const order = useQuery(api.orders.getOrderByOrderId, {
    orderId: orderId || "",
  });
  const userBusiness = useQuery(api.businesses.getUserBusiness, {});

  // Redirect business owner to dashboard — before rendering, no flash
  if (order && userBusiness !== undefined && userBusiness?._id === order.businessId) {
    navigate(`/dashboard/orders/${order._id}`, { replace: true });
    return null;
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your order...</p>
        </div>
      </div>
    );
  }

  const business = order.business;
  const businessType = getOrderBusinessType(business?.businessType);
  const addressSectionTitle = getAddressSectionTitle(businessType);
  const locationSectionTitle = getLocationSectionTitle(businessType);
  const customizationSectionTitle = getCustomizationSectionTitle(businessType);
  const locationUrl = getGoogleMapsLocationUrl(order.customerLocation);
  const locationLabel = getLocationLabel(order.customerLocation);
  const deliveryAddress = formatDeliveryAddress(order);
  const isAdminViewer =
    userBusiness !== undefined &&
    userBusiness !== null &&
    userBusiness._id === order.businessId;
  const statusForViewer = isAdminViewer ? order.status : "pending";
  const referenceImageLine = order.customizationNotes?.find((line: string) =>
    isReferenceImageLine(line),
  );
  const referenceImageUrl = referenceImageLine
    ? extractReferenceImageUrlFromLine(referenceImageLine)
    : "";
  const referenceImageFileId = referenceImageUrl
    ? extractConvexStorageFileId(referenceImageUrl)
    : "";
  const referenceImagePagePath =
    business?.slug && referenceImageFileId
      ? buildReferenceImagePath(business.slug, referenceImageFileId)
      : "";
  const visibleCustomizationNotes =
    order.customizationNotes?.filter(
      (line: string) => !isReferenceImageLine(line),
    ) ?? [];
  const orderLink = window.location.href;
  const whatsappMessage = buildWhatsAppOrderMessage({
    customerName: order.customerName,
    customerMobile: order.customerMobile,
    customerAlternateMobile: order.customerAlternateMobile,
    customerDoorNumber: order.customerDoorNumber,
    items: order.items,
    totalAmount: order.totalAmount,
    address: deliveryAddress,
    mapLink: locationUrl,
    notes: order.customerNotes || order.notes,
    customizationTitle: customizationSectionTitle,
    customizationNotes: visibleCustomizationNotes,
    orderLink,
    upiId: business?.upiId,
    businessName: business?.name,
    businessPhone: business?.whatsappPhone,
  });
  const retryWhatsAppUrl = business?.whatsappPhone
    ? buildWhatsAppOrderUrl(business.whatsappPhone, whatsappMessage)
    : "";

  const handleStatusChange = async (status: "confirmed" | "cancelled") => {
    try {
      await updateOrderStatus({ orderId: order._id, status });
      toast.success(
        status === "confirmed" ? "Order accepted" : "Order rejected",
      );
    } catch {
      toast.error("Failed to update order status");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            to={business?.slug ? storefrontPath(business.slug) : "/"}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium"
          >
            <span>&larr;</span>
            <span>{business?.name || "Back to Store"}</span>
          </Link>
          <span className="text-sm text-gray-500">Order Confirmed</span>
        </div>
      </header>

      <div className="py-8 px-4">
        {/* Success Header */}
        <div className="max-w-2xl mx-auto mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Order Placed Successfully!
            </h1>
            <p className="text-gray-600">Thank you for your order</p>
            <p
              className="text-lg font-semibold mt-2"
              style={{ color: business?.themeColor }}
            >
              Order ID: {order.orderId}
            </p>
          </div>
        </div>

        {/* Order Details */}
        <div className="max-w-2xl mx-auto space-y-6">
          {!isAdminViewer && retryWhatsAppUrl && (
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Your order is safely saved
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    If WhatsApp did not open or the message was lost, your order
                    and cart details are still safe. Send the same order again—
                    this will not create a duplicate order.
                  </p>
                  <a
                    href={retryWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 sm:w-auto"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry on WhatsApp
                  </a>
                </div>
              </div>
            </section>
          )}

          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Contact Information
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{order.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Mobile:</span>
                <span className="font-medium">{order.customerMobile}</span>
              </div>
              {order.customerAlternateMobile && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Alternate Mobile:</span>
                  <span className="font-medium">{order.customerAlternateMobile}</span>
                </div>
              )}
            </div>
          </div>

          {(deliveryAddress || order.customerLocation) && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Details
              </h2>

              {deliveryAddress && (
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {addressSectionTitle}
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {deliveryAddress}
                  </p>
                </div>
              )}

              {order.customerLocation && (
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {locationSectionTitle}
                  </p>
                  <p className="mt-1 font-medium text-gray-900">
                    {locationLabel}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {order.customerLocation.latitude.toFixed(5)},{" "}
                    {order.customerLocation.longitude.toFixed(5)}
                  </p>
                  {locationUrl && (
                    <a
                      href={locationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex text-sm font-medium text-green-700 underline"
                    >
                      Open shared location
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Items */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Items
            </h2>
            <div className="space-y-4">
              {order.items.map((item, index) => (
                <div key={index} className="flex gap-4 items-center">
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-sm text-gray-500">
                      Quantity: {item.quantity}
                    </p>
                    {item.customizationNotes?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-gray-500">
                        {item.customizationNotes.map((line: string) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {(order.customerNotes ||
            visibleCustomizationNotes.length > 0 ||
            referenceImagePagePath ||
            order.notes) && (
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-5">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <NotebookPen className="w-5 h-5" />
                Order Notes
              </h2>

              {order.customerNotes && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Notes</p>
                  <p className="mt-1 text-gray-900">{order.customerNotes}</p>
                </div>
              )}

              {visibleCustomizationNotes.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    {customizationSectionTitle}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-900">
                    {visibleCustomizationNotes.map((line: string) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {referenceImagePagePath && (
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Reference Image
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Link
                      to={referenceImagePagePath}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <Download className="h-4 w-4" />
                      View and download
                    </Link>
                  </div>
                </div>
              )}

              {!order.customerNotes &&
                visibleCustomizationNotes.length === 0 &&
                !referenceImagePagePath &&
                order.notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Notes</p>
                    <p className="mt-1 text-gray-900 whitespace-pre-line">
                      {order.notes}
                    </p>
                  </div>
                )}
            </div>
          )}

          {/* Order Status */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Order Status
            </h2>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  statusForViewer === "pending"
                    ? "bg-yellow-100 text-yellow-800"
                    : statusForViewer === "confirmed"
                      ? "bg-blue-100 text-blue-800"
                      : statusForViewer === "preparing"
                        ? "bg-purple-100 text-purple-800"
                        : statusForViewer === "ready"
                          ? "bg-indigo-100 text-indigo-800"
                          : statusForViewer === "delivered"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                }`}
              >
                {statusForViewer.charAt(0).toUpperCase() +
                  statusForViewer.slice(1)}
              </span>
              <span className="text-sm text-gray-500">
                {isAdminViewer
                  ? "Use the controls below to accept or reject this order."
                  : "We'll update you on your order status"}
              </span>
            </div>
            {isAdminViewer && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleStatusChange("confirmed")}
                  className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  <Check className="h-4 w-4" />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusChange("cancelled")}
                  className="inline-flex items-center gap-2 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              to={`/my-orders?mobile=${encodeURIComponent(order.customerMobile)}`}
              className="w-full px-6 py-3 rounded-lg text-gray-700 font-semibold border-2 border-gray-300 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <FileText className="w-5 h-5" />
              View My Orders
            </Link>

            <Link
              to={business?.slug ? storefrontPath(business.slug) : "/"}
              className="block text-center text-gray-600 hover:text-gray-900"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
