import { stripHtml } from "@/lib/email/html";
import type { EmailMessage } from "@/lib/types";

const ORIGINAL_MSG_RE = /\n-{3,}\s*Original Message\s*-{3,}\s*\n/i;
const FORWARDED_RE = /\n-{3,}\s*Forwarded message\s*-{3,}\s*\n/i;
/** Split quoted blocks that start a new "From:" line (Outlook / OWA) */
const FROM_LINE_SPLIT_RE = /\n(?=From:\s)/i;
const ANGLE_EMAIL_RE = /<([^>]+)>/;
const BARE_EMAIL_RE = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
const OUTLOOK_HEADER_BLOCK_RE =
  /From:\s*([\s\S]+?)\nSent:\s*([\s\S]+?)\n(?:To:\s*([\s\S]+?)\n)?(?:Cc:\s*([\s\S]+?)\n)?Subject:\s*([\s\S]+?)(?:\n|$)/i;

/**
 * Extract a best-effort email address from an Outlook "From:" line.
 */
export function extractEmailFromFromLine(fromLine: string): string | null {
  const angle = fromLine.match(ANGLE_EMAIL_RE);
  if (angle?.[1]) {
    return angle[1].trim();
  }
  const bare = fromLine.match(BARE_EMAIL_RE);
  return bare?.[1]?.trim() ?? null;
}

/**
 * Parse "From: ... Sent: ... To: ... Subject: ..." prefix and return metadata + body.
 */
export function parseOutlookHeaderBlock(segment: string): {
  from: string | null;
  subject: string | null;
  body: string;
} {
  const trimmed = segment.trim();
  const match = trimmed.match(OUTLOOK_HEADER_BLOCK_RE);
  if (!match || match.index === undefined) {
    return { from: null, subject: null, body: trimmed };
  }
  const fromRaw = match[1]?.trim() ?? "";
  const subject = match[5]?.trim() ?? null;
  const afterHeaders = trimmed.slice(match.index + match[0].length).trim();
  const before = trimmed.slice(0, match.index).trim();
  const body = [before, afterHeaders].filter(Boolean).join("\n\n").trim();
  const from = extractEmailFromFromLine(fromRaw) ?? fromRaw;
  return { from, subject, body };
}

/**
 * Split plain text (already HTML-stripped) into thread segments, newest-first chunks
 * (first chunk = top of message), then return messages in chronological order.
 */
export function splitThreadSegments(plain: string): string[] {
  const text = plain.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return [];
  }

  const splitOn = (input: string, re: RegExp): string[] => {
    const parts = input.split(re);
    return parts.map((p) => p.trim()).filter(Boolean);
  };

  let chunks: string[] = [text];

  for (const re of [ORIGINAL_MSG_RE, FORWARDED_RE]) {
    const next: string[] = [];
    for (const c of chunks) {
      next.push(...splitOn(c, re));
    }
    chunks = next.length ? next : chunks;
  }

  const flattened: string[] = [];
  for (const c of chunks) {
    const sub = c.split(FROM_LINE_SPLIT_RE);
    for (const part of sub) {
      const t = part.trim();
      if (t) {
        flattened.push(t);
      }
    }
  }

  return flattened.length ? flattened : [text];
}

export function buildMessagesFromSegments(
  segmentsNewestFirst: string[],
  subject: string,
  topSenderFallback: string,
  currentUserEmail: string
): EmailMessage[] {
  const chronological = [...segmentsNewestFirst].reverse();
  const messages: EmailMessage[] = [];
  for (let i = 0; i < chronological.length; i++) {
    const segment = chronological[i] ?? "";
    const parsed = parseOutlookHeaderBlock(segment);
    const isNewestInThread = i === chronological.length - 1;
    const from =
      parsed.from ?? (isNewestInThread ? topSenderFallback : "unknown@sender");
    const subj = parsed.subject ?? subject;
    const body = parsed.body || segment.trim();
    messages.push({
      id: `thread-${i}`,
      from,
      to: [currentUserEmail],
      subject: subj,
      body,
      timestamp: new Date(Date.now() - (chronological.length - 1 - i) * 60_000),
      isHtml: false,
    });
  }
  return messages;
}

/**
 * Parse an Outlook / OWA message HTML body into an ordered thread for the LLM.
 */
export function parseOutlookThreadFromHtml(
  htmlBody: string,
  subject: string,
  topSenderEmail: string,
  currentUserEmail: string
): EmailMessage[] {
  const plain = stripHtml(htmlBody);
  const segments = splitThreadSegments(plain);
  if (segments.length === 0) {
    return [];
  }
  return buildMessagesFromSegments(
    segments,
    subject,
    topSenderEmail,
    currentUserEmail
  );
}
