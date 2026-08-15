import { useCallback, useEffect, useRef, useState } from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import { normalizeIndianWhatsappPhone } from "../lib/phone";
import {
  BRAND_PALETTE_PAGE_SIZE,
  buildFallbackPalette,
  getGeneratedBrandPalettes,
  type GeneratedBrandPalette,
} from "../lib/brandPalette";
import { HexColorPicker } from "react-colorful";
import { storefrontUrl } from "../lib/urls";
import {
  Hash,
  Zap,
  ArrowLeft,
  Trash2,
  Plus,
  Store,
  Tag,
  Languages,
  ChevronDown,
  ExternalLink,
  GripVertical,
  CreditCard,
} from "lucide-react";
import { ImageCropper } from "./ImageCropper";

interface BrandPalette {
  seedColor: string;
  mode: "light" | "dark";
  colors: string[];
  primaryColor: string;
}

interface Business {
  _id: Id<"businesses">;
  name: string;
  slug: string;
  themeColor: string;
  brandPalette?: BrandPalette;
  logoId?: Id<"_storage">;
  logoUrl?: string | null;
  whatsappPhone: string;
  description?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    threads?: string;
    x?: string;
  };
  shippingBannerText?: string;
  featuredProductIds?: Id<"products">[];
  address?: {
    buildingNo: string;
    street: string;
    town: string;
    district: string;
    pincode: string;
    state: string;
    country: string;
  };
  serviceRegion?: string;
  businessType?: string;
  fssaiNumber?: string;
  fssaiDocId?: Id<"_storage">;
  fssaiDocUrl?: string | null;
  upiId?: string;
}

interface StoreSettingsProps {
  business: Business;
}

const LANGUAGES = [
  "English - United States",
  "English - United Kingdom",
  "Tamil",
  "Hindi",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
];

const DEFAULT_THEME_COLOR = "#3dac35";
const PALETTE_DEBOUNCE_MS = 450;

function createStoredPaletteId(palette: BrandPalette) {
  return [
    "stored-palette",
    palette.mode,
    palette.seedColor,
    palette.primaryColor,
    ...palette.colors,
  ]
    .join("|")
    .toLowerCase();
}

function createPaletteFromBusiness(
  palette: BrandPalette,
): GeneratedBrandPalette {
  const normalizedPrimary = palette.primaryColor.toLowerCase();
  const fallbackPalette = buildFallbackPalette(normalizedPrimary);
  const normalizedColors = [
    normalizedPrimary,
    palette.colors[1]?.toLowerCase() ?? fallbackPalette.colors[1],
    fallbackPalette.colors[2],
  ] as [string, string, string];

  return {
    id: createStoredPaletteId(palette),
    seedColor: palette.seedColor.toLowerCase(),
    mode: "light",
    colors: normalizedColors,
    primaryColor: normalizedPrimary,
  };
}

function createFallbackPalette(themeColor: string): GeneratedBrandPalette {
  try {
    return buildFallbackPalette(themeColor);
  } catch {
    return buildFallbackPalette(DEFAULT_THEME_COLOR);
  }
}

function getInitialSelectedPalette(business: Business): GeneratedBrandPalette {
  if (business.brandPalette) {
    try {
      return createPaletteFromBusiness(business.brandPalette);
    } catch {
      return createFallbackPalette(
        business.brandPalette.primaryColor || business.themeColor,
      );
    }
  }

  return createFallbackPalette(business.themeColor);
}

function getStorefrontPalettePreview(palette: GeneratedBrandPalette): string[] {
  return palette.colors;
}

