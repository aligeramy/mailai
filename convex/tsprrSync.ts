// biome-ignore lint/style/useFilenamingConvention: Convex routes by filename; matches the existing camelCase convention (see schema.ts, context.ts).
"use node";

import { v } from "convex/values";
import { Client } from "pg";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

const FRESH_MS = 5 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_PAYMENTS = 8;
const MAX_LEDGER = 12;
const MAX_TICKETS = 12;
const MAX_NOTES_PER_TICKET = 3;
const LEADING_SLASH_RE = /^\//;

type Json = Record<string, unknown>;
interface SyncItem {
  bodyForPrompt: string;
  correspondentEmail: string;
  defaultRelevant: boolean;
  externalId?: string;
  kind: string;
  occurredAt?: number;
  raw?: Json;
  snippet: string;
  source: "tsprr";
  title: string;
}

function dateToMs(value: unknown): number | undefined {
  if (!value) {
    return;
  }
  const t = new Date(value as string).getTime();
  return Number.isFinite(t) ? t : undefined;
}

/**
 * node-postgres returns `timestamp`/`date` columns as JS `Date` objects,
 * which Convex's value validator rejects. Round-trip through JSON so every
 * Date becomes its ISO string (via Date.prototype.toJSON) while everything
 * else is preserved. Also strips `undefined` keys for the same reason.
 */
