import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

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

const MAX_ITEMS_PER_CORRESPONDENT = 1000;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Whether an item should be in the prompt given its default + user override.
 */
export function isItemIncluded(item: Doc<"contextItems">): boolean {
  if (item.userOverride === "include") {
    return true;
  }
  if (item.userOverride === "exclude") {
    return false;
  }
  return item.defaultRelevant;
}

/**
 * List all context items for a correspondent, newest first.
 * Used by both the /context UI and the prompt composer.
 */
export const listByCorrespondent = query({
  args: {
    email: v.string(),
    source: v.optional(SOURCE_VALIDATOR),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return [];
    }

    const sourceFilter = args.source;
    if (sourceFilter) {
      return await ctx.db
        .query("contextItems")
        .withIndex("by_correspondent_source", (q) =>
          q.eq("correspondentEmail", email).eq("source", sourceFilter)
        )
        .order("desc")
        .take(MAX_ITEMS_PER_CORRESPONDENT);
    }
    return await ctx.db
      .query("contextItems")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .order("desc")
      .take(MAX_ITEMS_PER_CORRESPONDENT);
  },
});

/**
 * Internal variant used by the composer / sync actions.
 */
export const listByCorrespondentInternal = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return [];
    }
    return await ctx.db
      .query("contextItems")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .order("desc")
      .take(MAX_ITEMS_PER_CORRESPONDENT);
  },
});

export const getSettings = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return null;
    }
    return await ctx.db
      .query("contextSettings")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .unique();
  },
});

export const upsertSettings = mutation({
  args: {
    email: v.string(),
    enabledSources: v.optional(v.array(SOURCE_VALIDATOR)),
    freshnessWindowDays: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("email is required");
    }
    const existing = await ctx.db
      .query("contextSettings")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .unique();
    const patch = {
      enabledSources: args.enabledSources ?? existing?.enabledSources ?? [],
      freshnessWindowDays: args.freshnessWindowDays,
      maxTokens: args.maxTokens,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("contextSettings", {
      correspondentEmail: email,
      ...patch,
    });
  },
});

/**
 * Override an item's relevance. Pass `override: undefined` to clear the
 * override and fall back to defaultRelevant.
 */
export const setUserOverride = mutation({
  args: {
    itemId: v.id("contextItems"),
    override: v.optional(USER_OVERRIDE_VALIDATOR),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { userOverride: args.override });
  },
});

export const bulkSetUserOverride = mutation({
  args: {
    itemIds: v.array(v.id("contextItems")),
    override: v.optional(USER_OVERRIDE_VALIDATOR),
  },
  handler: async (ctx, args) => {
    for (const id of args.itemIds) {
      await ctx.db.patch(id, { userOverride: args.override });
    }
  },
});

/**
 * Internal upsert used by sync actions. Dedups by (source, externalId) when
 * externalId is present; otherwise inserts a new row each call.
 */
export const upsertItem = internalMutation({
  args: {
    correspondentEmail: v.string(),
    source: SOURCE_VALIDATOR,
    kind: v.string(),
    externalId: v.optional(v.string()),
    title: v.string(),
    snippet: v.string(),
    bodyForPrompt: v.string(),
    occurredAt: v.optional(v.number()),
    defaultRelevant: v.boolean(),
    raw: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.correspondentEmail);
    const doc = {
      correspondentEmail: email,
      source: args.source,
      kind: args.kind,
      externalId: args.externalId,
      title: args.title,
      snippet: args.snippet,
      bodyForPrompt: args.bodyForPrompt,
      occurredAt: args.occurredAt,
      fetchedAt: Date.now(),
      defaultRelevant: args.defaultRelevant,
      raw: args.raw,
    };

    if (args.externalId) {
      const existing = await ctx.db
        .query("contextItems")
        .withIndex("by_external", (q) =>
          q.eq("source", args.source).eq("externalId", args.externalId)
        )
        .filter((q) => q.eq(q.field("correspondentEmail"), email))
        .unique();
      if (existing) {
        // Preserve the user's override across resyncs.
        await ctx.db.patch(existing._id, {
          title: doc.title,
          snippet: doc.snippet,
          bodyForPrompt: doc.bodyForPrompt,
          occurredAt: doc.occurredAt,
          fetchedAt: doc.fetchedAt,
          defaultRelevant: doc.defaultRelevant,
          raw: doc.raw,
        });
        return existing._id;
      }
    }
    return await ctx.db.insert("contextItems", doc);
  },
});

