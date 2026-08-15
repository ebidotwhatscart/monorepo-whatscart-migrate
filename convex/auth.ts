import { query, mutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { v } from "convex/values";

type AuthCtx = QueryCtx | MutationCtx;

function configuredSuperAdminEmails() {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

// Helper function to get the current user from Clerk identity
export async function getCurrentUser(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  return user;
}

export async function requireSuperAdmin(ctx: AuthCtx) {
  const user = await getCurrentUser(ctx);
  if (!user || user.role !== "super_admin") {
    throw new Error("Super-admin access required");
  }
  return user;
}

export async function assertBusinessAccess(
  ctx: AuthCtx,
  businessId: Id<"businesses">,
) {
  const user = await getCurrentUser(ctx);
  if (!user) throw new Error("Not authenticated");

  const business = await ctx.db.get(businessId);
  if (!business || (business.ownerId !== user._id && user.role !== "super_admin")) {
    throw new Error("Not authorized");
  }
  return { user, business };
}

export const loggedInUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      return null;
    }

    // Look up user by clerkId from Clerk identity (subject contains the Clerk user ID)
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    return user;
  },
});

// Mutation to ensure user exists in the database
// Call this after successful Clerk authentication
export const ensureUserExists = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (identity === null) {
      throw new Error("Not authenticated");
    }

    // Check if user already exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (existingUser) {
      const configuredEmails = configuredSuperAdminEmails();
      if (
        configuredEmails.includes((identity.email ?? "").toLowerCase()) &&
        existingUser.role !== "super_admin"
      ) {
        await ctx.db.patch(existingUser._id, { role: "super_admin" });
      }
      return existingUser._id;
    }

    // Create new user
    const userId = await ctx.db.insert("users", {
      email: identity.email ?? "",
      name: identity.name ?? undefined,
      clerkId: identity.subject,
      role: configuredSuperAdminEmails().includes(
        (identity.email ?? "").toLowerCase(),
      )
        ? "super_admin"
        : "user",
    });

    return userId;
  },
});
