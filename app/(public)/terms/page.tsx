import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import { SITE_NAME, SITE_URL, TERMS_URL } from "@/lib/site-config";

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
        and the optional Microsoft Outlook add-in that connects to the Service
        (“Add-in”). By using the Service, you agree to these Terms.
      </p>

      <h2 id="eligibility">Eligibility and accounts</h2>
      <p>
        You must be able to form a binding contract where you live. If you use
        the Service on behalf of an organization, you represent that you have
        authority to bind that organization.
      </p>

      <h2 id="service">The Service</h2>
      <p>
        {SITE_NAME} helps you draft replies using AI features. The Service may
        rely on third-party AI providers (for example OpenAI) when you choose to
        generate content. Output is generated automatically and may be
        inaccurate or inappropriate—you are responsible for reviewing and
        editing anything before you send it.
      </p>

      <h2 id="keys">Your API keys and credentials</h2>
      <p>
        Where the Service is configured to use your own API keys or accounts,
        you are responsible for keeping those secrets secure and for all
        activity under them, including usage charges imposed by third parties.
      </p>

      <h2 id="acceptable">Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Use the Service to violate law, infringe rights, or send spam or
          malware.
        </li>
        <li>
          Attempt to probe, scan, or test the vulnerability of our systems, or
          bypass security or rate limits.
        </li>
        <li>
          Reverse engineer or attempt to extract the Service’s source code,
          except where such restrictions are prohibited by law.
        </li>
        <li>
          Use the Service to generate or distribute unlawful, harassing,
          defamatory, or harmful content.
        </li>
      </ul>

      <h2 id="outlook">Outlook and Microsoft</h2>
      <p>
        The Add-in runs inside Microsoft Outlook. Your use of Outlook is
        governed by Microsoft’s terms and policies. Microsoft is not responsible
        for the Add-in or this Service.
      </p>

      <h2 id="disclaimers">Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE,” WITHOUT WARRANTIES
        OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING IMPLIED WARRANTIES OF
        MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT,
        TO THE MAXIMUM EXTENT PERMITTED BY LAW.
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

      <h2 id="changes">Changes</h2>
      <p>
        We may update the Service and these Terms from time to time. If we make
        material changes, we will take reasonable steps to notify you (for
        example by posting an updated date on this page). Your continued use
        after changes become effective constitutes acceptance of the revised
        Terms.
      </p>

      <h2 id="contact">Contact</h2>
      <p>
        Questions about these Terms? Contact us through the site at{" "}
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
