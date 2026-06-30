import { eq, and, isNull, lte } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/lib/db/index";
import { notifications, users, media } from "@/lib/db/schema";
import { sendEmail } from "./mailer";
import { formatIstDateTime } from "@/lib/time";



interface NotificationDigest {
  mediaTitle: string;
  season: number | null;
  episode: number | null;
  title: string | null;
  airDate: Date | null;
  notificationId: string;
}

interface UserDigest {
  userId: string;
  email: string;
  notifications: NotificationDigest[];
}

interface TickResult {
  usersProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  notificationsMarked: number;
}



export async function runNotifyTick(env: CloudflareEnv): Promise<TickResult> {
  const db = getDb(env);
  const result: TickResult = {
    usersProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    notificationsMarked: 0,
  };

  
  
  const pending = await db
    .select({
      notificationId: notifications.id,
      userId: notifications.userId,
      mediaId: notifications.mediaId,
      season: notifications.season,
      episode: notifications.episode,
      title: notifications.title,
      airDate: notifications.airDate,
      userEmail: users.notificationEmail,
      fallbackEmail: users.email,
      mediaTitle: media.title,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .innerJoin(media, eq(notifications.mediaId, media.id))
    .where(
      and(
        isNull(notifications.emailedAt),
        lte(notifications.airDate, new Date()),
        eq(users.notifyEmails, true),
      ),
    );

  if (pending.length === 0) {
    console.log("[notify-tick] No pending notifications");
    return result;
  }

  
  const grouped = new Map<string, UserDigest>();

  for (const row of pending) {
    const email = row.userEmail ?? row.fallbackEmail;
    if (!email) continue; 

    let digest = grouped.get(row.userId);
    if (!digest) {
      digest = { userId: row.userId, email, notifications: [] };
      grouped.set(row.userId, digest);
    }
    digest.notifications.push({
      mediaTitle: row.mediaTitle ?? "Unknown Show",
      season: row.season,
      episode: row.episode,
      title: row.title,
      airDate: row.airDate,
      notificationId: row.notificationId,
    });
  }

  result.usersProcessed = grouped.size;
  console.log(`[notify-tick] Processing digests for ${grouped.size} users`);

  for (const [userId, digest] of grouped) {
    try {
      const subject = buildSubject(digest.notifications);
      const html = buildEmailHtml(digest.notifications);

      const sendResult = await sendEmail(
        { to: digest.email, subject, html },
        env,
      );

      if (sendResult.ok) {
        
        const now = new Date();
        const ids = digest.notifications.map((n) => n.notificationId);

        
        const stmts = ids.map((id) =>
          db
            .update(notifications)
            .set({ emailedAt: now })
            .where(eq(notifications.id, id)),
        );

        
        for (let i = 0; i < stmts.length; i += 100) {
          const chunk = stmts.slice(i, i + 100) as unknown as [
            BatchItem<"sqlite">,
            ...BatchItem<"sqlite">[],
          ];
          await db.batch(chunk);
        }

        result.emailsSent++;
        result.notificationsMarked += ids.length;
      } else {
        
        console.error(
          `[notify-tick] Failed to email ${digest.email}: ${sendResult.error}`,
        );
        result.emailsFailed++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notify-tick] Error emailing user ${userId}: ${msg}`);
      result.emailsFailed++;
    }
  }

  console.log(
    `[notify-tick] Done: ${result.emailsSent} sent, ` +
      `${result.emailsFailed} failed, ${result.notificationsMarked} marked`,
  );

  return result;
}



function buildSubject(items: NotificationDigest[]): string {
  if (items.length === 1) {
    const n = items[0];
    return `New episode: ${n.mediaTitle} S${pad(n.season)}E${pad(n.episode)}`;
  }
  const first = items[0];
  return `${items.length} new episodes — ${first.mediaTitle} and more`;
}

function buildEmailHtml(items: NotificationDigest[]): string {
  const rows = items
    .sort((a, b) => {
      
      const da = a.airDate?.getTime() ?? 0;
      const db = b.airDate?.getTime() ?? 0;
      return db - da;
    })
    .map((n) => {
      const ep = `S${pad(n.season)}E${pad(n.episode)}`;
      const dateStr = n.airDate ? formatIstDateTime(n.airDate) : "TBA";
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #eee;">
            <strong style="color:#1a1a1a;font-size:15px;">${esc(n.mediaTitle)}</strong>
            <br/>
            <span style="color:#666;font-size:13px;">${ep}${n.title ? ` — ${esc(n.title)}` : ""}</span>
            <br/>
            <span style="color:#999;font-size:12px;">Released ${dateStr}</span>
          </td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:20px 24px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600;">SyncX</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,.85);font-size:13px;">New episodes are out!</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${rows}
    </table>
    <div style="padding:16px 24px;text-align:center;">
      <a href="https:
    </div>
    <div style="padding:12px 24px;text-align:center;border-top:1px solid #eee;">
      <p style="margin:0;color:#999;font-size:11px;">
        You're receiving this because you enabled email notifications in SyncX.
        <a href="https:
      </p>
    </div>
  </div>
</body>
</html>`;
}

function pad(n: number | null | undefined): string {
  if (n == null) return "??";
  return n.toString().padStart(2, "0");
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
