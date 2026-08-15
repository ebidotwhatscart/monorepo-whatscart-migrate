import { useSearchParams, Link } from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { api } from "../lib/firebase/operations";
import { Package, Calendar, Phone, MapPin, CheckCircle, Clock, XCircle } from "lucide-react";
import { useState } from "react";
import { formatDeliveryAddress, getGoogleMapsLocationUrl, getLocationLabel } from "../lib/orderDetails";
import { storefrontPath } from "../lib/urls";

export function OrderHistoryPage() {
  const [searchParams] = useSearchParams();
  const mobile = searchParams.get("mobile");

  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);

  const orders = useQuery(api.orders.getOrdersByMobile, {
    mobile: mobile || "",
  });

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock };
      case "confirmed":
        return { label: "Confirmed", color: "bg-blue-100 text-blue-800", icon: CheckCircle };
      case "preparing":
        return { label: "Preparing", color: "bg-purple-100 text-purple-800", icon: Package };
      case "ready":
        return { label: "Ready for Pickup", color: "bg-indigo-100 text-indigo-800", icon: Package };
      case "delivered":
        return { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle };
      case "cancelled":
        return { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle };
      default:
        return { label: status, color: "bg-gray-100 text-gray-800", icon: Clock };
    }
  };

  if (!mobile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600">No mobile number provided</p>
          <Link to="/" className="inline-block mt-4 px-4 py-2 bg-primary text-white rounded-lg">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (!orders) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
          <p className="text-gray-600">Tracking orders for {mobile}</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No orders yet</h2>
            <p className="text-gray-600 mb-6">Start shopping to see your orders here</p>
            <Link
              to={`/`}
              className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-medium"
            >
              Browse Stores
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;
              const locationUrl = getGoogleMapsLocationUrl(order.customerLocation);
              const locationLabel = getLocationLabel(order.customerLocation);
              const deliveryAddress = formatDeliveryAddress(order);

              return (
                <div
                  key={order._id}
                  className="bg-white rounded-lg shadow-sm overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{order.orderId}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleDateString()} at{" "}
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Order Content */}
                  <div className="p-4">
                    {/* Business Info */}
                    {order.business && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-600">From:</p>
                        <Link
                          to={storefrontPath(order.business.slug)}
                          className="font-medium text-gray-900 hover:text-primary"
                        >
                          {order.business.name}
                        </Link>
                      </div>
                    )}

                    {/* Items */}
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 mb-2">Items:</p>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={index} className="text-sm">
                            <div className="flex justify-between items-center">
                              <span className="flex-1">
                                {item.name} x{item.quantity}
                              </span>
                              <span className="font-medium">
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </span>
                            </div>
                            {item.customizationNotes?.length ? (
                              <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-gray-500">
                                {item.customizationNotes.map((line: string) => (
                                  <li key={line}>{line}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-2 border-t">
                      <span className="font-medium text-gray-900">Total</span>
                      <span className="font-bold text-lg text-gray-900">
                        ₹{order.totalAmount.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Expand Details Button */}
                  <button
                    onClick={() => setSelectedOrder(selectedOrder === order._id ? null : order._id as string)}
                    className="w-full px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    {selectedOrder === order._id ? "Hide Details" : "View Details"}
                  </button>

                  {/* Expanded Details */}
                  {selectedOrder === order._id && (
                    <div className="p-4 bg-gray-50 border-t space-y-4">
                      {/* Customer Info */}
                      <div>
                        <p className="text-sm font-medium text-gray-900 mb-2">Delivery Details:</p>
                        <div className="space-y-1 text-sm">
                          <p className="flex items-center gap-2">
                            <span className="text-gray-600">Name:</span>
                            <span className="font-medium">{order.customerName}</span>
                          </p>
                          <p className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{order.customerMobile}</span>
                          </p>
                          {order.customerAlternateMobile && (
                            <p className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">Alternate: {order.customerAlternateMobile}</span>
                            </p>
                          )}
                          <p className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                            <span className="font-medium">
                              {deliveryAddress || "No typed address shared"}
                            </span>
                          </p>
                          {order.customerLocation && (
                            <p className="flex items-start gap-2">
                              <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                              <a
                                href={locationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-green-700 underline"
                              >
                                {locationLabel}
                              </a>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      {order.notes && (
                        <div>
                          <p className="text-sm font-medium text-gray-900 mb-1">Notes:</p>
                          <p className="text-sm text-gray-600">{order.notes}</p>
                        </div>
                      )}

                      {/* WhatsApp Link */}
                      {order.business && (
                        <a
                          href={`https://wa.me/${order.business.whatsappPhone}?text=${encodeURIComponent(
                            `Hi! Regarding my order ${order.orderId}...`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-green-600 hover:text-green-700 font-medium text-sm"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.149-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.074-.646-.282-1.232-.526-.598-.25-.992-.36-1.125-.38-.133-.022-.266-.044-.398-.045-.132-.001-.263.019-.398.045-.135.026-.527.199-1.019.524-.492.324-.856.766-1.057 1.224-.201.458-.237.914-.148 1.224.089.31.267.633.532.965l.645.768c.424.506.888.95 1.386 1.342.498.392.974.663 1.418.816.444.153.944.23 1.457.268.513.038 1.07.046 1.576.026.506-.02 1.006-.089 1.485-.22.48-.13.992-.382 1.373-.714.381-.332.685-.747.872-1.187.187-.44.288-.938.4-1.373.436-.435.036-.846.098-1.232.182-.386.084-.795.218-1.225.399-.43.181-.932.422-1.373.715-.441.293-.788.566-1.05.823-.261.257-.415.516-.46.775-.045.26-.068.518-.068.774 0 .256.023.514.068.773.045.26.199.52.46.777.261.257.609.53 1.05.823.44.292.943.432 1.373.715.43.181.839.334 1.225.399.386.064.797.096 1.232.182.435.085.938.147 1.373.148.435.001.846-.061 1.232-.182.386-.12.795-.302 1.225-.546.43-.244.748-.533.872-1.187.124-.654.237-1.224.616-1.733.379-.509.632-1.039.78-1.574l.645-.768c.424-.506.888-.95 1.386-1.342.498-.392.974-.663 1.418-.816.444-.153.944-.23 1.457-.268.513-.038 1.07-.046 1.576-.026.506.02 1.006.089 1.485.22.48.13.992.382 1.373.714.381.332.685.747.872 1.187.187.44.288.938.4 1.373.436.435.036.846-.098 1.232-.182.386-.084.795-.218 1.225-.399.43-.181.932-.422 1.373-.715.441-.293.788-.566 1.05-.823.261-.257.415-.516.46-.775.045-.26.068-.518.068-.774 0-.256-.023-.514-.068-.773-.045-.26-.199-.52-.46-.777-.261-.257-.609-.53-1.05-.823-.44-.292-.943-.432-1.373-.715-.43-.181-.839-.334-1.225-.399-.386-.064-.797-.096-1.232-.182-.435-.085-.938-.147-1.373-.148-.435-.001-.846.061-1.232.182-.386.12-.795.302-1.225.546-.43.244-.748.533-.872 1.187-.124.654-.237 1.224-.616 1.733-.379.509-.632 1.039-.78 1.574"/>
                          </svg>
                          Contact Seller
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
