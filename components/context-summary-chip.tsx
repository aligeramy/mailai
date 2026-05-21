"use client";

import { useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

interface ContextSummaryChipProps {
  /** Lowercased correspondent email. Empty disables the chip. */
  email: string;
  /** Click handler — used to switch the taskpane to the Context tab. */
  onOpen?: () => void;
}

const SOURCE_ORDER: Array<{ key: string; label: string }> = [
  { key: "tsprr", label: "TSP-RR" },
  { key: "outlook", label: "mail" },
  { key: "manual", label: "notes" },
  { key: "files", label: "files" },
  { key: "graph", label: "Graph" },
];

function effectiveIncluded(item: Doc<"contextItems">): boolean {
  if (item.userOverride === "include") {
    return true;
  }
  if (item.userOverride === "exclude") {
    return false;
  }
  return item.defaultRelevant;
}

/**
 * Tiny status chip for the Compose view: surfaces how much CRM/mailbox
 * context will accompany the next reply for this correspondent. Clicking
 * it deep-links to the Context tab so the user can edit the selection.
 */
export function ContextSummaryChip({ email, onOpen }: ContextSummaryChipProps) {
  const normalized = email.trim().toLowerCase();
  const items = useQuery(
    api.context.listByCorrespondent,
    normalized ? { email: normalized } : "skip"
  );

  const summary = useMemo(() => {
    if (!items) {
      return null;
    }
    const counts: Record<string, number> = {};
    let total = 0;
    for (const item of items) {
      if (!effectiveIncluded(item)) {
        continue;
      }
      counts[item.source] = (counts[item.source] ?? 0) + 1;
      total += 1;
    }
    return { total, counts };
  }, [items]);

  if (!normalized) {
    return null;
  }

  if (summary === null) {
    return (
      <div className="rounded-md border border-white/10 bg-background/40 px-2 py-1.5 text-muted-foreground text-xs">
        Loading context for {normalized}…
      </div>
    );
  }

  if (summary.total === 0) {
    return (
      <button
        className="flex w-full items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-amber-700 text-xs transition-colors hover:bg-amber-500/10 dark:text-amber-300"
        onClick={onOpen}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="size-3.5" />
          No CRM context yet for {normalized}
        </span>
        <span className="opacity-80">Open Context →</span>
      </button>
    );
  }

  const parts = SOURCE_ORDER.filter((s) => summary.counts[s.key] != null).map(
    (s) => `${summary.counts[s.key]} ${s.label}`
  );

  return (
    <button
      className="flex w-full items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 text-emerald-700 text-xs transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
      onClick={onOpen}
      type="button"
    >
      <span className="flex items-center gap-1.5">
        <Sparkles className="size-3.5" />
        Reply will include {summary.total} item{summary.total === 1 ? "" : "s"}
        {parts.length > 0 && (
          <span className="opacity-80">({parts.join(" · ")})</span>
        )}
      </span>
      <span className="opacity-80">Manage →</span>
    </button>
  );
}
