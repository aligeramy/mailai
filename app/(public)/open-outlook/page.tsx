import type { Metadata } from "next";
import { LegalDocShell } from "@/components/legal-doc-shell";
import { OpenOutlookAfterSignIn } from "@/components/open-outlook-after-signin";
import { OUTLOOK_ADDIN_URL, SITE_NAME, SITE_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Open Outlook",
  description: `Continue in Outlook to use ${SITE_NAME}.`,
  alternates: { canonical: `${SITE_URL}/open-outlook` },
  robots: { index: false, follow: true },
};

export default function OpenOutlookPage() {
  return (
    <LegalDocShell
      centerHeader
      sectionLabel="Next step"
      title="You’re signed in"
    >
      <OpenOutlookAfterSignIn webMailUrl={OUTLOOK_ADDIN_URL} />
    </LegalDocShell>
  );
}
