import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function PATCH(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const { syncCronEnabled } = (await request.json()) as { syncCronEnabled?: boolean };
    if (typeof syncCronEnabled !== "boolean") {
      return NextResponse.json({ error: "syncCronEnabled must be a boolean" }, { status: 400 });
    }

    await getDb(getEnv())
      .update(users)
      .set({ syncCronEnabled, updatedAt: new Date() })
      .where(eq(users.id, session.userId));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update sync cron setting error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 500 });
  }
}
