/** Canonical public site URL (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://smartreply.space";

export const SITE_NAME = "Smart Reply";

export const SITE_DESCRIPTION =
  "Paste any message and get a clear, professional reply in seconds. Free AI response generator for email and chat. Outlook add-in available.";

/** Link for the Outlook add-in CTA (AppSource, sideload docs, or OWA). */
export const OUTLOOK_ADDIN_URL =
  process.env.NEXT_PUBLIC_OUTLOOK_ADDIN_URL ??
  "https://outlook.office.com/mail/inbox";
