"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

type SyncCronMode = "sync" | "pull";

export default function SyncCronToggle({ enabled: initialEnabled, mode: initialMode }: { enabled: boolean; mode: SyncCronMode }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [mode, setMode] = useState<SyncCronMode>(initialMode);
  const [saving, setSaving] = useState(false);

  async function save(nextEnabled: boolean, nextMode: SyncCronMode) {
    const previousEnabled = enabled;
    const previousMode = mode;

    setEnabled(nextEnabled);
    setMode(nextMode);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sync-cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCronEnabled: nextEnabled, syncCronMode: nextMode }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      setEnabled(previousEnabled);
      setMode(previousMode);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Automatic sync cron</p>
        <p className="text-xs text-muted-foreground">Run background Stremio/Nuvio sync every 5 minutes.</p>
      </div>
      <div className="flex items-center gap-3">
        <select
          value={mode}
          onChange={(event) => save(enabled, event.target.value as SyncCronMode)}
          disabled={saving || !enabled}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="sync">Pull and push</option>
          <option value="pull">Pull only</option>
        </select>
        <Switch checked={enabled} onCheckedChange={(next) => save(next, mode)} disabled={saving} />
      </div>
    </div>
  );
}
