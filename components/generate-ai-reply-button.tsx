"use client";

import { Loader2, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { useGlowSheen } from "@/hooks/use-glow-sheen";
import { cn } from "@/lib/utils";

interface GenerateAiReplyButtonProps {
  isGenerating: boolean;
  onGenerate: () => void;
}

export function GenerateAiReplyButton({
  isGenerating,
  onGenerate,
}: GenerateAiReplyButtonProps) {
  const { glow, updateGlow, handlePointerEnter } = useGlowSheen();

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
        "mailai-generate-btn group/gen relative mt-1 mb-2 h-11 w-full overflow-hidden rounded-xl",
        "border-0 bg-transparent transition-[box-shadow,filter,transform] duration-200 active:scale-[0.99]"
      )}
      onClick={onGenerate}
      onPointerEnter={handlePointerEnter}
      onPointerMove={updateGlow}
      size="default"
    >
      <span
        aria-hidden
        className="mailai-glow-sheen pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/gen:opacity-100"
        style={
          {
            "--mailai-glow-x": `${glow.x}%`,
            "--mailai-glow-y": `${glow.y}%`,
          } as CSSProperties
        }
      />
      <span className="relative z-1 flex items-center justify-center gap-2 transition-[filter] duration-200 group-hover/gen:brightness-[1.03]">
        <Sparkles
          aria-hidden
          className="size-4 shrink-0 transition-[filter] duration-200 group-hover/gen:brightness-[1.03]"
          strokeWidth={2}
        />
        Generate AI Reply
      </span>
    </Button>
  );
}
