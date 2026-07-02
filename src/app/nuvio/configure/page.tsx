"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertCircle, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/spinner";

interface Profile { id: number; name: string }

export default function NuvioConfigurePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/nuvio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const data = (await res.json()) as { error?: string; profiles?: Array<{ id: number; name: string }> };
      if (!res.ok) throw new Error(data.error ?? "Login failed.");
      if (data.profiles?.length) { setProfiles(data.profiles); setSelected(data.profiles[0].id); }
      setAuthed(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong."); }
    finally { setLoading(false); }
  }

  async function handleConnect() {
    if (!selected) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/auth/nuvio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password, profileId: selected }) });
      if (!res.ok) throw new Error("Failed to connect profile.");
      router.push("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Connection failed."); }
    finally { setLoading(false); }
  }

  return (
    <div className="container max-w-lg py-12 animate-fade-in">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Nuvio Configuration</h1>
        <p className="text-muted-foreground">Connect your Nuvio account to sync watch progress.</p>
      </div>

      <Card>
        {!authed ? (
          <>
            <CardHeader><CardTitle className="text-lg">Sign in to Nuvio</CardTitle><CardDescription>Enter your Nuvio credentials.</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
                <Button type="submit" disabled={loading} className="w-full">{loading ? (<><Spinner />Signing in…</>) : (<>Sign in<ArrowRight className="h-4 w-4" /></>)}</Button>
              </form>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader><CardTitle className="text-lg">Select Profile</CardTitle></CardHeader>
            <CardContent>
              {profiles.length > 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="profile"><span className="flex items-center gap-1.5"><UserCircle className="h-4 w-4" />Profile</span></Label>
                    <select id="profile" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={selected} onChange={(e) => setSelected(Number(e.target.value))}>
                      {profiles.map((p) => (<option key={p.id} value={p.id} className="bg-background">{p.name}</option>))}
                    </select>
                  </div>
                  {error && (<Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>)}
                  <Button onClick={handleConnect} disabled={loading || !selected} className="w-full">{loading ? (<><Spinner />Connecting…</>) : (<>Connect Profile<ArrowRight className="h-4 w-4" /></>)}</Button>
                </div>
              ) : (<p className="text-sm text-muted-foreground">No profiles found. Please check your Nuvio account.</p>)}
            </CardContent>
          </>
        )}
      </Card>

      <div className="mt-6"><Button asChild variant="ghost" size="sm"><Link href="/"><ArrowLeft className="h-4 w-4" />Back to Home</Link></Button></div>
    </div>
  );
}
