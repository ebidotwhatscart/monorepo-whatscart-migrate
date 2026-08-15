import { useState, useEffect } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import { getErrorMessage } from "../lib/utils";
import { useSessionId } from "../hooks/useAnalytics";
import { buildShareUrl } from "../lib/analytics";
import { productSlug, storefrontUrl } from "../lib/urls";
import ShareSheet from "./ShareSheet";
import { ProductForm } from "./products/ProductForm";
import type { BusinessType } from "../types/product";
import {
  Search,
  Plus,
  Share2,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
  X,
  Check,
  AlertTriangle,
  Archive,
} from "lucide-react";

interface ProductManagerProps {
  businessId: Id<"businesses">;
  businessSlug: string;
  businessType: BusinessType;
  autoOpenAdd?: boolean;
  onAddClose?: () => void;
}

export function ProductManager({
  businessId,
  businessSlug,
  businessType,
  autoOpenAdd,
  onAddClose,
}: ProductManagerProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const showForm = searchParams.get("action") === "create";
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "instock" | "outofstock">(
    () => (searchParams.get("filter") as "all" | "instock" | "outofstock") || "all",
  );
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set(),
  );
  const [collectionMode, setCollectionMode] = useState(false);
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [isSharingProducts, setIsSharingProducts] = useState(false);

  const products = useQuery(api.products.getBusinessProducts, { businessId });
  const createCatalog = useMutation(api.catalogs.createCatalog);

  // Auto open add form
  useEffect(() => {
    if (autoOpenAdd && !showForm) {
      setEditingProduct(null);
      setSearchParams({ action: "create" }, { replace: true });
    }
  }, [autoOpenAdd]);

  const handleEdit = (product: any) => {
    navigate(`/dashboard/products/edit/${product._id}`);
  };

  const handleView = (product: any) => {
    navigate(`/dashboard/products/view/${product._id}`);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setSearchParams({ action: "create" }, { replace: true });
  };

  const handleFormClose = () => {
    setEditingProduct(null);
    setSearchParams({}, { replace: true });
    onAddClose?.();
  };

  const handleStartCollection = () => {
    setCollectionMode(true);
  };

  const handleOpenCollectionSheet = () => {
    if (selectedProductIds.size < 2) {
      toast.error("Select at least two products to create a collection");
      return;
    }

    setShowCollectionSheet(true);
  };

  const getCollectionUrl = (catalogId: string) =>
    storefrontUrl(businessSlug, `catalog/${catalogId}`);

  const createCollection = async () => {
    const name = collectionName.trim();

    try {
      setIsCreatingCollection(true);
      const result = await createCatalog({
        businessId,
        name: name || undefined,
        productIds: Array.from(selectedProductIds) as Id<"products">[],
      });
      return getCollectionUrl(result.catalogId);
    } catch (error) {
      toast.error(getErrorMessage(error));
      return null;
    } finally {
      setIsCreatingCollection(false);
    }
  };

  const completeCollectionFlow = () => {
    clearSelection();
    setCollectionMode(false);
    setCollectionName("");
    setShowCollectionSheet(false);
  };

  const [shareCollectionOpen, setShareCollectionOpen] = useState(false);
  const [shareCollectionUrl, setShareCollectionUrl] = useState("");

  const handleShareCollection = async () => {
    if (selectedProductIds.size < 2) {
      toast.error("Select at least two products to create a collection");
      return;
    }

    const url = await createCollection();
    if (!url) return;

    // Close collection sheet before opening ShareSheet (same z-index issue)
    setCollectionMode(false);
    setShowCollectionSheet(false);
    clearSelection();
    setCollectionName("");

    setShareCollectionUrl(url);
    setShareCollectionOpen(true);
  };

  const handleShareProductsIndividually = async () => {
    if (selectedProductIds.size < 2) {
      toast.error("Select at least two products to create a collection");
      return;
    }

    const collectionUrl = await createCollection();
    if (!collectionUrl) return;

    const selectedProducts =
      products?.filter((p) => selectedProductIds.has(p._id)) ?? [];

    setIsSharingProducts(true);

    for (let i = 0; i < selectedProducts.length; i++) {
      const product = selectedProducts[i];
      const productUrl = buildShareUrl(storefrontUrl(businessSlug, `products/${productSlug(product.name, product._id, product.slug)}`), "share");
      const text = `${product.name} — ₹${product.price}\n\n${productUrl}`;
      const firstImage = product.imageUrls?.[0];

      toast.info(`Sharing ${i + 1} of ${selectedProducts.length}: ${product.name}`, {
        id: "share-progress",
        duration: 5000,
      });

      if (navigator.share) {
        try {
          if (firstImage && navigator.canShare) {
            try {
              const response = await fetch(firstImage);
              const blob = await response.blob();
              const ext = blob.type.split("/")[1] || "jpg";
              const file = new File([blob], `${product.name}.${ext}`, {
                type: blob.type,
              });
              if (navigator.canShare({ text, files: [file] })) {
                await navigator.share({ text, files: [file] });
                continue;
              }
            } catch {
              // Image fetch or file share failed — fall through to text-only share
            }
          }

          await navigator.share({ text });
        } catch {
          // User cancelled or error — continue to next product
        }
      } else {
        try {
          await navigator.clipboard.writeText(productUrl);
          toast.success(`${product.name} link copied!`);
        } catch {
          toast.error(`Failed to copy ${product.name} link`);
        }
      }
    }

    toast.dismiss("share-progress");
    setIsSharingProducts(false);
    toast.success("All products shared!");
    completeCollectionFlow();
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const exitCollectionMode = () => {
    clearSelection();
    setCollectionMode(false);
    setShowCollectionSheet(false);
    setCollectionName("");
  };

  if (showForm) {
    return (
      <ProductForm
        businessId={businessId}
        businessType={businessType}
        product={editingProduct}
        onCancel={handleFormClose}
        onSuccess={() => {
          handleFormClose();
          toast.success(editingProduct ? "Product updated!" : "Product added!");
        }}
        onEditVariant={(variantId) => navigate(`/dashboard/products/edit/${variantId}`)}
      />
    );
  }

  // Build variant group map for client-side variant display
  const variantGroups = new Map<string, any[]>();
  (products ?? []).forEach((p) => {
    if (p.variantGroupId) {
      const existing = variantGroups.get(p.variantGroupId) || [];
      existing.push(p);
      variantGroups.set(p.variantGroupId, existing);
    }
  });
  const parentProductIds = new Set(
    (products ?? [])
      .filter((p) => variantGroups.has(p._id))
      .map((p) => p._id),
  );

  // Filter products
  const filtered = (products ?? []).filter((p) => {
    const matchesSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "instock" && p.inStock) ||
      (filter === "outofstock" && !p.inStock);
    return matchesSearch && matchesFilter;
  });

  // Group by category, ignoring case so "Dress" and "dress" stay together.
  const grouped: Record<string, { label: string; items: any[] }> = {};
  filtered.forEach((p) => {
    const label = p.category?.name?.trim() || "Uncategorised";
    const key = label.toLowerCase();
    if (!grouped[key]) grouped[key] = { label, items: [] };
    grouped[key].items.push(p);
  });

  const toggleSelectCategory = (categoryKey: string) => {
    const group = grouped[categoryKey];
    if (!group) return;
    const allSelected = group.items.every((product) =>
      selectedProductIds.has(product._id),
    );
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      group.items.forEach((product) => {
        if (allSelected) next.delete(product._id);
        else next.add(product._id);
      });
      return next;
    });
  };

  const hasSelection = selectedProductIds.size > 0;

  return (
    <div className="mx-auto min-h-full bg-app px-4 pb-32 pt-4">
      <div className="space-y-4">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name"
              className="h-14 w-full rounded-2xl border border-[#dfe8f0] bg-[#eef4fa] pl-11 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300"
            />
          </div>

          <div className="flex gap-2">
            {(["all", "instock", "outofstock"] as const).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setSearchParams((prev) => {
                    if (f === "all") prev.delete("filter");
                    else prev.set("filter", f);
                    return prev;
                  }, { replace: true });
                }}
                className={`rounded-md border px-4 py-2 text-sm font-semibold transition ${
                  filter === f
                    ? "border-[#46b038] bg-[#46b038] text-white shadow-[0_8px_20px_-14px_rgba(70,176,56,0.8)]"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {f === "all"
                  ? "All Products"
                  : f === "instock"
                    ? "In Stock"
                    : "Out of Stock"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ActionTile
              icon={<Plus className="h-6 w-6 text-slate-300" />}
              label="Add Product"
              onClick={handleAdd}
            />
            <ActionTile
              icon={<Share2 className="h-5 w-5 text-slate-300" />}
              label={collectionMode ? "Selecting" : "Create Collection"}
              onClick={handleStartCollection}
            />
          </div>
        </div>

        {filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-medium text-slate-400">
            No products found
          </div>
        )}

        {Object.entries(grouped).map(([categoryKey, group]) => {
          const { label: category, items } = group;
          const collapsed = collapsedCategories.has(categoryKey);
          const categorySelected = items.filter((product) =>
            selectedProductIds.has(product._id),
          ).length;

          return (
            <section key={categoryKey} className="space-y-3">
              <button
                onClick={() => toggleCategory(categoryKey)}
                className="flex w-full items-center justify-between pt-2"
              >
                <span className="text-[18px] font-bold tracking-[-0.05em] text-slate-950">
                  {category}
                </span>
                {collapsed ? (
                  <ChevronDown className="h-5 w-5 text-slate-500" />
                ) : (
                  <ChevronUp className="h-5 w-5 text-slate-500" />
                )}
              </button>

              {collectionMode && !collapsed && (
                <div className="flex items-center justify-between px-1 text-sm font-semibold text-slate-500">
                  <button
                    onClick={() => toggleSelectCategory(categoryKey)}
                    className="flex items-center gap-2"
                    type="button"
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-md border ${
                        categorySelected === items.length
                          ? "border-[#46b038] bg-[#46b038] text-white"
                          : "border-slate-300 bg-white text-transparent"
                      }`}
                    >
                      <Check className="h-4 w-4" />
                    </span>
                    Select All
                  </button>
                  <span>{categorySelected} items selected</span>
                </div>
              )}

              {!collapsed && (
                <div className="grid grid-cols-2 gap-3">
                  {items.map((product) => (
                    <ProductCard
                      key={product._id}
                      product={product}
                      onEdit={() => handleEdit(product)}
                      onView={() => handleView(product)}
                      businessId={businessId}
                      allProducts={products ?? []}
                      businessSlug={businessSlug}
                      isSelected={selectedProductIds.has(product._id)}
                      selectionMode={collectionMode}
                      onToggleSelect={() => toggleProductSelection(product._id)}
                      variantCount={
                        parentProductIds.has(product._id)
                          ? variantGroups.get(product._id)?.length
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {collectionMode && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[8rem] z-40 flex justify-center px-4">
          <div className="pointer-events-auto w-full max-w-[358px] rounded-2xl bg-[#0f172a] px-4 py-3 text-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.55)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Actions
                </p>
                <p className="text-sm font-bold">
                  {selectedProductIds.size} selected
                </p>
              </div>

              <div className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={exitCollectionMode}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white"
                >
                  Exit
                </button>
                <button
                  type="button"
                  onClick={handleOpenCollectionSheet}
                  className="rounded-lg bg-[#46b038] px-4 py-2 text-sm font-bold text-white"
                >
                  Create Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCollectionSheet && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-label="Share Collection"
        >
          <div className="mb-0 w-full max-w-[428px] rounded-t-3xl bg-white p-5 shadow-[0_-18px_45px_-20px_rgba(15,23,42,0.75)] animate-slide-up">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                Share Collection
              </h2>
              <button
                type="button"
                onClick={() => setShowCollectionSheet(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Close collection sheet"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="block">
              <span className="mb-2 block pl-1 text-sm font-bold text-slate-700">
                Collection name
              </span>
              <input
                type="text"
                value={collectionName}
                onChange={(event) => setCollectionName(event.target.value)}
                placeholder="Collection name"
                className="h-14 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300 focus:border-[#3DAC35]"
              />
            </label>

            <div className="mt-8 space-y-2">
              <button
                type="button"
                onClick={() => void handleShareCollection()}
                disabled={isCreatingCollection || isSharingProducts}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#111910] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Share2 className="h-5 w-5" />
                {isCreatingCollection ? "Creating..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ShareSheet
        isOpen={shareCollectionOpen}
        onClose={() => {
          setShareCollectionOpen(false);
          setShareCollectionUrl("");
          completeCollectionFlow();
        }}
        url={shareCollectionUrl}
        title="Product collection"
        businessId={businessId}
      />
    </div>
  );
}

function ActionTile({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-[1.1] flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-[#d7e4ef] bg-white text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f7fb]">
        {icon}
      </span>
      <span className="text-base font-bold text-slate-500">{label}</span>
    </button>
  );
}

function ProductCard({
  product,
  onEdit,
  onView,
  businessId,
  allProducts,
  businessSlug,
  isSelected,
  selectionMode,
  onToggleSelect,
  variantCount,
}: {
  product: any;
  onEdit: () => void;
  onView: () => void;
  businessId: Id<"businesses">;
  allProducts: any[];
  businessSlug: string;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  variantCount?: number;
}) {
  const deleteProduct = useMutation(api.products.deleteProduct);
  const createProduct = useMutation(api.products.createProduct);
  const trackProductShare = useMutation(api.analytics.trackProductShare);
  const sessionId = useSessionId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [shareProductOpen, setShareProductOpen] = useState(false);
  const [shareProductData, setShareProductData] = useState<{
    url: string;
    title: string;
    productId: string;
  } | null>(null);

  const handleDelete = async () => {
    if (!confirm("Delete this product?")) return;
    setIsDeleting(true);
    try {
      await deleteProduct({ productId: product._id });
      toast.success("Product deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeleting(false);
      setMenuOpen(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const baseName = product.name.replace(/^(Copy \d+ of )/i, "");
      let copyCount = 0;
      allProducts.forEach((p: any) => {
        const match = p.name.match(/^Copy (\d+) of (.+)$/i);
        if (match && match[2].toLowerCase() === baseName.toLowerCase()) {
          const num = parseInt(match[1]);
          if (num > copyCount) copyCount = num;
        }
      });
      await createProduct({
        businessId,
        name: `Copy ${copyCount + 1} of ${baseName}`,
        description: product.description,
        price: product.price,
        categoryId: product.categoryId,
        inStock: product.inStock,
        imageIds: product.imageIds || [],
      });
      toast.success("Duplicated!");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDuplicating(false);
      setMenuOpen(false);
    }
  };

  const handleShare = () => {
    const url = storefrontUrl(businessSlug, `products/${productSlug(product.name, product._id, product.slug)}`);
    setShareProductData({ url, title: product.name, productId: product._id });
    setShareProductOpen(true);
    setMenuOpen(false);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-white shadow-sm transition ${
        isSelected ? "border-2 border-[#3DAC35]" : "border border-[#F1F5F9]"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label={`View ${product.name}`}
        onClick={selectionMode ? onToggleSelect : onView}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (selectionMode) onToggleSelect();
            else onView();
          }
        }}
        className="block w-full cursor-pointer text-left"
      >
        <div className="relative aspect-[171/169] bg-[#F1F5F9]">
          {selectionMode && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onToggleSelect();
              }}
              className={`absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded border-2 text-white ${
                isSelected
                  ? "border-[#3DAC35] bg-[#3DAC35]"
                  : "border-white/80 bg-black/20 text-transparent"
              }`}
              aria-label={`${isSelected ? "Deselect" : "Select"} ${product.name}`}
            >
              <Check className="h-4 w-4" />
            </button>
          )}

          {product.imageUrls?.[0] ? (
            <img
              src={product.imageUrls[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-8 h-8 text-gray-300" />
            </div>
          )}

          <div className="absolute right-2 top-2 z-30">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((v) => !v);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-white/95 shadow-[0_6px_18px_-10px_rgba(15,23,42,0.9)] backdrop-blur"
              aria-label={`Open actions for ${product.name}`}
            >
              <MoreHorizontal className="h-4 w-4 text-slate-700" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-40 min-w-[132px] rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onEdit();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDuplicate();
                  }}
                  disabled={isDuplicating}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {isDuplicating ? "Duplicating..." : "Duplicate"}
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleShare();
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Share
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDelete();
                  }}
                  disabled={isDeleting}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-red-50 disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1 px-3 py-3">
          <p className="truncate text-sm font-semibold leading-5 text-slate-900">
            {product.name}
          </p>
          <p className="text-base font-bold leading-6 text-[#3DAC35]">
            ₹{product.price.toFixed(2)}
          </p>

          {product.colorName && product.colorSwatch && (
            <div className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded-full border border-slate-200"
                style={{ backgroundColor: product.colorSwatch }}
              />
              <span className="text-xs font-medium text-slate-500">
                {product.colorName}
              </span>
            </div>
          )}

          {variantCount && variantCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#3DAC35]">
                {variantCount} colours
              </span>
            </div>
          ) : null}

          {product.inStock ? (
            <div className="flex items-center gap-1.5">
              <Archive className="h-3 w-3 text-[#7cc66d]" />
              <span className="text-xs font-semibold text-[#46b038]">
                In stock
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 text-orange-400" />
              <span className="text-xs font-semibold text-orange-500">
                Out of stock
              </span>
            </div>
          )}
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {shareProductOpen && shareProductData && (
        <ShareSheet
          isOpen={shareProductOpen}
          onClose={() => {
            setShareProductOpen(false);
            setShareProductData(null);
          }}
          url={shareProductData.url}
          title={shareProductData.title}
          productId={shareProductData.productId}
          businessId={businessId}
        />
      )}
    </div>
  );
}
