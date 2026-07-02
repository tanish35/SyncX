"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NotificationsToggle({ enabled: initial, email: initialEmail }: { enabled: boolean; email: string }) {
  const [enabled, setEnabled] = useState(initial);
  const [email, setEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);

  async function save(next = enabled) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifyEmails: next, notificationEmail: email.trim() }),
      });
      if (!res.ok) throw new Error("Save failed");
      setEnabled(next);
    } catch {
      setEnabled(enabled);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">Episode release emails</p>
          <p className="text-xs text-muted-foreground">Get emailed when a tracked series has a new episode date.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(next) => save(next)} disabled={saving} />
      </div>
      <div className="flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <Button onClick={() => save()} disabled={saving} variant="outline">Save</Button>
      </div>
    </div>
  );
}
