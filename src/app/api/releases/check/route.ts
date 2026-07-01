import { NextRequest, NextResponse } from "next/server";
import { getEnv, requireSession } from "@/lib/api/utils";
import { runReleaseScan } from "@/lib/metadata/release-scan";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;

  try {
    const result = await runReleaseScan(getEnv());
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("Manual release check error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Release check failed" },
      { status: 500 },
    );
  }
}
