// The nav and footer shared by every public page.
import { PROFILE as p, SITE } from "@/lib/content";
import { PAGES } from "@/lib/pages";

export function SiteNav({ current = "" }: { current?: string }) {
  return (
    <header className="nav">
      <div className="wrap">
        <a href="/" className="nav__brand">
          {p.name}
        </a>
        <nav className="nav__links" aria-label="Primary">
          {PAGES.map((pg) => (
            <a key={pg.href} href={pg.href} aria-current={current === pg.href ? "page" : undefined}>
              {pg.label}
            </a>
          ))}
          <a className="nav__app" href="/app">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
              <path d="M11 18.5h2" />
            </svg>
            Get the app
          </a>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="wrap">
        <span>
          © {new Date().getFullYear()} {p.name}
        </span>
        <nav aria-label="Footer">
          {PAGES.map((pg) => (
            <a key={pg.href} href={pg.href}>
              {pg.label}
            </a>
          ))}
          <a href={SITE.linkedin} target="_blank" rel="noopener">
            LinkedIn
          </a>
        </nav>
      </div>
    </footer>
  );
}

export function WaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3z" />
      <path
        d="M9.2 8.4c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.4l.8 1.9c.1.2.1.4 0 .6l-.5.7c-.1.2-.2.3 0 .6a6.8 6.8 0 0 0 3 2.8c.3.1.4.1.6-.1l.7-.8c.2-.2.4-.2.6-.1l1.9.9c.3.1.4.2.4.4a2.4 2.4 0 0 1-1.8 2.3c-1 .2-2.3-.1-4.1-1.3a10.5 10.5 0 0 1-3.6-4c-.6-1.2-.5-2.2-.1-2.9z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
