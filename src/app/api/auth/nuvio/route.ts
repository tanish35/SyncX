import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { passwordLogin, getProfiles } from "@/lib/nuvio/client";
import { encryptCredential } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const { email, password, profileId } = (await request.json()) as {
      email?: string;
      password?: string;
      profileId?: number;
    };

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const tokens = await passwordLogin(email, password);
    const env = getEnv();

    if (profileId === undefined || profileId === null) {
      const profiles = await getProfiles(tokens.accessToken);
      return NextResponse.json({
        success: true,
        profiles: profiles.map((p) => ({ id: p.profile_id, name: p.profile_name })),
      });
    }

    const db = getDb(env);
    const now = new Date();

    const encryptedCreds = await encryptCredential(
      { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn, profileId },
      env.CRED_ENC_KEY,
    );

    const existingConn = await db
      .select()
      .from(connections)
      .where(and(eq(connections.userId, session.userId), eq(connections.provider, "nuvio")))
      .get();

    if (existingConn) {
      await db.update(connections)
        .set({ credentials: encryptedCreds, metadata: { profileId } as Record<string, unknown>, updatedAt: now })
        .where(eq(connections.id, existingConn.id));
    } else {
      await db.insert(connections).values({
        id: crypto.randomUUID(),
        userId: session.userId,
        provider: "nuvio",
        credentials: encryptedCreds,
        metadata: { profileId } as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Nuvio auth error:", err);
    const msg = err instanceof Error ? err.message : "Nuvio authentication failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }
}
