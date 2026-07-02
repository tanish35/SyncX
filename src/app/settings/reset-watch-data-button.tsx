"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function ResetWatchDataButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function reset() {
    if (!window.confirm("Clear your watch database and start tracking from the next pull?")) return;
    setLoading(true);
    setDone(false);
    try {
      const res = await fetch("/api/watch/reset", { method: "POST" });
      if (!res.ok) throw new Error("Reset failed");
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={reset} disabled={loading} variant="destructive">
        {loading ? "Resetting..." : "Reset Watch Data"}
      </Button>
      {done && <p className="text-xs text-muted-foreground">Cleared. Use Pull only to start from active/current items.</p>}
    </div>
  );
}