/**
 * Persist per-email Outlook items as individual context rows. Each message
 * becomes its own contextItems row (kind="email", externalId="outlook:<id>"),
 * so the user can include or exclude individual emails in the /context UI.
 * Replaces the bundled "history_digest" item for this correspondent — that
 * digest is deleted when we successfully ingest per-message data.
 */
export const upsertOutlookMessages = mutation({
  args: {
    email: v.string(),
    items: v.array(
      v.object({
        id: v.union(v.string(), v.null()),
        subject: v.string(),
        when: v.string(),
        from: v.string(),
        preview: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email || args.items.length === 0) {
      return { written: 0 };
    }

    let written = 0;
    for (const m of args.items) {
      const externalId = m.id ? `outlook:${m.id}` : undefined;
      const ts = Date.parse(m.when);
      const occurredAt = Number.isFinite(ts) ? ts : undefined;
      const subject = m.subject || "(No subject)";
      const fromAddr = m.from || "(unknown)";
      const preview = m.preview || "";
      const title = `${subject} — from ${fromAddr}`;
      const snippet = preview.slice(0, 220);
      const bodyForPrompt = [
        `Subject: ${subject}`,
        `From: ${fromAddr}`,
        `When: ${m.when}`,
        preview ? `Preview: ${preview}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const existing = externalId
        ? await ctx.db
            .query("contextItems")
            .withIndex("by_external", (q) =>
              q.eq("source", "outlook").eq("externalId", externalId)
            )
            .filter((q) => q.eq(q.field("correspondentEmail"), email))
            .unique()
        : null;

      const fetchedAt = Date.now();
      if (existing) {
        await ctx.db.patch(existing._id, {
          title,
          snippet,
          bodyForPrompt,
          occurredAt,
          fetchedAt,
          defaultRelevant: true,
        });
      } else {
        await ctx.db.insert("contextItems", {
          correspondentEmail: email,
          source: "outlook",
          kind: "email",
          externalId,
          title,
          snippet,
          bodyForPrompt,
          occurredAt,
          fetchedAt,
          defaultRelevant: true,
        });
      }
      written += 1;
    }

    // Drop the old bundled digest now that we have per-email rows; avoids
    // duplicating the same content in the composed context block.
    const digest = await ctx.db
      .query("contextItems")
      .withIndex("by_external", (q) =>
        q.eq("source", "outlook").eq("externalId", `digest:${email}`)
      )
      .unique();
    if (digest) {
      await ctx.db.delete(digest._id);
    }

    return { written };
  },
});

/**
 * Add a markdown file as a context item. Called by the Context tab when the
 * user uploads a .md/.txt file. Each file becomes its own contextItems row
 * (source="files", kind="markdown"), included by default. Deletes any prior
 * file with the same name for the same correspondent to avoid duplicates on
 * re-upload.
 */
export const addContextFile = mutation({
  args: {
    email: v.string(),
    filename: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("email is required");
    }
    const content = args.content.trim();
    if (!content) {
      throw new Error("file content is empty");
    }
    const externalId = `file:${args.filename}`;
    const existing = await ctx.db
      .query("contextItems")
      .withIndex("by_external", (q) =>
        q.eq("source", "files").eq("externalId", externalId)
      )
      .filter((q) => q.eq(q.field("correspondentEmail"), email))
      .unique();

    const doc = {
      correspondentEmail: email,
      source: "files" as const,
      kind: "markdown",
      externalId,
      title: args.filename,
      snippet: content.slice(0, 220).replace(/\s+/g, " "),
      bodyForPrompt: content,
      occurredAt: Date.now(),
      fetchedAt: Date.now(),
      defaultRelevant: true,
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("contextItems", doc);
  },
});

/**
 * Add a typed/pasted manual note as a context item (source="manual",
 * kind="note"). Use polishManualContext (action) first if you want OpenAI
 * to structure the raw text.
 */
export const addManualContext = mutation({
  args: {
    email: v.string(),
    title: v.string(),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("email is required");
    }
    const content = args.content.trim();
    if (!content) {
      throw new Error("content is empty");
    }
    return await ctx.db.insert("contextItems", {
      correspondentEmail: email,
      source: "manual",
      kind: "note",
      title: args.title.trim() || "Manual note",
      snippet: content.slice(0, 220).replace(/\s+/g, " "),
      bodyForPrompt: content,
      occurredAt: Date.now(),
      fetchedAt: Date.now(),
      defaultRelevant: true,
    });
  },
});

/**
 * Delete a single context item. Used by the UI's "Remove" action on
 * manual notes and uploaded files where outright deletion is preferable
 * to an exclude-toggle.
 */
export const deleteItem = mutation({
  args: { itemId: v.id("contextItems") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.itemId);
  },
});

/**
 * Persist the mailbox-history brief fetched client-side by the taskpane.
 * Stored as a single context item per correspondent (kind="history_digest");
 * toggling it off removes the entire mailbox history from the AI prompt.
 * Per-email granularity is a fast follow-up — we'll switch to one row per
 * message once we wire the structured fetch in the Outlook provider.
 */
export const recordOutlookHistoryDigest = mutation({
  args: {
    email: v.string(),
    brief: v.string(),
    windowLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      throw new Error("email is required");
    }
    const trimmed = args.brief.trim();
    if (!trimmed) {
      return null;
    }

    const existing = await ctx.db
      .query("contextItems")
      .withIndex("by_external", (q) =>
        q.eq("source", "outlook").eq("externalId", `digest:${email}`)
      )
      .unique();

    const snippet = trimmed.slice(0, 280).replace(/\s+/g, " ");
    const title = args.windowLabel
      ? `Outlook history (${args.windowLabel})`
      : "Outlook history";

    if (existing) {
      await ctx.db.patch(existing._id, {
        title,
        snippet,
        bodyForPrompt: trimmed,
        fetchedAt: Date.now(),
        defaultRelevant: true,
      });
      return existing._id;
    }
    return await ctx.db.insert("contextItems", {
      correspondentEmail: email,
      source: "outlook",
      kind: "history_digest",
      externalId: `digest:${email}`,
      title,
      snippet,
      bodyForPrompt: trimmed,
      fetchedAt: Date.now(),
      defaultRelevant: true,
    });
  },
});

/**
 * Bulk variant used by sync actions to write many items in one transaction.
 * Replaces existing items (by source + externalId) while preserving each one's
 * userOverride so user toggles survive resyncs.
 */
export const upsertItemsBulk = internalMutation({
  args: {
    items: v.array(
      v.object({
        correspondentEmail: v.string(),
        source: SOURCE_VALIDATOR,
        kind: v.string(),
        externalId: v.optional(v.string()),
        title: v.string(),
        snippet: v.string(),
        bodyForPrompt: v.string(),
        occurredAt: v.optional(v.number()),
        defaultRelevant: v.boolean(),
        raw: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const fetchedAt = Date.now();
    let written = 0;
    for (const item of args.items) {
      const email = normalizeEmail(item.correspondentEmail);
      let existing: Doc<"contextItems"> | null = null;
      if (item.externalId) {
        existing = await ctx.db
          .query("contextItems")
          .withIndex("by_external", (q) =>
            q.eq("source", item.source).eq("externalId", item.externalId)
          )
          .filter((q) => q.eq(q.field("correspondentEmail"), email))
          .unique();
      }
      if (existing) {
        await ctx.db.patch(existing._id, {
          title: item.title,
          snippet: item.snippet,
          bodyForPrompt: item.bodyForPrompt,
          occurredAt: item.occurredAt,
          fetchedAt,
          defaultRelevant: item.defaultRelevant,
          raw: item.raw,
        });
      } else {
        await ctx.db.insert("contextItems", {
          correspondentEmail: email,
          source: item.source,
          kind: item.kind,
          externalId: item.externalId,
          title: item.title,
          snippet: item.snippet,
          bodyForPrompt: item.bodyForPrompt,
          occurredAt: item.occurredAt,
          fetchedAt,
          defaultRelevant: item.defaultRelevant,
          raw: item.raw,
        });
      }
      written += 1;
    }
    return written;
  },
});

export const recordSyncStart = internalMutation({
  args: { correspondentEmail: v.string(), source: SOURCE_VALIDATOR },
  handler: async (ctx, args): Promise<Id<"contextSyncRuns">> => {
    return await ctx.db.insert("contextSyncRuns", {
      correspondentEmail: normalizeEmail(args.correspondentEmail),
      source: args.source,
      startedAt: Date.now(),
    });
  },
});

export const recordSyncFinish = internalMutation({
  args: {
    runId: v.id("contextSyncRuns"),
    ok: v.boolean(),
    itemsWritten: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.runId, {
      finishedAt: Date.now(),
      ok: args.ok,
      itemsWritten: args.itemsWritten,
      error: args.error,
    });
  },
});

/**
 * When did each source last finish successfully syncing for this correspondent?
 */
export const getLastSyncBySource = internalQuery({
  args: { correspondentEmail: v.string(), source: SOURCE_VALIDATOR },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.correspondentEmail);
    const rows = await ctx.db
      .query("contextSyncRuns")
      .withIndex("by_correspondent_source", (q) =>
        q.eq("correspondentEmail", email).eq("source", args.source)
      )
      .order("desc")
      .take(10);
    return rows.find((r) => r.ok) ?? null;
  },
});

// Kinds ordered by priority — identity/standing pinned at the top of the
// briefing, action items next, history last. Anything not listed gets a high
// (worst) sort key so it falls to the bottom.
const KIND_PRIORITY: Record<string, number> = {
  contact: 0,
  tenant: 1,
  account: 2,
  termination_notice: 3,
  parking_request: 4,
  prospect: 5,
  ticket: 6,
  payment: 7,
  ledger: 8,
  history_digest: 9,
  note: 10,
};
const DEFAULT_MAX_CHARS = 24_000; // ~6000 tokens at 4 chars/token

/**
 * Build the final context briefing string for a correspondent. Reads all
 * stored contextItems, applies user overrides and settings, orders by
 * (kind priority, recency), trims to budget, and returns one block ready to
 * paste into the LLM prompt.
 */
export const composeBriefingForCorrespondent = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return { contextBlock: "", includedCount: 0, excludedCount: 0 };
    }

    const settings = await ctx.db
      .query("contextSettings")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .unique();
    const enabledSources = settings?.enabledSources ?? [];
    const maxChars =
      settings?.maxTokens != null ? settings.maxTokens * 4 : DEFAULT_MAX_CHARS;

    const items = await ctx.db
      .query("contextItems")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .take(MAX_ITEMS_PER_CORRESPONDENT);

    const sourceEnabled = (src: string) =>
      enabledSources.length === 0 || enabledSources.includes(src as never);

    const included: Doc<"contextItems">[] = [];
    let excludedCount = 0;
    for (const item of items) {
      if (!sourceEnabled(item.source)) {
        excludedCount += 1;
        continue;
      }
      if (isItemIncluded(item)) {
        included.push(item);
      } else {
        excludedCount += 1;
      }
    }

    included.sort((a, b) => {
      const pa = KIND_PRIORITY[a.kind] ?? 100;
      const pb = KIND_PRIORITY[b.kind] ?? 100;
      if (pa !== pb) {
        return pa - pb;
      }
      const ta = a.occurredAt ?? a.fetchedAt;
      const tb = b.occurredAt ?? b.fetchedAt;
      return tb - ta;
    });

    const sections: string[] = [];
    let used = 0;
    for (const item of included) {
      const heading = `### ${item.title} [${item.source}/${item.kind}]`;
      const section = `${heading}\n${item.bodyForPrompt}`;
      if (used + section.length + 2 > maxChars) {
        break;
      }
      sections.push(section);
      used += section.length + 2;
    }

    const contextBlock =
      sections.length > 0
        ? `## Context for ${email}\n\n${sections.join("\n\n")}`
        : "";

    return {
      contextBlock,
      includedCount: sections.length,
      excludedCount,
    };
  },
});

export const getRecentSyncRuns = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = normalizeEmail(args.email);
    if (!email) {
      return [];
    }
    return await ctx.db
      .query("contextSyncRuns")
      .withIndex("by_correspondent", (q) => q.eq("correspondentEmail", email))
      .order("desc")
      .take(30);
  },
});
