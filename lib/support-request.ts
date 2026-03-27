const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function parseSupportPayload(body: unknown):
  | {
      ok: true;
      name: string;
      email: string;
      subject: string;
      message: string;
      honeypot: string;
    }
  | {
      ok: false;
      error: string;
    } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid payload." };
  }
  const o = body as Record<string, unknown>;

  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const subject = typeof o.subject === "string" ? o.subject.trim() : "";
  const message = typeof o.message === "string" ? o.message.trim() : "";
  const honeypot = typeof o.company === "string" ? o.company : "";

  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: "Please enter your name (max 120 characters)." };
  }
  if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (subject.length > 200) {
    return { ok: false, error: "Subject is too long (max 200 characters)." };
  }
  if (message.length < 10 || message.length > 8000) {
    return {
      ok: false,
      error: "Please enter a message between 10 and 8,000 characters.",
    };
  }

  return {
    ok: true,
    name,
    email,
    subject,
    message,
    honeypot,
  };
}
