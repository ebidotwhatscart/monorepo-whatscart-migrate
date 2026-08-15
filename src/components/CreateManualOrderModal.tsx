import { useState } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api, type Id } from "../lib/firebase/operations";
import { X, Plus, Trash2, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface CreateManualOrderModalProps {
  businessId: Id<"businesses">;
  isOpen: boolean;
  onClose: () => void;
}

interface OrderItemInput {
  productId?: Id<"products">;
  name: string;
  price: number;
  quantity: number;
  isCustom: boolean;
}

export function CreateManualOrderModal({
  businessId,
  isOpen,
  onClose,
}: CreateManualOrderModalProps) {
  const products = useQuery(api.products.getBusinessProducts, { businessId });
  const createManualOrder = useMutation(api.orders.createManualOrder);

  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerDoorNumber, setCustomerDoorNumber] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<OrderItemInput[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemQuantity, setCustomItemQuantity] = useState("1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addMode, setAddMode] = useState<"catalog" | "custom">("catalog");

  if (!isOpen) return null;

  const handleAddCatalogItem = () => {
    if (!selectedProductId || !products) return;
    const prod = products.find((p) => p._id === selectedProductId);
    if (!prod) return;

    setItems((prev) => {
      const existingIdx = prev.findIndex((i) => i.productId === prod._id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod._id,
          name: prod.name,
          price: prod.price,
          quantity: 1,
          isCustom: false,
        },
      ];
    });
    setSelectedProductId("");
  };

  const handleAddCustomItem = () => {
    if (!customItemName.trim()) {
      toast.error("Please enter item name");
      return;
    }
    const priceNum = parseFloat(customItemPrice);
    const qtyNum = parseInt(customItemQuantity, 10);
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (isNaN(qtyNum) || qtyNum < 1) {
      toast.error("Please enter a valid quantity");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        name: customItemName.trim(),
        price: priceNum,
        quantity: qtyNum,
        isCustom: true,
      },
    ]);
    setCustomItemName("");
    setCustomItemPrice("");
    setCustomItemQuantity("1");
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuantityChange = (index: number, newQty: number) => {
    if (newQty < 1) return;
    setItems((prev) => {
      const updated = [...prev];
      updated[index].quantity = newQty;
      return updated;
    });
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!customerMobile.trim()) {
      toast.error("Customer mobile is required");
      return;
    }
    if (items.length === 0) {
      toast.error("Please add at least one product or item to the order");
      return;
    }

    try {
      setIsSubmitting(true);
      await createManualOrder({
        businessId,
        customerName: customerName.trim(),
        customerMobile: customerMobile.trim(),
        customerDoorNumber: customerDoorNumber.trim() || undefined,
        customerAddress: customerAddress.trim() || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        totalAmount,
        status,
        notes: notes.trim() || undefined,
      });

      toast.success("Offline order created successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to create manual order");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Record Offline Order</h2>
            <p className="text-xs text-gray-500">Log orders taken outside WhatsApp / Platform</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Customer Information
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. +919876543210"
                  value={customerMobile}
                  onChange={(e) => setCustomerMobile(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Door / Flat No. (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 102B"
                  value={customerDoorNumber}
                  onChange={(e) => setCustomerDoorNumber(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. MG Road, Indiranagar"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Add Products Section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Order Items
              </h3>
              <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setAddMode("catalog")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    addMode === "catalog"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  From Catalog
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("custom")}
                  className={`px-2.5 py-1 rounded-md transition ${
                    addMode === "custom"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500"
                  }`}
                >
                  External / Custom Item
                </button>
              </div>
            </div>

            {/* Add from Catalog */}
            {addMode === "catalog" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                >
                  <option value="">Select a product from catalog...</option>
                  {products?.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} — ₹{p.price}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCatalogItem}
                  disabled={!selectedProductId}
                  className="inline-flex items-center gap-1 rounded-xl bg-green-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            )}

            {/* Add Custom / External Item */}
            {addMode === "custom" && (
              <div className="space-y-2 rounded-xl bg-gray-50 p-3 border border-gray-100">
                <input
                  type="text"
                  placeholder="External product name (e.g. Custom Gift Box)"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-green-500"
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Price (₹)"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-green-500"
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={customItemQuantity}
                      onChange={(e) => setCustomItemQuantity(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-green-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Add Item
                  </button>
                </div>
              </div>
            )}

            {/* Added Items List */}
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                  <ShoppingBag className="h-6 w-6 mb-1 text-gray-300" />
                  No items added yet. Select catalog products or add custom items above.
                </div>
              ) : (
                items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-xs"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{item.name}</p>
                        {item.isCustom && (
                          <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200/50">
                            External
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">₹{item.price.toFixed(2)} each</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-lg border border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, item.quantity - 1)}
                          className="px-2 py-0.5 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          -
                        </button>
                        <span className="px-2 text-xs font-semibold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(index, item.quantity + 1)}
                          className="px-2 py-0.5 text-xs font-bold text-gray-600 hover:bg-gray-100"
                        >
                          +
                        </button>
                      </div>

                      <span className="text-sm font-bold text-gray-900 min-w-[60px] text-right">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-gray-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Status & Notes */}
          <div className="space-y-3 border-t pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Initial Order Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                >
                  <option value="confirmed">Confirmed / Paid</option>
                  <option value="pending">Pending</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Internal Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Phone order / cash paid"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-green-500"
                />
              </div>
            </div>
          </div>

          {/* Total & Action */}
          <div className="border-t pt-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Order Amount</p>
              <p className="text-xl font-bold text-green-600">₹{totalAmount.toFixed(2)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || items.length === 0}
                className="rounded-xl bg-green-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-green-600 disabled:opacity-50"
              >
                {isSubmitting ? "Creating..." : "Save Order"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
