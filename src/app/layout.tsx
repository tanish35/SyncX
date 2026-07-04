import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: {
    default: "SyncX — Watch Progress Sync",
    template: "%s | SyncX",
  },
  description:
    "Sync watch progress between Stremio and Nuvio. Pick up where you left off across all your devices.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://syncx.tanishmajumdar2912.workers.dev",
  ),
  openGraph: {
    title: "SyncX",
    description: "Sync watch progress between Stremio and Nuvio.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ClerkProvider>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-border/40 py-6 text-center text-sm text-muted-foreground">
              <p>
                SyncX &copy; {new Date().getFullYear()} &middot; Open-source
                watch progress sync
              </p>
            </footer>
          </div>
        </ClerkProvider>
      </body>
    </html>
  );
}
