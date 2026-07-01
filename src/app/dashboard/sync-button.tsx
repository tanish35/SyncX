"use client";

import { useState } from "react";
import { Download, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

const MAX_STEPS = 500;

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function run(mode: "sync" | "pull") {
    setLoading(true);
    setResult(null);
    setProgress(0);
    try {
      let cursor: unknown = null;
      for (let i = 0; i < MAX_STEPS; i++) {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor, mode }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "Sync failed.");
        }
        const data = (await res.json()) as {
          done: boolean;
          progress: number;
          cursor: unknown;
          stats: { stremioPulled: number; nuvioPulled: number; stremioPushed: number; nuvioPushed: number };
        };
        cursor = data.cursor;
        setProgress(data.progress);
        if (data.done) {
          const { stremioPulled, nuvioPulled, stremioPushed, nuvioPushed } = data.stats;
          setResult({
            ok: true,
            message: mode === "pull"
              ? `Pull complete — fetched ${stremioPulled + nuvioPulled}. Open Currently Watching to see them.`
              : `Sync complete — pulled ${stremioPulled + nuvioPulled}, pushed ${stremioPushed + nuvioPushed}.`,
          });
          return;
        }
      }
      throw new Error("Sync did not finish (too many batches). Try again.");
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Sync failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={() => run("sync")} disabled={loading} size="lg">
        {loading ? (<><Spinner />Syncing… {Math.round(progress * 100)}%</>) : (<><RefreshCw className="h-4 w-4" />Sync Now</>)}
      </Button>
      <Button onClick={() => run("pull")} disabled={loading} variant="outline" size="sm">
        <Download className="h-4 w-4" />
        Pull only
      </Button>
      {result && (
        <p className={cn("flex items-center gap-1.5 text-xs", result.ok ? "text-emerald-400" : "text-destructive")}>
          {result.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {result.message}
        </p>
      )}
    </div>
  );
}
