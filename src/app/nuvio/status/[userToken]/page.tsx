import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";
import { formatIstDateTime } from "@/lib/time";

interface Props { params: Promise<{ userToken: string }> }

export default async function NuvioStatusPage({ params }: Props) {
  const { userToken } = await params;
  const user = await getServerUser();
  if (!user || !user.nuvioConnected) notFound();
  const lastSync = user.lastSyncAt ? formatIstDateTime(user.lastSyncAt) : "Never";

  return (
    <div className="container max-w-2xl py-12 animate-fade-in">
      <p className="mb-1 break-all font-mono text-xs text-muted-foreground">Token: {userToken}</p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">Nuvio Sync Status</h1>
      <p className="mb-8 text-muted-foreground">Overview of your Nuvio connection and sync state.</p>

      <Card className="mb-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle className="text-lg">Connection</CardTitle><Badge variant="success">Connected</Badge></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground">Profile</p><p className="mt-1 font-medium">{user.nuvioProfileId ?? "Default"}</p></div>
            <div><p className="text-muted-foreground">Last Sync</p><p className="mt-1 font-medium">{lastSync}</p></div>
          </div>
        </CardContent>
      </Card>

      <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link></Button>
    </div>
  );
}
