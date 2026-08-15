import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useFirebaseQuery as useQuery } from "../../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../../lib/firebase/mutations";
import { ArrowLeft, Camera, Check, Image as ImageIcon, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api, type Id } from "../../lib/firebase/operations";
import { getErrorMessage } from "../../lib/utils";
import { compressImage } from "../../lib/imageCompression";
import { BUSINESS_TYPE_CONFIG } from "./businessTypeConfig";
import { ProductTypeFields } from "./ProductTypeFields";
import { ProductReturnPolicySection } from "./ProductReturnPolicySection";
import {
  ProductVariationSection,
  createEmptyVariant,
  type VariantFormData,
  type VariationOption,
} from "./ProductVariationSection";
import type {
  BusinessType,
  DietaryClassification,
  ProductAudience,
  ProductCustomizationOption,
  ProductTypeDetails,
  ProductReturnPolicy,
} from "../../types/product";

type ProductFormProduct = {
  _id: Id<"products">;
  name?: string;
  description?: string;
  price?: number;
  categoryId?: Id<"categories">;
  category?: {
    name?: string;
  };
  inStock?: boolean;
  imageIds?: Id<"_storage">[];
  imageUrls?: string[];
  sizeGuideImageId?: Id<"_storage">;
  sizeGuideImageUrl?: string | null;
  sizes?: Array<{
    size: string;
    price?: number;
  }>;
  productTypeDetails?: ProductTypeDetails;
  variantGroupId?: string;
  variantType?: string;
  variantValue?: string;
  colorSwatch?: string;
  returnPolicy?: ProductReturnPolicy;
};

export interface ProductFormProps {
  businessId: Id<"businesses">;
  businessType: BusinessType;
  product?: ProductFormProduct;
  onCancel: () => void;
  onSuccess: () => void;
  onEditVariant?: (variantId: string) => void;
}

type FormErrors = {
  name?: string;
  price?: string;
  description?: string;
  images?: string;
  category?: string;
  variants?: Record<number, string[]>;
};

