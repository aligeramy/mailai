import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import {
  SITE_NAME,
  SITE_URL,
  SUPPORT_INBOX_EMAIL,
  TERMS_URL,
} from "@/lib/site-config";

const LAST_UPDATED = "March 24, 2025";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${SITE_NAME} and the Outlook add-in.`,
  alternates: { canonical: "/terms" },
  openGraph: {
    title: `Terms of Service — ${SITE_NAME}`,
    description: `Terms of Service for ${SITE_NAME}.`,
    url: TERMS_URL,
  },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalDocShell lastUpdated={LAST_UPDATED} title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your access to and use of{" "}
        {SITE_NAME} (the “Service”), including our website at{" "}
        <a
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={SITE_URL}
        >
          {new URL(SITE_URL).host}
        </a>{" "}
        and the optional Microsoft Outlook add-in. By using the Service, you
        agree to these Terms.
      </p>

      <h2 id="eligibility">Eligibility and authority</h2>
      <p>
        You must be able to form a binding contract in your jurisdiction to use
        the Service. If you use the Service on behalf of an organization, you
        represent that you have authority to bind that organization.
      </p>

      <h2 id="service">The Service</h2>
      <p>
        {SITE_NAME} provides AI-assisted email reply drafting and related
        productivity features. Some features may rely on third-party providers,
        including AI models, to generate output when you choose to use them.
      </p>
      <p>
        AI-generated content can be incomplete, inaccurate, or inappropriate.
        You are responsible for reviewing all output before using or sending it.
      </p>

      <h2 id="your-responsibility">Your responsibility</h2>
      <p>
        You are responsible for your use of the Service, for maintaining the
        confidentiality of any credentials or API keys you use with it, and for
        ensuring that your use complies with applicable laws, employer policies,
        and third-party terms.
      </p>

      <h2 id="acceptable-use">Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service to violate law, infringe rights, or facilitate fraud.
        </li>
        <li>Send spam, malware, or other harmful content.</li>
        <li>Attempt to bypass security, rate limits, or access controls.</li>
        <li>
          Reverse engineer or attempt to extract source code, except where
          prohibited restrictions are unenforceable by law.
        </li>
      </ul>

      <h2 id="third-party-services">Third-party services</h2>
      <p>
        The Service may integrate with Microsoft Outlook, Microsoft 365, AI
        providers, and other third-party services. Your use of those services is
        governed by their own terms and policies, and we are not responsible for
        third-party systems or outages.
      </p>

      <h2 id="outlook">Outlook and Microsoft</h2>
      <p>
        The add-in runs inside Microsoft Outlook. Microsoft controls the
        Outlook, Microsoft 365, and account-level features that make the add-in
        possible, and Microsoft’s policies apply to those products.
      </p>

      <h2 id="disclaimers">Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES
        OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING IMPLIED
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
        NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.
      </p>

      <h2 id="liability">Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY
        INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR
        ANY LOSS OF PROFITS, DATA, OR GOODWILL. OUR TOTAL LIABILITY FOR ANY
        CLAIM ARISING OUT OF THESE TERMS OR THE SERVICE WILL NOT EXCEED THE
        GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE
        (12) MONTHS BEFORE THE CLAIM OR (B) FIFTY U.S. DOLLARS (US $50), IF
        APPLICABLE.
      </p>

      <h2 id="changes">Changes to the Service or Terms</h2>
      <p>
        We may update the Service and these Terms from time to time. If we make
        material changes, we will take reasonable steps to notify you, such as
        by updating the date on this page. Continued use of the Service after
        the changes take effect means you accept the revised Terms.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        If you have questions about these Terms, contact us through the{" "}
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