export function StoreSettings({ business }: StoreSettingsProps) {
  const initialSelectedPalette = getInitialSelectedPalette(business);
  const [name, setName] = useState(business.name);
  const [whatsappPhone, setWhatsappPhone] = useState(business.whatsappPhone);
  const [themeColor, setThemeColor] = useState(initialSelectedPalette.primaryColor);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(
    business.logoUrl || null,
  );
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [language, setLanguage] = useState("English - United States");
  const [description, setDescription] = useState(business.description || "");
  const [socialLinks, setSocialLinks] = useState({
    instagram: business.socialLinks?.instagram || "",
    facebook: business.socialLinks?.facebook || "",
    threads: business.socialLinks?.threads || "",
    x: business.socialLinks?.x || "",
  });
  const [seedColor, setSeedColor] = useState(initialSelectedPalette.seedColor);
  const [draftSeedColor, setDraftSeedColor] = useState(initialSelectedPalette.seedColor);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [palettePool, setPalettePool] = useState<GeneratedBrandPalette[]>([
    initialSelectedPalette,
  ]);
  const [paletteWindowStart, setPaletteWindowStart] = useState(0);
  const [generatedPalettes, setGeneratedPalettes] = useState<
    GeneratedBrandPalette[]
  >([initialSelectedPalette]);
  const [selectedPalette, setSelectedPalette] = useState(initialSelectedPalette);
  const [isGeneratingPalettes, setIsGeneratingPalettes] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const updateBusiness = useMutation(api.businesses.updateBusiness);
  const generateUploadUrl = useMutation(api.businesses.generateUploadUrl);

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSavedField, setLastSavedField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef<Record<string, any>>({});

  const [fssaiNumber, setFssaiNumber] = useState(business.fssaiNumber || "");
  const [fssaiDocUrl, setFssaiDocUrl] = useState<string | null>(business.fssaiDocUrl || null);
  const [fssaiPdfFile, setFssaiPdfFile] = useState<File | null>(null);
  const [isUploadingFssai, setIsUploadingFssai] = useState(false);
  const [upiId, setUpiId] = useState(business.upiId || "");

  useEffect(() => {
    stateRef.current = {
      name,
      whatsappPhone,
      description,
      socialLinks,
      shippingBannerText,
      featuredProductIds,
      selectedPalette,
      logoFile,
      business,
      buildingNo, street, town, district, pincode, state, country, serviceRegion,
      fssaiNumber,
      fssaiPdfFile,
      upiId,
    };
  });

  const triggerAutoSave = useCallback((fieldName?: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus("saving");
    saveTimerRef.current = setTimeout(async () => {
      if (fieldName) setSavingField(fieldName);
      const s = stateRef.current;
      const normalizedWhatsappPhone = normalizeIndianWhatsappPhone(s.whatsappPhone);
      if (!normalizedWhatsappPhone || !s.name) {
        setSaveStatus("idle");
        if (fieldName) setSavingField(null);
        return;
      }
      try {
        let logoId = s.business.logoId;
        if (s.logoFile) {
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": s.logoFile.type },
            body: s.logoFile,
          });
          if (!result.ok) throw new Error("Failed to upload logo");
          const { storageId } = await result.json();
          logoId = storageId;
        }

        let fssaiDocId = s.business.fssaiDocId;
        if (s.fssaiPdfFile) {
          setIsUploadingFssai(true);
          const uploadUrl = await generateUploadUrl();
          const result = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/pdf" },
            body: s.fssaiPdfFile,
          });
          if (!result.ok) throw new Error("Failed to upload FSSAI certificate");
          const { storageId } = await result.json();
          fssaiDocId = storageId;
          setIsUploadingFssai(false);
        }

        await updateBusiness({
          businessId: s.business._id,
          name: s.name,
          themeColor: s.selectedPalette.primaryColor,
          brandPalette: {
            seedColor: s.selectedPalette.seedColor,
            mode: s.selectedPalette.mode,
            colors: s.selectedPalette.colors,
            primaryColor: s.selectedPalette.primaryColor,
          },
          logoId: logoId!,
          whatsappPhone: normalizedWhatsappPhone,
          description: s.description || undefined,
          socialLinks: s.socialLinks,
          shippingBannerText: s.shippingBannerText || undefined,
          featuredProductIds:
            s.featuredProductIds.length > 0 ? s.featuredProductIds : undefined,
          address: s.buildingNo || s.street || s.town || s.district || s.pincode || s.state || s.country
            ? { buildingNo: s.buildingNo, street: s.street, town: s.town, district: s.district, pincode: s.pincode, state: s.state, country: s.country }
            : undefined,
          serviceRegion: s.serviceRegion || undefined,
          fssaiNumber: s.fssaiNumber || undefined,
          fssaiDocId: fssaiDocId || undefined,
          upiId: s.upiId || undefined,
        });
        if (s.logoFile) {
          setLogoFile(null);
        }
        if (s.fssaiPdfFile) {
          setFssaiPdfFile(null);
        }
        setSavingField(null);
        setSaveStatus("saved");
        if (fieldName) {
          setLastSavedField(fieldName);
          setTimeout(() => setLastSavedField(null), 2000);
        }
        setTimeout(() => {
          setSaveStatus((prev) => (prev === "saved" ? "idle" : prev));
        }, 2000);
      } catch (error: any) {
        setSavingField(null);
        setSaveStatus("error");
        toast.error(error.message || "Failed to save");
      }
    }, 1500);
  }, [updateBusiness, generateUploadUrl, setLogoFile]);
  const hasInitializedPaletteGenerator = useRef(false);
  const paletteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const paletteRequestVersion = useRef(0);
  const queuedPaletteRequest = useRef<{
    requestVersion: number;
    seedColor: string;
  } | null>(null);
  const isPaletteGenerationInFlight = useRef(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const categories = useQuery(api.categories.getBusinessCategories, {
    businessId: business._id,
  });
  const deleteCategory = useMutation(api.categories.deleteCategory);
  const createCategory = useMutation(api.categories.createCategory);
  const reorderCategories = useMutation(api.categories.reorderCategories);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [shippingBannerText, setShippingBannerText] = useState(
    business.shippingBannerText || "",
  );
  const [featuredProductIds, setFeaturedProductIds] = useState<Id<"products">[]>(
    business.featuredProductIds || [],
  );
  const [buildingNo, setBuildingNo] = useState(business.address?.buildingNo || "");
  const [street, setStreet] = useState(business.address?.street || "");
  const [town, setTown] = useState(business.address?.town || "");
  const [district, setDistrict] = useState(business.address?.district || "");
  const [pincode, setPincode] = useState(business.address?.pincode || "");
  const [state, setState] = useState(business.address?.state || "");
  const [country, setCountry] = useState(business.address?.country || "");
  const [serviceRegion, setServiceRegion] = useState(business.serviceRegion || "");
  const allProducts = useQuery(
    api.products.getPublicProducts,
    { businessId: business._id },
  );

  const storeUrl = storefrontUrl(business.slug);

  useEffect(() => {
    setThemeColor(selectedPalette.primaryColor);
  }, [selectedPalette]);

  const clearPaletteDebounce = useCallback(() => {
    if (paletteDebounceTimerRef.current) {
      clearTimeout(paletteDebounceTimerRef.current);
      paletteDebounceTimerRef.current = null;
    }
  }, []);

  const runPaletteGeneration = useCallback(
    async (nextSeedColor: string, requestVersion: number) => {
    const request = {
      requestVersion,
      seedColor: nextSeedColor.toLowerCase(),
    };

    const executeRequest = async (activeRequest: typeof request) => {
      if (isPaletteGenerationInFlight.current) {
        queuedPaletteRequest.current = activeRequest;
        return;
      }

      isPaletteGenerationInFlight.current = true;
      setIsGeneratingPalettes(true);
      setPaletteError(null);

      try {
        const palettes = await getGeneratedBrandPalettes(activeRequest.seedColor);
        if (activeRequest.requestVersion !== paletteRequestVersion.current) {
          return;
        }
        const nextVisiblePalettes = palettes.slice(0, BRAND_PALETTE_PAGE_SIZE);
        setPalettePool(palettes);
        setPaletteWindowStart(0);
        setGeneratedPalettes(nextVisiblePalettes);
        setSelectedPalette(nextVisiblePalettes[0]);
      } catch (_error) {
        if (activeRequest.requestVersion !== paletteRequestVersion.current) {
          return;
        }

        const fallbackPalette = buildFallbackPalette(activeRequest.seedColor);
        setPalettePool([fallbackPalette]);
        setPaletteWindowStart(0);
        setGeneratedPalettes([fallbackPalette]);
        setSelectedPalette(fallbackPalette);
        setPaletteError("Couldn't generate palettes. Showing a fallback option.");
      } finally {
        isPaletteGenerationInFlight.current = false;

        if (
          queuedPaletteRequest.current &&
          queuedPaletteRequest.current.requestVersion !== activeRequest.requestVersion
        ) {
          const nextQueuedRequest = queuedPaletteRequest.current;
          queuedPaletteRequest.current = null;
          void executeRequest(nextQueuedRequest);
          return;
        }

        queuedPaletteRequest.current = null;
        if (
          activeRequest.requestVersion === paletteRequestVersion.current ||
          !paletteDebounceTimerRef.current
        ) {
          setIsGeneratingPalettes(false);
        }
      }
    };

    await executeRequest(request);
    },
    [],
  );

  useEffect(() => {
    if (!hasInitializedPaletteGenerator.current) {
      hasInitializedPaletteGenerator.current = true;
      return;
    }

    clearPaletteDebounce();
    const requestVersion = paletteRequestVersion.current;
    paletteDebounceTimerRef.current = setTimeout(() => {
      paletteDebounceTimerRef.current = null;
      void runPaletteGeneration(seedColor, requestVersion);
    }, PALETTE_DEBOUNCE_MS);

    return clearPaletteDebounce;
  }, [clearPaletteDebounce, runPaletteGeneration, seedColor]);

  useEffect(() => {
    setDraftSeedColor(seedColor);
  }, [seedColor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        handleSeedColorChange(draftSeedColor);
        setShowColorPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [draftSeedColor]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const handleLogoChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      if (src) {
        setCropImageSrc(src);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedFile: File) => {
    setLogoFile(croppedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
      setCropImageSrc(null);
    };
    reader.readAsDataURL(croppedFile);
    triggerAutoSave();
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleSeedColorChange = useCallback((value: string) => {
    paletteRequestVersion.current += 1;
    setSeedColor(value.toLowerCase());
    setPaletteError(null);
  }, []);

  const handleRegeneratePalettes = () => {
    clearPaletteDebounce();
    const nextWindowStart = paletteWindowStart + BRAND_PALETTE_PAGE_SIZE;
    if (nextWindowStart < palettePool.length) {
      const nextVisiblePalettes = palettePool.slice(
        nextWindowStart,
        nextWindowStart + BRAND_PALETTE_PAGE_SIZE,
      );
      setPaletteWindowStart(nextWindowStart);
      setGeneratedPalettes(nextVisiblePalettes);
      setSelectedPalette(nextVisiblePalettes[0]);
      setPaletteError(null);
      return;
    }

    paletteRequestVersion.current += 1;
    void runPaletteGeneration(seedColor, paletteRequestVersion.current);
  };



  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setIsAddingCategory(true);
    try {
      await createCategory({
        businessId: business._id,
        name: newCategoryName.trim(),
      });
      toast.success("Category added!");
      setNewCategoryName("");
      setShowAddCategory(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to add category");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: Id<"categories">) => {
    if (!confirm("Delete this category? Products will become uncategorised."))
      return;
    try {
      await deleteCategory({ categoryId });
      toast.success("Category deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <div className="bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white px-5 pt-6 pb-4 flex items-center justify-between border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Store Settings</h1>
          {saveStatus === "saving" && (
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Saving...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-xs font-semibold text-green-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Saved
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Save failed
            </span>
          )}
        </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-28">
        {/* Business Identity */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Business Identity
            </h2>
          </div>
          <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm border border-gray-100">
            {/* Store Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Store Name
                {savingField === "name" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "name" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  triggerAutoSave("name");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="Your Store Name"
              />
            </div>
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Store Description
                {savingField === "description" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "description" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  if (e.target.value.length <= 250) {
                    setDescription(e.target.value);
                    triggerAutoSave("description");
                  }
                }}
                rows={3}
                maxLength={250}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white resize-none"
                placeholder="Tell customers what makes your store special"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {description.length}/250
              </p>
            </div>
            {/* Logo */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2">
                Brand Logo
              </label>
              <div className="flex items-start gap-4">
                {/* Upload box */}
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-green-400 bg-green-50 flex flex-col items-center justify-center cursor-pointer flex-shrink-0 hover:bg-green-100 transition">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: themeColor }}
                    >
                      <Store className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleLogoChange(e.target.files?.[0] || null)
                    }
                    className="hidden"
                  />
                </label>
                <div className="flex flex-col justify-center gap-1 pt-1">
                  <p className="text-xs text-gray-500">
                    Recommended: 512×512px SVG, PNG or JPG.
                  </p>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="text-xs font-semibold text-green-600 text-left hover:underline"
                    >
                      Remove current
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* FSSAI Certificate Section for Home Bakery */}
            {(business.businessType === "home_bakery" || !business.businessType) && (
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Home Bakery FSSAI License
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    FSSAI Registration / License Number
                    {savingField === "fssaiNumber" ? (
                      <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                    ) : lastSavedField === "fssaiNumber" && (
                      <span className="ml-1.5 text-green-500">✓ Saved</span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={fssaiNumber}
                    onChange={(e) => {
                      setFssaiNumber(e.target.value);
                      triggerAutoSave("fssaiNumber");
                    }}
                    placeholder="e.g. 12345678901234"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                    FSSAI Certificate PDF
                    {isUploadingFssai && (
                      <span className="ml-1.5 text-amber-500 text-xs">Uploading PDF...</span>
                    )}
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition">
                      <span>{fssaiPdfFile ? fssaiPdfFile.name : "Upload Certificate PDF"}</span>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type !== "application/pdf") {
                              toast.error("Please upload a PDF file.");
                              return;
                            }
                            setFssaiPdfFile(file);
                            triggerAutoSave("fssaiDocId");
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                    {fssaiDocUrl && (
                      <a
                        href={fssaiDocUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-green-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View / Download Certificate
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Payment Settings (UPI ID) */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-green-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Payment Settings
                </h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Business UPI ID (VPA)
                  {savingField === "upiId" ? (
                    <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                  ) : lastSavedField === "upiId" && (
                    <span className="ml-1.5 text-green-500">✓ Saved</span>
                  )}
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => {
                    setUpiId(e.target.value);
                    triggerAutoSave("upiId");
                  }}
                  placeholder="e.g. merchant@okaxis, 9876543210@paytm"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white font-mono"
                />
                <p className="mt-1 text-xs text-gray-400">
                  If set, this UPI ID will be used in payment links attached to customer WhatsApp order messages. Defaults to your WhatsApp phone number as UPI receiver if left blank.
                </p>
              </div>
            </div>

            {/* Custom Domain / slug */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Store link (Cannot be edited after creation)
              </label>
              <div className="flex items-center rounded-xl border border-gray-200 overflow-hidden">
                <span className="px-3 py-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 font-medium">
                  https://whatscart.in/
                </span>
                <input
                  id="store-link"
                  type="text"
                  value={`${business.slug}`}
                  readOnly
                  disabled
                  className="flex-1 px-3 py-3 text-sm text-gray-700 bg-white outline-none"
                />
              </div>
            </div>
            {/* WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                WhatsApp Number
                {savingField === "whatsapp" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "whatsapp" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="tel"
                value={whatsappPhone}
                onChange={(e) => {
                  setWhatsappPhone(e.target.value);
                  triggerAutoSave("whatsapp");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="+91 812 345 6789"
              />
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <label className="text-sm font-semibold text-slate-800">
                    Brand primary color
                  </label>
                  
                  <p className="mt-1 text-sm text-slate-500">
                    Choose the only editable storefront brand color. Accent and neutral stay locked automatically.
                  </p>
                </div>
              </div>

              <div className="relative" ref={colorPickerRef}>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="h-10 w-14 shrink-0 rounded-lg border border-slate-200 shadow-sm transition hover:scale-105"
                    style={{ backgroundColor: draftSeedColor }}
                    aria-label="Pick a color"
                  />
                  <div className="flex items-center gap-1 overflow-hidden rounded-lg border border-slate-200 px-3 py-2">
                    <span className="text-xs font-medium text-slate-400">#</span>
                    <input
                      type="text"
                      value={draftSeedColor.replace("#", "")}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                        if (raw) setDraftSeedColor(`#${raw}`);
                      }}
                      className="w-20 border-0 p-0 text-sm font-semibold text-slate-900 outline-none"
                      maxLength={6}
                    />
                  </div>
                </div>
                {showColorPicker && (
                  <div className="mt-3 space-y-3">
                    <div className="flex gap-4">
                      <HexColorPicker
                        color={draftSeedColor}
                        onChange={setDraftSeedColor}
                        style={{ width: 180, height: 136 }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-xs font-semibold text-slate-500">Preset colors</p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            "#3DAC35", "#4F46E5", "#0EA5E9", "#F43F5E",
                            "#F59E0B", "#14B8A6", "#111827", "#8B5CF6",
                            "#EC4899", "#EF4444", "#10B981", "#F97316",
                          ].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setDraftSeedColor(color)}
                              className={`h-7 rounded-lg border transition hover:scale-110 ${
                                draftSeedColor === color
                                  ? "border-gray-900 ring-2 ring-gray-900/20"
                                  : "border-slate-200"
                              }`}
                              style={{ backgroundColor: color }}
                              aria-label={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleSeedColorChange(draftSeedColor);
                        setShowColorPicker(false);
                      }}
                      className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-gray-800"
                    >
                      Save color
                    </button>
                  </div>
                )}
              </div>
              <button
                  type="button"
                  onClick={handleRegeneratePalettes}
                  disabled={isGeneratingPalettes}
                  className="inline-flex w-full text-center justify-center shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Zap className="h-4 w-4" />
                  Refresh palette
                </button>

              {isGeneratingPalettes ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="text-sm font-medium text-slate-500"
                >
                  Updating palette...
                </p>
              ) : null}

              {paletteError ? (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="text-sm font-medium text-amber-700"
                >
                  {paletteError}
                </p>
              ) : null}

              <div
                className="grid gap-3"
                role="group"
                aria-label="Storefront palette preview"
              >
                {generatedPalettes.map((palette) => {
                  const selected = selectedPalette.id === palette.id;
                  const previewColors = getStorefrontPalettePreview(palette);

                  return (
                    <button
                      key={palette.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setSelectedPalette(palette);
                        setThemeColor(palette.primaryColor);
                        triggerAutoSave();
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-[#3DAC35] bg-[#F4FBF3] shadow-sm"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Locked storefront palette
                          </p>
                          <p className="mt-2 text-base font-bold text-slate-900">
                            Primary {palette.primaryColor}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            selected
                              ? "bg-[#DFF0DD] text-[#2E7D32]"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {selected ? "Selected" : "Choose"}
                        </span>
                      </div>

                      <div className="mt-4 flex gap-2">
                        {previewColors.map((color, index) => (
                          <span
                            key={`${palette.id}-${index}-${color}`}
                            className="h-10 flex-1 rounded-xl border border-slate-200"
                            style={{ backgroundColor: color }}
                            aria-label={
                              index === 0
                                ? "Primary color"
                                : index === 1
                                  ? "Accent color"
                                  : "Neutral color"
                            }
                          />
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Business Address */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Business Address
            </h2>
          </div>
          <div className="space-y-3">
            <div>
              <input type="text" value={buildingNo} onChange={(e) => { setBuildingNo(e.target.value); triggerAutoSave("buildingNo"); }}
                className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="Building No" />
              {savingField === "buildingNo" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "buildingNo" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
            </div>
            <div>
              <input type="text" value={street} onChange={(e) => { setStreet(e.target.value); triggerAutoSave("street"); }}
                className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="Street" />
              {savingField === "street" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "street" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
            </div>
            <div>
              <input type="text" value={town} onChange={(e) => { setTown(e.target.value); triggerAutoSave("town"); }}
                className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="Village/Town/City" />
              {savingField === "town" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "town" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input type="text" value={district} onChange={(e) => { setDistrict(e.target.value); triggerAutoSave("district"); }}
                  className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="District" />
                {savingField === "district" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "district" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
              </div>
              <div>
                <input type="text" value={pincode} onChange={(e) => { setPincode(e.target.value); triggerAutoSave("pincode"); }}
                  className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="PIN Code" />
                {savingField === "pincode" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "pincode" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input type="text" value={state} onChange={(e) => { setState(e.target.value); triggerAutoSave("state"); }}
                  className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="State" />
                {savingField === "state" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "state" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
              </div>
              <div>
                <input type="text" value={country} onChange={(e) => { setCountry(e.target.value); triggerAutoSave("country"); }}
                  className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="Country" />
                {savingField === "country" ? <span className="ml-2 text-xs text-amber-500">Saving...</span> : lastSavedField === "country" && <span className="ml-2 text-xs text-green-500">✓ Saved</span>}
              </div>
            </div>
          </div>
        </section>

        {/* Service Regions */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Store className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">
              Service Regions
            </h2>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Service Region
              {savingField === "serviceRegion" ? (
                <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
              ) : lastSavedField === "serviceRegion" && (
                <span className="ml-1.5 text-green-500">✓ Saved</span>
              )}
            </label>
            <input type="text" value={serviceRegion} onChange={(e) => { setServiceRegion(e.target.value); triggerAutoSave("serviceRegion"); }}
              className="w-full px-4 py-3.5 rounded-lg border border-slate-200 bg-white text-base outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 placeholder:text-slate-400" placeholder="Ex Delivery is done across Tamil Nadu" />
          </div>
        </section>

        {/* Social Media Links */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Hash className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">Social Media</h2>
          </div>
          <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm border border-gray-100">
            {/* Instagram */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Instagram profile
                {savingField === "instagram" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "instagram" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="url"
                value={socialLinks.instagram}
                onChange={(e) => {
                  setSocialLinks((prev) => ({
                    ...prev,
                    instagram: e.target.value,
                  }));
                  triggerAutoSave("instagram");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="https://instagram.com/yourstore"
              />
            </div>
            {/* Facebook */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Facebook profile
                {savingField === "facebook" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "facebook" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="url"
                value={socialLinks.facebook}
                onChange={(e) => {
                  setSocialLinks((prev) => ({
                    ...prev,
                    facebook: e.target.value,
                  }));
                  triggerAutoSave("facebook");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="https://facebook.com/yourstore"
              />
            </div>
            {/* Threads */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Threads profile
                {savingField === "threads" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "threads" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="url"
                value={socialLinks.threads}
                onChange={(e) => {
                  setSocialLinks((prev) => ({
                    ...prev,
                    threads: e.target.value,
                  }));
                  triggerAutoSave("threads");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="https://threads.net/@yourstore"
              />
            </div>
            {/* X (Twitter) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                X profile
                {savingField === "x" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "x" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="url"
                value={socialLinks.x}
                onChange={(e) => {
                  setSocialLinks((prev) => ({ ...prev, x: e.target.value }));
                  triggerAutoSave("x");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="https://x.com/yourstore"
              />
            </div>
          </div>
        </section>
        {/* Business Categories */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-green-600" />
              <h2 className="text-sm font-bold text-gray-900">
                Business Categories
              </h2>
            </div>
            <button
              onClick={() => setShowAddCategory((v) => !v)}
              className="flex items-center gap-1 text-xs font-bold text-green-600"
            >
              <Plus className="w-3.5 h-3.5" />
              Add New
            </button>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            {/* Add category inline */}
            {showAddCategory && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                  placeholder="Category name..."
                  className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400"
                  autoFocus
                />
                <button
                  onClick={handleAddCategory}
                  disabled={isAddingCategory || !newCategoryName.trim()}
                  className="px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {isAddingCategory ? "..." : "Add"}
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName("");
                  }}
                  className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500 text-xs font-bold"
                >
                  Cancel
                </button>
              </div>
            )}
            {!categories || categories.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                No categories yet. Add your first one.
              </div>
            ) : (
              categories.map((cat, idx) => (
                <div
                  key={cat._id}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragIndex === null || dragIndex === idx) return;
                    const reordered = [...categories];
                    const [moved] = reordered.splice(dragIndex, 1);
                    reordered.splice(idx, 0, moved);
                    setDragIndex(idx);
                    reorderCategories({
                      businessId: business._id,
                      orderedIds: reordered.map((c) => c._id as Id<"categories">),
                    });
                  }}
                  onDragEnd={() => setDragIndex(null)}
                  className={`flex items-center gap-2 px-4 py-3.5 ${
                    idx < categories.length - 1
                      ? "border-b border-gray-100"
                      : ""
                  } ${dragIndex === idx ? "opacity-50" : ""}`}
                >
                  <span className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 transition">
                    <GripVertical className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-semibold text-gray-800 flex-1">
                    {cat.name}
                  </span>
                  <button
                    onClick={() => handleDeleteCategory(cat._id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500 transition" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Language */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Languages className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">Language</h2>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5">
              Store Language
            </label>
            <div className="relative">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full appearance-none px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Shipping Banner */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">Storefront Banner</h2>
          </div>
          <div className="bg-white rounded-2xl p-4 space-y-4 shadow-sm border border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                Shipping Banner Text
                {savingField === "shippingBanner" ? (
                  <span className="ml-1.5 text-amber-500 text-xs">Saving...</span>
                ) : lastSavedField === "shippingBanner" && (
                  <span className="ml-1.5 text-green-500">✓ Saved</span>
                )}
              </label>
              <input
                type="text"
                value={shippingBannerText}
                onChange={(e) => {
                  setShippingBannerText(e.target.value);
                  triggerAutoSave("shippingBanner");
                }}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 bg-white"
                placeholder="Shipping available across India"
              />
              <p className="mt-1 text-xs text-gray-400">
                Shown in the top bar on your storefront. Leave empty to use the default.
              </p>
            </div>
          </div>
        </section>

        {/* Featured Products */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-green-600" />
            <h2 className="text-sm font-bold text-gray-900">Featured Products</h2>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-3">
              Select and reorder products for the hero carousel on your storefront.
            </p>
            {!allProducts ? (
              <p className="text-sm text-gray-400 py-4 text-center">Loading products...</p>
            ) : allProducts.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">
                No products yet. Create products first.
              </p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {allProducts.map((product) => {
                  const isFeatured = featuredProductIds.includes(product._id as Id<"products">);
                  const index = featuredProductIds.indexOf(product._id as Id<"products">);
                  return (
                    <div
                      key={product._id}
                      className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                        isFeatured
                          ? "border-green-400 bg-green-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isFeatured) {
                            setFeaturedProductIds((prev) =>
                              prev.filter((id) => id !== product._id),
                            );
                          } else {
                            setFeaturedProductIds((prev) => [...prev, product._id as Id<"products">]);
                          }
                          triggerAutoSave();
                        }}
                        className={`shrink-0 flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                          isFeatured
                            ? "border-green-500 bg-green-500 text-white"
                            : "border-gray-300"
                        }`}
                      >
                        {isFeatured && (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          ₹{product.price.toFixed(0)}
                        </p>
                      </div>
                      {isFeatured && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => {
                              setFeaturedProductIds((prev) => {
                                const next = [...prev];
                                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                                return next;
                              });
                              triggerAutoSave();
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move up"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            disabled={index === featuredProductIds.length - 1}
                            onClick={() => {
                              setFeaturedProductIds((prev) => {
                                const next = [...prev];
                                [next[index], next[index + 1]] = [next[index + 1], next[index]];
                                return next;
                              });
                              triggerAutoSave();
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move down"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {featuredProductIds.length > 0 && (
              <p className="mt-2 text-xs text-gray-400">
                {featuredProductIds.length} product{featuredProductIds.length !== 1 ? "s" : ""} selected. Use the arrow buttons to reorder.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
    {cropImageSrc && (
      <ImageCropper
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
        onCancel={handleCropCancel}
      />
    )}
    </>
  );
}
