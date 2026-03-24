"use client";

import type { LucideIcon } from "lucide-react";
import {
  AlignLeft,
  Briefcase,
  Coffee,
  List,
  Scissors,
  ScrollText,
  Smile,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ReplyLength, ReplyTone } from "@/lib/types";
import { cn } from "@/lib/utils";

const LENGTH_OPTIONS: {
  value: ReplyLength;
  title: string;
  Icon: LucideIcon;
}[] = [
  { value: "quick", title: "Blip — a line or two", Icon: Zap },
  { value: "short", title: "Brief — short and tidy", Icon: AlignLeft },
  { value: "normal", title: "Balanced — just right", Icon: List },
  { value: "long", title: "Full — room to breathe", Icon: ScrollText },
];

const TONE_OPTIONS: {
  value: ReplyTone;
  title: string;
  Icon: LucideIcon;
}[] = [
  {
    value: "professional",
    title: "Boardroom — clear and polished",
    Icon: Briefcase,
  },
  { value: "friendly", title: "Warm — human, approachable", Icon: Smile },
  { value: "concise", title: "Direct — no fluff", Icon: Scissors },
  { value: "casual", title: "Easy — relaxed", Icon: Coffee },
];

function SegmentedIconGroup<
  T extends string,
  O extends { title: string; value: T },
>({
  "aria-label": ariaLabel,
  disabled,
  onChange,
  options,
  renderCell,
  value,
}: {
  "aria-label": string;
  disabled?: boolean;
  onChange: (next: T) => void;
  options: O[];
  renderCell: (opt: O, selected: boolean) => ReactNode;
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
                {renderCell(opt, selected)}
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
  length: ReplyLength;
  onLengthChange: (value: ReplyLength) => void;
  onToneChange: (value: ReplyTone) => void;
  tone: ReplyTone;
}

const STYLE_ICON_CLASS = "size-4 shrink-0 stroke-2";

export function ReplyComposerToolbar({
  disabled,
  length,
  onLengthChange,
  onToneChange,
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
            onChange={onLengthChange}
            options={LENGTH_OPTIONS}
            renderCell={(opt, selected) => {
              const Icon = opt.Icon;
              return (
                <span
                  className={cn(
                    "inline-flex w-9 items-center justify-center px-1",
                    selected && "text-primary-foreground"
                  )}
                >
                  <Icon aria-hidden className={STYLE_ICON_CLASS} />
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
            onChange={onToneChange}
            options={TONE_OPTIONS}
            renderCell={(opt, selected) => {
              const Icon = opt.Icon;
              return (
                <span
                  className={cn(
                    "inline-flex w-9 items-center justify-center px-1",
                    selected && "text-primary-foreground"
                  )}
                >
                  <Icon aria-hidden className={STYLE_ICON_CLASS} />
                </span>
              );
            }}
            value={tone}
          />
        </div>
      </section>
    </TooltipProvider>
  );
}
