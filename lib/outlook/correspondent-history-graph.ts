import {
  type AccountInfo,
  createNestablePublicClientApplication,
  InteractionRequiredAuthError,
  type IPublicClientApplication,
} from "@azure/msal-browser";
import type {
  CorrespondentContextWindow,
  CorrespondentHistoryProgress,
} from "@/lib/types";

const PAGE_SIZE = 50;
const MAX_PAGES = 28;
const MAX_MATCHES = 85;
const MAX_PREVIEW_CHARS = 480;
const MAX_PROMPT_CHARS = 78_000;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const GRAPH_SCOPES = ["Mail.Read"];
const WHITESPACE_COLLAPSE_RE = /\s+/g;

function normalizeEmail(addr: string | undefined): string {
  return (addr ?? "").trim().toLowerCase();
}

let pcaPromise: Promise<IPublicClientApplication> | null = null;

function getEntraClientId(): string {
  const id = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;
  if (!id) {
    throw new Error(
      "NEXT_PUBLIC_AZURE_CLIENT_ID is not set. Register an Entra app and set it before enabling mailbox history."
    );
  }
  return id;
}

function getEntraAuthority(): string {
  // Single-tenant apps (the default for new-auth-style registrations) reject /common.
  // Honor NEXT_PUBLIC_AZURE_TENANT_ID when set; fall back to /common for multi-tenant apps.
  const tenant = process.env.NEXT_PUBLIC_AZURE_TENANT_ID?.trim();
  return tenant
    ? `https://login.microsoftonline.com/${tenant}`
    : "https://login.microsoftonline.com/common";
}

function getMsalClient(): Promise<IPublicClientApplication> {
  if (!pcaPromise) {
    pcaPromise = createNestablePublicClientApplication({
      auth: {
        clientId: getEntraClientId(),
        authority: getEntraAuthority(),
      },
    });
  }
  return pcaPromise;
}

function pickAccount(pca: IPublicClientApplication): AccountInfo | undefined {
  const accounts = pca.getAllAccounts();
  if (accounts.length === 0) {
    return;
  }
  const active = pca.getActiveAccount();
  if (active) {
    return active;
  }
  pca.setActiveAccount(accounts[0]);
  return accounts[0];
}

async function acquireGraphToken(): Promise<string> {
  const pca = await getMsalClient();
  const account = pickAccount(pca);
  try {
    const result = await pca.acquireTokenSilent({
      scopes: GRAPH_SCOPES,
      account,
    });
    return result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      const result = await pca.acquireTokenPopup({ scopes: GRAPH_SCOPES });
      if (result.account) {
        pca.setActiveAccount(result.account);
      }
      return result.accessToken;
    }
    throw err;
  }
}

/** Plain-English hint for Graph auth/host failures. */
function attachMailboxSearchHint(message: string): string {
  return `${message}\n\nMailbox history needs a Microsoft 365 / Exchange Online account with Mail.Read consented. Gmail or IMAP mailboxes attached to Outlook can't be searched through Microsoft Graph — set History to Off in that case.`;
}

/** True when the message is likely a host/account limitation, not a bug. */
export function isGraphMailboxHistoryUnsupportedMessage(
  message: string
): boolean {
  return (
    message.includes("NEXT_PUBLIC_AZURE_CLIENT_ID") ||
    message.includes("Microsoft 365 / Exchange Online") ||
    message.includes("Mail.Read") ||
    message.includes("consent_required") ||
    message.includes("interaction_required") ||
    message.includes("invalid_grant") ||
    message.includes("AADSTS") ||
    message.includes("nested_app_auth_not_supported") ||
    message.includes("MailboxNotEnabledForRESTAPI")
  );
}

export function graphMailboxHistoryUserShortHint(): string {
  return "Mailbox search needs a Microsoft 365 account with Mail.Read consent. Not available for Gmail/IMAP mailboxes attached to Outlook — set History to Off.";
}

interface GraphEmailAddress {
  emailAddress?: { address?: string; name?: string };
}

interface GraphMessage {
  bodyPreview?: string;
  ccRecipients?: GraphEmailAddress[];
  from?: GraphEmailAddress;
  id?: string;
  receivedDateTime?: string;
  subject?: string;
  toRecipients?: GraphEmailAddress[];
}

interface GraphListResponse {
  "@odata.nextLink"?: string;
  value?: GraphMessage[];
}

interface HistorySnippet {
  from: string;
  id: string | null;
  preview: string;
  subject: string;
  when: string;
}

