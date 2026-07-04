import { redirect } from "next/navigation";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { RefreshCw, ShieldCheck, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrCreateClerkUser } from "@/lib/auth/clerk-user";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { env } = await getCloudflareContext({ async: true });
  const user = await getOrCreateClerkUser(env);
  if (user?.approved) redirect("/dashboard");

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-slide-up">
        <div className="space-y-3 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <RefreshCw className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Sync<span className="text-primary">X</span></h1>
          <p className="text-muted-foreground">Sync watch progress between Stremio and Nuvio.</p>
        </div>

        {user ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="h-5 w-5 text-primary" />
                Access pending
              </CardTitle>
              <CardDescription>
                Your request has been sent. You will get an email when registration is approved.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Sign in to request access
              </CardTitle>
              <CardDescription>Use Google. An admin must approve your account before you can use SyncX.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <SignUpButton mode="modal">
                <Button className="w-full">Sign up with Google</Button>
              </SignUpButton>
              <SignInButton mode="modal">
                <Button variant="outline" className="w-full">Sign in</Button>
              </SignInButton>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
