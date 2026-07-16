import { ArrowUpRight } from "./Icons"

const links: { label: string; href: string }[] = [
  { label: "Home", href: "#home" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
]

export function Navbar() {
  return (
    <nav className="fixed top-4 left-0 right-0 px-4 z-50 flex items-center justify-center">
      <div className="hidden lg:flex rounded-full pl-2 pr-1.5 py-1.5 items-center gap-1 bg-white/90 backdrop-blur-xl border border-black/10 shadow-lg shadow-black/10">
        <a href="/#home" aria-label="Growzzy OS home" className="flex items-center justify-center h-9 w-9 rounded-full overflow-hidden mr-1">
          <img src="/growzzy-logo.png" alt="Growzzy OS" className="h-8 w-8 object-contain" />
        </a>
        {links.map((l, i) => (
          <a
            key={l.label}
            href={l.href}
            className={`px-3 py-2 text-sm font-medium font-body ${
              i === 0 ? "text-black" : "text-black/70 hover:text-black"
            }`}
          >
            {l.label}
          </a>
        ))}
        <a
          href="/auth"
          className="bg-black text-white whitespace-nowrap px-5 py-2 text-sm font-medium rounded-full flex items-center gap-1.5"
        >
          Launch Free <ArrowUpRight className="h-4 w-4" />
        </a>
        <a href="/auth" className="px-3 py-2 text-sm font-medium font-body text-black/70 hover:text-black">
          Sign in
        </a>
      </div>

      <a href="/#home" aria-label="Growzzy OS home" className="lg:hidden rounded-full w-12 h-12 flex items-center justify-center overflow-hidden bg-white/90 backdrop-blur-xl border border-black/10">
        <img src="/growzzy-logo.png" alt="Growzzy OS" className="h-10 w-10 object-contain" />
      </a>
    </nav>
  )
}
