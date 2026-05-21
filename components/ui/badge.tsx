import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone =
  | "neutral"
  | "muted"
  | "danger"
  | "warning"
  | "success"
  | "info"
  | "violet"
  | "sky";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral:
    "bg-foreground/8 text-foreground/80 border-foreground/12 hover:bg-foreground/12",
  muted: "bg-muted text-muted-foreground border-border/60",
  danger: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
  warning:
    "bg-amber-500/12 text-amber-700 border-amber-500/30 dark:text-amber-300",
  success:
    "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
  info: "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-300",
  violet:
    "bg-violet-500/12 text-violet-700 border-violet-500/25 dark:text-violet-300",
  sky: "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-300",
};

interface BadgeProps {
  children: ReactNode;
  className?: string;
  tone?: BadgeTone;
}

/**
 * Compact label pill used for source / kind / status / priority annotations.
 * Stays single-line, uses subtle background tint per tone, and renders at
 * 10–11 px so a row can fit multiple badges without ballooning.
 */
export function Badge({ tone = "neutral", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-0.5 font-medium text-[10px] leading-none transition-colors",
        TONE_CLASSES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
