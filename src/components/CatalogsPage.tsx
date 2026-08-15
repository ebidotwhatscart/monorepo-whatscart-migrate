import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { getErrorMessage } from "../lib/utils";
import ShareSheet from "./ShareSheet";
import { storefrontUrl } from "../lib/urls";

interface Business {
  _id: Id<"businesses">;
  slug: string;
}

interface CatalogsPageProps {
  business: Business;
  embedded?: boolean;
}

interface Catalog {
  _id: Id<"catalogs">;
  catalogId: string;
  name: string;
  productIds: Id<"products">[];
  createdAt: number;
  updatedAt: number;
}

interface Product {
  _id: Id<"products">;
  name: string;
  price: number;
  inStock: boolean;
  imageUrls?: string[];
  category?: { name?: string } | null;
}

interface CollectionProductPreview {
  _id: Id<"products">;
  name: string;
  imageUrl?: string;
}

interface EditableCollectionProduct {
  _id: Id<"products">;
  name: string;
  price?: number;
  imageUrl?: string;
}

export function CatalogsPage({
  business,
  embedded = false,
}: CatalogsPageProps) {
  const navigate = useNavigate();
  const { collectionId } = useParams<{ collectionId: string }>();
  const catalogs = useQuery(api.catalogs.getBusinessCatalogs, {
    businessId: business._id,
  });
  const products = useQuery(api.products.getBusinessProducts, {
    businessId: business._id,
  });
  const updateCatalog = useMutation(api.catalogs.updateCatalog);
  const deleteCatalog = useMutation(api.catalogs.deleteCatalog);
  const [editingCatalog, setEditingCatalog] = useState<Catalog | null>(null);
  const [catalogPendingDelete, setCatalogPendingDelete] =
    useState<Catalog | null>(null);
  const [isDeletingCatalog, setIsDeletingCatalog] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState("");
  const routeEditingCatalog = useMemo(
    () =>
      collectionId && catalogs
        ? catalogs.find((catalog) => catalog._id === collectionId)
        : null,
    [catalogs, collectionId],
  );
  const activeEditingCatalog = routeEditingCatalog ?? editingCatalog;

  const [shareUrl, setShareUrl] = useState("");
  const [shareTitle, setShareTitle] = useState("");
  const [shareOpen, setShareOpen] = useState(false);

  const getCatalogUrl = (catalogId: string) =>
    storefrontUrl(business.slug, `catalog/${catalogId}`);

  const handleShareCollection = (catalog: Catalog) => {
    setShareUrl(getCatalogUrl(catalog.catalogId));
    setShareTitle(`Collection: ${catalog.name}`);
    setShareOpen(true);
  };

  const productsById = useMemo(() => {
    const lookup = new Map<string, Product>();
    (products ?? []).forEach((product) => {
      lookup.set(product._id, product);
    });
    return lookup;
  }, [products]);

  const filteredCatalogs = useMemo(() => {
    const normalizedSearch = collectionSearch.trim().toLowerCase();
    if (!catalogs || !normalizedSearch) return catalogs ?? [];

    return catalogs.filter((catalog) =>
      catalog.name.toLowerCase().includes(normalizedSearch),
    );
  }, [catalogs, collectionSearch]);

  const getCollectionProducts = (catalog: Catalog) =>
    catalog.productIds.map((productId) => {
      const product = productsById.get(productId);
      return {
        _id: productId,
        name: product?.name ?? "Collection item",
        imageUrl: product?.imageUrls?.[0],
      };
    });

  const handleDelete = async (catalog: Catalog) => {
    setIsDeletingCatalog(true);
    try {
      await deleteCatalog({ catalogId: catalog._id });
      toast.success("Collection deleted");
      setCatalogPendingDelete(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsDeletingCatalog(false);
    }
  };

  const returnToCollections = () => {
    setEditingCatalog(null);
    navigate("/dashboard/products/collections");
  };

  if (collectionId && catalogs !== undefined && !routeEditingCatalog) {
    return (
      <div className="mx-auto min-h-full bg-app px-4 py-10">
        <div className="rounded-xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-900">
            Collection not found
          </h1>
          <button
            type="button"
            onClick={returnToCollections}
            className="mt-5 rounded-lg bg-[#111910] px-5 py-3 text-sm font-bold text-white"
          >
            Back to collections
          </button>
        </div>
      </div>
    );
  }

  if (collectionId && catalogs === undefined) {
    return (
      <div className="mx-auto min-h-full bg-app px-4 py-10 text-sm font-semibold text-slate-400">
        Loading collection...
      </div>
    );
  }

  if (activeEditingCatalog) {
    return (
      <CatalogEditor
        catalog={activeEditingCatalog}
        products={products}
        onCancel={returnToCollections}
        onSave={async ({ name, productIds }) => {
          try {
            await updateCatalog({
              catalogId: activeEditingCatalog._id,
              name,
              productIds,
            });
            returnToCollections();
            toast.success("Collection updated");
            return true;
          } catch (error) {
            toast.error(getErrorMessage(error));
            return false;
          }
        }}
        onDelete={async () => {
          try {
            await deleteCatalog({ catalogId: activeEditingCatalog._id });
            toast.success("Collection deleted");
            returnToCollections();
          } catch (error) {
            toast.error(getErrorMessage(error));
          }
        }}
      />
    );
  }

  return (
    <div className="mx-auto min-h-full bg-app px-4 pb-32 pt-4">
      <header className="mb-5 flex items-center gap-3">
        {!embedded && (
          <Link
            to="/dashboard/products"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm"
            aria-label="Back to products"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.03em] text-slate-950">
            Collections
          </h1>
          <p className="text-sm font-medium text-slate-500">
            Manage shared product collections
          </p>
        </div>
      </header>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
          <input
            type="text"
            value={collectionSearch}
            onChange={(event) => setCollectionSearch(event.target.value)}
            placeholder="Search collections..."
            className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 shadow-sm outline-none placeholder:text-slate-300 focus:border-[#3DAC35]"
          />
        </div>
        {catalogs !== undefined && (
          <p className="text-base font-medium text-slate-400">
            {filteredCatalogs.length} collections
          </p>
        )}
      </div>

      {catalogs === undefined || products === undefined ? (
        <div className="rounded-3xl bg-white p-6 text-sm font-semibold text-slate-400">
          Loading collections...
        </div>
      ) : catalogs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center">
          <h2 className="text-lg font-bold text-slate-900">
            No collections yet
          </h2>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Select products on the Products page and tap Create Collection.
          </p>
          <Link
            to="/dashboard/products"
            className="mt-5 inline-flex rounded-xl bg-[#46b038] px-5 py-3 text-sm font-bold text-white"
          >
            Create collection
          </Link>
        </div>
      ) : filteredCatalogs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-5 py-10 text-center text-sm font-medium text-slate-400">
          No collections found
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCatalogs.map((catalog) => (
            <article
              key={catalog._id}
              className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm relative"
            >
              <CollectionThumbnail
                collectionName={catalog.name}
                products={getCollectionProducts(catalog)}
              />

              <div className="mt-3">
                <h2 className="truncate text-lg font-semibold leading-5 text-slate-900">
                  {catalog.name}
                </h2>
                <div className="mt-2 flex items-center gap-2 text-base font-medium leading-5">
                  <span className="text-slate-600">
                    {catalog.productIds.length} Items
                  </span>
                  <span className="text-slate-300">.</span>
                  <span className="text-slate-400">
                    Updated {formatUpdatedAt(catalog.updatedAt)}
                  </span>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      `/dashboard/products/collections/edit/${catalog._id}`,
                    )
                  }
                  className="flex items-center justify-center rounded-lg border border-slate-200 bg-slate-100 p-4 text-md font-bold text-slate-600"
                  aria-label={`Edit ${catalog.name}`}
                >
                  Edit Collection
                </button>
                <button
                  type="button"
                  onClick={() => void handleShareCollection(catalog)}
                  className="flex items-center justify-center rounded-md bg-[#111910] p-4 text-sm font-bold text-white"
                  aria-label={`Share ${catalog.name}`}
                >
                  Share Collection
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCatalogPendingDelete(catalog)}
                className="flex items-center justify-center rounded-lg bg-red-50 text-sm font-bold text-red-500 absolute top-4 right-4 h-10 w-10"
                aria-label={`Delete ${catalog.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </article>
          ))}
        </div>
      )}

      {catalogPendingDelete && (
        <DeleteCollectionConfirmationModal
          isDeleting={isDeletingCatalog}
          onCancel={() => setCatalogPendingDelete(null)}
          onConfirm={() => void handleDelete(catalogPendingDelete)}
        />
      )}

      <ShareSheet
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        url={shareUrl}
        title={shareTitle}
      />
    </div>
  );
}

function CollectionThumbnail({
  collectionName,
  products,
}: {
  collectionName: string;
  products: CollectionProductPreview[];
}) {
  const visibleProducts = products.slice(0, 4);
  const remaining = Math.max(products.length - 4, 0);

  return (
    <div
      aria-label={`${collectionName} collection thumbnail with ${products.length} items`}
      className={`grid h-[200px] overflow-hidden rounded-lg bg-slate-100 ${
        products.length === 3
          ? "grid-cols-2 grid-rows-2"
          : "grid-cols-2 grid-rows-2"
      }`}
    >
      {visibleProducts.map((product, index) => (
        <CollectionThumbnailTile
          key={`${product._id}-${index}`}
          product={product}
          className={getThumbnailTileClass(products.length, index)}
          overlay={index === 3 && remaining > 0 ? `+${remaining}` : undefined}
        />
      ))}
    </div>
  );
}

function CollectionThumbnailTile({
  product,
  className,
  overlay,
}: {
  product: CollectionProductPreview;
  className: string;
  overlay?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-slate-200 ${className}`}>
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-400">
          <ImageIcon className="h-8 w-8" />
        </div>
      )}
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 text-3xl font-bold text-white">
          {overlay}
        </div>
      )}
    </div>
  );
}

