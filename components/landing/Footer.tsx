import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border/70 px-6 py-8 md:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
              <path d="M4 14c4-8 12-8 16 0" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="16" r="2" fill="white" />
            </svg>
          </span>
          <span className="font-display text-lg text-ink">growzzyos</span>
          <span className="ml-3 text-xs text-ink-soft">The AI workspace for your ads.</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-ink-soft">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/compliance" className="hover:text-ink">Compliance</Link>
          <Link href="/auth" className="hover:text-ink">Contact</Link>
          <span>© {new Date().getFullYear()} GrowzzyOS</span>
        </div>
      </div>
    </footer>
  )
}
