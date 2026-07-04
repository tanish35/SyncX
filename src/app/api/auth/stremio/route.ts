import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { users, connections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { login, getUser } from "@/lib/stremio/client";
import { encryptCredential } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const body = await request.json();
    const { email, password, authKey: rawAuthKey } = body as {
      email?: string;
      password?: string;
      authKey?: string;
    };

    const env = getEnv();
    const db = getDb(env);
    let authKey: string;
    let stremioUser: { _id: string; email: string; fullName?: string };

    if (email && password) {
      const result = await login(email, password);
      authKey = result.authKey;
      stremioUser = result.user;
    } else if (rawAuthKey) {
      authKey = rawAuthKey;
      stremioUser = await getUser(rawAuthKey);
    } else {
      return NextResponse.json(
        { error: "Provide email/password or authKey" },
        { status: 400 },
      );
    }

    const now = new Date();
    const existingStremioUser = await db
      .select()
      .from(users)
      .where(eq(users.stremioUserId, stremioUser._id))
      .get();

    if (existingStremioUser && existingStremioUser.id !== session.userId) {
      return NextResponse.json(
        { error: "This Stremio account is already connected to another SyncX user." },
        { status: 409 },
      );
    }

    await db
      .update(users)
      .set({
        stremioUserId: stremioUser._id,
        updatedAt: now,
      })
      .where(eq(users.id, session.userId));

    const encryptedAuthKey = await encryptCredential(
      { authKey },
      env.CRED_ENC_KEY,
    );

    const existingConn = await db
      .select()
      .from(connections)
      .where(eq(connections.userId, session.userId))
      .all()
      .then((rows) => rows.find((c) => c.provider === "stremio"));

    if (existingConn) {
      await db
        .update(connections)
        .set({
          credentials: encryptedAuthKey,
          updatedAt: now,
        })
        .where(eq(connections.id, existingConn.id));
    } else {
      await db.insert(connections).values({
        id: crypto.randomUUID(),
        userId: session.userId,
        provider: "stremio",
        credentials: encryptedAuthKey,
        createdAt: now,
        updatedAt: now,
      });
    }

    return NextResponse.json({
      success: true,
      redirect: "/stremio/configure",
    });
  } catch (err) {
    console.error("Stremio auth error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication failed" },
      { status: 401 },
    );
  }
}
