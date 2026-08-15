import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

const MAX_BATCH_ROUNDS = 2_000;

const deletionResultValidator = v.object({
  identifier: v.string(),
  email: v.union(v.string(), v.null()),
  clerkAccount: v.union(
    v.literal("deleted"),
    v.literal("already_missing"),
    v.literal("not_available"),
  ),
  users: v.number(),
  businesses: v.number(),
  categories: v.number(),
  products: v.number(),
  businessVariationOptions: v.number(),
  catalogs: v.number(),
  carts: v.number(),
  orders: v.number(),
  pageViews: v.number(),
  productViews: v.number(),
  productShares: v.number(),
  storageFiles: v.number(),
});

type DeletionCounts = Omit<
  typeof deletionResultValidator.type,
  "identifier" | "email" | "clerkAccount"
>;

function emptyCounts(): DeletionCounts {
  return {
    users: 0,
    businesses: 0,
    categories: 0,
    products: 0,
    businessVariationOptions: 0,
    catalogs: 0,
    carts: 0,
    orders: 0,
    pageViews: 0,
    productViews: 0,
    productShares: 0,
    storageFiles: 0,
  };
}

export const deleteUserAndOwnedDataByEmail = action({
  args: {
    email: v.optional(v.string()),
    confirmEmail: v.optional(v.string()),
    id: v.optional(v.string()),
    confirmId: v.optional(v.string()),
  },
  returns: deletionResultValidator,
  handler: async (ctx, args): Promise<typeof deletionResultValidator.type> => {
    const usingEmail = args.email !== undefined || args.confirmEmail !== undefined;
    const usingId = args.id !== undefined || args.confirmId !== undefined;
    if (usingEmail === usingId) {
      throw new Error("Provide exactly one confirmed email or one confirmed id");
    }

    const identifier = (usingEmail ? args.email : args.id)?.trim() ?? "";
    const confirmation =
      (usingEmail ? args.confirmEmail : args.confirmId)?.trim() ?? "";
    const identifiersMatch = usingEmail
      ? identifier.toLowerCase() === confirmation.toLowerCase()
      : identifier === confirmation;
    if (!identifier || !identifiersMatch) {
      throw new Error(
        usingEmail
          ? "confirmEmail must exactly match email"
          : "confirmId must exactly match id",
      );
    }

    const target = await ctx.runQuery(
      internal.adminDeletionInternal.getDeletionTarget,
      {
        identifier,
        identifierType: usingEmail ? "email" : "id",
      },
    );
    if (!target) {
      throw new Error(`No user or owned store found for ${identifier}`);
    }

    let clerkAccount: "deleted" | "already_missing" | "not_available" =
      "not_available";
    if (target.clerkId) {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (!clerkSecretKey) {
        throw new Error(
          "CLERK_SECRET_KEY is not configured on this Convex deployment",
        );
      }

      const clerkResponse = await fetch(
        `https://api.clerk.com/v1/users/${encodeURIComponent(target.clerkId)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${clerkSecretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!clerkResponse.ok && clerkResponse.status !== 404) {
        const responseBody = (await clerkResponse.text()).slice(0, 500);
        throw new Error(
          `Clerk user deletion failed (${clerkResponse.status}): ${responseBody}`,
        );
      }
      clerkAccount = clerkResponse.status === 404 ? "already_missing" : "deleted";
    }

    const counts = emptyCounts();
    let batchRounds = 0;

    while (true) {
      const businessId = await ctx.runQuery(
        internal.adminDeletionInternal.getNextOwnedBusiness,
        { userId: target.userId },
      );
      if (!businessId) break;

      let businessDeleted = false;
      while (!businessDeleted) {
        batchRounds += 1;
        if (batchRounds > MAX_BATCH_ROUNDS) {
          throw new Error(
            "Deletion exceeded the safety batch limit. Run the action again to continue cleanup.",
          );
        }

        const batch = await ctx.runMutation(
          internal.adminDeletionInternal.deleteBusinessDataBatch,
          { userId: target.userId, businessId },
        );
        businessDeleted = batch.businessDeleted;
        counts.businesses += batch.businesses;
        counts.categories += batch.categories;
        counts.products += batch.products;
        counts.businessVariationOptions += batch.businessVariationOptions;
        counts.catalogs += batch.catalogs;
        counts.carts += batch.carts;
        counts.orders += batch.orders;
        counts.pageViews += batch.pageViews;
        counts.productViews += batch.productViews;
        counts.productShares += batch.productShares;
        counts.storageFiles += batch.storageFiles;
      }
    }

    const userDeleted = await ctx.runMutation(
      internal.adminDeletionInternal.deleteUserRecord,
      { userId: target.userId },
    );
    counts.users = userDeleted ? 1 : 0;

    return {
      identifier,
      email: target.email,
      clerkAccount,
      ...counts,
    };
  },
});