function sanitizeForConvex(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function fmtMoney(amount: unknown): string {
  const n = typeof amount === "number" ? amount : Number(amount ?? 0);
  if (!Number.isFinite(n)) {
    return "$0.00";
  }
  return n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

function fmtDate(value: unknown): string {
  if (!value) {
    return "unknown date";
  }
  return new Date(value as string).toISOString().slice(0, 10);
}

function within90Days(ts: number | undefined): boolean {
  if (!ts) {
    return false;
  }
  return Date.now() - ts < NINETY_DAYS_MS;
}

function buildContactItem(
  email: string,
  contact: Json,
  primaryRole: string
): SyncItem {
  const name =
    `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() ||
    "(no name)";
  const body = [
    `Contact: ${name}`,
    `Primary role: ${primaryRole}`,
    contact.phone ? `Phone: ${contact.phone}` : null,
    contact.email ? `Email: ${contact.email}` : null,
    contact.company_name ? `Company: ${contact.company_name}` : null,
    contact.contact_type ? `Type: ${contact.contact_type}` : null,
    contact.notes ? `Notes: ${contact.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "contact",
    externalId: String(contact.id),
    title: `Contact: ${name} (${primaryRole})`,
    snippet: [contact.phone, contact.company_name].filter(Boolean).join(" · "),
    bodyForPrompt: body,
    occurredAt: dateToMs(contact.updated_at) ?? dateToMs(contact.created_at),
    defaultRelevant: true,
    raw: sanitizeForConvex(contact),
  };
}

function buildTenantItem(
  email: string,
  tenant: Json,
  unit: Json | null,
  building: Json | null
): SyncItem {
  const name =
    `${tenant.first_name ?? ""} ${tenant.last_name ?? ""}`.trim() ||
    "(no name)";
  const unitLabel = unit
    ? `unit ${unit.unit_number ?? unit.unit_name ?? "?"}`
    : "no unit on file";
  const buildingLabel = building?.building_name ?? "no building on file";
  const body = [
    `Tenant: ${name}`,
    `Status: ${tenant.status ?? "unknown"}`,
    `Unit: ${unitLabel}${unit?.street_number ? ` (${unit.street_number} ${unit.street_name}, ${unit.city})` : ""}`,
    `Building: ${buildingLabel}`,
    tenant.subletting_to_tenant_id
      ? "Currently sublet to another tenant."
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "tenant",
    externalId: String(tenant.id),
    title: `Tenant: ${name} — ${unitLabel}`,
    snippet: `${tenant.status ?? "status unknown"} · ${buildingLabel}`,
    bodyForPrompt: body,
    occurredAt: dateToMs(tenant.updated_at) ?? dateToMs(tenant.created_at),
    defaultRelevant: true,
    raw: sanitizeForConvex({ tenant, unit, building }),
  };
}

function buildAccountItem(
  email: string,
  account: Json,
  balance: number | null
): SyncItem {
  const body = [
    `Account: ${account.account_name ?? "(unnamed)"}`,
    `Status: ${account.status ?? "unknown"}`,
    account.lease_start_date
      ? `Lease start: ${fmtDate(account.lease_start_date)}`
      : null,
    account.expiry_date
      ? `Lease expiry: ${fmtDate(account.expiry_date)}`
      : null,
    account.termination_date
      ? `Termination date: ${fmtDate(account.termination_date)}`
      : null,
    balance !== null
      ? `Current canonical balance: ${fmtMoney(balance)} (positive = owed by tenant)`
      : null,
    account.total_adults != null
      ? `Adults on lease: ${account.total_adults}`
      : null,
    account.total_children != null
      ? `Children on lease: ${account.total_children}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "account",
    externalId: String(account.id),
    title: `Account: ${account.account_name ?? "(unnamed)"} [${account.status ?? "?"}]`,
    snippet:
      balance !== null
        ? `Balance ${fmtMoney(balance)}`
        : `Status: ${account.status ?? "?"}`,
    bodyForPrompt: body,
    occurredAt: dateToMs(account.created_at),
    defaultRelevant: true,
    raw: sanitizeForConvex({ account, balance }),
  };
}

function buildPaymentItem(email: string, p: Json): SyncItem {
  const occurredAt = dateToMs(p.date);
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "payment",
    externalId: String(p.id),
    title: `Payment ${fmtMoney(p.amount)} on ${fmtDate(p.date)}`,
    snippet: [
      p.payment_method,
      p.ref_number ? `ref ${p.ref_number}` : null,
      p.status,
    ]
      .filter(Boolean)
      .join(" · "),
    bodyForPrompt: [
      `Payment of ${fmtMoney(p.amount)} on ${fmtDate(p.date)}`,
      `Method: ${p.payment_method ?? "?"}`,
      p.ref_number ? `Ref: ${p.ref_number}` : null,
      p.status ? `Status: ${p.status}` : null,
      p.notes ? `Notes: ${p.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt,
    defaultRelevant: within90Days(occurredAt),
    raw: sanitizeForConvex(p),
  };
}

function buildLedgerItem(email: string, l: Json): SyncItem {
  const occurredAt = dateToMs(l.transaction_date);
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "ledger",
    externalId: String(l.id),
    title: `${l.transaction_type ?? "ledger"}: ${fmtMoney(l.amount)} on ${fmtDate(l.transaction_date)}`,
    snippet: (l.description as string | undefined) ?? "",
    bodyForPrompt: [
      `${l.transaction_type ?? "Ledger entry"}: ${fmtMoney(l.amount)} on ${fmtDate(l.transaction_date)}`,
      l.description ? `Description: ${l.description}` : null,
      l.reference_number ? `Ref: ${l.reference_number}` : null,
      l.notes ? `Notes: ${l.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt,
    defaultRelevant: within90Days(occurredAt),
    raw: sanitizeForConvex(l),
  };
}

function buildTicketItem(email: string, t: Json, notes: Json[]): SyncItem {
  const isOpen = !t.completed_at;
  const occurredAt = dateToMs(t.created_at);
  const notesBlock = notes
    .map(
      (n) =>
        `- (${fmtDate(n.created_at)}) ${typeof n.content === "string" ? n.content.slice(0, 240) : ""}`
    )
    .join("\n");
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "ticket",
    externalId: String(t.id),
    title: `Ticket #${t.ticket_number ?? "?"}: ${t.title ?? "(no title)"} [${t.status ?? "?"}]`,
    snippet: `${t.priority ?? "normal"} · opened ${fmtDate(t.created_at)}`,
    bodyForPrompt: [
      `Ticket #${t.ticket_number ?? "?"}: ${t.title ?? "(no title)"}`,
      `Status: ${t.status ?? "?"}, priority: ${t.priority ?? "?"}, category: ${t.category ?? "?"}`,
      t.is_emergency ? "EMERGENCY" : null,
      `Opened: ${fmtDate(t.created_at)}${t.completed_at ? `, completed: ${fmtDate(t.completed_at)}` : ""}`,
      t.description
        ? `Description: ${(t.description as string).slice(0, 400)}`
        : null,
      notesBlock ? `Recent notes:\n${notesBlock}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt,
    defaultRelevant: isOpen || within90Days(occurredAt),
    raw: sanitizeForConvex({ ticket: t, notes }),
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: linear formatter for many optional fields; splitting hurts readability.
function buildProspectItem(
  email: string,
  prospect: Json,
  pd: Json | null,
  docTracker: Json | null
): SyncItem {
  const name = pd
    ? `${pd.first_name ?? ""} ${pd.last_name ?? ""}`.trim() || "(no name)"
    : "(no name)";
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "prospect",
    externalId: String(prospect.id),
    title: `Prospect: ${name} for ${prospect.property_address ?? "(no property)"} [${prospect.state ?? "?"}]`,
    snippet: `Source: ${prospect.source ?? "?"}, move-in: ${fmtDate(prospect.move_in_date)}`,
    bodyForPrompt: [
      `Prospect application: ${name}`,
      `Property: ${prospect.property_address ?? "?"}`,
      `Status: ${prospect.state ?? "?"}, rating: ${prospect.rating ?? "?"}`,
      `Source: ${prospect.source ?? "?"}`,
      prospect.move_in_date
        ? `Desired move-in: ${fmtDate(prospect.move_in_date)}`
        : null,
      prospect.offer_amount
        ? `Offer: ${fmtMoney(prospect.offer_amount)}`
        : null,
      prospect.occupant_relationship
        ? `Occupants: ${prospect.occupant_relationship}`
        : null,
      pd?.occupation ? `Occupation: ${pd.occupation}` : null,
      pd?.monthly_income
        ? `Stated monthly income: ${fmtMoney(pd.monthly_income)}`
        : null,
      pd?.credit_score ? `Credit score: ${pd.credit_score}` : null,
      docTracker
        ? `Docs received: ID ${docTracker.gov_id_received ? "yes" : "no"}, credit ${docTracker.credit_report_received ? "yes" : "no"}, income ${docTracker.proof_of_income_received ? "yes" : "no"}`
        : null,
      prospect.open_comments ? `Notes: ${prospect.open_comments}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt: dateToMs(prospect.updated_at) ?? dateToMs(prospect.created_at),
    defaultRelevant: true,
    raw: sanitizeForConvex({ prospect, pd, docTracker }),
  };
}

function buildTerminationItem(email: string, n: Json): SyncItem {
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "termination_notice",
    externalId: String(n.id),
    title: `N9 termination [${n.status ?? "?"}] — move-out ${fmtDate(n.intended_move_out_date)}`,
    snippet: `${n.notice_type ?? "?"} · notice ${fmtDate(n.notice_date)}`,
    bodyForPrompt: [
      `Termination notice (${n.notice_type ?? "?"})`,
      `Status: ${n.status ?? "?"}`,
      n.notice_date ? `Notice date: ${fmtDate(n.notice_date)}` : null,
      n.intended_move_out_date
        ? `Intended move-out: ${fmtDate(n.intended_move_out_date)}`
        : null,
      n.actual_move_out_date
        ? `Actual move-out: ${fmtDate(n.actual_move_out_date)}`
        : null,
      n.additional_notes ? `Notes: ${n.additional_notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt: dateToMs(n.notice_date) ?? dateToMs(n.created_at),
    defaultRelevant: !n.actual_move_out_date,
    raw: sanitizeForConvex(n),
  };
}

function buildParkingItem(email: string, p: Json): SyncItem {
  return {
    correspondentEmail: email,
    source: "tsprr",
    kind: "parking_request",
    externalId: String(p.id),
    title: `Parking: ${p.vehicle_make ?? ""} ${p.vehicle_model ?? ""} (${p.license_plate ?? "?"}) [${p.status ?? "?"}]`,
    snippet: `${fmtDate(p.approved_start_date)} → ${fmtDate(p.approved_end_date)}`,
    bodyForPrompt: [
      `Parking request: ${p.vehicle_make ?? ""} ${p.vehicle_model ?? ""}`,
      `Plate: ${p.license_plate ?? "?"}, color: ${p.vehicle_color ?? "?"}`,
      `Driver: ${p.driver_name ?? "?"}`,
      `Status: ${p.status ?? "?"}`,
      `Window: ${fmtDate(p.approved_start_date)} → ${fmtDate(p.approved_end_date)}`,
      p.parking_spot ? `Spot: ${p.parking_spot}` : null,
      p.comments ? `Comments: ${p.comments}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    occurredAt: dateToMs(p.approved_start_date) ?? dateToMs(p.created_at),
    defaultRelevant:
      p.status !== "denied" &&
      p.status !== "expired" &&
      within90Days(dateToMs(p.approved_end_date) ?? dateToMs(p.created_at)),
    raw: sanitizeForConvex(p),
  };
}

/**
 * Sync TSP-RR context for one correspondent. Reads from the read-only
 * mailai_reader role over Postgres. Never writes to TSP-RR. Writes one
 * contextItems row per logical entity (contact, tenant, account, payment,
 * ticket, etc.) so the user can toggle each one in the /context UI.
 */
export const syncTsprrForCorrespondent = action({
  args: {
    email: v.string(),
    force: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    cached: boolean;
    itemsWritten: number;
    lastSyncedAt: number;
  }> => {
    const normalized = args.email.trim().toLowerCase();
    if (!normalized) {
      return { cached: false, itemsWritten: 0, lastSyncedAt: Date.now() };
    }

    if (!args.force) {
      const lastRun = await ctx.runQuery(internal.context.getLastSyncBySource, {
        correspondentEmail: normalized,
        source: "tsprr",
      });
      if (lastRun?.finishedAt && Date.now() - lastRun.finishedAt < FRESH_MS) {
        return {
          cached: true,
          itemsWritten: lastRun.itemsWritten ?? 0,
          lastSyncedAt: lastRun.finishedAt,
        };
      }
    }

    const connectionString = process.env.TSPRR_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "TSPRR_DATABASE_URL is not set. Configure it in Convex env: `npx convex env set TSPRR_DATABASE_URL '<connection string for mailai_reader>'`."
      );
    }

    const runId: Id<"contextSyncRuns"> = await ctx.runMutation(
      internal.context.recordSyncStart,
      { correspondentEmail: normalized, source: "tsprr" }
    );

    // Parse URL explicitly so the ssl config below isn't shadowed by a
    // `sslmode=` query parameter in the connection string. Supabase's
    // managed Postgres serves a chain signed by an intermediate CA that
    // isn't in Node's default trust store, so we disable cert validation.
    // This is acceptable because (a) we connect over TLS — the wire is
    // still encrypted, (b) mailai_reader is read-only at the DB level, and
    // (c) the connection target is pinned by env var, not user input.
    const parsed = new URL(connectionString);
    const client = new Client({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(LEADING_SLASH_RE, "") || "postgres",
      ssl: { rejectUnauthorized: false },
    });
    const items: SyncItem[] = [];
    let errMessage: string | undefined;

    try {
      await client.connect();
      await tsprrSyncCore(client, normalized, items);
    } catch (err) {
      errMessage = err instanceof Error ? err.message : String(err);
    } finally {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }

    let written = 0;
    if (items.length > 0) {
      written = await ctx.runMutation(internal.context.upsertItemsBulk, {
        items,
      });
    }

    await ctx.runMutation(internal.context.recordSyncFinish, {
      runId,
      ok: !errMessage,
      itemsWritten: written,
      error: errMessage,
    });

    if (errMessage) {
      throw new Error(`TSP-RR sync failed: ${errMessage}`);
    }

    return {
      cached: false,
      itemsWritten: written,
      lastSyncedAt: Date.now(),
    };
  },
});

const HEALTHCHECK_TABLES = [
  "contacts",
  "tenants",
  "unit_tenants",
  "units",
  "buildings",
  "accounts",
  "tenant_accounts",
  "canonical_account_balances",
  "payments",
  "ledger_transactions",
  "maintenance_tickets",
  "maintenance_ticket_units",
  "maintenance_ticket_history",
  "maintenance_notes",
  "prospects",
  "prospect_personal_details",
  "prospect_document_tracker",
  "termination_notices",
  "parking_requests",
] as const;

/**
 * Validate the TSP-RR connection. Confirms the env var is set, mailai_reader
 * can connect over TLS, run SELECT, and reach every granted table. Returns
 * one row per table so the UI can flag any that are missing (e.g. after a
 * future schema change in TSP-RR).
 */
export const validateTsprrConnection = action({
  args: {},
  handler: async (): Promise<{
    ok: boolean;
    error?: string;
    durationMs?: number;
    tables?: { name: string; rows: number | null; error?: string }[];
  }> => {
    const connectionString = process.env.TSPRR_DATABASE_URL;
    if (!connectionString) {
      return {
        ok: false,
        error:
          "TSPRR_DATABASE_URL is not set. Run `npx convex env set TSPRR_DATABASE_URL '<connection string>'`.",
      };
    }

    const started = Date.now();
    let parsed: URL;
    try {
      parsed = new URL(connectionString);
    } catch {
      return { ok: false, error: "TSPRR_DATABASE_URL is not a valid URL." };
    }

    const client = new Client({
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 5432,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(LEADING_SLASH_RE, "") || "postgres",
      ssl: { rejectUnauthorized: false },
    });
    const tables: { name: string; rows: number | null; error?: string }[] = [];
    try {
      await client.connect();
      await client.query("SELECT 1");
      for (const table of HEALTHCHECK_TABLES) {
        try {
          const res = await client.query<{ count: string }>(
            `SELECT count(*)::text AS count FROM public.${table}`
          );
          tables.push({
            name: table,
            rows: Number(res.rows[0]?.count ?? 0),
          });
        } catch (err) {
          tables.push({
            name: table,
            rows: null,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - started,
        tables,
      };
    } finally {
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
    return { ok: true, durationMs: Date.now() - started, tables };
  },
});

function derivePrimaryRole(args: {
  tenantId: string | null;
  prospectId: string | null;
  contact: Json | null;
}): string {
  if (args.tenantId) {
    return "tenant";
  }
  if (args.prospectId) {
    return "prospect";
  }
  if (args.contact) {
    return (args.contact.contact_type as string) ?? "contact";
  }
  return "unknown";
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: orchestrates the multi-table TSP-RR pull; splitting per source would just shuffle the control flow without making it clearer.
async function tsprrSyncCore(
  client: Client,
  email: string,
  out: SyncItem[]
): Promise<void> {
  // 1. Find the contact by email (case-insensitive).
  const contactRes = await client.query<Json>(
    "SELECT * FROM public.contacts WHERE lower(email) = lower($1) LIMIT 1",
    [email]
  );
  const contact = contactRes.rows[0] ?? null;

  // Also look up prospect_personal_details by email — handles prospects that
  // haven't been promoted to a contacts row.
  const pdRes = await client.query<Json>(
    `SELECT * FROM public.prospect_personal_details
     WHERE lower(email) = lower($1)
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
     LIMIT 1`,
    [email]
  );
  const pd = pdRes.rows[0] ?? null;

  // Determine primary role + IDs we'll need.
  const tenantId: string | null = (contact?.tenant_id as string) ?? null;
  let accountId: string | null = (contact?.account_id as string) ?? null;
  const prospectId: string | null =
    (contact?.prospect_id as string) ?? (pd?.prospect_id as string) ?? null;

  const primaryRole = derivePrimaryRole({ tenantId, prospectId, contact });

  if (contact) {
    out.push(buildContactItem(email, contact, primaryRole));
  }

  // 2. Tenant chain.
  let tenant: Json | null = null;
  let unit: Json | null = null;
  let building: Json | null = null;
  if (tenantId) {
    const tRes = await client.query<Json>(
      "SELECT * FROM public.tenants WHERE id = $1 LIMIT 1",
      [tenantId]
    );
    tenant = tRes.rows[0] ?? null;
    if (tenant && !accountId && tenant.account_id) {
      accountId = tenant.account_id as string;
    }

    // Pull current unit assignment (latest unit_tenants row, or tenant.unit_id).
    const unitIdCandidate =
      (tenant?.unit_id as string | undefined) ?? undefined;
    if (unitIdCandidate) {
      const uRes = await client.query<Json>(
        `SELECT u.*, b.building_name AS building_name_join
         FROM public.units u
         LEFT JOIN public.buildings b ON b.id = u.building_id
         WHERE u.id = $1
         LIMIT 1`,
        [unitIdCandidate]
      );
      unit = uRes.rows[0] ?? null;
      if (unit?.building_id) {
        const bRes = await client.query<Json>(
          "SELECT * FROM public.buildings WHERE id = $1 LIMIT 1",
          [unit.building_id]
        );
        building = bRes.rows[0] ?? null;
      }
    }

    if (tenant) {
      out.push(buildTenantItem(email, tenant, unit, building));
    }
  }

  // 3. Account + balance + payments + ledger.
  if (accountId) {
    const [aRes, balRes, payRes, ledRes] = await Promise.all([
      client.query<Json>(
        "SELECT * FROM public.accounts WHERE id = $1 LIMIT 1",
        [accountId]
      ),
      client.query<Json>(
        `SELECT balance FROM public.canonical_account_balances
         WHERE account_id = $1 LIMIT 1`,
        [accountId]
      ),
      client.query<Json>(
        `SELECT * FROM public.payments
         WHERE account_id = $1
         ORDER BY date DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT $2`,
        [accountId, MAX_PAYMENTS]
      ),
      client.query<Json>(
        `SELECT * FROM public.ledger_transactions
         WHERE account_id = $1
         ORDER BY transaction_date DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT $2`,
        [accountId, MAX_LEDGER]
      ),
    ]);
    const account = aRes.rows[0] ?? null;
    const balance =
      balRes.rows[0]?.balance != null ? Number(balRes.rows[0].balance) : null;
    if (account) {
      out.push(buildAccountItem(email, account, balance));
    }
    for (const p of payRes.rows) {
      out.push(buildPaymentItem(email, p));
    }
    for (const l of ledRes.rows) {
      out.push(buildLedgerItem(email, l));
    }
  }

  // 4. Maintenance tickets — by tenant_id OR by contact_email.
  const ticketRes = await client.query<Json>(
    `SELECT * FROM public.maintenance_tickets
     WHERE (tenant_id = $1 OR lower(contact_email) = lower($2))
     ORDER BY created_at DESC
     LIMIT $3`,
    [tenantId, email, MAX_TICKETS]
  );
  if (ticketRes.rows.length > 0) {
    const ticketIds = ticketRes.rows.map((t) => t.id);
    const notesRes = await client.query<Json>(
      `SELECT * FROM public.maintenance_notes
       WHERE ticket_id = ANY($1::uuid[])
       ORDER BY created_at DESC`,
      [ticketIds]
    );
    const notesByTicket = new Map<string, Json[]>();
    for (const n of notesRes.rows) {
      const id = String(n.ticket_id);
      const arr = notesByTicket.get(id) ?? [];
      if (arr.length < MAX_NOTES_PER_TICKET) {
        arr.push(n);
      }
      notesByTicket.set(id, arr);
    }
    for (const t of ticketRes.rows) {
      out.push(
        buildTicketItem(email, t, notesByTicket.get(String(t.id)) ?? [])
      );
    }
  }

  // 5. Prospect details.
  if (prospectId) {
    const [pRes, pdRes2, dtRes] = await Promise.all([
      client.query<Json>(
        "SELECT * FROM public.prospects WHERE id = $1 LIMIT 1",
        [prospectId]
      ),
      pd
        ? Promise.resolve({ rows: [pd] } as { rows: Json[] })
        : client.query<Json>(
            `SELECT * FROM public.prospect_personal_details
             WHERE prospect_id = $1
             ORDER BY is_primary_applicant DESC, updated_at DESC NULLS LAST
             LIMIT 1`,
            [prospectId]
          ),
      client.query<Json>(
        `SELECT * FROM public.prospect_document_tracker
         WHERE prospect_id = $1
         ORDER BY updated_at DESC NULLS LAST
         LIMIT 1`,
        [prospectId]
      ),
    ]);
    const prospect = pRes.rows[0] ?? null;
    const personalDetails = pdRes2.rows[0] ?? null;
    const docTracker = dtRes.rows[0] ?? null;
    if (prospect) {
      out.push(buildProspectItem(email, prospect, personalDetails, docTracker));
    }
  }

  // 6. Termination notices + parking requests — by tenant_id or account_id.
  if (tenantId || accountId) {
    const [termRes, parkRes] = await Promise.all([
      client.query<Json>(
        `SELECT * FROM public.termination_notices
         WHERE tenant_id = $1 OR account_id = $2
         ORDER BY notice_date DESC NULLS LAST, created_at DESC NULLS LAST
         LIMIT 5`,
        [tenantId, accountId]
      ),
      client.query<Json>(
        `SELECT * FROM public.parking_requests
         WHERE tenant_id = $1 OR account_id = $2
         ORDER BY created_at DESC NULLS LAST
         LIMIT 5`,
        [tenantId, accountId]
      ),
    ]);
    for (const n of termRes.rows) {
      out.push(buildTerminationItem(email, n));
    }
    for (const p of parkRes.rows) {
      out.push(buildParkingItem(email, p));
    }
  }
}
