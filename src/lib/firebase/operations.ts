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

type OperationApi = {
  adminDeletion: OperationModule;
  analytics: OperationModule;
  auth: OperationModule;
  businesses: OperationModule;
  businessVariationOptions: OperationModule;
  carts: OperationModule;
  catalogs: OperationModule;
  categories: OperationModule;
  orders: OperationModule;
  products: OperationModule;
  reviews: OperationModule;
  superAdmin: OperationModule;
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
  adminDeletion: createOperationModule("adminDeletion"),
  analytics: createOperationModule("analytics"),
  auth: createOperationModule("auth"),
  businesses: createOperationModule("businesses"),
  businessVariationOptions: createOperationModule("businessVariationOptions"),
  carts: createOperationModule("carts"),
  catalogs: createOperationModule("catalogs"),
  categories: createOperationModule("categories"),
  orders: createOperationModule("orders"),
  products: createOperationModule("products"),
  reviews: createOperationModule("reviews"),
  superAdmin: createOperationModule("superAdmin"),
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
