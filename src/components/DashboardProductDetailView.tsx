import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ShareSheet from "./ShareSheet";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  Image as ImageIcon,
  Pencil,
  Share2,
  Tag,
} from "lucide-react";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import { getErrorMessage } from "../lib/utils";
import { useSessionId } from "../hooks/useAnalytics";
import { productSlug, storefrontUrl } from "../lib/urls";

interface Business {
  _id: Id<"businesses">;
  slug: string;
}

interface DashboardProductDetailViewProps {
  business: Business;
}

export function DashboardProductDetailView({
  business,
}: DashboardProductDetailViewProps) {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const sessionId = useSessionId();
  const trackProductShare = useMutation(api.analytics.trackProductShare);
  const product = useQuery(
    api.products.getProduct,
    productId
      ? {
          productId: productId as Id<"products">,
          businessId: business._id,
        }
      : "skip",
  );
  const performance = useQuery(
    api.analytics.getProductPerformance,
    productId
      ? {
          businessId: business._id,
          productId: productId as Id<"products">,
        }
      : "skip",
  );
  const variants = useQuery(
    api.products.getProductVariants,
    productId
      ? {
          productId: productId as Id<"products">,
          businessId: business._id,
        }
      : "skip",
  );

  const goBack = () => navigate("/dashboard/products");
  const goEdit = () => {
    if (productId) navigate(`/dashboard/products/edit/${productId}`);
  };

  const [shareOpen, setShareOpen] = useState(false);

  const shareProduct = () => setShareOpen(true);

  if (product === undefined) {
    return (
      <div className="mx-auto min-h-full bg-app px-4 py-10 text-sm font-semibold text-slate-400">
        Loading product...
      </div>
    );
  }

  if (!product || product.businessId !== business._id) {
    return (
      <div className="mx-auto min-h-full bg-app px-4 py-10">
        <div className="rounded-3xl bg-white p-6 text-center">
          <h1 className="text-lg font-bold text-slate-900">
            Product not found
          </h1>
          <button
            type="button"
            onClick={goBack}
            className="mt-5 rounded-xl bg-[#46b038] px-5 py-3 text-sm font-bold text-white"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  const variantList = variants?.filter(
    (v) => v._id !== product._id && v.colorName,
  );
  const isVariant = !!product.colorName;
  const parentVariants = !isVariant ? variantList : [];
  const imageUrl = product.imageUrls?.[0];
  const totalViews = performance?.totalViews ?? 0;
  const timesShared = performance?.timesShared ?? 0;

  return (
    <div className="mx-auto min-h-full bg-app pb-56">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#3dac35]/10 bg-white/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#111910]"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-[#111910]">Product Details</h1>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-xl border border-[#3dac35]/5 bg-white shadow-sm">
          <div className="aspect-square bg-slate-100">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-slate-300">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4 px-0 py-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold leading-[30px] text-[#111910]">
                {product.name}
              </h2>
              <p className="mt-1 text-sm font-medium leading-5 text-[#111910]/60">
                {product.description || "No description added"}
              </p>
            </div>
            <p className="shrink-0 text-2xl font-bold leading-8 text-[#111910]">
              ₹{product.price.toFixed(0)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-[#3dac35]/20 bg-[#3dac35]/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#3dac35]" />
              <span className="text-sm font-bold text-[#3dac35]">
                {product.inStock ? "In Stock" : "Out of Stock"}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#111910]/5 px-3 py-1.5">
              <Tag className="h-3.5 w-3.5 text-[#111910]/50" />
            </div>
          </div>
        </section>

        <section className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#111910]/40">
              Performance
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="Total Views"
              value={totalViews}
              icon={<Eye className="h-10 w-10" />}
              highlighted
            />
            <MetricCard
              label="Times Shared"
              value={timesShared}
              icon={<Share2 className="h-10 w-10" />}
            />
          </div>
        </section>

        <section className="space-y-3 py-2">
          <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#111910]/40">
            Product Specifications
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <SpecCard
              label="Category"
              value={product.category?.name ?? "Uncategorised"}
            />
            <SpecCard
              label="Status"
              value={product.inStock ? "Active" : "Hidden"}
            />
          </div>
        </section>

        {isVariant && (
          <section className="space-y-3 py-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#111910]/40">
              Color Variant
            </h3>
            <div className="flex items-center gap-3 rounded-xl border border-[#3dac35]/10 bg-white p-4 shadow-sm">
              {product.colorSwatch && (
                <span
                  className="h-8 w-8 rounded-full border border-slate-200"
                  style={{ backgroundColor: product.colorSwatch }}
                />
              )}
              <div>
                <p className="text-sm font-semibold text-[#111910]">
                  {product.colorName || "Unnamed"}
                </p>
                <p className="text-xs text-[#111910]/50">
                  Part of a colour family
                </p>
              </div>
            </div>
          </section>
        )}

        {parentVariants && parentVariants.length > 0 && (
          <section className="space-y-3 py-2">
            <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-[#111910]/40">
              Colour Variants ({parentVariants.length})
            </h3>
            <div className="flex flex-wrap gap-3">
              {parentVariants.map((variant) => (
                <button
                  key={variant._id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/products/view/${variant._id}`,
                    )
                  }
                  className="flex items-center gap-2 rounded-xl border border-[#3dac35]/10 bg-white p-3 shadow-sm transition hover:border-[#3dac35]/30"
                >
                  {variant.colorSwatch && (
                    <span
                      className="h-6 w-6 rounded-full border border-slate-200"
                      style={{ backgroundColor: variant.colorSwatch }}
                    />
                  )}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-[#111910]">
                      {variant.colorName || "Unnamed"}
                    </p>
                    <p className="text-xs text-[#111910]/50">
                      ₹{variant.price.toFixed(0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-1/2 z-40 w-full max-w-[428px] -translate-x-1/2 border-t border-[#3dac35]/10 bg-white px-4 py-4 lg:px-4">
        <div className="grid w-full grid-cols-2 gap-3">
          <button
            type="button"
            onClick={goEdit}
            className="flex h-[50px] items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 text-base font-bold text-[#111910]"
          >
            <Pencil className="h-4 w-4" />
            Edit Product
          </button>
          <button
            type="button"
            onClick={() => void shareProduct()}
            className="flex h-[50px] items-center justify-center gap-2 rounded-xl bg-[#111910] text-base font-bold text-white"
          >
            <Share2 className="h-4 w-4" />
            Share Product
          </button>
        </div>
      </footer>

      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={product ? storefrontUrl(business.slug, `products/${productSlug(product.name, product._id, product.slug)}`) : ""}
        title={product?.name}
        text={`Check out ${product?.name}`}
        productId={product?._id}
        businessId={business?._id}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
  highlighted,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-4 shadow-sm ${
        highlighted
          ? "bg-[#111910] text-white"
          : "border border-[#111910]/10 bg-white text-[#111910]"
      }`}
    >
      <p
        className={`text-xs font-bold uppercase leading-4 ${
          highlighted ? "text-white/60" : "text-[#111910]/40"
        }`}
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold leading-8">{value}</p>
      <div
        className={`absolute bottom-[-10px] right-[-8px] ${
          highlighted ? "text-white/10" : "text-[#111910]/5"
        }`}
      >
        {icon}
      </div>
    </div>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#3dac35]/5 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase leading-4 text-[#111910]/40">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-[#3dac35]" />
        <p className="text-base font-semibold leading-6 text-[#111910]">
          {value}
        </p>
      </div>
    </div>
  );
}
