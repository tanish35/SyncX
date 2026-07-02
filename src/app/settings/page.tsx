import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Bell, Link2, AlertTriangle } from "lucide-react";
import NotificationsToggle from "./notifications-toggle";
import DisconnectButtons from "./disconnect-buttons";
import ResetWatchDataButton from "./reset-watch-data-button";
import SyncCronToggle from "./sync-cron-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";

export default async function SettingsPage() {
  const user = await getServerUser();
  if (!user) redirect("/");

  return (
    <div className="container max-w-2xl py-12 animate-fade-in">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences and connected providers.</p>
      </div>

      <Card className="mb-4">
        <CardHeader><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Notifications</CardTitle></div></CardHeader>
        <CardContent><NotificationsToggle enabled={user.notifyEmails} email={user.notificationEmail ?? user.email ?? ""} /></CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Automation</CardTitle></div></CardHeader>
        <CardContent><SyncCronToggle enabled={user.syncCronEnabled} /></CardContent>
      </Card>

      <Card className="mb-4">
        <CardHeader><div className="flex items-center gap-2"><Link2 className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Connected Providers</CardTitle></div></CardHeader>
        <CardContent><DisconnectButtons stremioConnected={user.stremioConnected} nuvioConnected={user.nuvioConnected} /></CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /><CardTitle className="text-lg text-destructive">Danger Zone</CardTitle></div></CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">Clear stored watch progress, notifications, push logs, and sync cursors for your account.</p>
          <ResetWatchDataButton />
        </CardContent>
      </Card>

      <div className="mt-8">
        <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link></Button>
      </div>
    </div>
  );
}
