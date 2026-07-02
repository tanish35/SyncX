import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BellPlus } from "lucide-react";
import TrackSearch from "./track-search";
import { Button } from "@/components/ui/button";
import { getServerUser } from "@/lib/auth/server";

export default async function TrackPage() {
  const user = await getServerUser();
  if (!user) redirect("/");

  return (
    <div className="container max-w-3xl py-10 animate-fade-in">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-primary">
            <BellPlus className="h-4 w-4" />
            <span className="font-medium">Track Series</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Add release tracking</h1>
          <p className="text-muted-foreground">Search a series and mark it watched/tracked for future episode emails.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
        </Button>
      </div>

      <TrackSearch />
    </div>
  );
}
