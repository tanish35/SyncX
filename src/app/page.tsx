"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Zap, Mail, Key, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/spinner";
import { cn } from "@/lib/utils";

type LoginMethod = "credentials" | "authkey";

export default function HomePage() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authKey, setAuthKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const body = method === "authkey" ? { authKey: authKey.trim() } : { email: email.trim(), password };
      const res = await fetch("/api/auth/stremio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Login failed. Please try again.");
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 animate-slide-up">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <RefreshCw className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Sync<span className="text-primary">X</span></h1>
          <p className="text-muted-foreground">Sync watch progress between Stremio and Nuvio</p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
            <Zap className="h-6 w-6 text-primary" />
            <p className="text-sm text-foreground">Install the SyncX add-on in Stremio to get started</p>
            <Button asChild className="w-full">
              <a href="stremio:
            </Button>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-3 text-muted-foreground">or sign in manually</span></div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Sign in with Stremio</CardTitle>
            <CardDescription>Connect your Stremio account to manage sync settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
              <button type="button" onClick={() => setMethod("credentials")} className={cn("flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all", method === "credentials" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Mail className="h-4 w-4" />Email
              </button>
              <button type="button" onClick={() => setMethod("authkey")} className={cn("flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-all", method === "authkey" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                <Key className="h-4 w-4" />Auth Key
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {method === "credentials" ? (
                <>
                  <div className="space-y-2"><Label htmlFor="email">Stremio Email</Label><Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
                  <div className="space-y-2"><Label htmlFor="password">Stremio Password</Label><Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="authkey">Stremio Auth Key</Label>
                  <Textarea id="authkey" required className="min-h-[80px] resize-y font-mono text-xs" placeholder="Paste your Stremio auth key here…" value={authKey} onChange={(e) => setAuthKey(e.target.value)} />
                  <div className="space-y-1.5 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">How to get your auth key:</p>
                    <ol className="list-decimal space-y-1 pl-4">
                      <li>Open <a href="https:
                      <li>Open the browser console (F12 → Console)</li>
                      <li>Run this command:</li>
                    </ol>
                    <pre className="mt-1.5 overflow-x-auto rounded bg-background/80 p-2 font-mono text-[11px] text-foreground"><code>JSON.parse(localStorage.getItem(&quot;stremio-token&quot;)).authKey</code></pre>
                    <p>Copy the string it returns and paste it above.</p>
                  </div>
                </div>
              )}
              {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
              <Button type="submit" disabled={loading} className="w-full">{loading ? (<><Spinner />Signing in…</>) : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}</Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Already have the add-on? <a href="/stremio/configure" className="text-primary hover:underline">Configure it here</a> · <a href="/nuvio/configure" className="text-primary hover:underline">Connect Nuvio</a>
        </p>
      </div>
    </div>
  );
}
