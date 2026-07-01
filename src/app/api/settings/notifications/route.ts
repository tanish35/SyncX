import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function PATCH(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const { notifyEmails, notificationEmail } = (await request.json()) as {
      notifyEmails?: boolean;
      notificationEmail?: string | null;
    };

    if (notifyEmails !== undefined && typeof notifyEmails !== "boolean") {
      return NextResponse.json(
        { error: "notifyEmails must be a boolean" },
        { status: 400 },
      );
    }
    if (notificationEmail !== undefined && notificationEmail !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    const env = getEnv();
    const db = getDb(env);

    await db
      .update(users)
      .set({
        ...(notifyEmails !== undefined ? { notifyEmails } : {}),
        ...(notificationEmail !== undefined ? { notificationEmail: notificationEmail || null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update notifications error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
