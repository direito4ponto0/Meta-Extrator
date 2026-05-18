import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PolicyContent } from "./CookieBanner";

export default function Footer() {
  const [policyOpen, setPolicyOpen] = useState(false);

  return (
    <footer
      data-testid="site-footer"
      className="mt-16 border-t border-[var(--ma-border)] bg-[var(--ma-bg)] text-[var(--ma-text-secondary)]"
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-center gap-2 px-6 py-5 text-center text-xs">
        <span data-testid="footer-copyright" className="text-[var(--ma-text-secondary)]">
          © 2026 META EXTRATOR · Todos os direitos reservados.
        </span>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                data-testid="footer-policy-link"
                className="text-[var(--ma-text-secondary)] underline decoration-[var(--ma-border)] underline-offset-2 transition-colors hover:text-[var(--ma-text)] hover:decoration-[var(--ma-text)]"
              >
                Política de Privacidade · LGPD
              </button>
            </DialogTrigger>
            <DialogContent
              data-testid="privacy-policy-dialog-footer"
              className="max-h-[85vh] max-w-2xl overflow-y-auto rounded-none border-[var(--ma-text)] p-0"
            >
              <PolicyContent />
            </DialogContent>
          </Dialog>

          <a
            href="https://github.com/direito4ponto0"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-developer-credit"
            className="text-[var(--ma-text-secondary)] underline decoration-[var(--ma-border)] underline-offset-2 transition-colors hover:text-[var(--ma-text)] hover:decoration-[var(--ma-text)]"
            title="Perfil GitHub de Mateus Ferreira dos Santos"
          >
            Desenvolvido por Mateus Ferreira dos Santos
          </a>
        </div>
      </div>
    </footer>
  );
}
