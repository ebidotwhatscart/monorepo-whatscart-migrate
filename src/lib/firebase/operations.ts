export type OperationKind = "query" | "mutation" | "action";

export type OperationReference<
  Kind extends OperationKind = OperationKind,
  Args = Record<string, unknown>,
  Result = any,
> = {
  readonly __operationKind?: Kind;
  readonly __operationName: string;
  readonly __operationArgs?: Args;
  readonly __operationResult?: Result;
};

export type OperationArgs<Reference extends OperationReference> =
  Reference extends OperationReference<OperationKind, infer Args, any>
    ? Args
    : Record<string, unknown>;

export type OperationReturnType<Reference extends OperationReference> =
  Reference extends OperationReference<OperationKind, any, infer Result>
    ? Result
    : any;

type OperationModule = Record<
  string,
  OperationReference<any, Record<string, unknown>, any>
>;

export type LooseDocument = {
  [key: string]: any;
  _creationTime: number;
  _id: any;
  aboutProduct: any[];
  aboutProductItems: any[];
  businessId: any;
  businessType: any;
  catalogId: any;
  colorName: any;
  colorSwatch: any;
  createdAt: any;
  customerAddress: any;
  customerDoorNumber: any;
  date: any;
  imageUrls: any[];
  imageIds: any[];
  inStock: any;
  isEnabled: any;
  items: any[];
  name: any;
  orderCount: any;
  orders: any;
  ownerEmail: any;
  ownerId: any;
  ownerName: any;
  price: any;
  productCount: any;
  productIds: any[];
  products: any[];
  revenue: any;
  reviews: any[];
  slug: any;
  sizes: any[];
  sizesData: any[];
  themeColor: any;
  updatedAt: any;
  variantType: any;
  variantValue: any;
  variants: any[];
  whatsappPhone: any;
};

type Query<Result = any> = OperationReference<
  "query",
  Record<string, unknown>,
  Result
>;
type Mutation<Result = any> = OperationReference<
  "mutation",
  Record<string, unknown>,
  Result
>;
type Action<Result = any> = OperationReference<
  "action",
  Record<string, unknown>,
  Result
>;

type OperationApi = {
  adminDeletion: {
    deleteUserAndOwnedDataByEmail: Action;
  };
  analytics: {
    getConversionRate: Query<number>;
    getProductPerformance: Query<LooseDocument>;
    getSalesTrend: Query<LooseDocument[]>;
    getTopCustomers: Query<LooseDocument[]>;
    getTopProducts: Query<LooseDocument[]>;
    getTotalOrders: Query<number>;
    getTotalPageViews: Query<number>;
    getTotalRevenue: Query<number>;
    getTotalVisitors: Query<number>;
    getTrafficSources: Query<LooseDocument[]>;
    trackPageView: Mutation;
    trackProductShare: Mutation;
    trackProductView: Mutation;
  };
  auth: {
    ensureUserExists: Mutation<string>;
    loggedInUser: Query<LooseDocument | null>;
  };
  businesses: {
    checkSlugAvailability: Query<boolean>;
    createBusiness: Mutation<string>;
    generateUploadUrl: Mutation<string>;
    getBusinessBySlug: Query<LooseDocument | null>;
    getFeaturedProducts: Query<LooseDocument[]>;
    getUserBusiness: Query<LooseDocument | null>;
    updateBusiness: Mutation;
  };
  businessVariationOptions: {
    addCustomVariationType: Mutation;
    addCustomVariationValue: Mutation;
    getBusinessVariationOptions: Query<LooseDocument[]>;
  };
  carts: {
    getCart: Query<LooseDocument | null>;
    saveCart: Mutation<string>;
  };
  catalogs: {
    createCatalog: Mutation<LooseDocument>;
    deleteCatalog: Mutation;
    getBusinessCatalogs: Query<LooseDocument[]>;
    getPublicCatalog: Query<LooseDocument | null>;
    updateCatalog: Mutation;
  };
  categories: {
    createCategory: Mutation<string>;
    deleteCategory: Mutation;
    getBusinessCategories: Query<LooseDocument[]>;
    getPublicCategories: Query<LooseDocument[]>;
    reorderCategories: Mutation;
  };
  orders: {
    createManualOrder: Mutation;
    createOrder: Mutation<LooseDocument>;
    generateCustomerUploadUrl: Mutation<string>;
    getBusinessOrderDetail: Query<LooseDocument | null>;
    getBusinessOrders: Query<LooseDocument[]>;
    getBusinessOrderStats: Query<LooseDocument>;
    getOrderByOrderId: Query<LooseDocument | null>;
    getOrdersByMobile: Query<LooseDocument[]>;
    resolveCustomerUploadUrl: Mutation<string>;
    setOrderBillingExclusion: Mutation;
    updateOrderNotes: Mutation;
    updateOrderStatus: Mutation;
  };
  products: {
    createProduct: Mutation<string>;
    deleteProduct: Mutation;
    getBusinessProducts: Query<LooseDocument[]>;
    getProduct: Query<LooseDocument | null>;
    getProductVariants: Query<LooseDocument[]>;
    getPublicProductBySlug: Query<LooseDocument | null>;
    getPublicProducts: Query<LooseDocument[]>;
    getRelatedProducts: Query<LooseDocument[]>;
    searchProducts: Query<LooseDocument[]>;
    updateProduct: Mutation;
  };
  reviews: {
    createReviewRequest: Mutation;
    generateReviewUploadUrl: Mutation<string>;
    getApprovedProductReviews: Query<LooseDocument>;
    getBusinessReviewRequestStates: Query<LooseDocument[]>;
    getOrderReviews: Query<LooseDocument>;
    getReviewForm: Query<LooseDocument | null>;
    moderateReview: Mutation;
    registerReviewUpload: Mutation;
    submitReviews: Mutation;
  };
  superAdmin: {
    getBusinessForAdmin: Query<LooseDocument | null>;
    listBusinesses: Query<LooseDocument[]>;
    setBusinessEnabled: Mutation;
  };
};

function createOperationModule(moduleName: string): OperationModule {
  const references = new Map<string, OperationReference>();
  return new Proxy({} as OperationModule, {
    get(_target, property) {
      if (typeof property !== "string") return undefined;
      const cached = references.get(property);
      if (cached) return cached;

      const reference = Object.freeze({
        __operationName: `${moduleName}:${property}`,
      });
      references.set(property, reference);
      return reference;
    },
  });
}

export const api: OperationApi = {
  adminDeletion: createOperationModule("adminDeletion") as OperationApi["adminDeletion"],
  analytics: createOperationModule("analytics") as OperationApi["analytics"],
  auth: createOperationModule("auth") as OperationApi["auth"],
  businesses: createOperationModule("businesses") as OperationApi["businesses"],
  businessVariationOptions: createOperationModule(
    "businessVariationOptions",
  ) as OperationApi["businessVariationOptions"],
  carts: createOperationModule("carts") as OperationApi["carts"],
  catalogs: createOperationModule("catalogs") as OperationApi["catalogs"],
  categories: createOperationModule("categories") as OperationApi["categories"],
  orders: createOperationModule("orders") as OperationApi["orders"],
  products: createOperationModule("products") as OperationApi["products"],
  reviews: createOperationModule("reviews") as OperationApi["reviews"],
  superAdmin: createOperationModule("superAdmin") as OperationApi["superAdmin"],
};

export function getOperationName(reference: OperationReference): string {
  if (!reference?.__operationName) {
    throw new Error("Invalid Firebase operation reference.");
  }
  return reference.__operationName;
}

export type Id<TableName extends string> = string & {
  readonly __tableName?: TableName;
};
