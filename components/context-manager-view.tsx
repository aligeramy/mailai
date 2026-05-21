"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Eye,
  FileUp,
  Loader2,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type SourceFilter = "all" | "outlook" | "graph" | "tsprr" | "files" | "manual";
type RelevanceFilter = "all" | "included" | "excluded";

const SOURCE_LABELS: Record<string, string> = {
  outlook: "Outlook",
  graph: "M365 Graph",
  tsprr: "TSP-RR",
  files: "Files",
  manual: "Manual",
};

const PLAIN_TEXT_EXT_RE = /\.(md|markdown|txt|json)$/i;
const PLAIN_TEXT_MIME_RE = /^(text\/|application\/json)/i;

/**
 * Read text out of a user-picked file. Plain (.md/.txt/.json) is read client-
 * side; binary formats (.pdf/.docx/.doc) round-trip through /api/parse-context-
 * file so we keep heavy parsers off the client bundle.
 */
async function extractFileContent(file: File): Promise<string> {
  const isPlain =
    PLAIN_TEXT_EXT_RE.test(file.name) || PLAIN_TEXT_MIME_RE.test(file.type);
  if (isPlain) {
    return await file.text();
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/parse-context-file", {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { content?: string; error?: string };
  if (!(res.ok && data.content)) {
    throw new Error(data.error ?? `Could not parse ${file.name}.`);
  }
  return data.content;
}

function effectiveIncluded(item: Doc<"contextItems">): boolean {
  if (item.userOverride === "include") {
    return true;
  }
  if (item.userOverride === "exclude") {
    return false;
  }
  return item.defaultRelevant;
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) {
    return "—";
  }
  return new Date(ts).toISOString().replace("T", " ").slice(0, 16);
}

interface ContextManagerViewProps {
  /**
   * Compact mode shrinks paddings and search width for the narrow Outlook
   * taskpane. Default false (full-width page mode).
   */
  compact?: boolean;
  /** Lowercased email of the correspondent. Empty string disables the view. */
  email: string;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrates list view, filters, sync action, add-note flow, polish, and file upload — splitting hides the state graph.
export function ContextManagerView({
  email,
  compact = false,
}: ContextManagerViewProps) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [relevanceFilter, setRelevanceFilter] =
    useState<RelevanceFilter>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<Id<"contextItems"> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<null | "menu" | "note" | "upload">(
    null
  );
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const autoSyncedFor = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const items = useQuery(
    api.context.listByCorrespondent,
    normalizedEmail ? { email: normalizedEmail } : "skip"
  );
  const composed = useQuery(
    api.context.composeBriefingForCorrespondent,
    previewOpen && normalizedEmail ? { email: normalizedEmail } : "skip"
  );
  const setOverride = useMutation(api.context.setUserOverride);
  const bulkSetOverride = useMutation(api.context.bulkSetUserOverride);
  const deleteItem = useMutation(api.context.deleteItem);
  const addManual = useMutation(api.context.addManualContext);
  const addFile = useMutation(api.context.addContextFile);
  const syncTsprr = useAction(api.tsprrSync.syncTsprrForCorrespondent);

