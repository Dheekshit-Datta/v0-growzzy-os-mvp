import { Button } from "@/components/ui/button";
import Link from "next/link";

const navLinks = [
  { label: "Workspace", href: "#features" },
  { label: "AI Optimization", href: "#features" },
  { label: "Platforms", href: "#platforms" },
  { label: "Pricing", href: "#pricing" },
  { label: "Compliance", href: "/compliance" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6 md:px-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M4 14c4-8 12-8 16 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="2" fill="white" />
            </svg>
          </span>
          <span className="font-display text-xl text-ink">growzzyos</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full px-4 text-ink hover:bg-accent"
            asChild
          >
            <Link href="/auth">Sign in</Link>
          </Button>
          <Button
            className="rounded-full bg-ink px-5 text-primary-foreground shadow-sm hover:bg-ink/90"
            asChild
          >
            <Link href="/dashboard">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
