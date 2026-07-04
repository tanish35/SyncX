import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import StremioLoginForm from "./login-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function StremioConfigurePage() {
  const user = await getServerUser();
  const connected = user?.stremioConnected ?? false;
  const manifestUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://syncx.tanishmajumdar2912.workers.dev"}/stremio/manifest.json`;

  return (
    <div className="container max-w-lg py-12 animate-fade-in">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Stremio Configuration</h1>
        <p className="text-muted-foreground">Connect your Stremio account to enable watch progress sync.</p>
      </div>

      {connected ? (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">Connection Status</CardTitle>
              <Badge variant="success"><CheckCircle2 className="h-3 w-3" />Connected</Badge>
            </CardHeader>
            <CardContent><p className="text-sm text-muted-foreground">Your Stremio account is connected and the SyncX add-on is active.</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Install Add-on</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Click below to open Stremio and install the SyncX add-on.</p>
              <Button asChild className="w-full"><a href={`stremio://${manifestUrl.replace(/^https?:\/\//, "")}`}>Open in Stremio</a></Button>
            </CardContent>
          </Card>
          <Button asChild variant="ghost" size="sm"><Link href="/dashboard"><ArrowLeft className="h-4 w-4" />Back to Dashboard</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Sign in to Stremio</CardTitle><CardDescription>Enter your Stremio credentials to connect.</CardDescription></CardHeader>
            <CardContent><StremioLoginForm /></CardContent>
          </Card>
          <Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="h-4 w-4" />Back to Home</Link></Button>
        </div>
      )}
    </div>
  );
}
