import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFirebaseQuery as useQuery } from "../lib/firebase/hooks";
import { useFirebaseMutation as useMutation } from "../lib/firebase/mutations";
import { useNavigate } from "react-router-dom";
import { api, type Id } from "../lib/firebase/operations";
import { toast } from "sonner";
import {
  BRAND_PALETTE_PAGE_SIZE,
  buildFallbackPalette,
  getGeneratedBrandPalettes,
  type GeneratedBrandPalette,
} from "../lib/brandPalette";
import {
  isValidIndianWhatsappPhone,
  normalizeIndianWhatsappPhone,
} from "../lib/phone";
import { getErrorMessage } from "../lib/utils";
import { HexColorPicker } from "react-colorful";
import { storefrontPath, storefrontUrl } from "../lib/urls";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronDown,
  CloudUpload,
  Cpu,
  ExternalLink,
  Footprints,
  ImagePlus,
  PaintbrushVertical,
  ShoppingBasket,
  Shirt,
  Sparkles,
  Store,
  Watch,
  X,
  Zap,
} from "lucide-react";
import { ImageCropper } from "./ImageCropper";
import { PoweredByWhatsCartPill } from "./PoweredByWhatsCartPill";

const BUSINESS_TYPES = [
  { value: "garments", label: "Garments", icon: Shirt },
  { value: "home_bakery", label: "Home Bakery", icon: Sparkles },
  { value: "handicrafts", label: "Handicrafts", icon: PaintbrushVertical },
] as const;

const LANGUAGES = [
  "English",
  "Tamil",
  "Hindi",
  "Telugu",
  "Kannada",
  "Malayalam",
];

export const THEME_COLORS = [
  "#3DAC35",
  "#4F46E5",
  "#0EA5E9",
  "#F43F5E",
  "#F59E0B",
  "#14B8A6",
  "#111827",
];

const DEFAULT_SEED_COLOR = THEME_COLORS[0];
const DEFAULT_FALLBACK_PALETTE = buildFallbackPalette(DEFAULT_SEED_COLOR);
const PALETTE_DEBOUNCE_MS = 450;
const OWNER_NAME_INPUT_ID = "owner-name";
const LANGUAGE_SELECT_ID = "preferred-language";
const BUSINESS_TYPE_LABEL_ID = "business-type-label";
const BUSINESS_NAME_INPUT_ID = "business-name";
const STORE_URL_INPUT_ID = "custom-store-url";
const WHATSAPP_INPUT_ID = "whatsapp-number";
const BUSINESS_LOGO_INPUT_ID = "business-logo";
const DESCRIPTION_INPUT_ID = "store-description";

const STEPS = [
  {
    id: "categories",
    title: "Business Categories",
    caption: "Stage 1 of 5",
  },
  {
    id: "business",
    title: "Business Details",
    caption: "Stage 2 of 5",
  },
  {
    id: "branding",
    title: "Brand Identity",
    caption: "Stage 3 of 5",
  },
  {
    id: "review",
    title: "Review & Launch",
    caption: "Stage 4 of 5",
  },
  {
    id: "complete",
    title: "Store Ready",
    caption: "Stage 5 of 5",
  },
] as const;

type Step = "welcome" | (typeof STEPS)[number]["id"];

interface BusinessSetupProps {
  onCreated?: () => void;
  onFinish?: () => void;
}

