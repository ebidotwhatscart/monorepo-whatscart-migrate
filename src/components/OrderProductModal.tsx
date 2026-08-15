import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";
import type { Id } from "../lib/firebase/operations";

type DetailedProduct = {
  _id: Id<"products">;
  name: string;
  description?: string;
  price: number;
  inStock: boolean;
  imageUrls?: string[];
  category?: { _id: Id<"categories">; name: string } | null;
};

type OrderProductModalContext = {
  order: {
    businessId: Id<"businesses">;
    itemsDetailed?: {
      product?: DetailedProduct | null;
      productId: string;
      name: string;
      price: number;
      quantity: number;
      image?: string;
    }[];
  };
};

type ModalFrameProps = {
  children: ReactNode;
  closeModal: () => void;
};

function ModalFrame({ children, closeModal }: ModalFrameProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#111910]/50 pt-4 sm:items-center">
      <div className="relative w-full max-w-[428px] rounded-[28px] rounded-b-none bg-app shadow-2xl animate-slide-up">
        <button
          type="button"
          onClick={closeModal}
          aria-label="Close product details"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#111910] shadow-sm"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function OrderProductModal() {
  const navigate = useNavigate();
  const { productId } = useParams<{ productId: string }>();
  const { order } = useOutletContext<OrderProductModalContext>();
  const product = order.itemsDetailed?.find(
    (item) => item.product?._id === productId,
  )?.product;

  const closeModal = () => {
    navigate("..");
  };

  if (!product) {
    return (
      <ModalFrame closeModal={closeModal}>
        <div className="space-y-4 p-6 pt-4">
          <div>
            <h2 className="text-2xl font-bold text-[#111910]">
              Product not found
            </h2>
            <p className="text-sm text-[#11191099]">
              This product is no longer available for this order.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="h-12 w-full rounded-xl bg-[#111910] text-sm font-bold text-white"
          >
            Back to order
          </button>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame closeModal={closeModal}>
      <img
        src={product.imageUrls?.[0] ?? ""}
        alt={product.name}
        className="h-72 w-full rounded-t-[28px] object-cover"
        loading="eager"
      />
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold text-[#111910]">
              {product.name}
            </h2>
            <p className="text-2xl font-bold text-[#111910] shrink-0">
              ₹{product.price.toFixed(2)}
            </p>
          </div>
          <p className="text-sm text-[#11191099] max-h-20 overflow-y-auto">{product.description}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-[rgba(61,172,53,0.05)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#11191066]">
              Category
            </p>
            <p className="mt-2 text-base font-semibold text-[#111910]">
              {product.category?.name ?? "Uncategorised"}
            </p>
          </div>
          <div className="rounded-2xl border border-[rgba(61,172,53,0.05)] bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#11191066]">
              Stock
            </p>
            <p className="mt-2 text-base font-semibold text-[#111910]">
              {product.inStock ? "In Stock" : "Out of Stock"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={closeModal}
          className="h-12 w-full rounded-xl bg-[#111910] text-sm font-bold text-white"
        >
          Close
        </button>
      </div>
    </ModalFrame>
  );
}
