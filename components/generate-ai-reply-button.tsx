"use client";

import { Loader2, Sparkles } from "lucide-react";
import { type PointerEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GenerateAiReplyButtonProps {
  isGenerating: boolean;
  onGenerate: () => void;
}

export function GenerateAiReplyButton({
  isGenerating,
  onGenerate,
}: GenerateAiReplyButtonProps) {
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const updateGlow = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setGlow({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }, []);

  if (isGenerating) {
    return (
      <Button
        aria-busy
        className="mailai-generate-btn mt-1 mb-2 h-11 w-full rounded-md"
        disabled
        size="default"
      >
        <Loader2 className="animate-spin" />
        Generating...
      </Button>
    );
  }

  return (
    <Button
      className={cn(
        "mailai-generate-btn group/gen relative mt-1 mb-2 h-11 w-full overflow-hidden rounded-lg",
        "bg-primary text-primary-foreground transition-[box-shadow,filter,transform] duration-200 hover:shadow-lg hover:brightness-[1.06] active:scale-[0.99] active:brightness-[1.02]"
      )}
      onClick={onGenerate}
      onPointerEnter={updateGlow}
      onPointerLeave={() => setGlow({ x: 50, y: 50 })}
      onPointerMove={updateGlow}
      size="default"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/gen:opacity-100"
        style={{
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, oklch(1 0 0 / 0.28) 0%, transparent 52%)`,
        }}
      />
      <span className="relative z-1 flex items-center justify-center gap-2 transition-[color,filter] duration-200 group-hover/gen:text-primary-foreground group-hover/gen:brightness-110">
        <Sparkles
          aria-hidden
          className="size-4 shrink-0 text-primary-foreground transition-[filter] duration-200 group-hover/gen:brightness-110"
          strokeWidth={2}
        />
        Generate AI Reply
      </span>
    </Button>
  );
}
