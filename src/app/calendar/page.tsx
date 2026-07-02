import { redirect } from "next/navigation";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, asc, eq, gte } from "drizzle-orm";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getServerUser } from "@/lib/auth/server";
import { getDb } from "@/lib/db";
import { media, notifications } from "@/lib/db/schema";
import { formatIstDay, formatIstTime } from "@/lib/time";
import CheckReleasesButton from "./check-releases-button";

export const dynamic = "force-dynamic";

function episodeLabel(season: number | null, episode: number | null) {
  if (season === null || episode === null) return "Episode";
  return `S${season} E${episode}`;
}

function dayKey(date: Date) {
  return formatIstDay(date);
}

export default async function CalendarPage() {
  const user = await getServerUser();
  if (!user) redirect("/");

  const db = getDb(getCloudflareContext().env as CloudflareEnv);
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      notification: notifications,
      item: media,
    })
    .from(notifications)
    .innerJoin(media, eq(notifications.mediaId, media.id))
    .where(and(eq(notifications.userId, user.userId), gte(notifications.airDate, cutoff)))
    .orderBy(asc(notifications.airDate))
    .all();

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.notification.airDate ? dayKey(row.notification.airDate) : "TBA";
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return (
    <div className="container max-w-4xl py-10 animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-primary">
            <CalendarDays className="h-4 w-4" />
            <span className="font-medium">Release Calendar</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Upcoming episodes</h1>
          <p className="text-muted-foreground">Future releases for currently watching and tracked series.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CheckReleasesButton />
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No upcoming releases yet</p>
            <p className="text-sm text-muted-foreground">Click Check releases to scan tracked series for announced episodes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([date, items]) => (
            <section key={date} className="grid gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight">{date}</h2>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              {items.map(({ notification, item }) => (
                <Card key={notification.id}>
                  <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-semibold">{item.title ?? item.imdbId ?? "Untitled"}</h3>
                        <Badge variant="outline">{episodeLabel(notification.season, notification.episode)}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.title ?? "Untitled episode"}</p>
                    </div>
                    <div className="text-sm text-muted-foreground sm:text-right">
                      {notification.airDate ? formatIstTime(notification.airDate) : "TBA"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
