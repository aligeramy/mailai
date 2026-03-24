import type { CorrespondentContextWindow } from "@/lib/types";

const PAGE_SIZE = 50;
const MAX_PAGES = 28;
const MAX_MATCHES = 85;
const MAX_PREVIEW_CHARS = 480;
const MAX_PROMPT_CHARS = 78_000;
const TRAILING_SLASH_RE = /\/$/;
const WHITESPACE_COLLAPSE_RE = /\s+/g;

function normalizeEmail(addr: string | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

function callbackTokenAsync(mailbox: Office.Mailbox): Promise<string> {
  return new Promise((resolve, reject) => {
    mailbox.getCallbackTokenAsync({ isRest: true }, (result) => {
      if (
        result.status === Office.AsyncResultStatus.Succeeded &&
        result.value
      ) {
        resolve(result.value);
      } else {
        const code = result.error?.code;
        const diag = code != null ? ` (code ${code})` : "";
        reject(
          new Error(
            (result.error?.message ?? "Could not get Outlook REST token.") +
              diag
          )
        );
      }
    });
  });
}

/** Plain-English hint for generic host failures when getting REST access. */
function attachMailboxSearchHint(message: string): string {
  if (
    message.includes("-2147467259") ||
    message.includes("Internal protocol") ||
    message.includes("9018") ||
    message.includes("9042")
  ) {
    return `${message} — Mailbox history needs an Exchange / Microsoft 365 mailbox and ReadWriteMailbox in the manifest. It often fails for Gmail (or other IMAP) in Outlook for Mac; try Outlook on the web, the Windows client, or set History to Off.`;
  }
  return message;
}

function saveComposeItemAsync(item: Office.MessageCompose): Promise<void> {
  return new Promise((resolve, reject) => {
    item.saveAsync((result) => {
      if (result.status === Office.AsyncResultStatus.Succeeded) {
        resolve();
      } else {
        reject(
          new Error(result.error?.message ?? "Save message failed (compose).")
        );
      }
    });
  });
}

function getComposeToAddresses(item: Office.MessageCompose): Promise<string[]> {
  return new Promise((resolve) => {
    item.to.getAsync((result) => {
      if (
        result.status === Office.AsyncResultStatus.Succeeded &&
        result.value?.length
      ) {
        resolve(result.value.map((r) => r.emailAddress));
      } else {
        resolve([]);
      }
    });
  });
}

interface RestEmailAddress {
  EmailAddress?: { Address?: string; Name?: string };
}

interface RestMessage {
  BodyPreview?: string;
  CcRecipients?: RestEmailAddress[];
  From?: RestEmailAddress;
  ReceivedDateTime?: string;
  Subject?: string;
  ToRecipients?: RestEmailAddress[];
}

interface RestListResponse {
  "@odata.nextLink"?: string;
  value?: RestMessage[];
}

interface HistorySnippet {
  from: string;
  preview: string;
  subject: string;
  when: string;
}

function messageInvolvesCounterparty(
  m: RestMessage,
  counterparty: string
): boolean {
  const c = normalizeEmail(counterparty);
  if (!c) {
    return false;
  }
  if (normalizeEmail(m.From?.EmailAddress?.Address) === c) {
    return true;
  }
  for (const r of m.ToRecipients ?? []) {
    if (normalizeEmail(r.EmailAddress?.Address) === c) {
      return true;
    }
  }
  for (const r of m.CcRecipients ?? []) {
    if (normalizeEmail(r.EmailAddress?.Address) === c) {
      return true;
    }
  }
  return false;
}

function windowStartDate(
  window: Exclude<CorrespondentContextWindow, "off">
): Date | null {
  if (window === "all") {
    return null;
  }
  const days = Number.parseInt(window, 10);
  if (!Number.isFinite(days)) {
    return null;
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function resolveCounterpartyEmail(params: {
  item: Office.MessageRead | Office.MessageCompose;
  isComposeMode: boolean;
  currentUserEmail: string;
}): Promise<string | null> {
  const me = normalizeEmail(params.currentUserEmail);

  if (params.isComposeMode) {
    const to = await getComposeToAddresses(
      params.item as Office.MessageCompose
    );
    const primary =
      to.map(normalizeEmail).find((e) => e && e !== me) ??
      normalizeEmail(to[0]);
    return primary || null;
  }

  const read = params.item as Office.MessageRead;
  const from = normalizeEmail(read.from?.emailAddress);
  if (from && from !== me) {
    return from;
  }

  const toList = (read.to ?? []).map((r) => normalizeEmail(r.emailAddress));
  const other = toList.find((e) => e && e !== me);
  return other ?? toList[0] ?? null;
}

/** Build query string for first Outlook REST Messages page */
function buildMessagesQuery(startDate: Date | null, pageSize: number): string {
  const params = new URLSearchParams();
  params.set(
    "$select",
    "Subject,ReceivedDateTime,From,ToRecipients,CcRecipients,BodyPreview"
  );
  params.set("$orderby", "ReceivedDateTime desc");
  params.set("$top", String(pageSize));
  if (startDate) {
    params.set("$filter", `ReceivedDateTime ge ${startDate.toISOString()}`);
  }
  return params.toString();
}

async function fetchOutlookRestJson(
  url: string,
  token: string
): Promise<RestListResponse> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Outlook REST failed (${res.status}): ${text.slice(0, 280)}`
    );
  }
  return res.json() as Promise<RestListResponse>;
}

function pushMatchingSnippetsFromBatch(
  batch: RestMessage[],
  counterparty: string,
  collected: HistorySnippet[]
): void {
  for (const m of batch) {
    if (!messageInvolvesCounterparty(m, counterparty)) {
      continue;
    }
    const subject = m.Subject?.trim() || "(No subject)";
    const when =
      m.ReceivedDateTime?.trim() ?? new Date().toISOString().slice(0, 10);
    const fromAddr = m.From?.EmailAddress?.Address?.trim() ?? "(unknown)";
    const preview = (m.BodyPreview ?? "")
      .replace(WHITESPACE_COLLAPSE_RE, " ")
      .trim()
      .slice(0, MAX_PREVIEW_CHARS);
    collected.push({
      subject,
      when,
      from: fromAddr,
      preview,
    });
    if (collected.length >= MAX_MATCHES) {
      break;
    }
  }
}

function buildHistoryPromptBody(
  counterparty: string,
  window: Exclude<CorrespondentContextWindow, "off">,
  collected: HistorySnippet[]
): string {
  const lines = collected.map(
    (row) =>
      `- ${row.when} | ${row.subject} | from ${row.from}\n  ${row.preview}`
  );
  let body = `Other emails with ${counterparty} (${
    window === "all" ? "mailbox search" : `last ${window} days`
  }, excerpts):\n${lines.join("\n")}`;

  if (body.length > MAX_PROMPT_CHARS) {
    body = `${body.slice(0, MAX_PROMPT_CHARS)}\n[Truncated for size]`;
  }
  return body;
}

export async function fetchCorrespondentHistoryFromRest(params: {
  mailbox: Office.Mailbox;
  item: Office.MessageRead | Office.MessageCompose;
  isComposeMode: boolean;
  currentUserEmail: string;
  window: Exclude<CorrespondentContextWindow, "off">;
}): Promise<string> {
  const counterparty = await resolveCounterpartyEmail({
    item: params.item,
    isComposeMode: params.isComposeMode,
    currentUserEmail: params.currentUserEmail,
  });

  if (!counterparty) {
    return "";
  }

  if (params.isComposeMode) {
    try {
      await saveComposeItemAsync(params.item as Office.MessageCompose);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        attachMailboxSearchHint(`Save draft (needed for REST): ${msg}`)
      );
    }
  }

  let token: string;
  try {
    token = await callbackTokenAsync(params.mailbox);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(attachMailboxSearchHint(`REST token: ${msg}`));
  }

  const base = (params.mailbox.restUrl ?? "").replace(TRAILING_SLASH_RE, "");
  if (!base) {
    throw new Error(
      "Outlook restUrl is empty in this host (mailbox search unavailable here)."
    );
  }

  const start = windowStartDate(params.window);
  const query = buildMessagesQuery(start, PAGE_SIZE);
  let nextUrl: string | null = `${base}/Me/Messages?${query}`;

  const collected: HistorySnippet[] = [];

  let pages = 0;
  try {
    while (nextUrl && collected.length < MAX_MATCHES && pages < MAX_PAGES) {
      pages += 1;
      const data = await fetchOutlookRestJson(nextUrl, token);
      const batch = data.value ?? [];
      pushMatchingSnippetsFromBatch(batch, counterparty, collected);
      nextUrl = data["@odata.nextLink"] ?? null;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Mail list request: ${msg}`);
  }

  if (collected.length === 0) {
    return "";
  }

  return buildHistoryPromptBody(counterparty, params.window, collected);
}
