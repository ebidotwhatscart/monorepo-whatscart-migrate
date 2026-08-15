import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { ProductManager } from "./ProductManager";
import { DashboardProductDetailView } from "./DashboardProductDetailView";
import { CatalogsPage } from "./CatalogsPage";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import type { BusinessType } from "../types/product";
import { ProductForm } from "./products/ProductForm";

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  businessType: BusinessType;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
}

interface ProductsPageProps {
  business: Business;
}

export function ProductsPage({ business }: ProductsPageProps) {
  const [searchParams] = useSearchParams();
  const isCreating = searchParams.get("action") === "create";

  return (
    <Routes>
      <Route
        index
        element={
          <>
            {!isCreating && <ProductSectionTabs />}
            <ProductManager
              businessId={business._id}
              businessSlug={business.slug}
              businessType={business.businessType}
            />
          </>
        }
      />
      <Route
        path="collections"
        element={
          <>
            <ProductSectionTabs />
            <CatalogsPage business={business} embedded />
          </>
        }
      />
      <Route
        path="collections/edit/:collectionId"
        element={<CatalogsPage business={business} embedded />}
      />
      <Route
        path="catalogs"
        element={<Navigate to="/dashboard/products/collections" replace />}
      />
      <Route
        path="edit/:productId"
        element={<DashboardProductEditPage business={business} />}
      />
      <Route
        path="view/:productId"
        element={<DashboardProductDetailView business={business} />}
      />
    </Routes>
  );
}

function ProductSectionTabs() {
  const tabs = [
    { label: "Products", to: "/dashboard/products", end: true },
    { label: "Collections", to: "/dashboard/products/collections", end: false },
  ];

  return (
    <header className="mx-auto border-b border-[#3DAC35]/10 bg-white backdrop-blur">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-lg font-bold leading-[22.5px] text-slate-900">
          Products & Collections
        </h1>
      </div>

      <div className="px-4 pt-4">
        <div
          role="tablist"
          aria-label="Products section"
          className="grid grid-cols-2 border-b border-slate-200"
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              role="tab"
              className={({ isActive }) =>
                `-mb-px flex justify-center border-b-2 pb-3 text-base leading-5 transition ${
                  isActive
                    ? "border-[#3DAC35] font-bold text-[#3DAC35]"
                    : "border-transparent font-medium text-slate-500"
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </div>
    </header>
  );
}

function DashboardProductEditPage({ business }: { business: Business }) {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const product = useQuery(
    api.products.getProduct,
    productId
      ? {
          productId: productId as Id<"products">,
          businessId: business._id,
        }
      : "skip",
  );

  const returnToProducts = () => navigate("/dashboard/products");

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
            onClick={returnToProducts}
            className="mt-5 rounded-xl bg-[#46b038] px-5 py-3 text-sm font-bold text-white"
          >
            Back to products
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProductForm
      businessId={business._id}
      businessType={business.businessType}
      product={product}
      onCancel={returnToProducts}
      onSuccess={() => {
        toast.success("Product updated!");
        returnToProducts();
      }}
      onEditVariant={(variantId) => navigate(`/dashboard/products/edit/${variantId}`)}
    />
  );
}