export function BusinessSetup({ onCreated, onFinish }: BusinessSetupProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("welcome");
  const [ownerName, setOwnerName] = useState("");
  const [language, setLanguage] = useState("English");
  const [businessType, setBusinessType] = useState<
    "garments" | "home_bakery" | "handicrafts" | ""
  >("");
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [buildingNo, setBuildingNo] = useState("");
  const [street, setStreet] = useState("");
  const [town, setTown] = useState("");
  const [district, setDistrict] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [serviceRegion, setServiceRegion] = useState("");
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [themeColor, setThemeColor] = useState(
    DEFAULT_FALLBACK_PALETTE.primaryColor,
  );
  const [slugReadyToCheck, setSlugReadyToCheck] = useState(false);
  const [seedColor, setSeedColor] = useState(
    DEFAULT_FALLBACK_PALETTE.seedColor,
  );
  const [palettePool, setPalettePool] = useState<GeneratedBrandPalette[]>([
    DEFAULT_FALLBACK_PALETTE,
  ]);
  const [paletteWindowStart, setPaletteWindowStart] = useState(0);
  const [generatedPalettes, setGeneratedPalettes] = useState<
    GeneratedBrandPalette[]
  >([DEFAULT_FALLBACK_PALETTE]);
  const [selectedPalette, setSelectedPalette] = useState<GeneratedBrandPalette>(
    DEFAULT_FALLBACK_PALETTE,
  );
  const [isGeneratingPalettes, setIsGeneratingPalettes] = useState(false);
  const [paletteError, setPaletteError] = useState<string | null>(null);
  const [draftSeedColor, setDraftSeedColor] = useState(
    DEFAULT_FALLBACK_PALETTE.seedColor,
  );
  const [showColorPicker, setShowColorPicker] = useState(false);

  const hasInitializedPaletteGenerator = useRef(false);
  const paletteDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isPaletteGenerationInFlight = useRef(false);
  const queuedPaletteRequest = useRef<{
    requestId: number;
    seedColor: string;
  } | null>(null);
  const paletteRequestId = useRef(0);
  const logoReadRequestId = useRef(0);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Onboarding stages are rendered in place, so route-level scroll restoration
  // does not run when moving between them.
  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "test") window.scrollTo(0, 0);
  }, [step]);

  const createBusiness = useMutation(api.businesses.createBusiness);
  const generateUploadUrl = useMutation(api.businesses.generateUploadUrl);

  const checkSlugAvailability = useQuery(
    api.businesses.checkSlugAvailability,
    slugReadyToCheck && slug ? { slug } : "skip",
  );

  useEffect(() => {
    if (!slugReadyToCheck) return;
    if (checkSlugAvailability !== undefined) {
      setSlugStatus(checkSlugAvailability ? "available" : "taken");
      setSlugError(
        checkSlugAvailability ? null : "This store URL is already taken.",
      );
    }
  }, [checkSlugAvailability, slugReadyToCheck]);

  const validateSlug = useCallback((value: string) => {
    if (!value) {
      setSlugStatus("idle");
      setSlugError(null);
      setSlugReadyToCheck(false);
      return;
    }

    if (!/^[a-z0-9-]+$/.test(value)) {
      setSlugStatus("taken");
      setSlugError("Use lowercase letters, numbers, and hyphens only.");
      setSlugReadyToCheck(false);
      return;
    }

    if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(value)) {
      setSlugStatus("taken");
      setSlugError(
        "Store URL must be 3 to 63 characters and cannot start or end with a hyphen.",
      );
      setSlugReadyToCheck(false);
      return;
    }

    if (/^[a-z0-9]{2}--/.test(value)) {
      setSlugStatus("taken");
      setSlugError(
        "Store URL cannot contain hyphens in the 3rd and 4th positions.",
      );
      setSlugReadyToCheck(false);
      return;
    }

    setSlugStatus("checking");
    setSlugError(null);
    setSlugReadyToCheck(true);
  }, []);

  useEffect(() => {
    setSlugReadyToCheck(false);
    const timer = setTimeout(() => {
      if (slug) {
        validateSlug(slug);
      } else {
        setSlugStatus("idle");
        setSlugError(null);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug, validateSlug]);

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 63);

  const selectedBusinessType = useMemo(
    () => BUSINESS_TYPES.find((item) => item.value === businessType),
    [businessType],
  );

  useEffect(() => {
    setThemeColor(selectedPalette.primaryColor);
  }, [selectedPalette]);

  const clearPaletteDebounce = useCallback(() => {
    if (paletteDebounceTimerRef.current) {
      clearTimeout(paletteDebounceTimerRef.current);
      paletteDebounceTimerRef.current = null;
    }
  }, []);

  const runPaletteGeneration = useCallback(async (nextSeedColor: string) => {
    const request = {
      requestId: ++paletteRequestId.current,
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
        const palettes = await getGeneratedBrandPalettes(
          activeRequest.seedColor,
        );
        if (activeRequest.requestId !== paletteRequestId.current) {
          return;
        }
        const nextVisiblePalettes = palettes.slice(0, BRAND_PALETTE_PAGE_SIZE);
        setPalettePool(palettes);
        setPaletteWindowStart(0);
        setGeneratedPalettes(nextVisiblePalettes);
        setSelectedPalette(nextVisiblePalettes[0]);
      } catch (_error) {
        if (activeRequest.requestId !== paletteRequestId.current) {
          return;
        }
        const fallbackPalette = buildFallbackPalette(activeRequest.seedColor);
        setPalettePool([fallbackPalette]);
        setPaletteWindowStart(0);
        setGeneratedPalettes([fallbackPalette]);
        setSelectedPalette(fallbackPalette);
        setPaletteError(
          "Couldn't generate palettes. Showing a fallback option.",
        );
      } finally {
        isPaletteGenerationInFlight.current = false;

        if (
          queuedPaletteRequest.current &&
          queuedPaletteRequest.current.requestId !== activeRequest.requestId
        ) {
          const nextQueuedRequest = queuedPaletteRequest.current;
          queuedPaletteRequest.current = null;
          void executeRequest(nextQueuedRequest);
          return;
        }

        queuedPaletteRequest.current = null;
        if (
          activeRequest.requestId === paletteRequestId.current ||
          !paletteDebounceTimerRef.current
        ) {
          setIsGeneratingPalettes(false);
        }
      }
    };

    await executeRequest(request);
  }, []);

  useEffect(() => {
    if (!hasInitializedPaletteGenerator.current) {
      hasInitializedPaletteGenerator.current = true;
      return;
    }

    clearPaletteDebounce();
    paletteDebounceTimerRef.current = setTimeout(() => {
      paletteDebounceTimerRef.current = null;
      void runPaletteGeneration(seedColor);
    }, PALETTE_DEBOUNCE_MS);

    return clearPaletteDebounce;
  }, [clearPaletteDebounce, runPaletteGeneration, seedColor]);

  useEffect(() => {
    setDraftSeedColor(seedColor);
  }, [seedColor]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node)
      ) {
        handleSeedColorChange(draftSeedColor)
        setShowColorPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [draftSeedColor]);

  const currentStepIndex = STEPS.findIndex((item) => item.id === step);
  const currentStepMeta = STEPS[currentStepIndex];
  const progressWidth = `${((currentStepIndex + 1) / STEPS.length) * 100}%`;
  const storeUrl = slug ? storefrontUrl(slug) : "https://your-store.whatscart.in";

  const handleNameChange = (name: string) => {
    setBusinessName(name);
    setSlug(generateSlug(name));
  };

  const handleLogoChange = (file: File | null) => {
    const readRequestId = ++logoReadRequestId.current;
    if (!file) {
      setLogoFile(null);
      setLogoPreview(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (logoReadRequestId.current !== readRequestId) {
        return;
      }

      const src =
        typeof event.target?.result === "string" ? event.target.result : null;
      if (src) {
        if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
          setLogoFile(file);
          setLogoPreview(src);
        } else {
          setCropImageSrc(src);
        }
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
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
  };

  const handleSeedColorChange = useCallback((value: string) => {
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

    void runPaletteGeneration(seedColor);
  };

  const canContinue = {
    categories: Boolean(ownerName.trim()),
    business: Boolean(
      businessName.trim() &&
      slug &&
      slugStatus === "available" &&
      isValidIndianWhatsappPhone(whatsappPhone),
    ),
    branding: true,
    review: true,
    complete: true,
  } satisfies Record<Exclude<Step, "welcome">, boolean>;

  const nextStep = () => {
    if (step !== "welcome" && !canContinue[step]) {
      toast.error("Please complete the required fields before continuing.");
      return;
    }

    const next = STEPS[currentStepIndex + 1];
    if (next) {
      setStep(next.id);
    }
  };

  const previousStep = () => {
    const prev = STEPS[currentStepIndex - 1];
    if (prev) {
      setStep(prev.id);
    }
  };

  const handleCreateStore = async () => {
    const normalizedWhatsappPhone = normalizeIndianWhatsappPhone(whatsappPhone);
    if (!normalizedWhatsappPhone) {
      toast.error("Enter a valid 10-digit WhatsApp number.");
      return;
    }

    setIsSubmitting(true);
    try {
      let storageId: string | undefined = undefined;
      if (logoFile) {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": logoFile.type },
          body: logoFile,
        });

        if (!result.ok) {
          throw new Error("Failed to upload logo.");
        }

        const json = await result.json();
        storageId = json.storageId;
      }

      const emptyAddress =
        !buildingNo && !street && !town && !district && !pincode && !state && !country
          ? undefined
          : { buildingNo, street, town, district, pincode, state, country };

      await createBusiness({
        name: businessName.trim(),
        slug,
        themeColor,
        brandPalette: {
          seedColor: selectedPalette.seedColor,
          mode: selectedPalette.mode,
          colors: selectedPalette.colors,
          primaryColor: selectedPalette.primaryColor,
        },
        logoId: storageId as Id<"_storage"> | undefined,
        whatsappPhone: normalizedWhatsappPhone,
        businessType: businessType || "garments",
        ownerName: ownerName.trim(),
        preferredLanguage: language,
        description: description.trim() || undefined,
        address: emptyAddress,
        serviceRegion: serviceRegion.trim() || undefined,
      });

      onCreated?.();
      setStep("complete");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const finishOnboarding = () => {
    onFinish?.();
    navigate("/dashboard");
  };

  const renderWelcome = () => (
    <div className="min-h-[calc(100vh-4rem)] bg-white">
      <div className="mx-auto flex max-w-[428px] flex-col items-center px-6 pt-10 text-center">
        <div className="mb-8 flex h-72 w-72 items-center justify-center rounded-[2rem] bg-[#F2F7F1]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#DFF0DD]">
            <Store className="h-12 w-12 text-[#3DAC35]" />
          </div>
        </div>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">
          Build your store in minutes
        </h1>
        <p className="mt-4 text-lg leading-7 text-slate-500">
          We&apos;ll set up your storefront, branding, and launch details in five
          guided stages.
        </p>
      </div>

      <div className="mx-auto mt-10 flex max-w-sm justify-center gap-3 px-6">
        {STEPS.map((item, index) => (
          <span
            key={item.id}
            className={`h-2 rounded-full transition-all ${index === currentStepIndex ? "w-10 bg-[#3DAC35]" : "w-2 bg-slate-200"}`}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-10 border-t border-slate-100 bg-white px-6 py-5">
        <button
          type="button"
          onClick={nextStep}
          className="w-full rounded-xl bg-black px-4 py-4 text-sm font-bold text-white shadow-lg shadow-black/10"
        >
          Start onboarding
        </button>
      </div>

      <div className="fixed left-[-21px] bottom-0 scale-[0.8] z-50 hidden md:block">
        <PoweredByWhatsCartPill />
      </div>
    </div>
  );

  const renderStepShell = (
    content: React.ReactNode,
    action: React.ReactNode,
  ) => (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[428px] flex-col bg-[#F6F8F6]">
      <div className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={previousStep}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="pr-10 text-base font-bold text-slate-900">
            Onboarding
          </h2>
        </div>

        <div className="px-4 pb-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{currentStepMeta.title}</span>
            <span>{currentStepMeta.caption}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#3DAC35] transition-all duration-300"
              style={{ width: progressWidth }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-6 bg-white">{content}</div>

      <div className="sticky bottom-0 border-t border-slate-200 bg-white px-4 py-4">
        {action}
      </div>

      <div className="fixed left-[-21px] bottom-0 scale-[0.8] z-50 hidden md:block">
        <PoweredByWhatsCartPill />
      </div>
    </div>
  );

  if (step === "welcome") {
    return renderWelcome();
  }

  if (step === "categories") {
    return renderStepShell(
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Welcome! Let&apos;s get started.
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Help us customize your experience by sharing a few details about you
            and your business.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={OWNER_NAME_INPUT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            Owner Name
          </label>
          <input
            id={OWNER_NAME_INPUT_ID}
            type="text"
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            placeholder="Your full name"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={LANGUAGE_SELECT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            Preferred Language
          </label>
          <div className="relative">
            <select
              id={LANGUAGE_SELECT_ID}
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="w-full appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
            >
              {LANGUAGES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        <div
          className="space-y-3"
          role="group"
          aria-labelledby={BUSINESS_TYPE_LABEL_ID}
        >
          <p
            id={BUSINESS_TYPE_LABEL_ID}
            className="text-sm font-semibold text-slate-800"
          >
            What type of business do you run? <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </p>
          <div className="space-y-2">
            {BUSINESS_TYPES.map(({ value, label, icon: Icon }) => {
              const selected = businessType === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBusinessType(value)}
                  className={`flex w-full items-center gap-4 rounded-xl border px-4 py-3 text-left transition ${
                    selected
                      ? "border-[#3DAC35] bg-[#EFF8EE] shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${selected ? "bg-[#DFF0DD]" : "bg-slate-100"}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${selected ? "text-[#3DAC35]" : "text-slate-500"}`}
                    />
                  </div>
                  <span
                    className={`text-sm font-semibold ${selected ? "text-slate-900" : "text-slate-700"}`}
                  >
                    {label}
                  </span>
                  {selected ? (
                    <Check className="ml-auto h-5 w-5 text-[#3DAC35]" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      <button
        type="button"
        onClick={nextStep}
        disabled={!canContinue.categories}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>,
    );
  }

  if (step === "business") {
    return renderStepShell(
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Tell us about your business
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Set the public details customers will use to find and contact your
            store.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={BUSINESS_NAME_INPUT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            Business Name
          </label>
          <input
            id={BUSINESS_NAME_INPUT_ID}
            type="text"
            value={businessName}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="e.g. The Coffee House"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor={STORE_URL_INPUT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            Custom Store URL
          </label>
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-stretch">
              <input
                id={STORE_URL_INPUT_ID}
                type="text"
                value={slug}
                onChange={(event) => setSlug(event.target.value.toLowerCase())}
                placeholder="coffeehouse"
                className="flex-1 rounded-l-xl border-0 bg-transparent px-4 py-3 text-sm outline-none"
              />
              <div className="flex items-center gap-2 pr-3">
                {slugStatus === "checking" ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#3DAC35] border-t-transparent" />
                ) : null}
                {slugStatus === "available" ? (
                  <Check className="h-4 w-4 text-[#3DAC35]" />
                ) : null}
                {slugStatus === "taken" ? (
                  <X className="h-4 w-4 text-rose-500" />
                ) : null}
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
              .whatscart.in
            </div>
          </div>
          <p
            className={`text-xs ${slugError ? "text-rose-500" : "text-slate-400"}`}
          >
            {slugError ?? "Customers will use this URL to visit your store."}
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor={WHATSAPP_INPUT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            WhatsApp Number
          </label>
          <div className="flex gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700">
              +91
            </div>
            <input
              id={WHATSAPP_INPUT_ID}
              type="tel"
              value={whatsappPhone}
              onChange={(event) => setWhatsappPhone(event.target.value)}
              placeholder="9876543210"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
            />
          </div>
          </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Business Address <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </p>
          <div className="space-y-3">
            <input
              type="text"
              value={buildingNo}
              onChange={(e) => setBuildingNo(e.target.value)}
              placeholder="Building No"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
            />
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
            />
            <input
              type="text"
              value={town}
              onChange={(e) => setTown(e.target.value)}
              placeholder="Village/Town/City"
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
              />
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="PIN Code"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="State"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
              />
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Country"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-sm font-semibold text-slate-800">
            Service Regions <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </p>
          <input
            type="text"
            value={serviceRegion}
            onChange={(e) => setServiceRegion(e.target.value)}
            placeholder="Ex Delivery is done across Tamil Nadu"
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
          />
        </div>
      </div>,
      <button
        type="button"
        onClick={nextStep}
        disabled={!canContinue.business}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>,
    );
  }

  if (step === "branding") {
    return (
      <>
        {renderStepShell(
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Brand identity
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Upload your logo, choose a theme color, and add a short
                description for your store.
              </p>
            </div>

            <label
              htmlFor={BUSINESS_LOGO_INPUT_ID}
              className="block cursor-pointer rounded-2xl border-2 border-dashed border-[#3DAC35] bg-[#F4FBF3] p-6 text-center"
            >
              {logoPreview ? (
                <div className="space-y-4">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="mx-auto h-auto w-full rounded-2xl object-cover shadow-sm"
                  />
                  <p className="text-sm font-semibold text-slate-800">
                    Tap to replace logo
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#DFF0DD]">
                    <CloudUpload className="h-7 w-7 text-[#3DAC35]" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-900">
                      Upload business logo <span className="text-xs font-normal text-slate-400">(Optional)</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      PNG or JPG up to 2MB (Rectangle transparent logo recommended)
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                    <ImagePlus className="h-4 w-4" />
                    Choose file
                  </span>
                </div>
              )}
              <input
                id={BUSINESS_LOGO_INPUT_ID}
                type="file"
                accept="image/*"
                onChange={(event) =>
                  handleLogoChange(event.target.files?.[0] || null)
                }
                className="hidden"
              />
            </label>

        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="brand-primary-color-input" className="text-sm font-semibold text-slate-800">
                Brand primary color
              </label>
            </div>
            <button
              type="button"
              onClick={handleRegeneratePalettes}
              disabled={isGeneratingPalettes}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              Refresh palette
            </button>
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
                  id="brand-primary-color-input"
                  type="text"
                  value={draftSeedColor.replace("#", "")}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
                    if (raw) {
                      const next = `#${raw}`;
                      setDraftSeedColor(next);
                      if (raw.length === 6) {
                        handleSeedColorChange(next);
                      }
                    }
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

          {isGeneratingPalettes ? (
            <p className="text-sm font-medium text-slate-500">
              Updating palette...
            </p>
          ) : null}

          {paletteError ? (
            <p className="text-sm font-medium text-amber-700">{paletteError}</p>
          ) : null}

          <div
            className="grid gap-3"
            role="group"
            aria-label="Storefront palette preview"
          >
            {generatedPalettes.map((palette) => {
              const selected = selectedPalette.id === palette.id;

              return (
                <button
                  key={palette.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setSelectedPalette(palette)}
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
                    {palette.colors.map((color, index) => (
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

        <div className="space-y-2">
          <label
            htmlFor={DESCRIPTION_INPUT_ID}
            className="text-sm font-semibold text-slate-800"
          >
            Business Description <span className="text-xs font-normal text-slate-400">(Optional)</span>
          </label>
          <textarea
            id={DESCRIPTION_INPUT_ID}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            maxLength={250}
            placeholder="Tell customers what makes your store special."
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#3DAC35] focus:ring-2 focus:ring-[#3DAC35]/20"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {description.length}/250
          </p>
        </div>
      </div>,
      <button
        type="button"
        onClick={nextStep}
        disabled={!canContinue.branding}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue
        <ArrowRight className="h-4 w-4" />
      </button>,
    )}
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

  if (step === "review") {
    return renderStepShell(
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Review before launch
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Confirm the essentials. You can still go back and adjust any section
            before creating the store.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              {logoPreview ? (
                <img
                  src={logoPreview}
                  alt="Business logo"
                  className="h-16 w-16 rounded-2xl object-cover"
                />
              ) : (
                <Store className="h-7 w-7 text-slate-400" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900">{businessName}</p>
              <p className="text-sm text-slate-500">
                {selectedBusinessType?.label}
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                <BadgeCheck className="h-3.5 w-3.5" />
                {language}
              </div>
            </div>
          </div>
        </div>

        <div
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          role="region"
          aria-label="Customer preview"
        >
          <a
            href={storefrontPath(slug)}
            aria-label="Open storefront preview"
            className="sr-only"
            style={{ color: themeColor }}
          >
            Open storefront preview
          </a>
          <SummaryRow label="Owner" value={ownerName} />
          <SummaryRow label="Store URL" value={storeUrl} />
          <SummaryRow label="WhatsApp" value={whatsappPhone} />
          <SummaryRow
            label="Theme color"
            value={themeColor}
            colorSwatch={themeColor}
          />
          <SummaryRow
            label="Description"
            value={description || "No description added"}
          />
        </div>
      </div>,
      <button
        type="button"
        onClick={handleCreateStore}
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Creating store..." : "Create store"}
      </button>,
    );
  }

  const absoluteStoreUrl = storefrontUrl(slug);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const isTwa = isAndroid && (
    window.matchMedia('(display-mode: standalone)').matches ||
    (typeof document !== "undefined" && document.referrer.includes('android-app://'))
  );
  const viewStoreUrl = isTwa
    ? `intent://${absoluteStoreUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end;`
    : storefrontPath(slug);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[428px] flex-col bg-white">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="flex flex-col items-center gap-6 w-full max-w-[325px]">
          {/* Success Icon */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[rgba(61,172,53,0.1)]">
            <BadgeCheck className="h-12 w-12 text-[#3DAC35]" />
          </div>

          {/* Store Preview Card */}
          <a
            href={viewStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md block"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#3DAC35]">
                  <ShoppingBasket className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-900 leading-5">
                    {businessName}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-[#3DAC35]">
                    {slug}.whatscart.in
                  </p>
                </div>
              </div>
              <ExternalLink className="h-5 w-5 text-slate-400 shrink-0" />
            </div>
          </a>

          {/* Success Text */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 leading-[30px] tracking-[-0.0313em]">
              Success! Your store is<br />ready to launch.
            </h1>
            <p className="mt-4 text-base leading-6 text-slate-500">
              Congratulations! Your online presence is<br />officially set up and ready to welcome<br />customers.
            </p>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 bg-white px-6 pb-8 pt-4">
        <button
          type="button"
          onClick={finishOnboarding}
          className="w-full rounded-xl bg-black px-4 py-4 text-lg font-bold text-white"
        >
          Go to Dashboard
        </button>
      </div>

      <div className="fixed left-[-21px] bottom-0 scale-[0.8] z-50 hidden md:block">
        <PoweredByWhatsCartPill />
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  colorSwatch,
}: {
  label: string;
  value: string;
  colorSwatch?: string;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-2 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-md font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2 text-left">
        {colorSwatch ? (
          <span
            className="h-4 w-4 rounded-full"
            style={{ backgroundColor: colorSwatch }}
          />
        ) : null}
        <span className="text-sm font-semibold text-slate-900">{value}</span>
      </div>
    </div>
  );
}

function ChecklistItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#DFF0DD]">
        <Check className="h-4 w-4 text-[#3DAC35]" />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
}


