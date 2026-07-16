const links = [
  { label: "Home", href: "/#home" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
]

export function Footer() {
  return (
    <footer id="footer" className="bg-black border-t border-white/10 px-8 md:px-16 py-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center">
          <img src="/growzzy-logo.png" alt="Growzzy OS logo" className="h-9 w-9 object-contain" loading="lazy" />
          <span className="font-body text-sm text-white/50 ml-3">Growzzy OS</span>
        </div>
        <nav className="flex flex-wrap gap-6">
          {links.map((l) => (
            <a key={l.label} href={l.href} className="font-body text-xs text-white/40 hover:text-white/70 transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
      </div>
      <div className="mt-8 font-body text-xs text-white/25 text-center">
        © 2026 Growzzy OS. Built for founders who move fast.
      </div>
    </footer>
  )
}
