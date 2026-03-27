import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Look up a user by email address. */
export const getByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
  },
});

/** Create or update a user record on sign-in. */
export const upsert = mutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    microsoftId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        image: args.image,
        microsoftId: args.microsoftId,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", args);
  },
});

/** Save the user's default reply preferences and optional API key. */
export const updatePreferences = mutation({
  args: {
    email: v.string(),
    openaiApiKey: v.optional(v.string()),
    defaultTone: v.optional(v.string()),
    defaultLength: v.optional(v.string()),
    defaultContextWindow: v.optional(v.string()),
  },
  handler: async (ctx, { email, ...prefs }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    await ctx.db.patch(user._id, prefs);
  },
});
