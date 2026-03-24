"use client";

import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  Gauge,
  Handshake,
  Key,
  Loader2,
  MessageSquareText,
  PenLine,
  RefreshCw,
  Scale,
  ScrollText,
  Settings,
  Smile,
  Snail,
  Text,
  Turtle,
} from "lucide-react";
import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { GenerateAiReplyButton } from "@/components/generate-ai-reply-button";
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
import {
  correspondentHistoryPhaseLabels,
  isRestMailboxHistoryUnsupportedMessage,
  restMailboxHistoryUserShortHint,
} from "@/lib/outlook/correspondent-history-rest";
import { createEmailProvider } from "@/lib/providers/create-email-provider";
import type {
  CorrespondentContextWindow,
  CorrespondentHistoryProgress,
  EmailChain,
  ReplyLength,
  ReplyTone,
} from "@/lib/types";

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

const CORRESPONDENT_CONTEXT_OPTIONS: {
  value: CorrespondentContextWindow;
  label: string;
}[] = [
  { value: "off", label: "Off" },
  { value: "30", label: "30d" },
  { value: "60", label: "60d" },
  { value: "90", label: "90d" },
  { value: "all", label: "All" },
];

const MAILAI_SESSION_HISTORY_UNSUPPORTED = "mailai_history_rest_unsupported";

type ViewState = "main" | "settings";
type ChainMeta = {
  date?: string;
  from?: string;
  subject?: string;
};

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

interface MailboxPreviewCache {
  note: string | null;
  text: string | null;
  window: CorrespondentContextWindow;
}

type HistoryPhaseStatus = "pending" | "loading" | "done";

interface HistoryPhaseRow {
  label: string;
  status: HistoryPhaseStatus;
}

function historyPhasesFromProgress(
  labels: string[],
  p: CorrespondentHistoryProgress
): HistoryPhaseRow[] {
  return labels.map((label, i) => {
    if (p.isComplete) {
      return { label, status: "done" };
    }
    if (i <= p.completedPhaseIndex) {
      return { label, status: "done" };
    }
    if (i === p.activePhaseIndex && p.activePhaseIndex >= 0) {
      return { label, status: "loading" };
    }
    return { label, status: "pending" };
  });
}