export function ProductForm({
  businessId,
  businessType,
  product,
  onCancel,
  onSuccess,
  onEditVariant,
}: ProductFormProps) {
  const categories = useQuery(api.categories.getBusinessCategories, {
    businessId,
  });
  const createCategory = useMutation(api.categories.createCategory);
  const deleteCategory = useMutation(api.categories.deleteCategory);
  const createProduct = useMutation(api.products.createProduct);
  const updateProduct = useMutation(api.products.updateProduct);
  const generateUploadUrl = useMutation(api.businesses.generateUploadUrl);
  const addCustomVariationType = useMutation(api.businessVariationOptions.addCustomVariationType);
  const addCustomVariationValue = useMutation(api.businessVariationOptions.addCustomVariationValue);
  const variationOptions = useQuery(api.businessVariationOptions.getBusinessVariationOptions, { businessId });

  // Load existing variants when editing a product that belongs to a variant group
  const productVariants = useQuery(
    api.products.getProductVariants,
    product?.variantGroupId
      ? { productId: product._id, businessId }
      : "skip",
  );

  const config = BUSINESS_TYPE_CONFIG[businessType];
  const existingProductTypeDetails = product?.productTypeDetails;
  const defaultAudience = config.audienceOptions?.[0]?.value ?? "female";

  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [price, setPrice] = useState(product?.price?.toString() || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || "");
  const [selectedCategoryLabel, setSelectedCategoryLabel] = useState(
    product?.category?.name || "",
  );
  const [inStock, setInStock] = useState(product?.inStock ?? true);
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>(
    product?.imageUrls || [],
  );
  const [removedImageIndices, setRemovedImageIndices] = useState<Set<number>>(new Set());
  const [sizeGuideImage, setSizeGuideImage] = useState<File | null>(null);
  const [sizeGuideImagePreview, setSizeGuideImagePreview] = useState<string | null>(
    product?.sizeGuideImageUrl ?? null,
  );
  const [removeSizeGuideImage, setRemoveSizeGuideImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sizeFormat, setSizeFormat] = useState<
    "alpha" | "numeric" | "weight" | "quantity"
  >(
    existingProductTypeDetails?.sizeFormat ??
      (businessType === "home_bakery" ? "weight" : "alpha"),
  );
  const [sizes, setSizes] = useState<Array<{ size: string; price: string }>>(
    businessType === "garments"
      ? product?.sizes?.length
        ? product.sizes.map((row) => ({
            size: row.size,
            price: row.price?.toString() || "",
          }))
        : [{ size: "", price: product?.price?.toString() || "" }]
      : businessType === "home_bakery"
        ? product?.sizes?.length
          ? product.sizes.map((row) => ({
              size: row.size,
              price: row.price?.toString() || "",
            }))
          : [{ size: "", price: "" }]
        : [],
  );
  const [audience, setAudience] = useState<ProductAudience>(
    existingProductTypeDetails?.audience ?? defaultAudience,
  );
  const [dietaryClassification, setDietaryClassification] = useState<
    DietaryClassification | undefined
  >(existingProductTypeDetails?.dietaryClassification);
  const [customizationEnabled, setCustomizationEnabled] = useState(
    existingProductTypeDetails?.customizationEnabled ?? false,
  );
  const [customizationOptions, setCustomizationOptions] = useState<
    ProductCustomizationOption[]
  >(existingProductTypeDetails?.customizationOptions ?? []);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [showCategoryInput, setShowCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [hiddenSuggested, setHiddenSuggested] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`hiddenSuggested_${businessType}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [hasColorVariants, setHasColorVariants] = useState(false);
  const [variants, setVariants] = useState<VariantFormData[]>([]);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [returnPolicy, setReturnPolicy] = useState<ProductReturnPolicy>(
    product?.returnPolicy ?? {
      returnable: true,
      returnWindowDays: 7,
      acceptedConditions: ["unused"],
    },
  );

  const parentSizeOptions = sizes
    .map((row) => ({ size: row.size.trim(), price: row.price.trim() }))
    .filter((row) => row.size);
  const parentSizeOptionsKey = parentSizeOptions
    .map((row) => `${row.size}\u0000${row.price}`)
    .join("\u0001");

  const handleAddCustomVariationType = async (variantType: string) => {
    return await addCustomVariationType({ businessId, variantType });
  };

  const handleAddCustomVariationValue = async (variantType: string, value: string) => {
    return await addCustomVariationValue({ businessId, variantType, value });
  };

  useEffect(() => {
    localStorage.setItem(`hiddenSuggested_${businessType}`, JSON.stringify(hiddenSuggested));
  }, [hiddenSuggested, businessType]);

  // Derive read-only existing variants from query (excludes parent product)
  const existingVariants = product?.variantGroupId && productVariants && productVariants.length > 0
    ? productVariants.filter((v) => v._id !== product._id)
    : [];

  useEffect(() => {
    if (!hasColorVariants || businessType === "handicrafts") {
      return;
    }

    setVariants((currentVariants) => {
      const nextVariants = currentVariants.map((variant) => {
        const previousPrices = new Map(
          variant.sizes
            .filter((row) => row.size.trim())
            .map((row) => [row.size.trim(), row.price]),
        );
        const nextSizes = parentSizeOptions.length > 0
          ? parentSizeOptions.map((option) => ({
              size: option.size,
              price: previousPrices.get(option.size) ?? option.price,
            }))
          : [{ size: "", price: "" }];

        const unchanged =
          variant.sizes.length === nextSizes.length &&
          variant.sizes.every(
            (row, index) =>
              row.size === nextSizes[index].size &&
              row.price === nextSizes[index].price,
          );

        return unchanged ? variant : { ...variant, sizes: nextSizes };
      });

      return nextVariants.every((variant, index) => variant === currentVariants[index])
        ? currentVariants
        : nextVariants;
    });
  }, [businessType, hasColorVariants, parentSizeOptionsKey]);

  // When user enables variants, pre-populate with existing ones
  const handleHasColorVariantsChange = (enabled: boolean) => {
    setHasColorVariants(enabled);
    if (enabled && existingVariants.length > 0 && variants.length === 0) {
      const isSimplePrice = businessType === "handicrafts";
      const mapped = existingVariants.map((v) => ({
        id: v._id,
        _id: v._id,
        variantType:
          v.variantType?.trim().toLowerCase() === "weight"
            ? ""
            : v.variantType || "",
        variantValue:
          v.variantType?.trim().toLowerCase() === "weight"
            ? ""
            : v.variantValue || v.colorName || "",
        colorSwatch: v.colorSwatch || "",
        sizes: isSimplePrice
          ? [{ size: "", price: v.price?.toString() || "" }]
          : v.sizes?.map((s) => ({
              size: s.size,
              price: s.price?.toString() || "",
            })) || [],
        inStock: v.inStock ?? true,
        images: [],
        imagePreviews: v.imageUrls || [],
      }));
      setVariants(mapped);
    } else if (enabled && variants.length === 0) {
      const nextVariant = createEmptyVariant();
      if (businessType !== "handicrafts" && parentSizeOptions.length > 0) {
        nextVariant.sizes = parentSizeOptions.map((option) => ({ ...option }));
      }
      setVariants([nextVariant]);
    }
  };

  const MAX_IMAGES = 5;
  const slots = Array.from({ length: MAX_IMAGES });
  const suggestedCategories = categories ?? [];
  const categoryOptions = [
    ...suggestedCategories,
    ...config.categorySuggestions
      .filter(
        (label) =>
          !suggestedCategories.some(
            (category) => category.name.toLowerCase() === label.toLowerCase(),
          ),
      )
      .filter((label) => !hiddenSuggested.includes(label))
      .map((label) => ({ _id: label, name: label, isSuggested: true })),
  ];

  const handleImageAdd = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const available = MAX_IMAGES - imagePreviews.length;
    const toAdd = files.slice(0, available);

    if (toAdd.length === 0) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    setImages((prev) => [...prev, ...toAdd]);
    if (formErrors.images) {
      setFormErrors((prev) => ({ ...prev, images: undefined }));
    }
    toAdd.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (readerEvent) =>
        setImagePreviews((prev) => [
          ...prev,
          readerEvent.target?.result as string,
        ]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) =>
      prev.filter((_, imageIndex) => imageIndex !== index),
    );
    const existingCount = product?.imageUrls?.length ?? 0;
    if (index >= existingCount) {
      setImages((prev) =>
        prev.filter((_, imageIndex) => imageIndex !== index - existingCount),
      );
    } else {
      setRemovedImageIndices((prev) => new Set(prev).add(index));
    }
  };

  const handleSizeGuideImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSizeGuideImage(file);
    setRemoveSizeGuideImage(false);
    const reader = new FileReader();
    reader.onload = () => setSizeGuideImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearSizeGuideImage = () => {
    setSizeGuideImage(null);
    setSizeGuideImagePreview(null);
    setRemoveSizeGuideImage(Boolean(product?.sizeGuideImageId));
  };

  const updateSizeRow = (
    index: number,
    key: "size" | "price",
    value: string,
  ) => {
    if (key === "price" && formErrors.price) {
      setFormErrors((prev) => ({ ...prev, price: undefined }));
    }
    setSizes((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    );
  };

  const addSizeRow = () => {
    setSizes((prev) => [...prev, { size: "", price: "" }]);
  };

  const removeSizeRow = (index: number) => {
    setSizes((prev) =>
      prev.length === 1
        ? [{ size: "", price: "" }]
        : prev.filter((_, rowIndex) => rowIndex !== index),
    );
  };

  const handleCategoryCreate = async () => {
    const nextLabel = newCategoryName.trim();
    if (!nextLabel) {
      setCategoryError("Enter a category name");
      return;
    }

    const normalizedNextLabel = nextLabel.toLowerCase();
    const hasDuplicate = suggestedCategories.some(
      (category) => category.name.trim().toLowerCase() === normalizedNextLabel,
    );

    if (hasDuplicate) {
      setCategoryError("Category already exists");
      return;
    }

    setCategoryError("");
    setIsAddingCategory(true);
    try {
      const nextId = await createCategory({ businessId, name: nextLabel });
      setCategoryId(nextId);
      setSelectedCategoryLabel(nextLabel);
      setNewCategoryName("");
      setShowCategoryInput(false);
      toast.success("Category added");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string, catName: string, isSuggested?: boolean) => {
    if (isSuggested) {
      setHiddenSuggested((prev) => [...prev, catName]);
      if (selectedCategoryLabel === catName) {
        setCategoryId("");
        setSelectedCategoryLabel("");
      }
      return;
    }
    try {
      await deleteCategory({ categoryId: catId as Id<"categories"> });
      if (categoryId === catId && selectedCategoryLabel === catName) {
        setCategoryId("");
        setSelectedCategoryLabel("");
      }
      toast.success("Category deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const buildProductTypeDetails = (): ProductTypeDetails => {
    if (businessType === "garments") {
      return {
        audience,
        sizeFormat: sizeFormat === "numeric" ? "numeric" : "alpha",
      };
    }

    if (businessType === "home_bakery") {
      return {
        dietaryClassification,
        customizationEnabled,
        customizationOptions: customizationEnabled ? customizationOptions : [],
      };
    }

    return {
      audience,
      customizationEnabled,
      customizationOptions: customizationEnabled ? customizationOptions : [],
    };
  };

  const uploadImageFiles = async (
    files: File[],
    existingIds: Id<"_storage">[] = [],
    removedIndices: Set<number> = new Set(),
  ): Promise<Id<"_storage">[]> => {
    const filteredExisting = existingIds.filter(
      (_, i) => !removedIndices.has(i),
    );
    if (files.length === 0) return filteredExisting;

    const uploaded = await Promise.all(
      files.map(async (file) => {
        const compressed = await compressImage(file);
        const uploadUrl = await generateUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": compressed.type },
          body: compressed,
        });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = await response.json();
        return storageId as Id<"_storage">;
      }),
    );
    return [...filteredExisting, ...uploaded].slice(0, MAX_IMAGES);
  };

  const uploadImageFile = async (file: File): Promise<Id<"_storage">> => {
    const compressed = await compressImage(file);
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": compressed.type },
      body: compressed,
    });
    if (!response.ok) throw new Error("Upload failed");
    const { storageId } = await response.json();
    return storageId as Id<"_storage">;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();

    let effectivePrice: string;
    if (hasColorVariants) {
      effectivePrice =
        businessType === "garments" || businessType === "home_bakery"
          ? sizes.find((row) => row.price.trim())?.price.trim() || ""
          : price.trim();
    } else {
      effectivePrice =
        businessType === "garments" || businessType === "home_bakery"
          ? sizes.find((row) => row.price.trim())?.price.trim() || ""
          : price.trim();
    }

    const nextErrors: FormErrors = {};
    if (!trimmedName) {
      nextErrors.name = "Product name is required";
    } else if (trimmedName.length > 120) {
      nextErrors.name = "Product name must be under 120 characters";
    }

    if (!effectivePrice) {
      nextErrors.price = "Price is required";
    } else {
      const parsedPrice = parseFloat(effectivePrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        nextErrors.price = "Price must be greater than 0";
      } else if (parsedPrice > 999999) {
        nextErrors.price = "Price is too high";
      } else if ((effectivePrice.split(".")[1]?.length ?? 0) > 2) {
        nextErrors.price = "Max 2 decimal places";
      }
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length > 500) {
      nextErrors.description = "Description must be under 500 characters";
    }

    if (!product && imagePreviews.length === 0) {
      nextErrors.images = "At least 1 product image required";
    }

    if (!selectedCategoryLabel.trim() && !categoryId) {
      nextErrors.category = "Please select a category";
    }

    if (hasColorVariants) {
      const variationErrors: Record<number, string[]> = {};

      if (variants.length === 0) {
        variationErrors[-1] = ["Add at least one variation"];
      }

      variants.forEach((variant, variantIndex) => {
        const errors: string[] = [];
        const hasPrice = variant.sizes.some((row) => row.price.trim());
        const hasInvalidPrice = variant.sizes.some((row) => {
          if (!row.price.trim()) return false;
          const parsedPrice = parseFloat(row.price);
          return !Number.isFinite(parsedPrice) || parsedPrice <= 0;
        });
        const hasIncompleteSizePrice =
          businessType !== "handicrafts" &&
          variant.sizes.some((row) => row.size.trim() && !row.price.trim());

        if (!variant.variantType.trim()) {
          errors.push("Variation type is required");
        }
        if (!variant.variantValue.trim()) {
          errors.push("Variation value is required");
        }
        if (variant.imagePreviews.length === 0) {
          errors.push("At least one variation image is required");
        }
        if (!hasPrice) {
          errors.push("Variation price is required");
        } else if (hasInvalidPrice) {
          errors.push("Variation price must be greater than 0");
        } else if (hasIncompleteSizePrice) {
          errors.push("Enter a price for every selected size");
        }

        if (errors.length > 0) {
          variationErrors[variantIndex] = errors;
        }
      });

      if (Object.keys(variationErrors).length > 0) {
        nextErrors.variants = variationErrors;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      const fieldToId: Record<string, string> = {
        name: "product-name-input",
        images: "product-images-section",
        price: "product-price-section",
        description: "product-description-input",
        category: "product-category-section",
        variants: "product-variation-section",
      };
      const firstKey = Object.keys(nextErrors)[0];
      const targetId =
        firstKey === "variants"
          ? (() => {
              const firstVariationIndex = Object.keys(nextErrors.variants ?? {})
                .find((key) => key !== "-1");
              return firstVariationIndex === undefined
                ? "product-variation-section"
                : `product-variation-${firstVariationIndex}`;
            })()
          : fieldToId[firstKey];
      if (targetId) {
        setTimeout(() => {
          const target = document.getElementById(targetId);
          target?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        }, 150);
      }
      return;
    }

    setFormErrors({});
    setIsSubmitting(true);
    try {
      let resolvedCategoryId = categoryId || undefined;
      const trimmedCategoryLabel = selectedCategoryLabel.trim();

      if (!resolvedCategoryId && trimmedCategoryLabel) {
        const existingCategory = suggestedCategories.find(
          (category) =>
            category.name.trim().toLowerCase() ===
            trimmedCategoryLabel.toLowerCase(),
        );

        resolvedCategoryId =
          existingCategory?._id ||
          (await createCategory({
            businessId,
            name: trimmedCategoryLabel,
          }));
      }

      if (hasColorVariants) {
        const variantGroupId = product?.variantGroupId || product?._id || crypto.randomUUID();
        const parentImageIds = await uploadImageFiles(
          images,
          product?.imageIds || [],
          removedImageIndices,
        );
        const parentSizes =
          businessType === "garments" || businessType === "home_bakery"
            ? sizes
                .map((row) => ({
                  size: row.size.trim(),
                  price: row.price.trim() ? parseFloat(row.price) : undefined,
                }))
                .filter((row) => row.size)
            : [];
        const garmentSizeGuideData =
          businessType === "garments"
            ? {
                ...(sizeGuideImage
                  ? { sizeGuideImageId: await uploadImageFile(sizeGuideImage) }
                  : {}),
                ...(removeSizeGuideImage && product
                  ? { removeSizeGuideImage: true }
                  : {}),
              }
            : {};

        const parentData = {
          name: trimmedName,
          description,
          price: parseFloat(effectivePrice),
          sizes: parentSizes,
          categoryId: resolvedCategoryId,
          inStock: true,
          imageIds: parentImageIds,
          productTypeDetails: buildProductTypeDetails(),
          returnPolicy,
          variantGroupId,
          ...garmentSizeGuideData,
        };

        if (product) {
          await updateProduct({ productId: product._id, ...parentData });
        } else {
          await createProduct({ businessId, ...parentData });
        }

        for (const variant of variants) {
          // For existing variants, preserve original imageIds when no new uploads
          const existingImageIds = variant._id
            ? (productVariants?.find((v) => v._id === variant._id)?.imageIds ?? [])
            : [];
          const variantImageIds = await uploadImageFiles(variant.images, existingImageIds);
          const variantPrice =
            variant.sizes.find((s) => s.price.trim())?.price.trim() ||
            effectivePrice;

          const variantSizes = variant.sizes
            .map((row) => ({
              size: row.size.trim(),
              price: row.price.trim() ? parseFloat(row.price) : undefined,
            }))
            .filter((row) => row.size);

          const variantData = {
            businessId,
            name: `${trimmedName} - ${variant.variantValue || variant.variantType || "Variant"}`,
            description,
            price: parseFloat(variantPrice),
            sizes: variantSizes,
            categoryId: resolvedCategoryId,
            inStock: variant.inStock,
            imageIds: variantImageIds,
            productTypeDetails: buildProductTypeDetails(),
            returnPolicy,
            variantGroupId,
            variantType: variant.variantType || undefined,
            variantValue: variant.variantValue || undefined,
            colorSwatch: variant.variantType === "Color" ? variant.colorSwatch || undefined : undefined,
          };

          if (variant._id) {
            const { businessId: _bid, ...updateData } = variantData;
            await updateProduct({ productId: variant._id, ...updateData });
          } else {
            await createProduct(variantData);
          }
        }
      } else {
        let imageIds: Id<"_storage">[] = await uploadImageFiles(
          images,
          product?.imageIds || [],
          removedImageIndices,
        );
        const garmentSizeGuideData =
          businessType === "garments"
            ? {
                ...(sizeGuideImage
                  ? { sizeGuideImageId: await uploadImageFile(sizeGuideImage) }
                  : {}),
                ...(removeSizeGuideImage && product
                  ? { removeSizeGuideImage: true }
                  : {}),
              }
            : {};

        const data = {
          name: trimmedName,
          description,
          price: parseFloat(effectivePrice),
          sizes:
            businessType === "garments" || businessType === "home_bakery"
              ? sizes
                  .map((row) => ({
                    size: row.size.trim(),
                    price: row.price.trim() ? parseFloat(row.price) : undefined,
                  }))
                  .filter((row) => row.size)
              : [],
          categoryId: resolvedCategoryId,
          inStock,
          imageIds,
          productTypeDetails: buildProductTypeDetails(),
          returnPolicy,
          ...garmentSizeGuideData,
          ...(product?.variantGroupId ? { variantGroupId: product.variantGroupId } : {}),
          ...(product?.variantType ? { variantType: product.variantType } : {}),
          ...(product?.variantValue ? { variantValue: product.variantValue } : {}),
          ...(product?.colorSwatch ? { colorSwatch: product.colorSwatch } : {}),
        };

        if (product) {
          await updateProduct({ productId: product._id, ...data });
        } else {
          await createProduct({ businessId, ...data });
        }
      }

      console.log(
        `[ProductForm] ${product ? "Updated" : "Created"} product:`,
        {
          name: trimmedName,
          price: parseFloat(effectivePrice),
          categoryId: resolvedCategoryId,
          inStock,
          sizes: sizes.filter((s) => s.size.trim()).length,
          images: imagePreviews.length,
          hasColorVariants,
          variantCount: hasColorVariants ? variants.length : 0,
        },
      );

      onSuccess();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f2]">
      <div className="flex flex-col bg-[#f5f6f2]">
        <div className="flex items-center gap-3 px-4 pb-4 pt-5">
          <button
            onClick={onCancel}
            className="rounded-full p-1 text-slate-700"
            type="button"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold text-slate-800">
            {product ? "Edit Product" : "Add New Product"}
          </h2>
        </div>

        <form
          id="product-form"
          onSubmit={handleSubmit}
          className="space-y-5 px-4 pb-28"
        >
          <section id="product-images-section" className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-800">
              Product Images
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Add up to 5 photos of your product
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {slots.map((_, index) => {
                const preview = imagePreviews[index];
                const showAddButton =
                  !preview && (index === 0 || imagePreviews[index - 1]);

                return (
                  <div
                    key={index}
                    className={`relative aspect-square overflow-hidden rounded-xl ${
                      preview
                        ? "bg-[#f0f1ed]"
                        : showAddButton
                          ? "border border-dashed border-[#85cf82] bg-[#f4fbf3]"
                          : "border border-[#eceee8] bg-[#f7f8f4]"
                    }`}
                  >
                    {preview ? (
                      <>
                        <img
                          src={preview}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/80"
                        >
                          <X className="h-3.5 w-3.5 text-white" />
                        </button>
                      </>
                    ) : showAddButton ? (
                      <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-1">
                        <Camera className="h-5 w-5 text-[#4fb64a]" />
                        <span className="text-[10px] font-semibold text-[#4fb64a]">
                          Add Photo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageAdd}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {formErrors.images && (
              <p className="mt-3 text-sm font-semibold text-red-500">
                {formErrors.images}
              </p>
            )}
          </section>

          {businessType === "garments" && (
            <section className="space-y-4">
              <h3 className="text-lg font-bold leading-7 text-slate-900">
                Size guide <span className="text-base font-normal text-slate-500">(Optional)</span>
              </h3>
              <div className="rounded-xl border border-[#3dac35]/10 bg-white p-5 shadow-sm">
                {sizeGuideImagePreview ? (
                  <div className="relative mx-auto w-fit overflow-hidden rounded-xl border border-[#3dac35] bg-[#3dac35]/5">
                    <img
                      src={sizeGuideImagePreview}
                      alt="Size guide preview"
                      className="h-36 w-72 object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearSizeGuideImage}
                      aria-label="Remove size guide"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/80"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="flex min-h-[146px] cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-[#3dac35] bg-[#3dac35]/5 px-6 py-8 text-center">
                    <div>
                      <p className="text-base font-bold tracking-[-0.015em] text-slate-900">Upload Size Guide</p>
                      <p className="mt-1 text-sm text-slate-500">Help customers choose the right size.</p>
                    </div>
                    <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 shadow-sm">
                      <Upload className="h-4 w-4" />
                      Choose File
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleSizeGuideImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </section>
          )}

          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-800">
              General Information
            </h3>

            <div className="mt-4 space-y-4">
              <Field label="Product Name">
                <input
                  id="product-name-input"
                  aria-label="Product Name"
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (formErrors.name) {
                      setFormErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  className={`w-full rounded-xl border bg-[#f7f8f4] px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82] ${
                    formErrors.name ? "border-red-300" : "border-[#e8ebe3]"
                  }`}
                  placeholder="e.g. Minimalist Ceramic Vase"
                  required
                />
                {formErrors.name && (
                  <p className="mt-2 text-sm font-semibold text-red-500">
                    {formErrors.name}
                  </p>
                )}
              </Field>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">
                  Product In Stock
                </span>
                <button
                  type="button"
                  onClick={() => setInStock(!inStock)}
                  className={`flex h-7 w-12 items-center rounded-full p-1 transition ${
                    inStock ? "bg-[#57bb4f]" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-white transition ${
                      inStock ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <Field label="Description">
                <textarea
                  id="product-description-input"
                  aria-label="Description"
                  value={description}
                  onChange={(event) => {
                    setDescription(event.target.value);
                    if (formErrors.description) {
                      setFormErrors((prev) => ({ ...prev, description: undefined }));
                    }
                  }}
                  rows={4}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-[#e8ebe3] bg-[#f7f8f4] px-4 py-3 text-sm text-slate-700 outline-none focus:border-[#85cf82]"
                  placeholder="Tell customers about your product details, materials, and size..."
                />
                <div className="mt-1 flex justify-between">
                  {formErrors.description ? (
                    <p className="text-sm font-semibold text-red-500">
                      {formErrors.description}
                    </p>
                  ) : <span />}
                  <span className="text-sm text-slate-400">
                    {description.length}/500
                  </span>
                </div>
              </Field>
            </div>
          </section>

          <section id="product-category-section" className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="text-[15px] font-bold text-slate-800">
              Categorization
            </h3>

            <div className="mt-4 space-y-4">
              <Field label="Category">
                <div className="flex flex-wrap gap-2">
                  {categoryOptions.map((category) => {
                    const isSuggested =
                      "isSuggested" in category && category.isSuggested;
                    const selected =
                      categoryId === category._id ||
                      (!categoryId &&
                        selectedCategoryLabel.toLowerCase() ===
                          category.name.toLowerCase());
                    return (
                      <div
                        key={category._id}
                        className={`inline-flex items-center rounded-full transition ${
                          selected && !isDeletingCategory
                            ? "bg-[#58bb4f] text-white"
                            : "bg-[#f2f3ef] text-slate-500"
                        } ${isDeletingCategory ? "bg-red-50 ring-1 ring-red-300" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (isDeletingCategory) {
                              handleDeleteCategory(category._id, category.name, isSuggested);
                              return;
                            }
                            if (isSuggested) {
                              setCategoryId("");
                            } else {
                              setCategoryId(category._id);
                            }
                            setSelectedCategoryLabel(category.name);
                            if (formErrors.category) {
                              setFormErrors((prev) => ({ ...prev, category: undefined }));
                            }
                          }}
                          className="px-3 py-1.5 text-sm font-semibold rounded-full transition focus:outline-none"
                        >
                          {isDeletingCategory ? (
                            <span className="flex items-center gap-1.5">
                              <Trash2 className="h-3 w-3 text-red-500" />
                              {category.name}
                            </span>
                          ) : (
                            category.name
                          )}
                        </button>
                      </div>
                    );
                  })}

                  <div className="flex gap-2 w-full mt-1">
                    {!isDeletingCategory ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDeletingCategory(true);
                            setShowCategoryInput(false);
                            setNewCategoryName("");
                            setCategoryError("");
                          }}
                          className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600"
                        >
                          <span className="flex items-center gap-1">
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCategoryInput(true);
                            setCategoryError("");
                          }}
                          disabled={isAddingCategory || showCategoryInput}
                          className="rounded-full bg-[#f2f3ef] px-3 py-1.5 text-sm font-semibold text-slate-500"
                        >
                          + Add New
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsDeletingCategory(false)}
                        className="rounded-full bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-600"
                      >
                        Done
                      </button>
                    )}
                  </div>
                </div>

                {formErrors.category && (
                  <p className="mt-2 text-sm font-semibold text-red-500">
                    {formErrors.category}
                  </p>
                )}

                {showCategoryInput && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-[#dbe7d7] bg-[#f7fbf5] px-3 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCategoryInput(false);
                        setNewCategoryName("");
                        setCategoryError("");
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400"
                    >
                      <X className="h-4 w-4" />
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        aria-label="New Category"
                        type="text"
                        value={newCategoryName}
                        onChange={(event) => {
                          setNewCategoryName(event.target.value);
                          if (categoryError) setCategoryError("");
                        }}
                        placeholder="Type category name"
                        className={`flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400 ${
                          categoryError ? "text-red-600" : "text-slate-700"
                        }`}
                        autoFocus
                      />
                      {categoryError && (
                        <span className="shrink-0 text-sm font-semibold text-red-500">
                          {categoryError}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleCategoryCreate}
                      disabled={isAddingCategory || !newCategoryName.trim()}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#58bb4f] text-white disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </Field>
            </div>
          </section>

          <ProductTypeFields
            businessType={businessType}
            audience={audience}
            dietaryClassification={dietaryClassification}
            customizationEnabled={customizationEnabled}
            customizationOptions={customizationOptions}
            sizeFormat={sizeFormat}
            sizes={sizes}
            priceError={
              businessType === "garments" || businessType === "home_bakery"
                ? formErrors.price
                : undefined
            }
            onAudienceChange={setAudience}
            onDietaryClassificationChange={setDietaryClassification}
            onCustomizationEnabledChange={setCustomizationEnabled}
            onCustomizationOptionsChange={setCustomizationOptions}
            onSizeFormatChange={setSizeFormat}
            onUpdateSizeRow={updateSizeRow}
            onAddSizeRow={addSizeRow}
            onRemoveSizeRow={removeSizeRow}
          />

          <ProductVariationSection
            hasColorVariants={hasColorVariants}
            onHasColorVariantsChange={handleHasColorVariantsChange}
            existingVariants={existingVariants}
            variants={variants}
            onVariantsChange={setVariants}
            sizeFormat={sizeFormat}
            sizeOptions={parentSizeOptions}
            priceError={hasColorVariants ? formErrors.price : undefined}
            simplePrice={businessType === "handicrafts"}
            variationOptions={(variationOptions ?? config.variationOptions) as VariationOption[]}
            variationOptionsLoading={variationOptions === undefined}
            onAddCustomType={handleAddCustomVariationType}
            onAddCustomValue={handleAddCustomVariationValue}
            onEditVariant={onEditVariant}
            variantErrors={formErrors.variants}
          />

          <ProductReturnPolicySection
            value={returnPolicy}
            onChange={setReturnPolicy}
          />


          {businessType === "handicrafts" && (
            <section id="product-price-section" className="rounded-2xl bg-white p-4 shadow-sm">
              <h3 className="text-[15px] font-bold text-slate-800">Pricing</h3>

              <div className="mt-4">
                <Field label="Price">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
                      ₹
                    </span>
                    <input
                      id="product-price-input"
                      aria-label="Price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={price}
                      onChange={(event) => {
                        setPrice(event.target.value);
                        if (formErrors.price) {
                          setFormErrors((prev) => ({
                            ...prev,
                            price: undefined,
                          }));
                        }
                      }}
                      className={`w-full rounded-xl border bg-[#f7f8f4] py-3 pl-7 pr-3 text-sm text-slate-700 outline-none focus:border-[#85cf82] ${
                        formErrors.price ? "border-red-300" : "border-[#e8ebe3]"
                      }`}
                      placeholder="237"
                    />
                  </div>
                  {formErrors.price && (
                    <p className="mt-2 text-sm font-semibold text-red-500">
                      {formErrors.price}
                    </p>
                  )}
                </Field>
              </div>
            </section>
          )}

          <div className="fixed bottom-0 z-20 border-t border-slate-200 bg-white w-[428px] max-w-full left-1/2 -translate-x-1/2 pb-4 pt-3">
            <div className="px-4">
              <button
                type="submit"
                form="product-form"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1b2340] py-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {isSubmitting
                  ? "Saving..."
                  : product
                    ? "Update Product"
                    : "Save Product"}
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}
