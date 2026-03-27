"use client";

import type { LucideIcon } from "lucide-react";
import { Equal, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  REPLY_LENGTH_TITLES,
  REPLY_TONE_TITLES,
} from "@/lib/reply-preferences";
import type { ReplyLength, ReplyTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_ICONS: Record<ReplyLength, LucideIcon> = {
  auto: Sparkles,
  light: Minus,
  normal: Equal,
  high: Plus,
};

const LENGTH_OPTIONS: {
  title: string;
  value: ReplyLength;
}[] = [
  { value: "auto", title: REPLY_LENGTH_TITLES.auto },
  { value: "light", title: REPLY_LENGTH_TITLES.light },
  { value: "normal", title: REPLY_LENGTH_TITLES.normal },
  { value: "high", title: REPLY_LENGTH_TITLES.high },
];

const TONE_OPTIONS: {
  title: string;
  value: ReplyTone;
}[] = [
  { value: "auto", title: REPLY_TONE_TITLES.auto },
  { value: "light", title: REPLY_TONE_TITLES.light },
  { value: "normal", title: REPLY_TONE_TITLES.normal },
  { value: "high", title: REPLY_TONE_TITLES.high },
];

function SegmentedIconGroup<
  T extends string,
  O extends { title: string; value: T },
>({
  "aria-label": ariaLabel,
  disabled,
  loadingValue,
  onChange,
  options,
  renderCell,
  value,
}: {
  "aria-label": string;
  disabled?: boolean;
  loadingValue?: T | null;
  onChange: (next: T) => void;
  options: O[];
  renderCell: (opt: O, selected: boolean, loading: boolean) => ReactNode;
  value: T;
}) {
  const n = options.length;
  return (
    <fieldset
      aria-label={ariaLabel}
      className="m-0 inline-flex min-w-0 overflow-hidden rounded-lg border border-border bg-background/90 p-0 shadow-sm dark:bg-input/30"
    >
      {options.map((opt, i) => {
        const selected = value === opt.value;
        const loading = loadingValue === opt.value;
        return (
          <Tooltip key={String(opt.value)}>
            <TooltipTrigger asChild>
              <Button
                aria-label={opt.title}
                aria-pressed={selected}
                className={cn(
                  "h-7 min-w-0 shrink-0 rounded-none border-0 px-0 shadow-none ring-0",
                  "focus-visible:z-10 focus-visible:ring-[1.5px] focus-visible:ring-ring/50",
                  i > 0 && "border-border border-l",
                  i === 0 && "rounded-l-[calc(var(--radius-lg)-1px)]",
                  i === n - 1 && "rounded-r-[calc(var(--radius-lg)-1px)]",
                  selected
                    ? "bg-primary text-primary-foreground hover:bg-primary/92 hover:text-primary-foreground"
                    : "bg-transparent text-foreground/85 hover:bg-muted/80 hover:text-foreground"
                )}
                disabled={disabled}
                onClick={() => {
                  onChange(opt.value);
                }}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                {renderCell(opt, selected, loading)}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{opt.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </fieldset>
  );
}

interface ReplyComposerToolbarProps {
  disabled?: boolean;
  isResolvingLength?: boolean;
  isResolvingTone?: boolean;
  length: ReplyLength;
  onLengthChange: (value: ReplyLength) => void;
  onToneChange: (value: ReplyTone) => void;
  resolutionError?: string | null;
  tone: ReplyTone;
}

const STYLE_ICON_CLASS = "size-4 shrink-0 stroke-2";

export function ReplyComposerToolbar({
  disabled,
  isResolvingLength = false,
  isResolvingTone = false,
  length,
  onLengthChange,
  onToneChange,
  resolutionError = null,
  tone,
}: ReplyComposerToolbarProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <section
        aria-label="Reply length and tone"
        className="border-border/45 border-t bg-muted/30 px-2 py-2 sm:px-3 dark:bg-muted/15"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between sm:gap-3">
          <SegmentedIconGroup
            aria-label="Reply length"
            disabled={disabled}
            loadingValue={isResolvingLength ? "auto" : null}
            onChange={onLengthChange}
            options={LENGTH_OPTIONS}
            renderCell={(opt, selected, loading) => {
              const Icon = loading ? Loader2 : LEVEL_ICONS[opt.value];
              return (
                <span
                  className={cn(
                    "inline-flex w-9 items-center justify-center px-1",
                    selected && "text-primary-foreground"
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(STYLE_ICON_CLASS, loading && "animate-spin")}
                  />
                </span>
              );
            }}
            value={length}
          />

          <div
            aria-hidden
            className="hidden h-6 w-px shrink-0 bg-border/70 sm:block"
          />

          <SegmentedIconGroup
            aria-label="Reply tone"
            disabled={disabled}
            loadingValue={isResolvingTone ? "auto" : null}
            onChange={onToneChange}
            options={TONE_OPTIONS}
            renderCell={(opt, selected, loading) => {
              const Icon = loading ? Loader2 : LEVEL_ICONS[opt.value];
              return (
                <span
                  className={cn(
                    "inline-flex w-9 items-center justify-center px-1",
                    selected && "text-primary-foreground"
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(STYLE_ICON_CLASS, loading && "animate-spin")}
                  />
                </span>
              );
            }}
            value={tone}
          />
        </div>

        {resolutionError ? (
          <div className="mt-2 text-center text-[11px] text-destructive leading-none sm:text-left">
            {resolutionError}
          </div>
        ) : null}
      </section>
    </TooltipProvider>
  );
}