function getThumbnailTileClass(itemCount: number, index: number) {
  if (itemCount <= 2) return "row-span-2";
  if (itemCount === 3 && index === 0) return "row-span-2";
  return "";
}

function formatUpdatedAt(timestamp: number) {
  const diff = Date.now() - timestamp;
  const day = 24 * 60 * 60 * 1000;

  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function CatalogEditor({
  catalog,
  products,
  onCancel,
  onSave,
  onDelete,
}: {
  catalog: Catalog;
  products: Product[] | undefined;
  onCancel: () => void;
  onSave: (values: {
    name: string;
    productIds: Id<"products">[];
  }) => Promise<boolean>;
  onDelete: () => Promise<void>;
}) {
  const [name, setName] = useState(catalog.name);
  const [search, setSearch] = useState("");
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [recentlyRemovedProduct, setRecentlyRemovedProduct] =
    useState<EditableCollectionProduct | null>(null);
  const [undoSecondsRemaining, setUndoSecondsRemaining] = useState(5);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    () => new Set(catalog.productIds),
  );
  const [isSaving, setIsSaving] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      if (undoIntervalRef.current) {
        clearInterval(undoIntervalRef.current);
      }
    },
    [],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!products || !normalizedSearch) return products ?? [];

    return products.filter((product) =>
      product.name.toLowerCase().includes(normalizedSearch),
    );
  }, [products, search]);

  const selectedProducts = useMemo(() => {
    const productLookup = new Map<string, Product>();
    (products ?? []).forEach((product) =>
      productLookup.set(product._id, product),
    );

    return Array.from(selectedProductIds).map((productId) => {
      const product = productLookup.get(productId);
      return {
        _id: productId as Id<"products">,
        name: product?.name ?? "Collection item",
        price: product?.price,
        imageUrl: product?.imageUrls?.[0],
      };
    });
  }, [products, selectedProductIds]);

  const addableProducts = filteredProducts.filter(
    (product) => !selectedProductIds.has(product._id),
  );

  const clearUndoHistory = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
      undoIntervalRef.current = null;
    }
    setRecentlyRemovedProduct(null);
  };

  const addProduct = (productId: Id<"products">) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      next.add(productId);
      return next;
    });
    if (recentlyRemovedProduct?._id === productId) {
      clearUndoHistory();
    }
  };

  const removeProduct = (product: EditableCollectionProduct) => {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      next.delete(product._id);
      return next;
    });

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    if (undoIntervalRef.current) {
      clearInterval(undoIntervalRef.current);
    }

    setUndoSecondsRemaining(5);
    setRecentlyRemovedProduct(product);
    undoIntervalRef.current = setInterval(() => {
      setUndoSecondsRemaining((current) => Math.max(current - 1, 1));
    }, 1000);
    undoTimeoutRef.current = setTimeout(() => {
      setRecentlyRemovedProduct(null);
      undoTimeoutRef.current = null;
      if (undoIntervalRef.current) {
        clearInterval(undoIntervalRef.current);
        undoIntervalRef.current = null;
      }
    }, 5000);
  };

  const undoProductRemoval = () => {
    if (!recentlyRemovedProduct) return;
    addProduct(recentlyRemovedProduct._id);
    clearUndoHistory();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Collection name is required");
      return;
    }

    if (selectedProductIds.size < 2) {
      toast.error("Select at least two products");
      return;
    }

    setIsSaving(true);
    const saved = await onSave({
      name: trimmedName,
      productIds: Array.from(selectedProductIds) as Id<"products">[],
    });
    if (!saved) {
      setIsSaving(false);
    }
  };

  const handleConfirmedDelete = async () => {
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  };

  return (
    <form
      aria-label="Edit collection"
      onSubmit={(event) => void handleSubmit(event)}
      className="mx-auto min-h-screen bg-app pb-36"
    >
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#3DAC35]/10 bg-white/80 px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm"
          aria-label="Cancel collection edit"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold leading-7 tracking-[-0.025em] text-[#111910]">
            Edit Collection
          </h1>
        </div>
      </header>

      <main className="space-y-4 px-4 py-4">
        <label className="block">
          <span className="mb-1.5 block pl-1 text-base font-semibold leading-5 text-slate-700">
            Collection name
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-[55px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-base font-semibold text-slate-700 outline-none placeholder:text-slate-300 focus:border-[#3DAC35]"
            placeholder="Collection name"
          />
        </label>

        <div className="flex items-center justify-between">
          <span className="pl-1 text-base font-semibold leading-5 text-slate-700">
            Collection products
          </span>
          <button
            type="button"
            onClick={() => setShowProductPicker(true)}
            aria-label="Toggle product picker"
            className="text-lg font-bold leading-5 text-[#3DAC35]"
          >
            Add more +
          </button>
        </div>

        {products === undefined ? (
          <div className="rounded-3xl bg-white p-6 text-sm font-semibold text-slate-400">
            Loading products...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-4">
              {selectedProducts.map((product) => (
                <SelectedCollectionProductRow
                  key={product._id}
                  product={product}
                  onRemove={() => removeProduct(product)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowProductPicker(true)}
              className="flex h-[50px] w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-base font-bold text-slate-600"
            >
              Add more <span>+</span>
            </button>
          </div>
        )}
      </main>

      {showProductPicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add products to collection"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-[#111910]/50 px-4 pt-6"
          onClick={() => setShowProductPicker(false)}
        >
          <div
            className="w-full max-w-[428px] rounded-t-[28px] bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold leading-6 text-[#111910]">
                Add products
              </h2>
              <button
                type="button"
                onClick={() => setShowProductPicker(false)}
                aria-label="Close product picker"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-[#111910]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search products..."
                className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300 focus:border-[#3DAC35]"
              />
            </div>

            {addableProducts.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm font-medium text-slate-400">
                No products found
              </div>
            ) : (
              <div className="mt-3 max-h-[58vh] space-y-3 overflow-y-auto pb-2">
                {addableProducts.map((product) => (
                  <button
                    key={product._id}
                    type="button"
                    onClick={() => {
                      addProduct(product._id);
                      setShowProductPicker(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-white p-2 text-left"
                    aria-label={`Add ${product.name} to collection`}
                  >
                    <ProductThumb imageUrl={product.imageUrls?.[0]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-semibold text-slate-700">
                        {product.name}
                      </span>
                      <span className="mt-1 block text-sm font-semibold text-slate-400">
                        ₹ {product.price}
                      </span>
                    </span>
                    <span className="text-xl font-bold text-[#3DAC35]">+</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[428px] -translate-x-1/2 space-y-2 border-t border-slate-200 bg-white px-4 py-4 lg:px-4">
        <button
          type="submit"
          disabled={isSaving}
          className="h-14 w-full rounded-lg bg-slate-900 text-base font-bold text-white shadow-[0_10px_15px_-8px_rgba(15,23,42,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving..." : "Save Collection"}
        </button>
        <button
          type="button"
          onClick={() => setShowDeleteConfirmation(true)}
          className="h-12 w-full rounded-xl border border-slate-200 bg-white text-base font-bold text-slate-600"
        >
          Delete Collection
        </button>
      </div>

      {showDeleteConfirmation && (
        <DeleteCollectionConfirmationModal
          isDeleting={isDeleting}
          onCancel={() => setShowDeleteConfirmation(false)}
          onConfirm={() => void handleConfirmedDelete()}
        />
      )}

      {recentlyRemovedProduct && (
        <div className="fixed inset-x-0 top-4 z-[65] flex justify-center p-4">
          <div
            role="status"
            className="flex w-full max-w-[428px] items-center justify-between gap-4 rounded-xl bg-[#111910] px-4 py-3 text-white shadow-[0_14px_30px_-18px_rgba(15,23,42,0.95)]"
          >
            <span className="min-w-0 truncate text-sm font-semibold">
              {recentlyRemovedProduct.name} removed ({undoSecondsRemaining}s)
            </span>
            <button
              type="button"
              onClick={undoProductRemoval}
              className="flex-shrink-0 text-sm font-bold text-[#7ddc6d]"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </form>
  );
}

function DeleteCollectionConfirmationModal({
  isDeleting,
  onCancel,
  onConfirm,
}: {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [closing, setClosing] = useState(false);

  const handleCancel = () => {
    setClosing(true);
    setTimeout(onCancel, 300);
  };

  const handleConfirm = () => {
    setClosing(true);
    setTimeout(onConfirm, 300);
  };
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete Collection"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[#111910]/50 pt-6"
      onClick={handleCancel}
    >
      <div
        className={`w-full max-w-[428px] rounded-t-[32px] bg-white px-4 pb-4 pt-10 shadow-2xl ${closing ? "animate-slide-down" : "animate-slide-up"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto flex w-full max-w-[344px] flex-col items-center gap-7">
          <div className="flex flex-col items-center gap-3.5 text-center">
            <div className="flex h-[39px] w-[39px] items-center justify-center rounded-full bg-red-50 text-red-500">
              <Trash2 className="h-6 w-6" />
            </div>
            <h2 className="max-w-[310px] text-center text-2xl font-bold leading-9 text-slate-900">
              Are you sure you want to delete this collection?
            </h2>
          </div>

          <div className="w-full space-y-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isDeleting || closing}
              className="h-[52px] w-full rounded-lg bg-black text-base font-semibold leading-7 text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete Collection"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isDeleting || closing}
              className="h-[52px] w-full rounded-xl border border-slate-200 bg-slate-100 text-base font-medium leading-6 text-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SelectedCollectionProductRow({
  product,
  onRemove,
}: {
  product: EditableCollectionProduct;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <ProductThumb imageUrl={product.imageUrl} />
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold leading-5 text-slate-700">
              {product.name}
            </p>
            {product.price !== undefined && (
              <p className="mt-2 text-base font-semibold leading-5 text-slate-400">
                ₹ {product.price}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#ff7d7d]"
          aria-label={`Remove ${product.name} from collection`}
        >
          <Trash2 className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}

function ProductThumb({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className="h-[81px] w-[81px] flex-shrink-0 overflow-hidden rounded-[10px] border border-slate-300 bg-slate-100">
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300">
          <ImageIcon className="h-7 w-7" />
        </div>
      )}
    </div>
  );
}
