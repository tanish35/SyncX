"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/spinner";

type Result = {
  tvmazeId: number;
  imdbId: string | null;
  title: string;
  year: number | null;
  status: string | null;
  posterUrl: string | null;
  summary: string | null;
};

export default function TrackSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracked, setTracked] = useState<Record<number, boolean>>({});

  async function search(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/track/search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { results: Result[] };
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }

  async function track(result: Result) {
    const res = await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    if (res.ok) setTracked((state) => ({ ...state, [result.tvmazeId]: true }));
  }

  return (
    <div className="space-y-5">
      <form onSubmit={search} className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search series by title" />
        <Button type="submit" disabled={loading}>
          {loading ? <Spinner /> : <Search className="h-4 w-4" />}
          Search
        </Button>
      </form>

      <div className="grid gap-3">
        {results.map((result) => (
          <Card key={result.tvmazeId}>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-[4.5rem_1fr_auto] sm:items-center">
              <div className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-md bg-muted">
                {result.posterUrl ? (
                  
                  <img src={result.posterUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Search className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-base font-semibold">{result.title}</h2>
                  {result.year && <Badge variant="outline">{result.year}</Badge>}
                  {result.status && <Badge variant="secondary">{result.status}</Badge>}
                </div>
                {result.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{result.summary}</p>}
              </div>
              <Button onClick={() => track(result)} disabled={tracked[result.tvmazeId]} variant={tracked[result.tvmazeId] ? "outline" : "default"}>
                {tracked[result.tvmazeId] ? <CheckCircle2 className="h-4 w-4" /> : null}
                {tracked[result.tvmazeId] ? "Tracked" : "Track"}
              </Button>
            </CardContent>
          </Card>
        ))}
        {!loading && query && results.length === 0 && <p className="text-sm text-muted-foreground">No results yet.</p>}
      </div>
    </div>
  );
}
