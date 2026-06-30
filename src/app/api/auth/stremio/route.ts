import { NextRequest, NextResponse } from "next/server";
import { getEnv } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { users, connections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { login, getUser } from "@/lib/stremio/client";
import { createSessionCookie } from "@/lib/auth/session";
import { encryptCredential } from "@/lib/crypto";

export async function POST(request: NextRequest) {
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
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.stremioUserId, stremioUser._id))
      .get();

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await db
        .update(users)
        .set({
          email: stremioUser.email ?? existingUser.email,
          updatedAt: now,
        })
        .where(eq(users.id, userId));
    } else {
      userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        stremioUserId: stremioUser._id,
        email: stremioUser.email,
        notifyEmails: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    const encryptedAuthKey = await encryptCredential(
      { authKey },
      env.CRED_ENC_KEY,
    );

    const existingConn = await db
      .select()
      .from(connections)
      .where(eq(connections.userId, userId))
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
        userId,
        provider: "stremio",
        credentials: encryptedAuthKey,
        createdAt: now,
        updatedAt: now,
      });
    }

    const sessionCookie = await createSessionCookie(
      { userId },
      env.SESSION_SECRET,
    );

    const response = NextResponse.json({
      success: true,
      redirect: "/dashboard",
    });
    response.headers.set("Set-Cookie", sessionCookie);

    return response;
  } catch (err) {
    console.error("Stremio auth error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication failed" },
      { status: 401 },
    );
  }
}