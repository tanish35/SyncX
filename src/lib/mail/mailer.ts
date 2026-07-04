import { getEnv } from "@/lib/auth/env";

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail(
  payload: EmailPayload,
  env: CloudflareEnv,
): Promise<{ ok: boolean; error?: string }> {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = getEnv(env);
  const from = payload.from ?? GMAIL_USER;

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.warn(
      `[mailer] GMAIL_USER or GMAIL_APP_PASSWORD not configured; logging email instead.`,
    );
    console.info(`[mailer] TO=${payload.to} SUBJECT="${payload.subject}"`);
    console.info(`[mailer] HTML preview: ${payload.html.slice(0, 200)}…`);
    return { ok: true };
  }

  try {
    const loadMailer = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<typeof import("worker-mailer")>;
    const { WorkerMailer } = await loadMailer("worker-mailer");
    await WorkerMailer.send(
      {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        credentials: {
          username: GMAIL_USER,
          password: GMAIL_APP_PASSWORD,
        },
        authType: "login",
      },
      {
        from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      },
    );

    console.info(`[mailer] Sent email to ${payload.to}: "${payload.subject}"`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[mailer] sendEmail failed: ${msg}`);
    return { ok: false, error: msg };
  }
}
