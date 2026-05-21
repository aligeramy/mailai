"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
  FileUp,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { type ChangeEvent, useMemo, useRef, useState } from "react";
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
  const [addOpen, setAddOpen] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const normalizedEmail = email.trim().toLowerCase();

  const items = useQuery(
    api.context.listByCorrespondent,
    normalizedEmail ? { email: normalizedEmail } : "skip"
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

  const handleSync = async () => {
    if (!normalizedEmail) {
      return;
    }
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await syncTsprr({ email: normalizedEmail, force: true });
      setSyncMessage(
        result.cached
          ? "Already fresh — no new data pulled."
          : `Synced ${result.itemsWritten} item(s) from TSP-RR.`
      );
    } catch (err) {
      setSyncMessage(
        err instanceof Error ? err.message : "TSP-RR sync failed."
      );
    } finally {
      setSyncing(false);
    }
  };

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
      setAddOpen(false);
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
      setAddOpen(false);
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
        const text = await file.text();
        if (!text.trim()) {
          continue;
        }
        await addFile({
          email: normalizedEmail,
          filename: file.name,
          content: text,
        });
      }
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
            onClick={handleSync}
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
          <p className="text-muted-foreground text-xs">{syncMessage}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SourceTabs onChange={setSourceFilter} value={sourceFilter} />
        <RelevanceTabs onChange={setRelevanceFilter} value={relevanceFilter} />
        <div className="relative min-w-32 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={`pl-8 ${compact ? "h-8 text-xs" : ""}`}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search"
            value={search}
          />
        </div>
        <Button
          onClick={() => setAddOpen((v) => !v)}
          size="sm"
          variant={addOpen ? "secondary" : "default"}
        >
          {addOpen ? (
            <X className="mr-1 size-3.5" />
          ) : (
            <Plus className="mr-1 size-3.5" />
          )}
          Add
        </Button>
        <Button onClick={handleClearOverrides} size="sm" variant="ghost">
          <Trash2 className="mr-1 size-3.5" />
          {compact ? "Reset" : "Clear overrides"}
        </Button>
      </div>

      {addOpen && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-xs" htmlFor="ctx-note-title">
                Title (optional)
              </label>
              <Input
                className={compact ? "h-8 text-xs" : ""}
                id="ctx-note-title"
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Renewal preferences"
                value={noteTitle}
              />
              <label className="font-medium text-xs" htmlFor="ctx-note-content">
                Notes (typed or pasted)
              </label>
              <textarea
                className="min-h-32 rounded-md border bg-background p-2 font-mono text-xs"
                id="ctx-note-content"
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Anything the AI should remember about this contact — preferences, agreements, gotchas, paste raw notes…"
                value={noteContent}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  disabled={!noteContent.trim() || savingNote || polishing}
                  onClick={handleSaveRaw}
                  size="sm"
                  variant="secondary"
                >
                  {savingNote ? (
                    <Loader2 className="mr-1 size-3.5 animate-spin" />
                  ) : null}
                  Save as-is
                </Button>
                <Button
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
            </div>
            <div className="border-t pt-3">
              <div className="mb-2 font-medium text-xs">
                Or upload markdown / text files
              </div>
              <input
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="hidden"
                multiple
                onChange={handleFilesPicked}
                ref={fileInputRef}
                type="file"
              />
              <Button
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                size="sm"
                variant="outline"
              >
                {uploading ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <FileUp className="mr-1 size-3.5" />
                )}
                Choose files…
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

      {items === undefined && (
        <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading items…
        </div>
      )}
      {items !== undefined && filteredItems.length === 0 && (
        <Card>
          <CardContent
            className={`text-center text-muted-foreground text-sm ${compact ? "p-4" : "p-8"}`}
          >
            {items.length === 0
              ? 'No context items yet. Click "Sync TSP-RR" to pull from the database, or generate a reply to capture mailbox history.'
              : "No items match the current filters."}
          </CardContent>
        </Card>
      )}
      {items !== undefined && filteredItems.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="w-8 px-2 py-2" />
                <th className="px-2 py-2 font-medium">Item</th>
                {!compact && (
                  <th className="hidden px-3 py-2 font-medium md:table-cell">
                    Source / Kind
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

function SourceTabs(props: {
  value: SourceFilter;
  onChange: (next: SourceFilter) => void;
}) {
  const options: { value: SourceFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "outlook", label: "Outlook" },
    { value: "graph", label: "Graph" },
    { value: "tsprr", label: "TSP-RR" },
    { value: "files", label: "Files" },
    { value: "manual", label: "Manual" },
  ];
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5">
      {options.map((opt) => (
        <button
          className={`rounded px-2 py-1 font-medium text-xs transition-colors ${
            props.value === opt.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
          key={opt.value}
          onClick={() => props.onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RelevanceTabs(props: {
  value: RelevanceFilter;
  onChange: (next: RelevanceFilter) => void;
}) {
  const options: { value: RelevanceFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "included", label: "In" },
    { value: "excluded", label: "Out" },
  ];
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5">
      {options.map((opt) => (
        <button
          className={`rounded px-2 py-1 font-medium text-xs transition-colors ${
            props.value === opt.value
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
          key={opt.value}
          onClick={() => props.onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
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
      <tr className="border-t">
        <td className="px-2 py-2 align-top">
          <input
            aria-label={`Include ${item.title}`}
            checked={included}
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
