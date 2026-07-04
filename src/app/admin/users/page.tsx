import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { desc, eq } from "drizzle-orm";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getServerUser } from "@/lib/auth/server";
import { sendEmail } from "@/lib/mail/mailer";
import { formatIstDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

async function approveUser(formData: FormData) {
  "use server";

  const admin = await getServerUser();
  if (admin?.role !== "admin") redirect("/");

  const userId = String(formData.get("userId") ?? "");
  const { env } = await getCloudflareContext({ async: true });
  const db = getDb(env);
  const user = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return;

  await db.update(users).set({
    approved: true,
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(users.id, userId));

  if (user.email) {
    await sendEmail({
      to: user.email,
      subject: "SyncX registration approved",
      html: `<p>Your SyncX registration is approved.</p><p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://syncx.tanishmajumdar2912.workers.dev"}">Open SyncX</a></p>`,
    }, env);
  }

  revalidatePath("/admin/users");
}

export default async function AdminUsersPage() {
  const admin = await getServerUser();
  if (admin?.role !== "admin") redirect("/");

  const { env } = await getCloudflareContext({ async: true });
  const rows = await getDb(env)
    .select()
    .from(users)
    .orderBy(desc(users.createdAt))
    .all();

  return (
    <div className="container max-w-4xl py-10 animate-fade-in">
      <div className="mb-8 space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Approve new SyncX registrations.</p>
      </div>

      <div className="grid gap-3">
        {rows.map((user) => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">{user.email ?? user.id}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Requested {user.accessRequestedAt ? formatIstDateTime(user.accessRequestedAt) : "before approval tracking"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.approved ? "success" : "secondary"}>
                  {user.approved ? "Approved" : "Pending"}
                </Badge>
                {user.role === "admin" && <Badge variant="outline">Admin</Badge>}
              </div>
            </CardHeader>
            {!user.approved && (
              <CardContent>
                <form action={approveUser}>
                  <input type="hidden" name="userId" value={user.id} />
                  <Button size="sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Approve
                  </Button>
                </form>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
