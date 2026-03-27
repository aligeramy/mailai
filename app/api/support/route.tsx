import { render } from "@react-email/render";
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import SupportRequestEmail from "@/emails/support-request";
import { SUPPORT_INBOX_EMAIL } from "@/lib/site-config";
import { parseSupportPayload } from "@/lib/support-request";

export const runtime = "nodejs";

function getResendFrom(): string {
  const raw = process.env.RESEND_FROM?.trim();
  if (raw) {
    return raw;
  }
  return "SmartReply <onboarding@resend.dev>";
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Support email is not configured. Set RESEND_API_KEY on the server.",
      },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseSupportPayload(json);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  if (parsed.honeypot.length > 0) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const resend = new Resend(apiKey);
  const from = getResendFrom();

  const subjectLine =
    parsed.subject.length > 0 ? parsed.subject : "General inquiry";
  const mailSubject = `[SmartReply] ${subjectLine}`;

  const origin =
    request.headers.get("origin") ??
    request.headers.get("referer") ??
    "unknown";

  const html = await render(
    <SupportRequestEmail
      email={parsed.email}
      message={parsed.message}
      name={parsed.name}
      origin={origin}
      subjectLine={subjectLine}
      submittedAtIso={new Date().toISOString()}
    />
  );

  const { error } = await resend.emails.send({
    from,
    to: SUPPORT_INBOX_EMAIL,
    replyTo: parsed.email,
    subject: mailSubject,
    html,
  });

  if (error) {
    console.error("[mailai/api] support email send failed", error);
    return NextResponse.json(
      {
        error:
          "Could not send your message. Try again later or email us directly.",
      },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
