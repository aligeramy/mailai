"use client";

import { Download } from "lucide-react";
import type { CSSProperties } from "react";
import { useGlowSheen } from "@/hooks/use-glow-sheen";
import { OUTLOOK_ADDIN_URL } from "@/lib/site-config";
import { cn } from "@/lib/utils";

interface OutlookAddinButtonProps {
  className?: string;
}

export function OutlookAddinButton({ className }: OutlookAddinButtonProps) {
  const addinSheen = useGlowSheen();

  return (
    <a
      className={cn(
        "group/addin relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-8 font-semibold text-sm text-white shadow-lg",
        "border border-sky-200/25",
        "bg-linear-to-br from-sky-700 via-sky-500 to-sky-400",
        "shadow-[0_10px_28px_-4px_rgb(14_165_233/0.42),0_4px_14px_-2px_rgb(56_189_248/0.28)]",
        "transition-[filter,box-shadow,transform] duration-200",
        "hover:shadow-[0_14px_36px_-4px_rgb(14_165_233/0.48),0_6px_18px_-2px_rgb(56_189_248/0.35)] hover:brightness-[1.06]",
        "active:scale-[0.99]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "sm:min-w-[200px] sm:flex-1",
        className
      )}
      href={OUTLOOK_ADDIN_URL}
      onPointerEnter={addinSheen.handlePointerEnter}
      onPointerMove={addinSheen.updateGlow}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span
        aria-hidden
        className="mailai-glow-sheen pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/addin:opacity-100"
        style={
          {
            "--mailai-glow-x": `${addinSheen.glow.x}%`,
            "--mailai-glow-y": `${addinSheen.glow.y}%`,
          } as CSSProperties
        }
      />
      <span className="relative z-1 flex items-center justify-center gap-2 drop-shadow-sm">
        <Download aria-hidden className="size-4 shrink-0 opacity-95" />
        Outlook add-in
      </span>
    </a>
  );
}
