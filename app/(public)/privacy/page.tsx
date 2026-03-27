import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import {
  PRIVACY_URL,
  SITE_NAME,
  SITE_URL,
  SUPPORT_INBOX_EMAIL,
} from "@/lib/site-config";

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
        This Privacy Policy explains how {SITE_NAME} (“we,” “us,” or “our”)
        collects, uses, stores, and shares information when you use our
        website at{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SITE_URL}
        >
          {new URL(SITE_URL).host}
        </a>{" "}
        and the optional Microsoft Outlook add-in (the “Service”).
      </p>

      <p>
        By using the Service, you consent to the practices described in this
        Policy. If you do not agree with this Policy, do not use the Service.
      </p>

      <h2 id="information-we-collect">Information we collect</h2>
      <p>We may collect or process the following categories of information:</p>
      <ul>
        <li>
          <strong className="text-foreground">Account and technical data.</strong>{" "}
          This includes information such as device type, browser type, IP
          address, timestamps, and basic diagnostic logs needed to keep the
          Service secure and reliable.
        </li>
        <li>
          <strong className="text-foreground">Content you provide.</strong>{" "}
          When you generate a reply or submit a support request, we process the
          text and context you provide so we can deliver the requested feature.
        </li>
        <li>
          <strong className="text-foreground">Outlook data.</strong> If you use
          the add-in, the Service may access message or thread context according
          to the permissions you grant in Microsoft Outlook or Microsoft 365.
        </li>
        <li>
          <strong className="text-foreground">Support communications.</strong>{" "}
          If you contact us, we receive the information you send, such as your
          name, email address, and message.
        </li>
      </ul>

      <h2 id="how-we-use-information">How we use information</h2>
      <p>We use information to:</p>
      <ul>
        <li>Provide and improve the Service.</li>
        <li>Generate reply drafts and related suggestions.</li>
        <li>Operate, maintain, secure, and debug the Service.</li>
        <li>Respond to support inquiries and product questions.</li>
        <li>Comply with legal obligations and enforce our terms.</li>
      </ul>

      <h2 id="sharing">How we share information</h2>
      <p>
        We do not sell personal information. We may share information only as
        needed to operate the Service, including with:
      </p>
      <ul>
        <li>
          <strong className="text-foreground">Service providers.</strong> For
          example, infrastructure, analytics, email delivery, or AI vendors
          that help us run the Service.
        </li>
        <li>
          <strong className="text-foreground">Microsoft.</strong> If you use the
          Outlook add-in, Microsoft processes some data according to its own
          terms and privacy practices.
        </li>
        <li>
          <strong className="text-foreground">Legal and business transfers.</strong>{" "}
          We may disclose information if required by law or in connection with a
          merger, acquisition, or similar transaction.
        </li>
      </ul>

      <h2 id="ai-providers">AI providers</h2>
      <p>
        When you use AI features, your prompts and related context may be sent
        to third-party AI providers to generate output. Those providers process
        the data under their own terms and privacy policies. Do not submit
        highly sensitive information unless you understand the risks.
      </p>

      <h2 id="retention">Retention</h2>
      <p>
        We keep information only for as long as reasonably necessary to operate
        the Service, fulfill the purposes described in this Policy, or meet
        legal, security, or accounting obligations.
      </p>

      <h2 id="cookies">Cookies and similar technologies</h2>
      <p>
        We may use cookies and similar technologies to remember preferences,
        improve performance, and understand how the Service is used. You can
        control cookies through your browser settings.
      </p>

      <h2 id="security">Security</h2>
      <p>
        We use reasonable administrative, technical, and organizational
        safeguards designed to protect information. No system is completely
        secure, and we cannot guarantee absolute security.
      </p>

      <h2 id="your-rights">Your choices and rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        delete, or restrict certain personal information, or to object to some
        processing. To exercise those rights, contact us using the information
        below. We may need to verify your request.
      </p>

      <h2 id="children">Children</h2>
      <p>
        The Service is not directed to children under 13, or the age required
        by local law, and we do not knowingly collect personal information from
        children.
      </p>

      <h2 id="changes">Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. If we make changes,
        we will post the updated version here and revise the “Last updated” date
        above.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        If you have questions about this Policy, contact us through the{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href="/support"
        >
          support page
        </a>{" "}
        or email{" "}
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