  const filteredItems = useMemo(() => {
    if (!items) {
      return [] as Doc<"contextItems">[];
    }
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceFilter !== "all" && item.source !== sourceFilter) {
        return false;
      }
      const included = effectiveIncluded(item);
      if (relevanceFilter === "included" && !included) {
        return false;
      }
      if (relevanceFilter === "excluded" && included) {
        return false;
      }
      if (q) {
        const hay =
          `${item.title}\n${item.snippet}\n${item.bodyForPrompt}`.toLowerCase();
        if (!hay.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [items, search, sourceFilter, relevanceFilter]);

  const stats = useMemo(() => {
    if (!items) {
      return { total: 0, included: 0, excluded: 0 };
    }
    let included = 0;
    for (const item of items) {
      if (effectiveIncluded(item)) {
        included += 1;
      }
    }
    return {
      total: items.length,
      included,
      excluded: items.length - included,
    };
  }, [items]);

  const handleSync = async (silent = false) => {
    if (!normalizedEmail) {
      return;
    }
    setSyncing(true);
    setSyncMessage(
      silent ? `Looking up ${normalizedEmail} in TSP-RR…` : "Syncing TSP-RR…"
    );
    try {
      const result = await syncTsprr({
        email: normalizedEmail,
        force: !silent,
      });
      if (result.cached) {
        setSyncMessage("TSP-RR already fresh (cached < 5 min).");
      } else if (result.itemsWritten === 0) {
        setSyncMessage(
          `No TSP-RR record for ${normalizedEmail} — add a note or upload files below.`
        );
      } else {
        setSyncMessage(`Synced ${result.itemsWritten} item(s) from TSP-RR.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "TSP-RR sync failed.";
      setSyncMessage(msg);
    } finally {
      setSyncing(false);
    }
  };

  // Auto-trigger one TSP-RR sync the first time we land on a correspondent
  // that has no items yet. Silent — failures surface in the sync banner only
  // when the user explicitly clicks Sync.
  // biome-ignore lint/correctness/useExhaustiveDependencies: handleSync closes over normalizedEmail; re-runs only need to fire on correspondent/items changes.
  useEffect(() => {
    if (!normalizedEmail || items === undefined) {
      return;
    }
    if (autoSyncedFor.current === normalizedEmail) {
      return;
    }
    const hasTsprr = items.some((i) => i.source === "tsprr");
    if (hasTsprr) {
      autoSyncedFor.current = normalizedEmail;
      return;
    }
    autoSyncedFor.current = normalizedEmail;
    handleSync(true).catch(() => {
      /* surfaced via syncMessage state */
    });
  }, [normalizedEmail, items]);

  const handleToggle = async (
    item: Doc<"contextItems">,
    nextIncluded: boolean
  ) => {
    const defaultMatchesGoal = item.defaultRelevant === nextIncluded;
    let override: "include" | "exclude" | undefined;
    if (!defaultMatchesGoal) {
      override = nextIncluded ? "include" : "exclude";
    }
    await setOverride({ itemId: item._id, override });
  };

  const handleClearOverrides = async () => {
    if (!items || items.length === 0) {
      return;
    }
    const overridden = items.filter((i) => i.userOverride !== undefined);
    if (overridden.length === 0) {
      return;
    }
    await bulkSetOverride({
      itemIds: overridden.map((i) => i._id),
      override: undefined,
    });
  };

  const handleDelete = async (item: Doc<"contextItems">) => {
    if (item.source !== "manual" && item.source !== "files") {
      return;
    }
    await deleteItem({ itemId: item._id });
  };

  const resetAddForm = () => {
    setNoteTitle("");
    setNoteContent("");
    setAddError(null);
  };

  const handleSaveRaw = async () => {
    if (!(normalizedEmail && noteContent.trim())) {
      return;
    }
    setSavingNote(true);
    setAddError(null);
    try {
      await addManual({
        email: normalizedEmail,
        title: noteTitle.trim() || "Manual note",
        content: noteContent.trim(),
      });
      resetAddForm();
      setAddMode(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const handlePolishAndSave = async () => {
    if (!(normalizedEmail && noteContent.trim())) {
      return;
    }
    setPolishing(true);
    setAddError(null);
    try {
      const res = await fetch("/api/polish-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: noteContent,
          title: noteTitle || undefined,
        }),
      });
      const data = (await res.json()) as { polished?: string; error?: string };
      if (!(res.ok && data.polished)) {
        throw new Error(data.error ?? "Polish failed.");
      }
      await addManual({
        email: normalizedEmail,
        title: noteTitle.trim() || "Manual note (polished)",
        content: data.polished,
      });
      resetAddForm();
      setAddMode(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Polish failed.");
    } finally {
      setPolishing(false);
    }
  };

  const handleFilesPicked = async (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!(normalizedEmail && fileList && fileList.length > 0)) {
      return;
    }
    setUploading(true);
    setAddError(null);
    try {
      for (const file of Array.from(fileList)) {
        const text = await extractFileContent(file);
        if (!text.trim()) {
          continue;
        }
        await addFile({
          email: normalizedEmail,
          filename: file.name,
          content: text,
        });
      }
      setAddMode(null);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!normalizedEmail) {
    return (
      <Card>
        <CardContent
          className={`text-center text-muted-foreground text-sm ${compact ? "p-4" : "p-8"}`}
        >
          No correspondent selected. Open an email thread in Outlook (or pass an
          email to this view) to see and manage its context items.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`flex flex-col gap-3 ${compact ? "" : "gap-4"}`}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-col">
            <span className="break-all font-medium text-sm">
              {normalizedEmail}
            </span>
            <span className="text-muted-foreground text-xs">
              {stats.total} item(s) · {stats.included} in · {stats.excluded} out
            </span>
          </div>
          <Button
            disabled={syncing}
            onClick={() => handleSync(false)}
            size={compact ? "sm" : "default"}
            variant="secondary"
          >
            {syncing ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sync TSP-RR
          </Button>
        </div>
        {syncMessage && (
          <div
            className={`flex items-start gap-1.5 rounded-md px-2 py-1.5 text-xs ${syncMessage.includes("failed") || syncMessage.includes("Error") || syncMessage.includes("not set") ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "text-muted-foreground"}`}
          >
            {(syncMessage.includes("failed") ||
              syncMessage.includes("Error") ||
              syncMessage.includes("not set")) && (
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            )}
            <span>{syncMessage}</span>
          </div>
        )}
      </div>

      <button
        className="-mx-1 flex items-center gap-1.5 self-start rounded px-1 py-0.5 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => setPreviewOpen((v) => !v)}
        type="button"
      >
        {previewOpen ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <Eye className="size-3.5" />
        Preview the context the AI will see
      </button>
      {previewOpen && (
        <Card>
          <CardContent className="p-3">
            {composed === undefined && (
              <div className="flex items-center text-muted-foreground text-xs">
                <Loader2 className="mr-2 size-4 animate-spin" />
                Composing…
              </div>
            )}
            {composed && !composed.contextBlock && (
              <p className="text-muted-foreground text-xs">
                Nothing included yet — toggle some items on (or sync TSP-RR) to
                see the briefing the AI will read.
              </p>
            )}
            {composed?.contextBlock && (
              <>
                <div className="mb-2 text-muted-foreground text-xs">
                  {composed.includedCount} included · {composed.excludedCount}{" "}
                  excluded · ~{composed.contextBlock.length} chars (≈{" "}
                  {Math.round(composed.contextBlock.length / 4)} tokens)
                </div>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px] leading-snug">
                  {composed.contextBlock}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 p-1.5">
        <SourceTabs onChange={setSourceFilter} value={sourceFilter} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border/60" />
        <RelevanceTabs onChange={setRelevanceFilter} value={relevanceFilter} />
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border/60" />
        <div className="relative min-w-32 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-7 border-border/60 bg-background pl-7 text-xs shadow-none"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search context"
            value={search}
          />
        </div>
        <div className="relative">
          <Button
            aria-expanded={addMode !== null}
            aria-haspopup="menu"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() => setAddMode((m) => (m === null ? "menu" : null))}
            size="sm"
            variant={addMode === null ? "default" : "secondary"}
          >
            {addMode === null ? (
              <Plus className="size-3.5" />
            ) : (
              <X className="size-3.5" />
            )}
            Add
          </Button>
          {addMode === "menu" && (
            <div
              className="absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
              role="menu"
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setAddError(null);
                  setAddMode("note");
                }}
                role="menuitem"
                type="button"
              >
                <PenLine className="size-3.5 text-muted-foreground" />
                <span>
                  <span className="block font-medium">Add a note</span>
                  <span className="block text-[10px] text-muted-foreground">
                    Type or paste. Optionally AI-polish.
                  </span>
                </span>
              </button>
              <div className="h-px bg-border" />
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                onClick={() => {
                  setAddError(null);
                  setAddMode("upload");
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                role="menuitem"
                type="button"
              >
                <FileUp className="size-3.5 text-muted-foreground" />
                <span>
                  <span className="block font-medium">Upload files</span>
                  <span className="block text-[10px] text-muted-foreground">
                    .pdf .docx .doc .md .txt .json
                  </span>
                </span>
              </button>
            </div>
          )}
        </div>
        <Button
          className="h-7 px-2 text-xs"
          onClick={handleClearOverrides}
          size="sm"
          variant="ghost"
        >
          <Trash2 className="mr-1 size-3.5" />
          {compact ? "Reset" : "Clear overrides"}
        </Button>
      </div>

      <input
        accept=".pdf,.docx,.doc,.md,.markdown,.txt,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/json,text/markdown,text/plain"
        className="hidden"
        multiple
        onChange={handleFilesPicked}
        ref={fileInputRef}
        type="file"
      />

      {addMode === "note" && (
        <Card className="border-border/60 bg-muted/20">
          <CardContent className="flex flex-col gap-2.5 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">Add a note</span>
              <button
                aria-label="Close note editor"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setAddMode(null)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <Input
              className="h-8 border-border/60 bg-background text-xs"
              id="ctx-note-title"
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional) — e.g. Renewal preferences"
              value={noteTitle}
            />
            <textarea
              className="min-h-28 rounded-md border border-border/60 bg-background p-2 font-mono text-xs leading-snug placeholder:text-muted-foreground/70"
              id="ctx-note-content"
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Anything the AI should remember about this contact — preferences, agreements, gotchas, raw notes…"
              value={noteContent}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="h-7 px-2 text-xs"
                disabled={!noteContent.trim() || savingNote || polishing}
                onClick={handleSaveRaw}
                size="sm"
                variant="outline"
              >
                {savingNote ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : null}
                Save as-is
              </Button>
              <Button
                className="h-7 px-2 text-xs"
                disabled={!noteContent.trim() || savingNote || polishing}
                onClick={handlePolishAndSave}
                size="sm"
              >
                {polishing ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1 size-3.5" />
                )}
                Polish with AI & save
              </Button>
            </div>
            {addError && (
              <p className="text-rose-600 text-xs dark:text-rose-400">
                {addError}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {uploading && (
        <div className="flex items-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-700 text-xs dark:text-sky-300">
          <Loader2 className="size-3.5 animate-spin" />
          Parsing & saving file(s)…
        </div>
      )}
      {addError && addMode !== "note" && (
        <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-700 text-xs dark:text-rose-300">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <span className="flex-1">{addError}</span>
          <button
            aria-label="Dismiss"
            className="opacity-70 hover:opacity-100"
            onClick={() => setAddError(null)}
            type="button"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {items === undefined && (
        <div className="flex items-center justify-center rounded-md border border-border/60 bg-muted/20 p-8 text-muted-foreground text-sm">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading items…
        </div>
      )}
      {items !== undefined && filteredItems.length === 0 && (
        <Card className="border-border/60 bg-muted/20">
          <CardContent
            className={`flex flex-col items-center gap-2 text-center ${compact ? "p-4" : "p-8"}`}
          >
            <div className="font-medium text-sm">
              {items.length === 0
                ? "Nothing here yet"
                : "No items match your filters"}
            </div>
            <p className="max-w-md text-muted-foreground text-xs leading-relaxed">
              {items.length === 0 ? (
                <>
                  We auto-check TSP-RR for{" "}
                  <span className="font-medium text-foreground">
                    {normalizedEmail}
                  </span>{" "}
                  the first time you land here. If they're not in the database,
                  use <span className="font-medium text-foreground">Add</span>{" "}
                  above to attach a note or upload files (.pdf, .docx, .md,
                  .txt, .json).
                </>
              ) : (
                <>
                  Try clearing the search or switching the source filter to
                  "All".
                </>
              )}
            </p>
            {items.length === 0 && (
              <Button
                className="mt-1 h-7 text-xs"
                disabled={syncing}
                onClick={() => handleSync(false)}
                size="sm"
                variant="outline"
              >
                {syncing ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="mr-1 size-3.5" />
                )}
                Try TSP-RR again
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {items !== undefined && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-border/60 border-b bg-muted/40 text-[11px] uppercase tracking-wide">
              <tr className="text-left text-muted-foreground">
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-medium">Item</th>
                {!compact && (
                  <th className="hidden px-3 py-2 font-medium md:table-cell">
                    Source
                  </th>
                )}
                {!compact && (
                  <th className="hidden px-3 py-2 font-medium md:table-cell">
                    When
                  </th>
                )}
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const included = effectiveIncluded(item);
                const expanded = expandedId === item._id;
                const deletable =
                  item.source === "manual" || item.source === "files";
                return (
                  <ContextRow
                    compact={compact}
                    expanded={expanded}
                    included={included}
                    item={item}
                    key={item._id}
                    onDelete={deletable ? () => handleDelete(item) : undefined}
                    onToggle={(next) => handleToggle(item, next)}
                    onToggleExpand={() =>
                      setExpandedId(expanded ? null : item._id)
                    }
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PillTabs<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: segmented control built with buttons; a <fieldset>+<legend> breaks the inline layout we want.
    <div
      aria-label={props.ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-md border border-border/60 bg-background p-0.5 shadow-sm"
      role="group"
    >
      {props.options.map((opt) => {
        const selected = props.value === opt.value;
        return (
          <button
            aria-pressed={selected}
            className={`rounded-[3px] px-2 py-0.5 font-medium text-[11px] transition-colors ${
              selected
                ? "bg-foreground/90 text-background shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            key={opt.value}
            onClick={() => props.onChange(opt.value)}
            type="button"
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SourceTabs(props: {
  value: SourceFilter;
  onChange: (next: SourceFilter) => void;
}) {
  return (
    <PillTabs
      ariaLabel="Filter by source"
      onChange={props.onChange}
      options={[
        { value: "all", label: "All" },
        { value: "outlook", label: "Mail" },
        { value: "graph", label: "Graph" },
        { value: "tsprr", label: "TSP-RR" },
        { value: "files", label: "Files" },
        { value: "manual", label: "Notes" },
      ]}
      value={props.value}
    />
  );
}

function RelevanceTabs(props: {
  value: RelevanceFilter;
  onChange: (next: RelevanceFilter) => void;
}) {
  return (
    <PillTabs
      ariaLabel="Filter by inclusion"
      onChange={props.onChange}
      options={[
        { value: "all", label: "All" },
        { value: "included", label: "In" },
        { value: "excluded", label: "Out" },
      ]}
      value={props.value}
    />
  );
}

function ContextRow(props: {
  item: Doc<"contextItems">;
  included: boolean;
  expanded: boolean;
  compact: boolean;
  onToggle: (next: boolean) => void;
  onToggleExpand: () => void;
  onDelete?: () => void;
}) {
  const { item, included, expanded, compact, onDelete } = props;
  const ts = item.occurredAt ?? item.fetchedAt;
  return (
    <>
      <tr
        className={`border-border/40 border-t transition-colors ${expanded ? "bg-muted/30" : "hover:bg-muted/20"}`}
      >
        <td className="px-2 py-2 align-top">
          <input
            aria-label={`Include ${item.title}`}
            checked={included}
            className="size-3.5 cursor-pointer accent-foreground"
            onChange={(e) => props.onToggle(e.target.checked)}
            type="checkbox"
          />
        </td>
        <td className="px-2 py-2 align-top">
          <button
            className="text-left font-medium hover:underline"
            onClick={props.onToggleExpand}
            type="button"
          >
            {item.title}
          </button>
          <div className="text-muted-foreground text-xs">{item.snippet}</div>
          {compact && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {SOURCE_LABELS[item.source] ?? item.source} · {item.kind} ·{" "}
              {formatTimestamp(ts)}
            </div>
          )}
        </td>
        {!compact && (
          <td className="hidden whitespace-nowrap px-3 py-2 align-top text-muted-foreground text-xs md:table-cell">
            {SOURCE_LABELS[item.source] ?? item.source} · {item.kind}
          </td>
        )}
        {!compact && (
          <td className="hidden whitespace-nowrap px-3 py-2 align-top text-muted-foreground text-xs md:table-cell">
            {formatTimestamp(ts)}
          </td>
        )}
        <td className="px-2 py-2 align-top text-xs">
          <div className="flex items-center gap-1.5">
            {item.userOverride === "include" && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                In
              </span>
            )}
            {item.userOverride === "exclude" && (
              <span className="rounded bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-700 dark:text-rose-300">
                Out
              </span>
            )}
            {item.userOverride === undefined && (
              <span className="text-muted-foreground">
                {item.defaultRelevant ? "auto-in" : "auto-out"}
              </span>
            )}
            {onDelete && (
              <button
                aria-label={`Delete ${item.title}`}
                className="text-muted-foreground hover:text-rose-600"
                onClick={onDelete}
                type="button"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t bg-muted/30">
          <td className="px-2 py-3" colSpan={compact ? 3 : 5}>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap text-xs">
              {item.bodyForPrompt}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
