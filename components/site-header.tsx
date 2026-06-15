import { Globe2, User } from "lucide-react"

const NAV_ITEMS = ["Home", "About Us", "Programs", "Apply", "Support", "News", "Contact", "Digital Library"]

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 bg-[#004e89] text-white shadow-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0">
          <span className="flex size-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
            <Globe2 className="size-5 text-accent" aria-hidden="true" />
          </span>
          <span className="text-2xl font-extrabold tracking-tight">
            SR1
          </span>
          <span className="sr-only">SR1 Academy home</span>
        </a>

        {/* Nav */}
        <nav className="ml-2 hidden flex-1 items-center justify-center gap-5 lg:flex" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <a
              key={item}
              href="#"
              className={`text-md text-white transition-colors hover:text-accent ${
                item === "Programs" ? "font-extrabold":"font-medium"
              }`}
            >
              {item}
            </a>
          ))}
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <div
            className="flex items-center overflow-hidden rounded-md text-xs font-semibold ring-1 ring-white/30"
            role="group"
            aria-label="Language"
          >
            <button className="bg-white/10 px-2 py-1 hover:bg-white/20">EN</button>
            <button className="px-2 py-1 text-white/70 hover:bg-white/20">ES</button>
          </div>
          <span className="flex size-9 items-center justify-center rounded-full ring-1 ring-white/30">
            <User className="size-5" aria-hidden="true" />
            <span className="sr-only">Account</span>
          </span>
        </div>
      </div>
    </header>
  )
}
