"use client";

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

export default function ContextManagerPage() {
  const [emailInput, setEmailInput] = useState("");
  const [activeEmail, setActiveEmail] = useState("");

  const handleLoad = () => {
    const trimmed = emailInput.trim().toLowerCase();
    if (trimmed) {
      setActiveEmail(trimmed);
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
        </CardContent>
      </Card>

      <ContextManagerView email={activeEmail} />
    </div>
  );
}
