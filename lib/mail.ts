import { z } from "zod";
import { token, digest } from "./passwords.ts";
export type MailConfig = {
  apiKey: string;
  from: string;
  origin: string;
  testRecipient?: string;
};
export function mailConfiguration(
  values: Record<string, string | undefined>,
): MailConfig | null {
  const {
    RESEND_API_KEY: apiKey,
    MAIL_FROM: from,
    APP_ORIGIN: origin,
  } = values;
  if (!apiKey?.trim() || !from?.trim() || !origin) return null;
  if (/[\r\n]/.test(from) || from.length > 254) return null;
  const address = from.match(/<([^<>]+)>$/)?.[1] || from;
  if (!z.string().email().safeParse(address).success) return null;
  const testRecipient = values.MAIL_TEST_RECIPIENT?.trim().toLowerCase();
  if (testRecipient && !z.string().email().safeParse(testRecipient).success)
    return null;
  if (address.toLowerCase().endsWith("@resend.dev") && !testRecipient)
    return null;
  try {
    const u = new URL(origin);
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.pathname !== "/" ||
      u.search ||
      u.hash
    )
      return null;
    return {
      apiKey,
      from,
      origin: u.origin,
      ...(testRecipient ? { testRecipient } : {}),
    };
  } catch {
    return null;
  }
}
export class MailError extends Error {
  code: string;
  retryable: boolean;
  constructor(code: string, retryable = true) {
    super("Email delivery is temporarily unavailable. Please try again later.");
    this.code = code;
    this.retryable = retryable;
  }
}
export async function sendMail(
  config: MailConfig,
  recipient: string,
  subject: string,
  text: string,
  id: string,
  fetcher: typeof fetch = fetch,
) {
  if (config.testRecipient && recipient.toLowerCase() !== config.testRecipient)
    throw new MailError("owner_test_only", false);
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `rescueloop/${id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [recipient],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(12000),
    });
  } catch {
    throw new MailError("network");
  }
  if (!response.ok)
    throw new MailError(
      `provider_${response.status}`,
      response.status === 429 || response.status >= 500,
    );
  const result = (await response.json()) as { id?: string };
  if (!result.id) throw new MailError("invalid_response");
  return result.id;
}
export async function issueEmailToken(
  db: D1Database,
  userId: string,
  email: string,
  purpose: "verify" | "reset",
  config: MailConfig,
  now = new Date(),
  fetcher: typeof fetch = fetch,
) {
  const raw = token(),
    hash = digest(raw),
    stamp = now.toISOString();
  const result = await db
    .prepare(
      `INSERT INTO rl_email_tokens(hash,userId,purpose,expiresAt,createdAt) VALUES(?,?,?,?,?) ON CONFLICT(userId,purpose) DO UPDATE SET hash=excluded.hash,expiresAt=excluded.expiresAt,createdAt=excluded.createdAt WHERE rl_email_tokens.createdAt<=?`,
    )
    .bind(
      hash,
      userId,
      purpose,
      new Date(
        now.getTime() + (purpose === "verify" ? 86400000 : 1800000),
      ).toISOString(),
      stamp,
      new Date(now.getTime() - 60000).toISOString(),
    )
    .run();
  if (!result.meta.changes) return false;
  const link = `${config.origin}/#${purpose}=${raw}`;
  try {
    await sendMail(
      config,
      email,
      purpose === "verify"
        ? "Verify your RescueLoop email"
        : "Reset your RescueLoop password",
      `${purpose === "verify" ? "Confirm this address to receive RescueLoop updates." : "You requested a password reset for your RescueLoop account."}\n\n${link}\n\nThis link expires in ${purpose === "verify" ? "24 hours" : "30 minutes"} and works once. If you did not request this, ignore this email.`,
      `${purpose}/${hash}`,
      fetcher,
    );
  } catch (error) {
    await db
      .prepare("DELETE FROM rl_email_tokens WHERE hash=?")
      .bind(hash)
      .run();
    throw error;
  }
  return true;
}
type Job = {
  id: string;
  userId: string;
  notificationId: string;
  attempts: number;
  expiresAt: string;
  email: string;
  emailEnabled: number;
  emailVerifiedAt: string | null;
  preferences: string;
  kind: string;
  title: string;
};
export async function drainEmailOutbox(
  db: D1Database,
  config: MailConfig | null,
  now = new Date(),
  fetcher: typeof fetch = fetch,
) {
  if (!config) return { sent: 0, failed: 0 };
  const stamp = now.toISOString();
  await db.batch([
    db
      .prepare(
        "UPDATE rl_email_outbox SET status='failed',lastError='expired',lease=NULL WHERE status IN ('pending','sending') AND (expiresAt<=? OR attempts>=6) AND nextAt<=?",
      )
      .bind(stamp, stamp),
    db.prepare("DELETE FROM rl_email_tokens WHERE expiresAt<=?").bind(stamp),
  ]);
  const jobs = (
    await db
      .prepare(
        `SELECT q.*,a.email,a.emailEnabled,a.emailVerifiedAt,a.preferences,n.kind,n.title FROM rl_email_outbox q JOIN rl_accounts a ON a.id=q.userId JOIN rl_notifications n ON n.id=q.notificationId WHERE q.status IN ('pending','sending') AND q.nextAt<=? AND q.expiresAt>? AND q.attempts<6 ORDER BY q.nextAt LIMIT 10`,
      )
      .bind(stamp, stamp)
      .all<Job>()
  ).results;
  let sent = 0,
    failed = 0;
  const deadline = Date.now() + 18000;
  for (const job of jobs) {
    if (Date.now() > deadline) break;
    const lease = crypto.randomUUID();
    const claim = await db
      .prepare(
        "UPDATE rl_email_outbox SET status='sending',lease=?,attempts=attempts+1,nextAt=? WHERE id=? AND status IN ('pending','sending') AND nextAt<=? AND expiresAt>?",
      )
      .bind(
        lease,
        new Date(now.getTime() + 60000).toISOString(),
        job.id,
        stamp,
        stamp,
      )
      .run();
    if (!claim.meta.changes) continue;
    const fresh = await db
      .prepare(
        "SELECT a.emailEnabled,a.emailVerifiedAt,a.preferences FROM rl_accounts a JOIN rl_email_outbox q ON q.userId=a.id WHERE q.id=? AND q.lease=?",
      )
      .bind(job.id, lease)
      .first<{
        emailEnabled: number;
        emailVerifiedAt: string | null;
        preferences: string;
      }>();
    if (!fresh) continue;
    if (
      !fresh.emailEnabled ||
      !fresh.emailVerifiedAt ||
      JSON.parse(fresh.preferences)[job.kind] === false
    ) {
      await db
        .prepare(
          "UPDATE rl_email_outbox SET status='cancelled',lease=NULL WHERE id=? AND lease=?",
        )
        .bind(job.id, lease)
        .run();
      continue;
    }
    try {
      const providerId = await sendMail(
        config,
        job.email,
        `RescueLoop: ${job.title}`,
        "There is a new update in your RescueLoop workspace. Sign in to view the details and respond.\n\n" +
          config.origin +
          "\n\nManage email and notification preferences under Notifications in RescueLoop.",
        `notification/${job.id}`,
        fetcher,
      );
      await db
        .prepare(
          "UPDATE rl_email_outbox SET status='sent',sentAt=?,providerId=?,lease=NULL,lastError=NULL WHERE id=? AND lease=?",
        )
        .bind(stamp, providerId, job.id, lease)
        .run();
      sent++;
    } catch (error) {
      const failure =
        error instanceof MailError ? error : new MailError("unexpected");
      const terminal = !failure.retryable || job.attempts + 1 >= 6;
      await db
        .prepare(
          "UPDATE rl_email_outbox SET status=?,nextAt=?,lastError=?,lease=NULL WHERE id=? AND lease=?",
        )
        .bind(
          terminal ? "failed" : "pending",
          new Date(
            now.getTime() + Math.min(1800000, 60000 * 2 ** job.attempts),
          ).toISOString(),
          failure.code,
          job.id,
          lease,
        )
        .run();
      failed++;
    }
  }
  return { sent, failed };
}
