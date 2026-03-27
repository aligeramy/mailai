"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPPORT_INBOX_EMAIL, SUPPORT_URL } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export function SupportForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (company.length > 0) {
      return;
    }
    setLoading(true);
    setErrorMessage(null);
    setSuccess(false);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          company,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Could not send message.");
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="relative space-y-5" noValidate onSubmit={onSubmit}>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Use this form for product help and feedback. We respond at{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={`mailto:${SUPPORT_INBOX_EMAIL}`}
        >
          {SUPPORT_INBOX_EMAIL}
        </a>
        . You can also bookmark{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SUPPORT_URL}
        >
          this page
        </a>
        .
      </p>

      {/* Honeypot: hidden from users, bots often fill */}
      <div
        aria-hidden
        className="absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="support-company">Company</label>
        <input
          autoComplete="off"
          id="support-company"
          name="company"
          onChange={(e) => {
            setCompany(e.target.value);
          }}
          tabIndex={-1}
          type="text"
          value={company}
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="support-name"
        >
          Name
        </label>
        <Input
          autoComplete="name"
          className="h-10 md:text-sm"
          id="support-name"
          maxLength={120}
          name="name"
          onChange={(e) => {
            setName(e.target.value);
          }}
          placeholder="Your name"
          required
          type="text"
          value={name}
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="support-email"
        >
          Email
        </label>
        <Input
          autoComplete="email"
          className="h-10 md:text-sm"
          id="support-email"
          inputMode="email"
          maxLength={254}
          name="email"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="support-subject"
        >
          Subject{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          className="h-10 md:text-sm"
          id="support-subject"
          maxLength={200}
          name="subject"
          onChange={(e) => {
            setSubject(e.target.value);
          }}
          placeholder="e.g. Outlook add-in issue"
          type="text"
          value={subject}
        />
      </div>

      <div className="space-y-2">
        <label
          className="font-medium text-foreground text-sm"
          htmlFor="support-message"
        >
          Message
        </label>
        <textarea
          className={cn(
            "min-h-[160px] w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none transition-colors",
            "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30"
          )}
          id="support-message"
          maxLength={8000}
          name="message"
          onChange={(e) => {
            setMessage(e.target.value);
          }}
          placeholder="Describe what you need help with…"
          required
          value={message}
        />
        <p className="text-muted-foreground text-xs">
          {message.length} / 8,000 characters · minimum 10 characters
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg border border-destructive/35 bg-destructive/8 px-3 py-2 text-destructive text-sm">
          {errorMessage}
        </p>
      ) : null}

      {success ? (
        <output
          aria-live="polite"
          className="block rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-800 text-sm dark:text-emerald-200"
        >
          Thanks — your message was sent. We’ll get back to you by email.
        </output>
      ) : null}

      <Button className="rounded-xl" disabled={loading} size="lg" type="submit">
        {loading ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
