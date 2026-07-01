import Link from "next/link";
import {
  RefreshCw,
  Settings,
  LayoutDashboard,
  BellPlus,
  CalendarDays,
  LogOut,
  Zap,
  MonitorPlay,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/currently-watching", label: "Watching", icon: MonitorPlay },
  { href: "/track", label: "Track", icon: BellPlus },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
            <RefreshCw className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Sync<span className="text-primary">X</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Link href={link.href}>
                <link.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            </Button>
          ))}
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <Link href="/stremio/configure">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Add-on</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/api/auth/logout">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
