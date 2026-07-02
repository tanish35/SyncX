"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

export default function SyncButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function sync() {
    setLoading(true);
    setMsg(null);
    try {
      
      let cursor: unknown = null;
      for (let i = 0; i < 500; i++) {
        const r = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cursor }),
        });
        if (!r.ok) throw new Error("Sync failed");
        const data = (await r.json()) as { done: boolean; cursor: unknown };
        cursor = data.cursor;
        if (data.done) { setOk(true); setMsg("Synced!"); return; }
      }
      throw new Error("Sync did not finish");
    } catch {
      setOk(false); setMsg("Sync failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={sync} disabled={loading}>{loading ? (<><Spinner />Syncing…</>) : (<><RefreshCw className="h-4 w-4" />Sync Now</>)}</Button>
      {msg && (<span className={cn("flex items-center gap-1.5 text-xs", ok ? "text-emerald-400" : "text-destructive")}>{ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{msg}</span>)}
    </div>
  );
}
