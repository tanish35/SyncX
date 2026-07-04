import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Activity, CheckCircle2, AlertCircle, Info } from "lucide-react";
import SyncButton from "./sync-button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";
import { formatIstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

interface Props { params: Promise<{ userToken: string }> }

export default async function StremioStatusPage({ params }: Props) {
  const { userToken } = await params;
  const user = await getServerUser();
  if (!user || !user.stremioConnected) notFound();
  const lastSync = user.lastSyncAt ? formatIstDateTime(user.lastSyncAt) : "Never";

  const activity = [
    { label: "Stremio connected", time: "Active", status: "ok" as const },
    ...(user.nuvioConnected ? [{ label: "Nuvio connected", time: "Active", status: "ok" as const }] : [{ label: "Nuvio", time: "Not connected", status: "warn" as const }]),
    { label: "Last sync", time: lastSync, status: "info" as const },
  ];
  const statusIcon = { ok: CheckCircle2, warn: AlertCircle, info: Info };
  const statusColor = { ok: "text-emerald-400", warn: "text-amber-400", info: "text-muted-foreground" };

  return (
    <div className="container max-w-2xl py-12 animate-fade-in">
      <div className="mb-8">
        <p className="mb-1 break-all font-mono text-xs text-muted-foreground">Token: {userToken}</p>
        <h1 className="text-3xl font-bold tracking-tight">Stremio Sync Status</h1>
        <p className="mt-2 text-muted-foreground">Real-time overview of your SyncX add-on status.</p>
      </div>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Overview</CardTitle></div>
          <Badge variant="success">Active</Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Last Sync</p><p className="mt-1 font-medium">{lastSync}</p></div>
            <div><p className="text-muted-foreground">Connected Providers</p><p className="mt-1 font-medium">Stremio{user.nuvioConnected ? ", Nuvio" : ""}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-lg">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {activity.map((item, i) => { const Icon = statusIcon[item.status]; return (
              <div key={i} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                <span className="text-sm">{item.label}</span>
                <span className={cn("flex items-center gap-1.5 text-xs", statusColor[item.status])}><Icon className="h-3.5 w-3.5" />{item.time}</span>
              </div>
            ); })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Dashboard</Link></Button>
        <SyncButton />
      </div>
    </div>
  );
}
