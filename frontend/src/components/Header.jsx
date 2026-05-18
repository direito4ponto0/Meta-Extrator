import LogoMark from "./LogoMark";

export default function Header() {
  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 w-full border-b border-[var(--ma-border)] bg-[var(--ma-bg)] backdrop-blur-xl"
      style={{ backgroundColor: 'var(--ma-bg)', opacity: 0.95 }}
    >
      {/* Accent line on top */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--ma-accent)] to-transparent opacity-70" aria-hidden="true" />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="/" className="group flex items-center gap-3" data-testid="site-logo">
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute -inset-1 rounded-full bg-[var(--ma-accent)] opacity-0 blur-md transition-opacity duration-500 group-hover:opacity-20"
            />
            <LogoMark size={36} className="relative transition-transform duration-300 group-hover:scale-110" style={{ color: 'var(--ma-text)' }} />
          </div>
          <div className="leading-none">
            <div className="font-display text-sm font-bold tracking-tight" style={{ color: 'var(--ma-text)' }}>META EXTRATOR</div>
            <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'var(--ma-text-secondary)' }}>
              METADADOS E HASH
            </div>
          </div>
        </a>

        <div className="flex items-center gap-3 sm:gap-5">
          <a
            href="#sobre"
            data-testid="about-link"
            className="relative text-xs font-medium uppercase tracking-widest transition-colors after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0 after:bg-[var(--ma-accent)] after:transition-all after:duration-300 hover:after:w-full"
            style={{ color: 'var(--ma-text-secondary)' }}
          >
            Sobre
          </a>
        </div>
      </div>
    </header>
  );
}
