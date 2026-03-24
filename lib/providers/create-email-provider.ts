import { GmailProvider } from "@/lib/providers/gmail-provider";
import { OutlookProvider } from "@/lib/providers/outlook-provider";
import type { EmailProvider } from "@/lib/types";

export type EmailHostKind = "outlook" | "gmail";

/**
 * Factory for mail clients. Gmail is reserved for a future Chrome extension / sidebar.
 */
export function createEmailProvider(
  kind: EmailHostKind,
  office?: typeof Office
): EmailProvider {
  if (kind === "gmail") {
    return new GmailProvider();
  }
  return new OutlookProvider(office);
}
