"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";

export default function SyncCronToggle({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/sync-cron", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncCronEnabled: next }),
      });
      if (!res.ok) throw new Error("Save failed");
    } catch {
      setEnabled(!next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <p className="text-sm font-medium">Automatic sync cron</p>
        <p className="text-xs text-muted-foreground">Run background Stremio/Nuvio sync every 5 minutes.</p>
      </div>
      <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
    </div>
  );
}
