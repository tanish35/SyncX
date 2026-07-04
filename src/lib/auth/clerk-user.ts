import { currentUser } from "@clerk/nextjs/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/mail/mailer";

export const ADMIN_EMAIL = "tanishmajumdar2912@gmail.com";

function primaryEmail(user: Awaited<ReturnType<typeof currentUser>>): string | null {
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;
  return email?.toLowerCase() ?? null;
}

async function notifyAdmin(env: CloudflareEnv, userId: string, email: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://syncx.tanishmajumdar2912.workers.dev";
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: "SyncX access request",
    html: `<p>${email} requested access to SyncX.</p><p><a href="${appUrl}/admin/users">Review users</a></p>`,
  }, env);

  await getDb(env)
    .update(users)
    .set({ accessRequestEmailedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getOrCreateClerkUser(env: CloudflareEnv) {
  const clerkUser = await currentUser();
  const email = primaryEmail(clerkUser);
  if (!clerkUser || !email) return null;

  const db = getDb(env);
  const now = new Date();
  const isAdmin = email === ADMIN_EMAIL;

  let user = await db.select().from(users).where(eq(users.clerkUserId, clerkUser.id)).get();

  if (!user) {
    user = await db.select().from(users).where(eq(users.email, email)).get();
  }

  if (!user && isAdmin) {
    user = await db.select().from(users).orderBy(asc(users.createdAt)).limit(1).get();
  }

  if (user) {
    const approved = user.approved || isAdmin;
    await db.update(users).set({
      clerkUserId: clerkUser.id,
      email,
      notificationEmail: user.notificationEmail ?? email,
      approved,
      role: isAdmin ? "admin" : user.role,
      approvedAt: approved ? user.approvedAt ?? now : null,
      updatedAt: now,
    }).where(eq(users.id, user.id));

    return {
      ...user,
      clerkUserId: clerkUser.id,
      email,
      notificationEmail: user.notificationEmail ?? email,
      approved,
      role: isAdmin ? "admin" : user.role,
      approvedAt: approved ? user.approvedAt ?? now : null,
    };
  }

  const userId = crypto.randomUUID();
  await db.insert(users).values({
    id: userId,
    clerkUserId: clerkUser.id,
    email,
    notificationEmail: email,
    approved: isAdmin,
    role: isAdmin ? "admin" : "user",
    accessRequestedAt: now,
    approvedAt: isAdmin ? now : null,
    notifyEmails: true,
    createdAt: now,
    updatedAt: now,
  });

  const created = await db.select().from(users).where(eq(users.id, userId)).get();
  if (created && !isAdmin) await notifyAdmin(env, userId, email);
  return created;
}
