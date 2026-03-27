import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    microsoftId: v.optional(v.string()),
    // User-provided OpenAI key (overrides server key)
    openaiApiKey: v.optional(v.string()),
    // Default preferences
    defaultTone: v.optional(v.string()),
    defaultLength: v.optional(v.string()),
    defaultContextWindow: v.optional(v.string()),
  })
    .index("by_email", ["email"])
    .index("by_microsoft_id", ["microsoftId"]),
});
