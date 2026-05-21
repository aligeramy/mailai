import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Unified context store. Every piece of context the AI might see when drafting
 * a reply to a correspondent (mailbox history, Microsoft Graph data,
 * TSP-RR CRM data, freeform user notes) lives here as one row per item.
 *
 * The user can toggle individual rows in/out of the prompt via the /context UI.
 */
const SOURCE_VALIDATOR = v.union(
  v.literal("outlook"),
  v.literal("graph"),
  v.literal("tsprr"),
  v.literal("files"),
  v.literal("manual")
);

const USER_OVERRIDE_VALIDATOR = v.union(
  v.literal("include"),
  v.literal("exclude")
);

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

  contextItems: defineTable({
    // The email of the person being replied to (lowercased + trimmed).
    correspondentEmail: v.string(),
    source: SOURCE_VALIDATOR,
    // Free-form within a source. Examples:
    //   outlook: "email"
    //   tsprr:   "contact" | "tenant" | "account" | "payment" | "ledger" |
    //            "ticket" | "prospect" | "termination_notice" | "parking_request"
    //   graph:   "calendar_event" | "file" | "teams_chat" | "directory_user"
    //   manual:  "note"
    kind: v.string(),
    // Stable id in the source system, used to dedup on re-sync.
    externalId: v.optional(v.string()),

    // Display
    title: v.string(),
    snippet: v.string(),
    bodyForPrompt: v.string(),

    // Provenance + recency
    occurredAt: v.optional(v.number()),
    fetchedAt: v.number(),

    // Relevance: defaultRelevant is the auto choice; userOverride wins if set.
    defaultRelevant: v.boolean(),
    userOverride: v.optional(USER_OVERRIDE_VALIDATOR),

    // Original structured payload, for the detail drawer in the UI and for
    // future reformatting without re-fetching from the source.
    raw: v.optional(v.any()),
  })
    .index("by_correspondent", ["correspondentEmail"])
    .index("by_correspondent_source", ["correspondentEmail", "source"])
    .index("by_correspondent_kind", ["correspondentEmail", "kind"])
    .index("by_external", ["source", "externalId"]),

  contextSettings: defineTable({
    correspondentEmail: v.string(),
    // Sources enabled for this correspondent. Empty array means all enabled.
    enabledSources: v.array(SOURCE_VALIDATOR),
    // Soft cap: items older than this default to defaultRelevant=false.
    freshnessWindowDays: v.optional(v.number()),
    // Approx token budget for the composed context block.
    maxTokens: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_correspondent", ["correspondentEmail"]),

  // Tracks per-source freshness so the action can skip work when a recent
  // sync already covers this correspondent.
  contextSyncRuns: defineTable({
    correspondentEmail: v.string(),
    source: SOURCE_VALIDATOR,
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    ok: v.optional(v.boolean()),
    itemsWritten: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_correspondent_source", ["correspondentEmail", "source"])
    .index("by_correspondent", ["correspondentEmail"]),
});
