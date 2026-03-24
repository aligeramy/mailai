import type {
  CorrespondentContextWindow,
  CorrespondentHistoryProgress,
} from "@/lib/types";

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
    message.includes("9017") ||
    message.includes("9018") ||
    message.includes("9042")
  ) {
    return `${message}\n\nMailbox history needs Exchange / Microsoft 365 with ReadWriteMailbox in the manifest. Error 9017 and similar codes often appear for Gmail or other IMAP accounts in Outlook for Mac — Outlook on the web or Windows usually works. Choose History: Off to skip mailbox search.`;
  }
  return message;
}

/** True when the message is likely a host/account limitation, not a bug. */
export function isRestMailboxHistoryUnsupportedMessage(
  message: string
): boolean {
  return (
    message.includes("9017") ||
    message.includes("9018") ||
    message.includes("9042") ||
    message.includes("-2147467259") ||
    message.includes("Internal protocol") ||
    message.includes("Exchange / Microsoft 365")
  );
}

export function restMailboxHistoryUserShortHint(): string {
  return "Not available for this account in this Outlook client (common with Gmail/IMAP on Mac). Set History to Off, or use Outlook on the web / Windows with Microsoft 365.";
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
  Id?: string;
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

interface HistoryTimeSegment {
  fromInclusive: Date | null;
  label: string;
  toExclusive: Date | null;
}

/** UTC midnight `days` ago (consistent with prior single-window behavior). */
function utcDaysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Load recent mail first, then older bands, so the model can use partial context early.
 * 60/90d = consecutive 30-day bands; "all" = last 30d then everything older.
 */
function historyTimeSegments(
  window: Exclude<CorrespondentContextWindow, "off">
): HistoryTimeSegment[] {
  if (window === "30") {
    return [
      {
        label: "Last 30 days",
        fromInclusive: utcDaysAgo(30),
        toExclusive: null,
      },
    ];
  }
  if (window === "60") {
    return [
      {
        label: "Last 30 days",
        fromInclusive: utcDaysAgo(30),
        toExclusive: null,
      },
      {
        label: "Days 31–60",
        fromInclusive: utcDaysAgo(60),
        toExclusive: utcDaysAgo(30),
      },
    ];
  }
  if (window === "90") {
    return [
      {
        label: "Last 30 days",
        fromInclusive: utcDaysAgo(30),
        toExclusive: null,
      },
      {
        label: "Days 31–60",
        fromInclusive: utcDaysAgo(60),
        toExclusive: utcDaysAgo(30),
      },
      {
        label: "Days 61–90",
        fromInclusive: utcDaysAgo(90),
        toExclusive: utcDaysAgo(60),
      },
    ];
  }
  return [
    {
      label: "Last 30 days",
      fromInclusive: utcDaysAgo(30),
      toExclusive: null,
    },
    {
      label: "Older mail",
      fromInclusive: null,
      toExclusive: utcDaysAgo(30),
    },
  ];
}

export function correspondentHistoryPhaseLabels(
  window: Exclude<CorrespondentContextWindow, "off">
): string[] {
  return historyTimeSegments(window).map((s) => s.label);
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

function buildMessagesQuery(options: {
  fromInclusive: Date | null;
  pageSize: number;
  toExclusive: Date | null;
}): string {
  const params = new URLSearchParams();
  params.set(
    "$select",
    "Id,Subject,ReceivedDateTime,From,ToRecipients,CcRecipients,BodyPreview"
  );
  params.set("$orderby", "ReceivedDateTime desc");
  params.set("$top", String(options.pageSize));
  const filters: string[] = [];
  if (options.fromInclusive) {
    filters.push(`ReceivedDateTime ge ${options.fromInclusive.toISOString()}`);
  }
  if (options.toExclusive) {
    filters.push(`ReceivedDateTime lt ${options.toExclusive.toISOString()}`);
  }
  if (filters.length > 0) {
    params.set("$filter", filters.join(" and "));
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
  collected: HistorySnippet[],
  seenIds: Set<string>
): void {
  for (const m of batch) {
    const mid = m.Id?.trim();
    if (mid && seenIds.has(mid)) {
      continue;
    }
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
    if (mid) {
      seenIds.add(mid);
    }
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

async function collectFromSegment(
  base: string,
  token: string,
  segment: HistoryTimeSegment,
  counterparty: string,
  collected: HistorySnippet[],
  seenIds: Set<string>,
  pageBudget: { used: number }
): Promise<void> {
  const query = buildMessagesQuery({
    fromInclusive: segment.fromInclusive,
    toExclusive: segment.toExclusive,
    pageSize: PAGE_SIZE,
  });
  let nextUrl: string | null = `${base}/Me/Messages?${query}`;

  while (
    nextUrl &&
    collected.length < MAX_MATCHES &&
    pageBudget.used < MAX_PAGES
  ) {
    pageBudget.used += 1;
    const data = await fetchOutlookRestJson(nextUrl, token);
    const batch = data.value ?? [];
    pushMatchingSnippetsFromBatch(batch, counterparty, collected, seenIds);
    nextUrl = data["@odata.nextLink"] ?? null;
  }
}

function emitProgress(
  onProgress: ((p: CorrespondentHistoryProgress) => void) | undefined,
  args: {
    activePhaseIndex: number;
    collected: HistorySnippet[];
    completedPhaseIndex: number;
    counterparty: string;
    isComplete: boolean;
    totalPhases: number;
    window: Exclude<CorrespondentContextWindow, "off">;
  }
): void {
  if (!onProgress) {
    return;
  }
  const cumulativeText =
    args.collected.length === 0
      ? ""
      : buildHistoryPromptBody(args.counterparty, args.window, args.collected);
  onProgress({
    activePhaseIndex: args.activePhaseIndex,
    completedPhaseIndex: args.completedPhaseIndex,
    cumulativeText,
    isComplete: args.isComplete,
    totalPhases: args.totalPhases,
  });
}

export async function fetchCorrespondentHistoryFromRest(params: {
  currentUserEmail: string;
  isComposeMode: boolean;
  item: Office.MessageRead | Office.MessageCompose;
  mailbox: Office.Mailbox;
  onProgress?: (progress: CorrespondentHistoryProgress) => void;
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

  const segments = historyTimeSegments(params.window);
  const totalPhases = segments.length;
  const collected: HistorySnippet[] = [];
  const seenIds = new Set<string>();
  const pageBudget = { used: 0 };

  emitProgress(params.onProgress, {
    activePhaseIndex: 0,
    completedPhaseIndex: -1,
    collected,
    counterparty,
    isComplete: false,
    totalPhases,
    window: params.window,
  });

  try {
    for (let i = 0; i < segments.length; i++) {
      await collectFromSegment(
        base,
        token,
        segments[i],
        counterparty,
        collected,
        seenIds,
        pageBudget
      );
      const isLast = i === segments.length - 1;
      emitProgress(params.onProgress, {
        activePhaseIndex: isLast ? -1 : i + 1,
        completedPhaseIndex: i,
        collected,
        counterparty,
        isComplete: isLast,
        totalPhases,
        window: params.window,
      });
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
