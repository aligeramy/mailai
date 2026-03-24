"use client";

import {
  BotMessageSquare,
  Check,
  ClipboardCopy,
  Key,
  Loader2,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
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
import { createEmailProvider } from "@/lib/providers/create-email-provider";
import type { EmailChain, ReplyTone } from "@/lib/types";

const TONES: { value: ReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
];

type ViewState = "main" | "settings";

function taskpaneSubtitle(officeReady: boolean, composeMode: boolean): string {
  if (!officeReady) {
    return "Dev preview";
  }
  if (composeMode) {
    return "Compose — replying to thread in draft";
  }
  return "Reading message — reply uses full thread when quoted";
}

export default function TaskpanePage() {
  const [officeReady, setOfficeReady] = useState(false);
  const [emailChain, setEmailChain] = useState<EmailChain | null>(null);
  const [generatedReply, setGeneratedReply] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tone, setTone] = useState<ReplyTone>("professional");
  const [additionalContext, setAdditionalContext] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [view, setView] = useState<ViewState>("main");
  const [copied, setCopied] = useState(false);
  const [inserted, setInserted] = useState(false);
  const [composeMode, setComposeMode] = useState(false);

  const loadEmailChain = useCallback(async () => {
    try {
      if (typeof Office === "undefined" || !Office.context?.mailbox?.item) {
        return;
      }

      const provider = createEmailProvider("outlook");
      const chain = await provider.getEmailChain();
      setEmailChain(chain);
      setComposeMode(provider.isComposeMode());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load email content"
      );
    }
  }, []);

  useEffect(() => {
    if (typeof Office !== "undefined") {
      Office.onReady(() => {
        setOfficeReady(true);
        loadEmailChain();
      });
    } else {
      setOfficeReady(false);
    }

    const savedKey = localStorage.getItem("mailai_api_key");
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, [loadEmailChain]);

  const generateReply = async () => {
    const chainToUse = emailChain ?? createDemoChain();

    setIsGenerating(true);
    setError(null);
    setGeneratedReply("");

    try {
      const response = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailChain: chainToUse,
          tone,
          additionalContext: additionalContext || undefined,
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          setView("settings");
        }
        throw new Error(data.error ?? "Failed to generate reply");
      }

      setGeneratedReply(data.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
    }
  };

  const insertReplyToOutlook = async () => {
    if (!generatedReply || typeof Office === "undefined") {
      return;
    }

    try {
      const provider = createEmailProvider("outlook");
      await provider.insertReply(generatedReply);
      setInserted(true);
      setTimeout(() => setInserted(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to insert reply");
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveApiKey = () => {
    localStorage.setItem("mailai_api_key", apiKey);
    setView("main");
    setError(null);
  };

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
      <div className="mb-3 flex items-center justify-between gap-2">
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
              onClick={() => loadEmailChain()}
              size="icon-xs"
              title="Reload thread from Outlook"
              variant="ghost"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}
          <Button
            onClick={() => setView("settings")}
            size="icon-xs"
            variant="ghost"
          >
            <Settings className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Status */}
      {!officeReady && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800 text-xs dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Running outside Outlook. Using demo email data for testing.
        </div>
      )}

      {/* Tone selector */}
      <div className="mb-3 space-y-1.5">
        <label className="font-medium text-xs" htmlFor="tone-select">
          Reply Tone
        </label>
        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <Button
              key={t.value}
              onClick={() => setTone(t.value)}
              size="xs"
              variant={tone === t.value ? "default" : "outline"}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Additional context */}
      <div className="mb-3 space-y-1.5">
        <label className="font-medium text-xs" htmlFor="context-input">
          Additional context (optional)
        </label>
        <Input
          id="context-input"
          onChange={(e) =>
            setAdditionalContext((e.target as HTMLInputElement).value)
          }
          placeholder="e.g., Decline politely, mention I'm on vacation..."
          value={additionalContext}
        />
      </div>

      {/* Generate button */}
      <Button
        className="mb-3 w-full"
        disabled={isGenerating}
        onClick={generateReply}
        size="lg"
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

      {/* Error display */}
      {error && (
        <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-2 text-destructive text-xs">
          {error}
        </div>
      )}

      {/* Generated reply */}
      {generatedReply && (
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-sm">Generated Reply</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-60 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-sm">
              {generatedReply}
            </div>
          </CardContent>
          <CardFooter className="gap-2">
            {officeReady && (
              <Button onClick={insertReplyToOutlook} size="sm">
                {inserted ? (
                  <>
                    <Check className="size-3" />
                    Done
                  </>
                ) : (
                  <>
                    <Send className="size-3" />
                    {composeMode ? "Insert into draft" : "Open reply with text"}
                  </>
                )}
              </Button>
            )}
            <Button onClick={copyToClipboard} size="sm" variant="outline">
              {copied ? (
                <>
                  <Check className="size-3" />
                  Copied
                </>
              ) : (
                <>
                  <ClipboardCopy className="size-3" />
                  Copy
                </>
              )}
            </Button>
            <Button onClick={generateReply} size="sm" variant="outline">
              <RefreshCw className="size-3" />
              Regenerate
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Email chain preview */}
      {emailChain && (
        <details className="mt-3">
          <summary className="cursor-pointer font-medium text-muted-foreground text-xs">
            Email Chain ({emailChain.messages.length} messages)
          </summary>
          <div className="mt-2 max-h-40 space-y-2 overflow-y-auto">
            {emailChain.messages.map((msg) => (
              <div
                className="rounded border bg-muted/30 p-2 text-xs"
                key={msg.id}
              >
                <div className="font-medium">{msg.from}</div>
                <div className="line-clamp-2 text-muted-foreground">
                  {msg.body.slice(0, 150)}...
                </div>
              </div>
            ))}
          </div>
        </details>
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
