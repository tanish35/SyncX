import { redirect } from "next/navigation";
import Link from "next/link";
import { Zap, Settings, ArrowRight, MonitorPlay, BellPlus, CalendarDays } from "lucide-react";
import SyncButton from "./sync-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";
import { formatIstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getServerUser();
  if (!user) redirect("/");
  const lastSync = user.lastSyncAt ? formatIstDateTime(user.lastSyncAt) : "Never";

  const quickLinks = [
    { href: "/currently-watching", icon: MonitorPlay, title: "Currently Watching", desc: "See your saved timestamp" },
    { href: "/track", icon: BellPlus, title: "Track Series", desc: "Add release emails" },
    { href: "/calendar", icon: CalendarDays, title: "Calendar", desc: "Upcoming releases" },
    { href: "/settings", icon: Settings, title: "Settings", desc: "Notifications & account" },
    { href: "/stremio/configure", icon: Zap, title: "Stremio Add-on", desc: "Install & configure" },
  ];

  return (
    <div className="container max-w-3xl py-12 animate-fade-in">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Manage your connected providers and sync progress.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Stremio</CardTitle>
            {user.stremioConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Disconnected</Badge>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Primary watch progress source via Stremio add-on.</p>
            <Button asChild variant="outline" size="sm"><Link href="/stremio/configure">Configure <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Nuvio</CardTitle>
            {user.nuvioConnected ? <Badge variant="success">Connected</Badge> : <Badge variant="secondary">Disconnected</Badge>}
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Secondary sync target for Nuvio progress.</p>
            <Button asChild variant="outline" size="sm"><Link href="/nuvio/configure">Configure <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Sync Status</CardTitle>
            <CardDescription className="mt-1">Last synced: <span className="text-foreground">{lastSync}</span></CardDescription>
          </div>
          <SyncButton />
        </CardHeader>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-5">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href} className="group">
            <Card className="h-full transition-colors hover:border-primary/40">
              <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <link.icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">{link.title}</p>
                <p className="text-xs text-muted-foreground">{link.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
