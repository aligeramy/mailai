"use client";

import { Copy, Loader2, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { useId, useMemo, useState } from "react";
import { OutlookAddinButton } from "@/components/outlook-addin-button";
import { ReplyComposerToolbar } from "@/components/reply-composer-toolbar";
import { Button } from "@/components/ui/button";
import { useGlowSheen } from "@/hooks/use-glow-sheen";
import { useReplyPreferences } from "@/hooks/use-reply-preferences";
import type { EmailChain } from "@/lib/types";
import { cn } from "@/lib/utils";

function buildDemoChainFromPaste(text: string): EmailChain {
  const trimmed = text.trim();
  const now = new Date();
  return {
    subject: "Message to respond to",
    currentUserEmail: "you@example.com",
    messages: [
      {
        id: "demo-1",
        from: "sender@example.com",
        to: ["you@example.com"],
        subject: "Message to respond to",
        body: trimmed.length > 0 ? trimmed : "(empty message)",
        timestamp: now,
      },
    ],
  };
}

export function LandingReplyDemo() {
  const inputId = useId();
  const outputId = useId();
  const [input, setInput] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const generateSheen = useGlowSheen();
  const draftChain = useMemo(() => {
    const trimmed = input.trim();
    return trimmed ? buildDemoChainFromPaste(trimmed) : null;
  }, [input]);
  const {
    ensureResolvedPreferences,
    isResolvingLength,
    isResolvingTone,
    length,
    resolutionError,
    setLength,
    setTone,
    tone,
  } = useReplyPreferences({
    emailChain: draftChain,
  });

  const generate = async () => {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("Paste a message first.");
      setReply(null);
      return;
    }
    setLoading(true);
    setError(null);
    setReply(null);
    try {
      const emailChain = buildDemoChainFromPaste(trimmed);
      const resolvedPreferences = await ensureResolvedPreferences();
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailChain,
          tone,
          length,
          resolvedPreferences,
        }),
      });
      const data = (await res.json()) as { error?: string; reply?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not generate a reply.");
      }
      if (typeof data.reply !== "string") {
        throw new Error("Invalid response from server.");
      }
      setReply(data.reply);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const copyReply = async () => {
    if (!reply) {
      return;
    }
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <label className="sr-only" htmlFor={inputId}>
        Message to reply to
      </label>
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border/80 bg-card/60 shadow-sm transition-[border-color,box-shadow] duration-200",
          "hover:border-border",
          "focus-within:border-sky-400/50 focus-within:ring-[1.5px] focus-within:ring-sky-400 focus-within:ring-offset-2 focus-within:ring-offset-background"
        )}
      >
        <textarea
          className={cn(
            "min-h-[180px] w-full resize-none border-0 bg-transparent px-4 pt-4 pb-4 text-[0.9375rem] text-foreground leading-relaxed outline-none",
            "placeholder:text-muted-foreground/75",
            "focus-visible:ring-0"
          )}
          id={inputId}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the email or message you need to reply to…"
          value={input}
        />
        <ReplyComposerToolbar
          disabled={loading}
          isResolvingLength={isResolvingLength}
          isResolvingTone={isResolvingTone}
          length={length}
          onLengthChange={setLength}
          onToneChange={setTone}
          resolutionError={resolutionError}
          tone={tone}
        />
      </div>

      <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        {loading ? (
          <Button
            aria-busy
            className="h-12 w-full rounded-xl px-8 shadow-md sm:min-w-[200px] sm:flex-1"
            disabled
            size="lg"
            type="button"
          >
            <Loader2 className="size-4 animate-spin" />
            Generating…
          </Button>
        ) : (
          <Button
            className={cn(
              "group/gen relative h-12 w-full overflow-hidden rounded-xl px-8 shadow-md sm:min-w-[200px] sm:flex-1",
              "bg-primary text-primary-foreground transition-[box-shadow,filter,transform] duration-200",
              "hover:shadow-lg hover:brightness-[1.06] active:scale-[0.99]"
            )}
            onClick={generate}
            onPointerEnter={generateSheen.handlePointerEnter}
            onPointerMove={generateSheen.updateGlow}
            type="button"
          >
            <span
              aria-hidden
              className="mailai-glow-sheen mailai-glow-sheen--subtle pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/gen:opacity-100"
              style={
                {
                  "--mailai-glow-x": `${generateSheen.glow.x}%`,
                  "--mailai-glow-y": `${generateSheen.glow.y}%`,
                } as CSSProperties
              }
            />
            <span className="relative z-1 flex items-center justify-center gap-2 font-medium">
              <Sparkles
                aria-hidden
                className="size-4 shrink-0"
                strokeWidth={2}
              />
              Generate reply
            </span>
          </Button>
        )}

        <OutlookAddinButton />
      </div>

      {error ? (
        <p
          className="mt-6 rounded-xl border border-destructive/35 bg-destructive/8 px-4 py-3 text-center text-destructive text-sm"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {reply ? (
        <section
          aria-labelledby={outputId}
          className="mt-8 rounded-2xl border border-border/70 bg-muted/25 p-5 text-left shadow-sm dark:bg-muted/15"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium text-foreground text-sm" id={outputId}>
              Suggested reply
            </h2>
            <Button
              className="h-8 rounded-full px-3 text-xs"
              onClick={copyReply}
              size="sm"
              type="button"
              variant="outline"
            >
              <Copy aria-hidden className="size-3.5" />
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <p className="whitespace-pre-wrap text-[0.9375rem] text-foreground/95 leading-relaxed">
            {reply}
          </p>
        </section>
      ) : null}
    </div>
  );
}
