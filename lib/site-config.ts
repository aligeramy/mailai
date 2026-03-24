/** Canonical public site URL (no trailing slash). */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://smartreply.space";

export const SITE_NAME = "SmartReply";

/** Product name in copyright footers (compact). */
export const COPYRIGHT_PRODUCT = "SmartReply";
/** Attribution in copyright footers. */
export const COPYRIGHT_ATTRIBUTION = "MailAI";

/** Top-left header wordmark (logo label). */
export const SITE_HEADER_BRAND = "Smart Reply";
export const SITE_HEADER_LOCKUP = `${SITE_HEADER_BRAND} by ${COPYRIGHT_ATTRIBUTION}`;

/** Small caps line above the landing H1. */
export const SITE_HERO_EYEBROW = "AI email · Outlook & web";

/** Visible H1 on the landing page. */
export const SITE_HERO_TITLE_LINE1 = "SmartReply";
export const SITE_HERO_TITLE_LINE2 = "AI Email Reply Generator";

export const SITE_DESCRIPTION =
  "SmartReply is a free AI email reply generator: use the Outlook add-in to draft next to your thread in Microsoft 365, or paste any text on the web. No signup.";

/** Default & home-page SEO title. */
export const SITE_SEO_TITLE = `${SITE_NAME} | AI Email Reply Generator`;

/** Link for the Outlook add-in CTA (AppSource, sideload docs, or OWA). */
export const OUTLOOK_ADDIN_URL =
  process.env.NEXT_PUBLIC_OUTLOOK_ADDIN_URL ??
  "https://outlook.office.com/mail/inbox";

export const TERMS_URL = `${SITE_URL}/terms`;
export const PRIVACY_URL = `${SITE_URL}/privacy`;
