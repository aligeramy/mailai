"use client";

import { useAction } from "convex/react";
import { AlertCircle, CheckCircle2, Loader2, Stethoscope } from "lucide-react";
import { useState } from "react";
import { ContextManagerView } from "@/components/context-manager-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/convex/_generated/api";

interface HealthResult {
  durationMs?: number;
  error?: string;
  ok: boolean;
  tables?: { name: string; rows: number | null; error?: string }[];
}

export default function ContextManagerPage() {
  const [emailInput, setEmailInput] = useState("");
  const [activeEmail, setActiveEmail] = useState("");
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthChecking, setHealthChecking] = useState(false);
  const validate = useAction(api.tsprrSync.validateTsprrConnection);

  const handleLoad = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed) {
      setActiveEmail(trimmed);
    }
  };

  const handleHealthCheck = async () => {
    setHealthChecking(true);
    setHealth(null);
    try {
      const result = await validate({});
      setHealth(result);
    } catch (err) {
      setHealth({
        ok: false,
        error: err instanceof Error ? err.message : "Health check failed.",
      });
    } finally {
      setHealthChecking(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Context Manager</h1>
        <p className="text-muted-foreground text-sm">
          Every piece of context the AI sees when drafting a reply, across
          Outlook, Microsoft Graph, and TSP-RR. Toggle items in or out; changes
          apply immediately to your next generated reply.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Correspondent</CardTitle>
          <CardDescription>
            Enter the email address of the person you're replying to.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 md:flex-row">
          <Input
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleLoad();
              }
            }}
            placeholder="someone@example.com"
            value={emailInput}
          />
          <Button onClick={handleLoad}>Load</Button>
          <Button
            disabled={healthChecking}
            onClick={handleHealthCheck}
            variant="outline"
          >
            {healthChecking ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Stethoscope className="mr-2 size-4" />
            )}
            Test TSP-RR connection
          </Button>
        </CardContent>
        {health && (
          <CardContent className="pt-0">
            <div
              className={`flex items-start gap-2 rounded-md p-2 text-sm ${health.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-rose-500/10 text-rose-700 dark:text-rose-300"}`}
            >
              {health.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
              )}
              <div className="flex-1">
                {health.ok ? (
                  <span>
                    Connected in {health.durationMs}ms. Reached{" "}
                    {health.tables?.length ?? 0} tables.
                  </span>
                ) : (
                  <span>{health.error ?? "Connection failed."}</span>
                )}
                {health.tables && health.tables.length > 0 && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs opacity-80">
                      Per-table row counts
                    </summary>
                    <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs md:grid-cols-3">
                      {health.tables.map((t) => (
                        <li key={t.name}>
                          {t.error ? (
                            <span className="text-rose-600 dark:text-rose-400">
                              {t.name}: error
                            </span>
                          ) : (
                            <span>
                              {t.name}: {t.rows?.toLocaleString() ?? "—"}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      <ContextManagerView email={activeEmail} />
    </div>
  );
}