/** Structured per-message form exposed for per-email context persistence. */
export interface OutlookHistoryItem {
  from: string;
  id: string | null;
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
  m: GraphMessage,
  counterparty: string
): boolean {
  const c = normalizeEmail(counterparty);
  if (!c) {
    return false;
  }
  if (normalizeEmail(m.from?.emailAddress?.address) === c) {
    return true;
  }
  for (const r of m.toRecipients ?? []) {
    if (normalizeEmail(r.emailAddress?.address) === c) {
      return true;
    }
  }
  for (const r of m.ccRecipients ?? []) {
    if (normalizeEmail(r.emailAddress?.address) === c) {
      return true;
    }
  }
  return false;
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
    "id,subject,receivedDateTime,from,toRecipients,ccRecipients,bodyPreview"
  );
  params.set("$orderby", "receivedDateTime desc");
  params.set("$top", String(options.pageSize));
  const filters: string[] = [];
  if (options.fromInclusive) {
    filters.push(`receivedDateTime ge ${options.fromInclusive.toISOString()}`);
  }
  if (options.toExclusive) {
    filters.push(`receivedDateTime lt ${options.toExclusive.toISOString()}`);
  }
  if (filters.length > 0) {
    params.set("$filter", filters.join(" and "));
  }
  return params.toString();
}

async function fetchGraphJson(
  url: string,
  token: string
): Promise<GraphListResponse> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Graph request failed (${res.status}): ${text.slice(0, 280)}`
    );
  }
  return res.json() as Promise<GraphListResponse>;
}

function pushMatchingSnippetsFromBatch(
  batch: GraphMessage[],
  counterparty: string,
  collected: HistorySnippet[],
  seenIds: Set<string>
): void {
  for (const m of batch) {
    const mid = m.id?.trim();
    if (mid && seenIds.has(mid)) {
      continue;
    }
    if (!messageInvolvesCounterparty(m, counterparty)) {
      continue;
    }
    const subject = m.subject?.trim() || "(No subject)";
    const when =
      m.receivedDateTime?.trim() ?? new Date().toISOString().slice(0, 10);
    const fromAddr = m.from?.emailAddress?.address?.trim() ?? "(unknown)";
    const preview = (m.bodyPreview ?? "")
      .replace(WHITESPACE_COLLAPSE_RE, " ")
      .trim()
      .slice(0, MAX_PREVIEW_CHARS);
    if (mid) {
      seenIds.add(mid);
    }
    collected.push({
      id: mid ?? null,
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
  let nextUrl: string | null = `${GRAPH_BASE}/me/messages?${query}`;

  while (
    nextUrl &&
    collected.length < MAX_MATCHES &&
    pageBudget.used < MAX_PAGES
  ) {
    pageBudget.used += 1;
    const data = await fetchGraphJson(nextUrl, token);
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

export async function fetchCorrespondentHistoryFromGraph(params: {
  currentUserEmail: string;
  isComposeMode: boolean;
  item: Office.MessageRead | Office.MessageCompose;
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

  let token: string;
  try {
    token = await acquireGraphToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(attachMailboxSearchHint(`Graph token: ${msg}`));
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
    throw new Error(attachMailboxSearchHint(`Mail list request: ${msg}`));
  }

  if (collected.length === 0) {
    return "";
  }

  return buildHistoryPromptBody(counterparty, params.window, collected);
}

/**
 * Same Graph fetch as fetchCorrespondentHistoryFromGraph, but returns the
 * structured per-message list instead of a joined brief. Used by the context
 * manager to persist each message as its own row, so the user can toggle
 * individual emails in or out of the AI prompt.
 */
export async function fetchCorrespondentMessagesFromGraph(params: {
  currentUserEmail: string;
  isComposeMode: boolean;
  item: Office.MessageRead | Office.MessageCompose;
  window: Exclude<CorrespondentContextWindow, "off">;
}): Promise<{ counterparty: string; items: OutlookHistoryItem[] }> {
  const counterparty = await resolveCounterpartyEmail({
    item: params.item,
    isComposeMode: params.isComposeMode,
    currentUserEmail: params.currentUserEmail,
  });
  if (!counterparty) {
    return { counterparty: "", items: [] };
  }

  let token: string;
  try {
    token = await acquireGraphToken();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(attachMailboxSearchHint(`Graph token: ${msg}`));
  }

  const segments = historyTimeSegments(params.window);
  const collected: HistorySnippet[] = [];
  const seenIds = new Set<string>();
  const pageBudget = { used: 0 };

  for (const segment of segments) {
    await collectFromSegment(
      token,
      segment,
      counterparty,
      collected,
      seenIds,
      pageBudget
    );
  }

  return { counterparty, items: collected };
}
