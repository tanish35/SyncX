"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface Props { stremioConnected: boolean; nuvioConnected: boolean }

export default function DisconnectButtons({ stremioConnected, nuvioConnected }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function disconnect(provider: string) {
    if (!confirm(`Disconnect ${provider}?`)) return;
    setLoading(provider);
    try {
      await fetch(`/api/providers/${provider}/disconnect`, { method: "POST" });
      router.refresh();
    } catch {
      alert(`Failed to disconnect ${provider}.`);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Stremio</span>
          {stremioConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Disconnected</Badge>}
        </div>
        {stremioConnected && <Button onClick={() => disconnect("stremio")} disabled={loading === "stremio"} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" />{loading === "stremio" ? "…" : "Disconnect"}</Button>}
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Nuvio</span>
          {nuvioConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Disconnected</Badge>}
        </div>
        {nuvioConnected && <Button onClick={() => disconnect("nuvio")} disabled={loading === "nuvio"} variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5" />{loading === "nuvio" ? "…" : "Disconnect"}</Button>}
      </div>
    </div>
  );
}
