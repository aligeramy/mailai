"use client";

import {
  BotMessageSquare,
  Briefcase,
  ChevronDown,
  ChevronRight,
  Gauge,
  Handshake,
  Key,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Scale,
  Settings,
  Smile,
  Snail,
  Sparkles,
  Text,
  Turtle,
} from "lucide-react";
import { type ReactElement, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { stripHtml } from "@/lib/email/html";
import { createEmailProvider } from "@/lib/providers/create-email-provider";
import type { EmailChain, ReplyLength, ReplyTone } from "@/lib/types";

const TONES: { value: ReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
];
const LENGTHS: { value: ReplyLength; label: string }[] = [
  { value: "quick", label: "Quick" },
  { value: "short", label: "Short" },
  { value: "normal", label: "Normal" },
  { value: "long", label: "Long" },
];

type ViewState = "main" | "settings";
type ChainMeta = {
  date?: string;
  from?: string;
  subject?: string;
};

function taskpaneSubtitle(officeReady: boolean, composeMode: boolean): string {
  if (!officeReady) {
    return "Dev preview";
  }
  if (composeMode) {
    return "Compose — replying to thread in draft";
  }
  return "Reading message — reply uses full thread when quoted";
}

function toneIcon(tone: ReplyTone): ReactElement {
  if (tone === "professional") {
    return <Briefcase className="size-3.5" />;
  }
  if (tone === "friendly") {
    return <Handshake className="size-3.5" />;
  }
  if (tone === "concise") {
    return <Text className="size-3.5" />;
  }
  if (tone === "formal") {
    return <Scale className="size-3.5" />;
  }
  return <Smile className="size-3.5" />;
}

function lengthIcon(length: ReplyLength): ReactElement {
  if (length === "quick") {
    return <Gauge className="size-3.5" />;
  }
  if (length === "short") {
    return <Snail className="size-3.5" />;
  }
  if (length === "normal") {
    return <MessageSquareText className="size-3.5" />;
  }
  return <Turtle className="size-3.5" />;
}

function extractChainMeta(text: string): ChainMeta {
  const from = text.match(/(?:^|\n)From:\s*(.+)/i)?.[1]?.trim();
  const date = text.match(/(?:^|\n)(?:Date|Sent):\s*(.+)/i)?.[1]?.trim();
  const subject = text.match(/(?:^|\n)Subject:\s*(.+)/i)?.[1]?.trim();
  return { from, date, subject };
}

function compactChainBody(input: string): string {
  const droppedLinePatterns = [
    /^Get\s+Outlook/i,
    /^Renew now$/i,
    /^Sign In\|/i,
    /^All the best,?$/i,
    /^Dynadot$/i,
    /^EXPIRING IN/i,
    /^Total price to renew:/i,
    /^\*The price quoted above/i,
  ];

  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return true;
    }
    return !droppedLinePatterns.some((pattern) => pattern.test(trimmed));
  });

  return filtered
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export default function TaskpanePage() {
  const [officeReady, setOfficeReady] = useState(false);
  const [officeInitFailed, setOfficeInitFailed] = useState(false);
  const [emailChain, setEmailChain] = useState<EmailChain | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<ReplyTone>("professional");
  const [length, setLength] = useState<ReplyLength>("normal");
  const [additionalContext, setAdditionalContext] = useState("");
  const [contextExpanded, setContextExpanded] = useState(false);
  const [chainExpanded, setChainExpanded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState<ViewState>("main");
  const [composeMode, setComposeMode] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const loadEmailChain = useCallback(async () => {
    try {
      if (typeof Office === "undefined" || !Office.context?.mailbox?.item) {
        console.info("[mailai/taskpane] Office context not available");
        return;
      }

      const provider = createEmailProvider("outlook");
      const chain = await provider.getEmailChain();
      setEmailChain(chain);
      setComposeMode(provider.isComposeMode());
      console.info("[mailai/taskpane] loaded email chain", {
        messages: chain.messages.length,
        composeMode: provider.isComposeMode(),
      });
    } catch (err) {
      console.error("[mailai/taskpane] failed to load email chain", err);
      setError(
        err instanceof Error ? err.message : "Failed to load email content"
      );
    }
  }, []);

  useEffect(() => {
    const savedKey = localStorage.getItem("mailai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }

    const initOffice = () => {
      if (typeof Office === "undefined") {
        return false;
      }
      Office.onReady(() => {
        console.info("[mailai/taskpane] Office.onReady fired");
        setOfficeReady(true);
        setOfficeInitFailed(false);
        loadEmailChain();
      });
      return true;
    };

    if (!initOffice()) {
      // In Outlook webviews, office.js may arrive after React mount.
      let attempts = 0;
      const maxAttempts = 30;
      const interval = window.setInterval(() => {
        attempts += 1;
        if (initOffice()) {
          window.clearInterval(interval);
          return;
        }
        if (attempts >= maxAttempts) {
          window.clearInterval(interval);
          console.info("[mailai/taskpane] Office.js not detected after retry");
          setOfficeReady(false);
          setOfficeInitFailed(true);
        }
      }, 250);
      return () => window.clearInterval(interval);
    }
  }, [loadEmailChain]);

  const generateReply = async () => {
    setIsGenerating(true);
    setError(null);
    setToastVisible(false);

    try {
      let chainToUse = emailChain;

      // In Outlook, always prefer live message body/context over demo content.
      if (
        !chainToUse &&
        typeof Office !== "undefined" &&
        Office.context?.mailbox?.item
      ) {
        const provider = createEmailProvider("outlook");
        chainToUse = await provider.getEmailChain();
        setEmailChain(chainToUse);
        setComposeMode(provider.isComposeMode());
      }

      // Only use demo data when truly outside Outlook.
      if (!chainToUse) {
        chainToUse = createDemoChain();
      }

      console.info("[mailai/taskpane] generate clicked", {
        hasApiKeyInUI: Boolean(apiKey.trim()),
        messages: chainToUse.messages.length,
        tone,
        length,
      });

      const response = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailChain: chainToUse,
          tone,
          length,
          additionalContext: additionalContext || undefined,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });

      const data = await response.json();
      console.info("[mailai/taskpane] generate response", {
        status: response.status,
        ok: response.ok,
      });

      if (!response.ok) {
        if (response.status === 401) {
          setView("settings");
        }
        throw new Error(data.error ?? "Failed to generate reply");
      }

      if (typeof Office !== "undefined" && Office.context?.mailbox?.item) {
        const provider = createEmailProvider("outlook");
        await provider.insertReply(data.reply);
        setToastMessage("Reply inserted into message body.");
        setToastVisible(true);
      } else {
        setToastMessage("Generated reply (Outlook not detected).");
        setToastVisible(true);
      }
    } catch (err) {
      console.error("[mailai/taskpane] generate failed", err);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const saveApiKey = () => {
    localStorage.setItem("mailai_api_key", apiKey);
    setView("main");
    setError(null);
  };

  useEffect(() => {
    if (!toastVisible) {
      return;
    }
    const timer = window.setTimeout(() => {
      setToastVisible(false);
    }, 2300);
    return () => window.clearTimeout(timer);
  }, [toastVisible]);

  if (view === "settings") {
    return (
      <div className="flex min-h-screen flex-col bg-background p-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="size-4" />
              Settings
            </CardTitle>
            <CardDescription>
              Your key is stored in this browser only. Each generate request
              sends it to your deployed MailAI API, which calls OpenAI — we do
              not store keys on the server.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="font-medium text-sm" htmlFor="api-key-input">
                OpenAI API Key
              </label>
              <Input
                id="api-key-input"
                onChange={(e) =>
                  setApiKey((e.target as HTMLInputElement).value)
                }
                placeholder="sk-..."
                type="password"
                value={apiKey}
              />
              <p className="text-muted-foreground text-xs">
                Optional: set{" "}
                <code className="rounded bg-muted px-1">OPENAI_API_KEY</code> in{" "}
                <code className="rounded bg-muted px-1">.env.local</code>{" "}
                instead and leave this blank.
              </p>
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            <Button onClick={saveApiKey} size="sm">
              Save Key
            </Button>
            <Button onClick={() => setView("main")} size="sm" variant="outline">
              Cancel
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background p-3">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 px-1 py-1">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
            <BotMessageSquare className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-lg leading-tight">MailAI</h1>
            <p className="text-muted-foreground text-xs">
              {taskpaneSubtitle(officeReady, composeMode)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {officeReady && (
            <Button
              className="rounded-md"
              onClick={() => loadEmailChain()}
              size="icon-xs"
              title="Reload thread from Outlook"
              variant="ghost"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
          <Button
            className="rounded-md"
            onClick={() => setView("settings")}
            size="icon-xs"
            variant="ghost"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>
      {/* Status */}
      {!officeReady && officeInitFailed && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 text-xs dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Running outside Outlook. Using demo email data for testing.
        </div>
      )}

      {/* Length selector */}
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <label className="font-medium text-sm" htmlFor="length-group">
          Reply Length
        </label>
        <TooltipProvider>
          <div
            className="inline-flex rounded-md border border-white/10 bg-background/40 p-1"
            id="length-group"
          >
            {LENGTHS.map((l) => (
              <Tooltip key={l.value}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={l.label}
                    className="rounded-sm"
                    onClick={() => setLength(l.value)}
                    size="icon-xs"
                    variant={length === l.value ? "default" : "outline"}
                  >
                    {lengthIcon(l.value)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{l.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Tone selector */}
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <label className="font-medium text-sm" htmlFor="tone-group">
          Reply Tone
        </label>
        <TooltipProvider>
          <div
            className="inline-flex rounded-md border border-white/10 bg-background/40 p-1"
            id="tone-group"
          >
            {TONES.map((t) => (
              <Tooltip key={t.value}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t.label}
                    className="rounded-sm"
                    onClick={() => setTone(t.value)}
                    size="icon-xs"
                    variant={tone === t.value ? "default" : "outline"}
                  >
                    {toneIcon(t.value)}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Generate button */}
      <Button
        className="mailai-generate-btn mt-1 mb-2 h-11 w-full rounded-md"
        disabled={isGenerating}
        onClick={generateReply}
        size="default"
      >
        {isGenerating ? (
          <>
            <Loader2 className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Sparkles />
            Generate AI Reply
          </>
        )}
      </Button>
      {/* Additional context (collapsed by default) */}
      <div className="mb-3 px-1">
        <button
          className="flex w-full items-center justify-between rounded-md px-1 py-1"
          onClick={() => setContextExpanded((prev) => !prev)}
          type="button"
        >
          <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
            Additional context
          </span>
          {contextExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>
        {contextExpanded && (
          <>
            <div className="my-1">
              <hr className="border-white/10" />
            </div>
            <textarea
              className="mt-1 min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-1.5 py-1 text-[11px] leading-snug outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              id="context-input"
              onChange={(e) =>
                setAdditionalContext((e.target as HTMLTextAreaElement).value)
              }
              placeholder="Optional: constraints, points to mention, or preferred phrasing..."
              value={additionalContext}
            />
          </>
        )}
      </div>
      {/* Error display */}
      {error && (
        <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Email chain preview */}
      {emailChain && (
        <div className="mt-1 px-1">
          <button
            className="flex w-full items-center justify-between rounded-md px-1 py-1"
            onClick={() => setChainExpanded((prev) => !prev)}
            type="button"
          >
            <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-wide">
              Email chain ({emailChain.messages.length})
            </span>
            {chainExpanded ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 text-muted-foreground" />
            )}
          </button>

          {chainExpanded && (
            <>
              <div className="my-1">
                <hr className="border-white/10" />
              </div>
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                {emailChain.messages.map((msg) => {
                  const plain = msg.isHtml ? stripHtml(msg.body) : msg.body;
                  const compact = compactChainBody(plain);
                  const meta = extractChainMeta(compact);
                  const primaryFrom = meta.from ?? msg.from;
                  const dateText = meta.date;
                  const subjectText = meta.subject;
                  return (
                    <div
                      className="rounded-sm border border-white/10 bg-background/30 px-2 py-1.5"
                      key={msg.id}
                    >
                      <div className="mb-1.5 rounded-sm border border-border/70 bg-muted/35 px-1.5 py-1 text-[10px] leading-snug">
                        <div className="truncate text-foreground/90">
                          <span className="text-muted-foreground/90">
                            From:
                          </span>{" "}
                          <span className="font-medium">{primaryFrom}</span>
                        </div>
                        {dateText && (
                          <div className="truncate text-muted-foreground/90">
                            <span className="text-muted-foreground/80">
                              Date:
                            </span>{" "}
                            {dateText}
                          </div>
                        )}
                        {subjectText && (
                          <div className="truncate text-muted-foreground/90">
                            <span className="text-muted-foreground/80">
                              Subject:
                            </span>{" "}
                            {subjectText}
                          </div>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap break-words text-[11px] leading-snug">
                        {compact}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom fixed toast (sonner-style lightweight) */}
      {toastMessage && (
        <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
          <div
            className={`rounded-md border border-sky-300/35 bg-background/95 px-3 py-2 text-sky-700 text-xs shadow-lg backdrop-blur-sm transition-all duration-200 dark:text-sky-100 ${
              toastVisible
                ? "translate-y-0 opacity-100"
                : "translate-y-3 opacity-0"
            }`}
          >
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}

/** Demo email chain for testing outside Outlook */
function createDemoChain(): EmailChain {
  return {
    subject: "Q3 Project Timeline Discussion",
    currentUserEmail: "you@company.com",
    messages: [
      {
        id: "1",
        from: "sarah@company.com",
        to: ["you@company.com", "team@company.com"],
        subject: "Q3 Project Timeline Discussion",
        body: "Hi team,\n\nI wanted to touch base about the Q3 project timeline. We're currently tracking about two weeks behind schedule on the API integration phase. The main blockers are:\n\n1. The third-party vendor hasn't provided updated documentation\n2. Our testing environment needs additional configuration\n\nCan we schedule a sync this week to discuss mitigation strategies?\n\nBest,\nSarah",
        timestamp: new Date(Date.now() - 7_200_000),
      },
      {
        id: "2",
        from: "mike@company.com",
        to: ["sarah@company.com", "you@company.com", "team@company.com"],
        subject: "Re: Q3 Project Timeline Discussion",
        body: "Hi Sarah,\n\nThanks for the heads up. I can confirm the testing environment issue - I've been working with DevOps on it and we should have it resolved by Wednesday.\n\nFor the vendor docs, I'd suggest we proceed with what we have and flag any gaps. Happy to join a sync call.\n\nMike",
        timestamp: new Date(Date.now() - 3_600_000),
      },
    ],
  };
}
