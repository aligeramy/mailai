import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import { PRIVACY_URL, SITE_NAME, SITE_URL } from "@/lib/site-config";

const LAST_UPDATED = "March 24, 2025";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${SITE_NAME} handles information when you use our site and Outlook add-in.`,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: `Privacy Policy — ${SITE_NAME}`,
    description: `Privacy Policy for ${SITE_NAME}.`,
    url: PRIVACY_URL,
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalDocShell lastUpdated={LAST_UPDATED} title="Privacy Policy">
      <p>
        This Privacy Policy describes how {SITE_NAME} (“we,” “us”) collects,
        uses, and shares information when you use our website at{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SITE_URL}
        >
          {new URL(SITE_URL).host}
        </a>{" "}
        and the optional Microsoft Outlook add-in (“Add-in”).
      </p>

      <h2 id="collect">Information we process</h2>
      <p>Depending on how you use the Service, we may process:</p>
      <ul>
        <li>
          <strong className="text-foreground">
            Account and technical data.
          </strong>{" "}
          For example basic log or diagnostic data needed to operate the site
          (such as IP address, device/browser type, and timestamps) and cookies
          or similar technologies as described below.
        </li>
        <li>
          <strong className="text-foreground">Content you submit.</strong> When
          you generate a reply, the text you provide (for example message or
          thread excerpts you paste or that the Add-in reads per your
          permissions) may be sent to AI providers to produce a draft.
        </li>
        <li>
          <strong className="text-foreground">Integration data.</strong> If you
          connect third-party services (for example an AI API using your key),
          those providers may process data according to their own policies.
        </li>
      </ul>

      <h2 id="ai">AI providers</h2>
      <p>
        We may use third-party AI services to generate suggestions. Those
        providers may process prompts and related content on their systems. You
        should review their terms and privacy notices. Do not submit highly
        sensitive information unless you understand the risks.
      </p>

      <h2 id="outlook">Outlook</h2>
      <p>
        The Add-in runs inside Outlook and uses the permissions you grant in
        Microsoft 365. Microsoft processes data under its own terms and privacy
        statement. We do not control Microsoft’s systems.
      </p>

      <h2 id="cookies">Cookies and local storage</h2>
      <p>
        We may use cookies and similar technologies to keep the site working
        (for example preferences such as theme), to understand usage in the
        aggregate, and to improve the Service. You can control cookies through
        your browser settings.
      </p>

      <h2 id="retention">Retention</h2>
      <p>
        We retain information only as long as needed for the purposes described
        in this Policy, unless a longer period is required by law. Operational
        logs may be retained for a limited period for security and debugging.
      </p>

      <h2 id="security">Security</h2>
      <p>
        We use reasonable administrative and technical safeguards designed to
        protect information. No method of transmission over the Internet is 100%
        secure.
      </p>

      <h2 id="rights">Your choices and rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        delete, or restrict certain personal information, or to object to or
        limit certain processing. To make a request, contact us using the
        details below. We may need to verify your request.
      </p>

      <h2 id="children">Children</h2>
      <p>
        The Service is not directed to children under 13 (or the age required by
        your jurisdiction), and we do not knowingly collect personal information
        from children.
      </p>

      <h2 id="international">International transfers</h2>
      <p>
        If you access the Service from outside the country where we operate,
        your information may be processed in countries that may have different
        data protection laws.
      </p>

      <h2 id="changes">Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the
        updated version on this page and update the “Last updated” date above.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about privacy? Contact us through{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SITE_URL}
        >
          {new URL(SITE_URL).host}
        </a>
        .
      </p>
    </LegalDocShell>
  );
}
