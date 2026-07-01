import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { getDb } from "@/lib/db";
import { connections } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const VALID_PROVIDERS = new Set(["stremio", "nuvio"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const { provider } = await params;

    if (!VALID_PROVIDERS.has(provider)) {
      return NextResponse.json(
        { error: `Invalid provider: ${provider}` },
        { status: 400 },
      );
    }

    const env = getEnv();
    const db = getDb(env);

    const deleted = await db
      .delete(connections)
      .where(
        and(
          eq(connections.userId, session.userId),
          eq(connections.provider, provider),
        ),
      )
      .returning({ id: connections.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: `No ${provider} connection found` },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Disconnect error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Disconnect failed" },
      { status: 500 },
    );
  }
}
