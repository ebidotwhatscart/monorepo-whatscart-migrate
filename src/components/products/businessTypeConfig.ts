import type {
  BusinessType,
  DietaryClassification,
  ProductAudience,
  ProductCustomizationOption,
} from "../../types/product";

type ProductTypeConfig = {
  categorySuggestions: string[];
  audienceOptions?: Array<{
    value: ProductAudience;
    label: string;
  }>;
  sizeFormatOptions?: Array<{
    value: string;
    label: string;
  }>;
  dietaryOptions?: Array<{
    value: DietaryClassification;
    label: string;
  }>;
  customizationLabel?: string;
  customizationOptions?: Array<{
    value: ProductCustomizationOption;
    label: string;
  }>;
  variationOptions: Array<{ variantType: string; values: string[] }>;
  storefront: {
    shippingBanner: string;
    directConnectionTitle: string;
    directConnectionBody: string;
  };
};

export const BUSINESS_TYPE_CONFIG: Record<BusinessType, ProductTypeConfig> = {
  garments: {
    categorySuggestions: ["Tops", "Dress", "Pant", "Jacket", "Accessories"],
    variationOptions: [
      { variantType: "Color", values: ["Black", "White", "Red", "Blue"] },
      { variantType: "Size", values: ["XS", "S", "M", "L", "XL", "XXL"] },
      { variantType: "Material", values: ["Cotton", "Linen", "Silk", "Denim"] },
      { variantType: "Style", values: ["Casual", "Formal", "Traditional"] },
      { variantType: "Fit", values: ["Slim", "Regular", "Relaxed"] },
      { variantType: "Pattern", values: ["Solid", "Striped", "Printed", "Floral"] },
    ],
    audienceOptions: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "unisex", label: "Unisex" },
      { value: "kid", label: "Kid" },
    ],
    storefront: {
      shippingBanner: "Shipping available",
      directConnectionTitle: "Direct Merchant Connection",
      directConnectionBody:
        "All orders finalized via WhatsApp instant responses, direct chat, no middlemen.",
    },
  },
  home_bakery: {
    categorySuggestions: ["Cake", "Biscuit", "Pastry"],
    variationOptions: [
      { variantType: "Flavor", values: ["Vanilla", "Chocolate", "Red Velvet", "Butterscotch"] },
      { variantType: "Filling", values: ["Cream", "Fruit", "Chocolate", "Nutella"] },
      { variantType: "Quantity", values: ["1", "2", "6", "12"] },
    ],
    sizeFormatOptions: [
      { value: "weight", label: "Weight (gm/kg)" },
      { value: "quantity", label: "Quantity (per piece)" },
    ],
    dietaryOptions: [
      { value: "veg", label: "Veg" },
      { value: "non_veg", label: "Non-Veg" },
      { value: "egg", label: "Egg" },
    ],
    customizationLabel: "Allow Cake Customization",
    customizationOptions: [
      { value: "edible_photo_print", label: "Edible photo print" },
      { value: "custom_text_message", label: "Custom text message" },
    ],
    storefront: {
      shippingBanner: "Fresh bakes available for local delivery and pickup",
      directConnectionTitle: "Direct Baker Connection",
      directConnectionBody:
        "Finalize flavors, pickup slots, and customization requests directly on WhatsApp.",
    },
  },
  handicrafts: {
    categorySuggestions: ["Home Decor", "Jewelry", "Gift Items"],
    variationOptions: [
      { variantType: "Material", values: ["Wood", "Clay", "Metal", "Resin"] },
      { variantType: "Color", values: ["Natural", "Black", "White", "Blue"] },
      { variantType: "Style", values: ["Minimal", "Rustic", "Traditional"] },
      { variantType: "Finish", values: ["Matte", "Glossy", "Polished"] },
      { variantType: "Design", values: ["Floral", "Geometric", "Abstract"] },
    ],
    audienceOptions: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
      { value: "unisex", label: "Unisex" },
      { value: "kid", label: "Kid" },
    ],
    customizationLabel: "Allow Handicraft Personalization",
    customizationOptions: [
      {
        value: "custom_engraving",
        label: "Custom engraving (names, dates, quotes)",
      },
      { value: "embroidered_text", label: "Embroidered text/designs" },
      {
        value: "customer_photo_upload",
        label: "Customer photo upload (printed/etched)",
      },
    ],
    storefront: {
      shippingBanner: "Handmade pieces shipped with care",
      directConnectionTitle: "Direct Maker Connection",
      directConnectionBody:
        "Confirm handmade finishes, personalization, and dispatch timelines directly on WhatsApp.",
    },
  },
};
