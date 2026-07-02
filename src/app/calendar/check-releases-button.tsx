"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

export default function CheckReleasesButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function check() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/releases/check", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { notificationsCreated?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Release check failed.");
      setResult({ ok: true, message: `Found ${data.notificationsCreated ?? 0} new release alert(s).` });
      router.refresh();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Release check failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button onClick={check} disabled={loading} size="sm">
        {loading ? <><Spinner />Checking…</> : <><RefreshCw className="h-4 w-4" />Check releases</>}
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
