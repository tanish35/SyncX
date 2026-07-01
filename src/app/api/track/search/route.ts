import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api/utils";
import { searchShows } from "@/lib/metadata/tvmaze";

function stripHtml(value: string | null | undefined) {
  return value?.replace(/<[^>]*>/g, "").trim() ?? null;
}

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ("error" in auth) return auth.error;

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const results = await searchShows(q);
  return NextResponse.json({
    results: results.slice(0, 10).map(({ show }) => ({
      tvmazeId: show.id,
      imdbId: show.externals.imdb,
      title: show.name,
      year: show.premiered ? Number(show.premiered.slice(0, 4)) : null,
      status: show.status,
      posterUrl: show.image?.medium ?? show.image?.original ?? null,
      summary: stripHtml(show.summary),
    })),
  });
}
