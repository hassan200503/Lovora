import "server-only";

export type Mail = { to: string; subject: string; text: string; html: string };
export type MailResult = { id: string | null; provider: string };

type Provider = "resend" | "brevo" | "console";

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email delivery is not configured");
    this.name = "EmailNotConfiguredError";
  }
}

export class EmailDeliveryError extends Error {
  constructor(
    public readonly provider: Provider,
    public readonly status?: number,
  ) {
    super(`Email delivery failed (${provider}${status ? ` ${status}` : ""})`);
    this.name = "EmailDeliveryError";
  }
}

/**
 * EMAIL_PROVIDER picks a provider explicitly. When unset, whichever API key is
 * present wins. Without credentials, development logs the message instead of
 * sending it; production refuses and the UI falls back to the recovery code.
 */
function activeProvider(): Provider | null {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === "resend" || explicit === "brevo") return explicit;
  if (explicit === "console") return process.env.NODE_ENV === "production" ? null : "console";
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.BREVO_API_KEY) return "brevo";
  if (process.env.NODE_ENV !== "production") return "console";
  return null;
}

type Address = { name: string; email: string };

/** Accepts "Name <you@example.com>" or a bare address. */
function fromAddress(): Address | null {
  const raw = process.env.EMAIL_FROM?.trim();
  if (raw) {
    const match = raw.match(/^(.*?)\s*<([^<>]+)>$/);
    if (match) return { name: match[1].replace(/^"|"$/g, "").trim() || "Lovora", email: match[2].trim() };
    return { name: process.env.EMAIL_FROM_NAME?.trim() || "Lovora", email: raw };
  }
  if (process.env.EMAIL_PROVIDER?.trim().toLowerCase() === "console" || process.env.NODE_ENV !== "production") {
    return { name: process.env.EMAIL_FROM_NAME?.trim() || "Lovora", email: "onboarding@resend.dev" };
  }
  return null;
}

export function emailConfigured(): boolean {
  const provider = activeProvider();
  if (!provider || !fromAddress()) return false;
  if (provider === "console") return true;
  return Boolean(provider === "resend" ? process.env.RESEND_API_KEY : process.env.BREVO_API_KEY);
}

export async function sendMail(mail: Mail): Promise<MailResult> {
  const provider = activeProvider();
  const from = fromAddress();
  if (!provider || !from) throw new EmailNotConfiguredError();

  if (provider === "console") {
    console.info(`[email:console] to=${mail.to} subject=${mail.subject}\n${mail.text}`);
    return { id: null, provider };
  }

  const apiKey = provider === "resend" ? process.env.RESEND_API_KEY : process.env.BREVO_API_KEY;
  if (!apiKey) throw new EmailNotConfiguredError();

  const endpoint = provider === "resend" ? "https://api.resend.com/emails" : "https://api.brevo.com/v3/smtp/email";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (provider === "resend") headers.authorization = `Bearer ${apiKey}`;
  else headers["api-key"] = apiKey;

  const body =
    provider === "resend"
      ? { from: `${from.name} <${from.email}>`, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }
      : {
          sender: { name: from.name, email: from.email },
          to: [{ email: mail.to }],
          subject: mail.subject,
          htmlContent: mail.html,
          textContent: mail.text,
        };

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new EmailDeliveryError(provider);
  }

  if (!res.ok) throw new EmailDeliveryError(provider, res.status);

  let id: string | null = null;
  try {
    const data = (await res.json()) as { id?: unknown; messageId?: unknown };
    if (typeof data.id === "string") id = data.id;
    else if (typeof data.messageId === "string") id = data.messageId;
  } catch {
    // A 2xx without a JSON body still means the provider accepted the message.
  }
  return { id, provider };
}
