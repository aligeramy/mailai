import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import {
  EULA_URL,
  SITE_NAME,
  SITE_URL,
  SUPPORT_INBOX_EMAIL,
} from "@/lib/site-config";

const LAST_UPDATED = "March 27, 2026";

export const metadata: Metadata = {
  title: "End User License Agreement",
  description: `EULA for ${SITE_NAME} — license to use the website and Outlook add-in.`,
  alternates: { canonical: "/eula" },
  openGraph: {
    title: `EULA — ${SITE_NAME}`,
    description: `End User License Agreement for ${SITE_NAME}.`,
    url: EULA_URL,
  },
  robots: { index: true, follow: true },
};

export default function EulaPage() {
  return (
    <LegalDocShell
      lastUpdated={LAST_UPDATED}
      title="End User License Agreement"
    >
      <p>
        This End User License Agreement (“EULA”) is a short license between you
        and {SITE_NAME} for use of the Service (our website at{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SITE_URL}
        >
          {new URL(SITE_URL).host}
        </a>{" "}
        and the optional Microsoft Outlook add-in). Our{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href="/terms"
        >
          Terms of Service
        </a>{" "}
        also apply and contain additional rules, disclaimers, and limits.
      </p>

      <h2 id="grant">License</h2>
      <p>
        Subject to this EULA and the Terms, we grant you a personal,
        non-exclusive, non-transferable, revocable license to access and use the
        Service for its intended purpose. You may not sublicense, sell, or
        redistribute the Service.
      </p>

      <h2 id="restrictions">Restrictions</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service in violation of law or third-party rights.</li>
        <li>
          Probe, attack, or interfere with the Service or others’ use of it.
        </li>
        <li>
          Reverse engineer or attempt to extract source code except where
          prohibited law makes that restriction unenforceable.
        </li>
        <li>
          Use automated means to overload or scrape the Service without our
          permission.
        </li>
      </ul>

      <h2 id="ai">AI features</h2>
      <p>
        AI output is generated using third-party services (including the OpenAI
        API). Output may be wrong or incomplete; you are responsible for
        reviewing it before use. See our{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href="/privacy"
        >
          Privacy Policy
        </a>{" "}
        for how data is handled.
      </p>

      <h2 id="termination">Termination</h2>
      <p>
        We may suspend or end access to the Service if you breach this EULA or
        the Terms, or if we stop offering the Service. You may stop using the
        Service at any time.
      </p>

      <h2 id="disclaimer">Disclaimer</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, TO THE
        MAXIMUM EXTENT PERMITTED BY LAW.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about this EULA:{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href="/support"
        >
          Support
        </a>{" "}
        or{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={`mailto:${SUPPORT_INBOX_EMAIL}`}
        >
          {SUPPORT_INBOX_EMAIL}
        </a>
        .
      </p>
    </LegalDocShell>
  );
}
