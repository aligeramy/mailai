import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import { SupportForm } from "@/components/support-form";
import { SITE_NAME, SUPPORT_INBOX_EMAIL, SUPPORT_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Support",
  description: `Contact ${SITE_NAME} — help with the Outlook add-in and website.`,
  alternates: { canonical: "/support" },
  openGraph: {
    title: `Support — ${SITE_NAME}`,
    description: `Get help with ${SITE_NAME}.`,
    url: SUPPORT_URL,
  },
  robots: { index: true, follow: true },
};

export default function SupportPage() {
  return (
    <LegalDocShell centerHeader sectionLabel="Help" title="Support">
      <div className="space-y-6">
        <p className="text-center text-muted-foreground text-sm leading-relaxed md:text-[0.9375rem]">
          Get help with the {SITE_NAME} website, the Outlook add-in, or billing
          questions. We usually reply within a few business days.
        </p>
        <p className="text-center text-muted-foreground text-sm leading-relaxed md:text-[0.9375rem]">
          Prefer email?{" "}
          <a
            className="text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
            href={`mailto:${SUPPORT_INBOX_EMAIL}`}
          >
            {SUPPORT_INBOX_EMAIL}
          </a>
        </p>
        <SupportForm />
      </div>
    </LegalDocShell>
  );
}