function MailboxHistoryPreviewBody({
  cache,
  loading,
}: {
  cache: MailboxPreviewCache | null;
  loading: boolean;
}): ReactNode {
  if (cache?.note && !cache.text) {
    return (
      <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 px-2 py-2 text-[11px] text-amber-900 leading-snug transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-amber-500/45 hover:bg-amber-500/10 hover:text-amber-950 hover:shadow-sm dark:text-amber-100 dark:hover:border-amber-400/35 dark:hover:bg-amber-500/15 dark:hover:text-amber-50">
        {cache.note}
      </div>
    );
  }
  if (loading && !cache?.text) {
    return (
      <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-muted/20 px-2 py-3 text-muted-foreground text-xs transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-white/18 hover:bg-muted/35 hover:text-foreground/90 hover:shadow-sm">
        <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" />
        Loading messages with this contact…
      </div>
    );
  }
  if (cache?.text) {
    return (
      <div className="space-y-2">
        <pre className="wrap-break-word max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-white/10 bg-background/40 p-2 font-mono text-[10px] leading-snug transition-[border-color,background-color,color,box-shadow] duration-200 hover:border-white/20 hover:bg-background/55 hover:text-foreground/95 hover:shadow-sm">
          {cache.text}
        </pre>
        {loading ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground transition-colors duration-200 hover:text-foreground/88">
            <Loader2
              aria-hidden
              className="size-3.5 shrink-0 animate-spin opacity-80"
            />
            Loading older messages for this range…
          </div>
        ) : null}
      </div>
    );
  }
  return null;
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
  const [contextHistoryExpanded, setContextHistoryExpanded] = useState(false);
  const [mailboxHistoryPreviewLoading, setMailboxHistoryPreviewLoading] =
    useState(false);
  const [mailboxHistoryPreviewCache, setMailboxHistoryPreviewCache] =
    useState<MailboxPreviewCache | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState<ViewState>("main");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [correspondentContext, setCorrespondentContext] =
    useState<CorrespondentContextWindow>("off");
  const [historyPhaseRows, setHistoryPhaseRows] = useState<HistoryPhaseRow[]>(
    []
  );
  const [mailboxHistoryHostBanner, setMailboxHistoryHostBanner] =
    useState(false);

  const correspondentHistoryTextRef = useRef("");
  const mailboxHistoryRequestGenRef = useRef(0);

  const applyMailboxHistoryUnsupportedHost = useCallback(() => {
    try {
      sessionStorage.setItem(MAILAI_SESSION_HISTORY_UNSUPPORTED, "1");
    } catch {
      /* private / blocked storage */
    }
    setMailboxHistoryHostBanner(true);
    setCorrespondentContext("off");
  }, []);

  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        sessionStorage.getItem(MAILAI_SESSION_HISTORY_UNSUPPORTED) === "1"
      ) {
        setMailboxHistoryHostBanner(true);
      }
    } catch {
      /* empty */
    }
  }, []);

  const loadEmailChain = useCallback(async () => {
    try {
      if (typeof Office === "undefined" || !Office.context?.mailbox?.item) {
        console.info("[mailai/taskpane] Office context not available");
        return;
      }

      const provider = createEmailProvider("outlook");
      const chain = await provider.getEmailChain();
      setEmailChain(chain);
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
        correspondentContext,
      });

      let correspondentHistoryRaw: string | undefined;
      let historySideNote: string | undefined;
      if (correspondentContext !== "off") {
        const cached = correspondentHistoryTextRef.current.trim();
        if (cached.length > 0) {
          correspondentHistoryRaw = cached;
          if (mailboxHistoryPreviewLoading) {
            historySideNote =
              "Reply includes mailbox history loaded so far; older segments may still be loading in the background.";
          }
        } else if (mailboxHistoryPreviewLoading) {
          historySideNote =
            "Mailbox history is still loading — this reply uses the thread only. Generate again in a few seconds to include history.";
        } else {
          try {
            const provider = createEmailProvider("outlook");
            const raw =
              await provider.fetchCorrespondentHistoryForPrompt(
                correspondentContext
              );
            const trimmed = raw.trim();
            correspondentHistoryTextRef.current = trimmed;
            if (trimmed.length > 0) {
              correspondentHistoryRaw = trimmed;
            } else {
              historySideNote =
                "Mailbox history: no other messages matched (check range, To address, and manifest ReadWriteMailbox).";
            }
          } catch (histErr) {
            console.warn(
              "[mailai/taskpane] correspondent history failed",
              histErr
            );
            const msg =
              histErr instanceof Error
                ? histErr.message
                : "Mailbox history failed.";
            if (isRestMailboxHistoryUnsupportedMessage(msg)) {
              historySideNote = restMailboxHistoryUserShortHint();
              applyMailboxHistoryUnsupportedHost();
            } else {
              historySideNote = `Mailbox history failed: ${msg}`;
            }
          }
        }
      }

      const response = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailChain: chainToUse,
          tone,
          length,
          additionalContext: additionalContext || undefined,
          ...(correspondentHistoryRaw ? { correspondentHistoryRaw } : {}),
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
        const base = "Reply inserted into message body.";
        setToastMessage(historySideNote ? `${base} ${historySideNote}` : base);
        setToastVisible(true);
      } else {
        const base = "Generated reply (Outlook not detected).";
        setToastMessage(historySideNote ? `${base} ${historySideNote}` : base);
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

  useEffect(() => {
    if (correspondentContext === "off") {
      correspondentHistoryTextRef.current = "";
      setHistoryPhaseRows([]);
      setMailboxHistoryPreviewCache(null);
      setMailboxHistoryPreviewLoading(false);
      return;
    }

    if (
      !officeReady ||
      typeof Office === "undefined" ||
      !Office.context?.mailbox?.item
    ) {
      return;
    }

    const gen = mailboxHistoryRequestGenRef.current + 1;
    mailboxHistoryRequestGenRef.current = gen;

    const labels = correspondentHistoryPhaseLabels(correspondentContext);
    setHistoryPhaseRows(
      labels.map((label) => ({ label, status: "pending" as const }))
    );
    setMailboxHistoryPreviewLoading(true);
    setMailboxHistoryPreviewCache({
      note: null,
      text: null,
      window: correspondentContext,
    });

    let cancelled = false;

    const applyProgress = (p: CorrespondentHistoryProgress) => {
      if (cancelled || gen !== mailboxHistoryRequestGenRef.current) {
        return;
      }
      correspondentHistoryTextRef.current = p.cumulativeText.trim();
      setHistoryPhaseRows(historyPhasesFromProgress(labels, p));
      setMailboxHistoryPreviewCache({
        note: null,
        text: p.cumulativeText.trim() || null,
        window: correspondentContext,
      });
    };

    (async () => {
      try {
        const provider = createEmailProvider("outlook");
        const final = await provider.fetchCorrespondentHistoryForPrompt(
          correspondentContext,
          applyProgress
        );
        if (cancelled || gen !== mailboxHistoryRequestGenRef.current) {
          return;
        }
        const trimmed = final.trim();
        correspondentHistoryTextRef.current = trimmed;
        setHistoryPhaseRows(labels.map((label) => ({ label, status: "done" })));
        if (trimmed.length > 0) {
          setMailboxHistoryPreviewCache({
            note: null,
            text: trimmed,
            window: correspondentContext,
          });
        } else {
          setMailboxHistoryPreviewCache({
            note: "No other messages matched for this contact in the selected range. The add-in needs ReadWriteMailbox; check addresses and try another range.",
            text: null,
            window: correspondentContext,
          });
        }
      } catch (e) {
        if (cancelled || gen !== mailboxHistoryRequestGenRef.current) {
          return;
        }
        const msg =
          e instanceof Error ? e.message : "Could not load mailbox history.";
        console.warn("[mailai/taskpane] mailbox history preview failed", e);
        if (isRestMailboxHistoryUnsupportedMessage(msg)) {
          applyMailboxHistoryUnsupportedHost();
        } else {
          setMailboxHistoryPreviewCache({
            note: msg,
            text: null,
            window: correspondentContext,
          });
          setHistoryPhaseRows([]);
        }
      } finally {
        if (!cancelled && gen === mailboxHistoryRequestGenRef.current) {
          setMailboxHistoryPreviewLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [correspondentContext, officeReady]);

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
      <div className="group/header mb-3 flex items-center justify-between gap-2 border-white/10 border-b px-1 py-1.5 transition-colors duration-200 hover:border-white/20">
        <div className="flex items-center gap-2">
          <div>
            <h1 className="font-semibold text-foreground/92 text-lg leading-tight transition-colors duration-200 group-hover/header:text-foreground">
              MailAI
            </h1>
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
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 text-xs transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-amber-300 hover:bg-amber-100/90 hover:text-amber-900 hover:shadow-sm dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:hover:border-amber-700 dark:hover:bg-amber-900 dark:hover:text-amber-100">
          Running outside Outlook. Using demo email data for testing.
        </div>
      )}

      {/* Length selector */}
      <div className="group/row mt-2 mb-2 flex items-center justify-between gap-3 px-1">
        <label
          className="font-medium text-foreground/88 text-sm transition-colors duration-200 group-hover/row:text-foreground"
          htmlFor="length-group"
        >
          Reply Length
        </label>
        <TooltipProvider>
          <div
            className="inline-flex overflow-hidden rounded-md border border-white/10 bg-background/40 transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/22 hover:bg-background/55 hover:shadow-sm"
            id="length-group"
            role="group"
          >
            {LENGTHS.map((l) => (
              <Tooltip key={l.value}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={l.label}
                    className="rounded-none border-y-0 border-r-0 border-l first:rounded-l-md last:rounded-r-md"
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
      <div className="group/row mb-3 flex items-center justify-between gap-3 px-1">
        <label
          className="font-medium text-foreground/88 text-sm transition-colors duration-200 group-hover/row:text-foreground"
          htmlFor="tone-group"
        >
          Reply Tone
        </label>
        <TooltipProvider>
          <div
            className="inline-flex overflow-hidden rounded-md border border-white/10 bg-background/40 transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/22 hover:bg-background/55 hover:shadow-sm"
            id="tone-group"
            role="group"
          >
            {TONES.map((t) => (
              <Tooltip key={t.value}>
                <TooltipTrigger asChild>
                  <Button
                    aria-label={t.label}
                    className="rounded-none border-y-0 border-r-0 border-l first:rounded-l-md last:rounded-r-md"
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

      {/* Correspondent mailbox context (Outlook REST) */}
      <div className="group/row mb-3 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <label
            className="font-medium text-foreground/88 text-sm transition-colors duration-200 group-hover/row:text-foreground"
            htmlFor="correspondent-context-group"
          >
            History
          </label>
        </div>
        <div
          className="inline-flex max-w-[min(100%,220px)] flex-wrap justify-end gap-0 overflow-hidden rounded-md border border-white/10 bg-background/40 transition-[background-color,border-color,box-shadow] duration-200 hover:border-white/22 hover:bg-background/55 hover:shadow-sm sm:max-w-none sm:flex-nowrap"
          id="correspondent-context-group"
          role="group"
        >
          {CORRESPONDENT_CONTEXT_OPTIONS.map((opt) => (
            <Button
              aria-label={`History: ${opt.label}`}
              className="h-7 min-w-8 gap-1 rounded-none border-y-0 border-r-0 border-l px-2 text-[10px] first:rounded-l-md last:rounded-r-md"
              key={opt.value}
              onClick={() => setCorrespondentContext(opt.value)}
              size="sm"
              variant={
                correspondentContext === opt.value ? "default" : "outline"
              }
            >
              {correspondentContext === opt.value &&
              mailboxHistoryPreviewLoading &&
              opt.value !== "off" ? (
                <Loader2
                  aria-hidden
                  className="size-3 shrink-0 animate-spin opacity-90"
                />
              ) : (
                <span className="font-medium tabular-nums">{opt.label}</span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {mailboxHistoryHostBanner ? (
        <div className="mb-3 rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-2.5 text-amber-950 text-xs leading-snug transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-950 hover:shadow-sm dark:border-amber-500/25 dark:bg-amber-950/40 dark:text-amber-50 dark:hover:border-amber-400/40 dark:hover:bg-amber-950/60 dark:hover:text-amber-50">
          <p className="mb-1.5 font-medium">
            Mailbox history isn’t available in this Outlook setup
          </p>
          <p className="mb-2 text-[11px] opacity-95">
            Outlook couldn’t get a token to search your mailbox for past
            messages with this contact. That usually happens with{" "}
            <span className="font-medium">
              Gmail or other IMAP accounts in Outlook for Mac
            </span>
            — not a bug in MailAI.{" "}
            <span className="font-medium">Leave History on Off</span>: replies
            still use the <span className="font-medium">open conversation</span>
            . For full mailbox search, use{" "}
            <span className="font-medium">Outlook on the web</span> or{" "}
            <span className="font-medium">Outlook for Windows</span> with an{" "}
            <span className="font-medium">Exchange or Microsoft 365</span>{" "}
            mailbox.
          </p>
          <Button
            className="h-7 text-[11px]"
            onClick={() => {
              setMailboxHistoryHostBanner(false);
              try {
                sessionStorage.removeItem(MAILAI_SESSION_HISTORY_UNSUPPORTED);
              } catch {
                /* empty */
              }
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            Dismiss
          </Button>
        </div>
      ) : null}

      {/* Generate button */}
      <GenerateAiReplyButton
        isGenerating={isGenerating}
        onGenerate={generateReply}
      />

      {/* Thread + mailbox context sent to the model */}
      {emailChain && (
        <div className="group/row mt-2 mb-2 px-1">
          <button
            aria-expanded={contextHistoryExpanded}
            className="group/panel-head flex w-full items-center justify-between gap-2 rounded-md px-0 py-0 text-left transition-[background-color,color] duration-200 hover:bg-muted/25"
            onClick={() => setContextHistoryExpanded((prev) => !prev)}
            type="button"
          >
            <span className="flex min-w-0 flex-1 items-center gap-2 font-medium text-foreground/88 text-sm transition-colors duration-200 group-hover/panel-head:text-foreground">
              <ScrollText className="size-4 shrink-0 opacity-80 transition-opacity duration-200 group-hover/panel-head:opacity-100" />
              <span className="min-w-0 truncate">
                Context history
                <span className="font-normal text-muted-foreground transition-colors duration-200 group-hover/panel-head:text-foreground/90">
                  {" "}
                  ({emailChain.messages.length}
                  {correspondentContext !== "off"
                    ? ` · ${CORRESPONDENT_CONTEXT_OPTIONS.find((o) => o.value === correspondentContext)?.label ?? correspondentContext} context`
                    : ""}
                  )
                </span>
              </span>
            </span>
            {contextHistoryExpanded ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover/panel-head:text-foreground/90" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover/panel-head:text-foreground/90" />
            )}
          </button>

          {contextHistoryExpanded && (
            <div className="mt-1 space-y-1.5">
              <div>
                <p className="mb-0.5 font-medium text-muted-foreground text-sm transition-colors duration-200 hover:text-foreground/90">
                  This thread
                </p>
                <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                  {emailChain.messages.map((msg) => {
                    const plain = msg.isHtml ? stripHtml(msg.body) : msg.body;
                    const compact = compactChainBody(plain);
                    const meta = extractChainMeta(compact);
                    const primaryFrom = meta.from ?? msg.from;
                    const dateText = meta.date;
                    const subjectText = meta.subject;
                    return (
                      <div
                        className="group/msg rounded-sm border border-white/10 bg-background/30 px-1.5 py-1 transition-[border-color,background-color,box-shadow,color,filter] duration-200 hover:border-white/22 hover:bg-background/48 hover:text-foreground/95 hover:shadow-sm group-hover/msg:[&_.mailai-meta-muted]:text-foreground/85"
                        key={msg.id}
                      >
                        <div className="mb-1 rounded-sm border border-border/70 bg-muted/35 px-1 py-0.5 text-[10px] leading-snug transition-[border-color,background-color] duration-200 group-hover/msg:border-border group-hover/msg:bg-muted/45">
                          <div className="truncate text-foreground/90">
                            <span className="mailai-meta-muted text-muted-foreground/90 transition-colors duration-200">
                              From:
                            </span>{" "}
                            <span className="font-medium">{primaryFrom}</span>
                          </div>
                          {dateText && (
                            <div className="truncate text-muted-foreground/90">
                              <span className="mailai-meta-muted text-muted-foreground/80 transition-colors duration-200">
                                Date:
                              </span>{" "}
                              {dateText}
                            </div>
                          )}
                          {subjectText && (
                            <div className="truncate text-muted-foreground/90">
                              <span className="mailai-meta-muted text-muted-foreground/80 transition-colors duration-200">
                                Subject:
                              </span>{" "}
                              {subjectText}
                            </div>
                          )}
                        </div>
                        <div className="wrap-break-word whitespace-pre-wrap text-[11px] leading-snug transition-colors duration-200 group-hover/msg:text-foreground/95">
                          {compact}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {correspondentContext !== "off" && (
                <div>
                  <p className="mb-0.5 font-medium text-muted-foreground text-sm transition-colors duration-200 hover:text-foreground/90">
                    Mailbox history (briefing text)
                  </p>
                  {historyPhaseRows.length > 0 ? (
                    <ul className="mb-1.5 space-y-0.5">
                      {historyPhaseRows.map((row) => (
                        <li
                          className="flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground transition-[color,background-color] duration-200 hover:bg-muted/40 hover:text-foreground/90"
                          key={row.label}
                        >
                          {row.status === "done" ? (
                            <Check
                              aria-hidden
                              className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400"
                            />
                          ) : null}
                          {row.status === "loading" ? (
                            <Loader2
                              aria-hidden
                              className="size-3 shrink-0 animate-spin"
                            />
                          ) : null}
                          {row.status === "pending" ? (
                            <span
                              aria-hidden
                              className="inline-block size-3 shrink-0 rounded-full border border-muted-foreground/35"
                            />
                          ) : null}
                          <span className="text-foreground/85">
                            {row.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <MailboxHistoryPreviewBody
                    cache={mailboxHistoryPreviewCache}
                    loading={mailboxHistoryPreviewLoading}
                  />
                </div>
              )}

              {correspondentContext === "off" && (
                <p className="text-[10px] text-muted-foreground leading-snug transition-colors duration-200 hover:text-foreground/88">
                  Turn on a <span className="font-medium">History</span> range
                  above to include other messages with this contact in the AI
                  briefing.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mb-2 border-white/10 border-t" />
      {/* Additional context (collapsed by default) */}
      <div className="group/row mb-2 px-1">
        <button
          className="group/panel-head flex w-full items-center justify-between gap-2 rounded-md px-0 py-0 text-left transition-[background-color,color] duration-200 hover:bg-muted/25"
          onClick={() => setContextExpanded((prev) => !prev)}
          type="button"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2 font-medium text-foreground/88 text-sm transition-colors duration-200 group-hover/panel-head:text-foreground">
            <PenLine className="size-4 shrink-0 opacity-80 transition-opacity duration-200 group-hover/panel-head:opacity-100" />
            Additional context
          </span>
          {contextExpanded ? (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover/panel-head:text-foreground/90" />
          ) : (
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors duration-200 group-hover/panel-head:text-foreground/90" />
          )}
        </button>
        {contextExpanded && (
          <textarea
            className="mt-1 min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-1 py-1 text-[11px] leading-snug outline-none transition-[border-color,box-shadow,color] duration-200 placeholder:text-muted-foreground/70 hover:border-input hover:text-foreground hover:shadow-sm focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            id="context-input"
            onChange={(e) =>
              setAdditionalContext((e.target as HTMLTextAreaElement).value)
            }
            placeholder="Optional: constraints, points to mention, or preferred phrasing..."
            value={additionalContext}
          />
        )}
      </div>
      {/* Error display */}
      {error && (
        <div className="mb-3 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs transition-[border-color,background-color,box-shadow,color] duration-200 hover:border-destructive/65 hover:bg-destructive/15 hover:text-destructive hover:shadow-sm">
          {error}
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
