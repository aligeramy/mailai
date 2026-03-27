import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import { SupportForm } from "@/components/support-form";
import { SITE_NAME, SUPPORT_URL } from "@/lib/site-config";

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
    <LegalDocShell sectionLabel="Help" title="Support">
      <SupportForm />
    </LegalDocShell>
  );
}
