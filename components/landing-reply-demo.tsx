"use client";

import { Copy, Download, Loader2, Sparkles } from "lucide-react";
import { type PointerEvent, useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { OUTLOOK_ADDIN_URL } from "@/lib/site-config";
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
  const [glow, setGlow] = useState({ x: 50, y: 50 });

  const updateGlow = useCallback((e: PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setGlow({
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    });
  }, []);

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
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailChain,
          tone: "professional",
          length: "normal",
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
      <textarea
        className={cn(
          "min-h-[180px] w-full resize-y rounded-2xl border border-border/80 bg-card/60 px-4 py-4 text-[0.9375rem] text-foreground leading-relaxed shadow-sm",
          "outline-none transition-[border-color,box-shadow,background-color] duration-200",
          "placeholder:text-muted-foreground/75",
          "hover:border-border hover:bg-card/80",
          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/35"
        )}
        id={inputId}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste the email or message you need to reply to…"
        value={input}
      />

      <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        {loading ? (
          <Button
            aria-busy
            className="h-12 w-full rounded-full px-8 shadow-md sm:min-w-[200px] sm:flex-1"
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
              "group/gen relative h-12 w-full overflow-hidden rounded-full px-8 shadow-md sm:min-w-[200px] sm:flex-1",
              "bg-primary text-primary-foreground transition-[box-shadow,filter,transform] duration-200",
              "hover:shadow-lg hover:brightness-[1.06] active:scale-[0.99]"
            )}
            onClick={generate}
            onPointerEnter={updateGlow}
            onPointerLeave={() => setGlow({ x: 50, y: 50 })}
            onPointerMove={updateGlow}
            type="button"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/gen:opacity-100"
              style={{
                background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, oklch(1 0 0 / 0.28) 0%, transparent 52%)`,
              }}
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

        <a
          className={cn(
            buttonVariants({ size: "lg", variant: "outline" }),
            "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-border/90 bg-background/80 px-8 font-medium shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,color] duration-200",
            "hover:border-border hover:bg-muted/50 hover:shadow-md sm:min-w-[200px] sm:flex-1"
          )}
          href={OUTLOOK_ADDIN_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Download aria-hidden className="size-4 shrink-0" />
          Outlook add-in
        </a>
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
