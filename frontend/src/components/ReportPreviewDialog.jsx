import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "@phosphor-icons/react";
import { formatBytes } from "@/lib/formatters";

/**
 * Preview PDF report inside a modal before downloading.
 * Receives an async builder fn that returns `{ blob, filename }`.
 *
 * Props:
 *  - open: boolean
 *  - onOpenChange(open): void
 *  - builder: () => { blob, filename }     // synchronous (jsPDF is sync)
 *  - title?: string
 */
export default function ReportPreviewDialog({ open, onOpenChange, builder, title = "Pré-visualização do relatório" }) {
  const [url, setUrl] = useState(null);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!open || !builder) return;

    let revokedUrl = null;
    let cancelled = false;

    (async () => {
      try {
        const result = await builder();
        if (cancelled || !result) return;
        const { blob, filename } = result;
        const objectUrl = URL.createObjectURL(blob);
        revokedUrl = objectUrl;
        setUrl(objectUrl);
        setMeta({ filename, size: blob.size, type: blob.type });
      } catch (err) {
        console.error("Failed to build PDF preview:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (revokedUrl) URL.revokeObjectURL(revokedUrl);
      setUrl(null);
      setMeta(null);
    };
  }, [open, builder]);

  const handleDownload = () => {
    if (!url || !meta) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = meta.filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="report-preview-dialog"
        className="flex h-[92vh] w-[96vw] max-w-6xl flex-col gap-0 rounded-none border-[var(--ma-text)] bg-white p-0"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Header */}
        <header className="relative flex items-center justify-between border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
              Pré-visualização
            </div>
            <div className="truncate font-mono text-xs text-[var(--ma-text)]" title={meta?.filename || ""}>
              {meta?.filename || "Gerando…"}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {meta && (
              <span className="hidden font-mono text-[10px] text-[var(--ma-text-secondary)] sm:inline">
                {formatBytes(meta.size)}
              </span>
            )}
            <Button
              data-testid="preview-download-btn"
              variant="minimal"
              onClick={handleDownload}
              disabled={!url}
              className="text-xs uppercase tracking-widest"
            >
              <Download size={14} weight="bold" className="mr-2" /> Baixar PDF
            </Button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              data-testid="preview-close-btn"
              aria-label="Fechar pré-visualização"
              className="inline-flex h-8 w-8 items-center justify-center border border-[var(--ma-border)] bg-white text-[var(--ma-text-secondary)] hover:border-[var(--ma-text)] hover:text-[var(--ma-text)]"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </header>

        {/* PDF embed */}
        <div className="relative flex-1 bg-[var(--ma-bg-secondary)]">
          {url ? (
            <object
              data-testid="report-preview-iframe"
              data={url}
              type="application/pdf"
              className="absolute inset-0 h-full w-full border-0 bg-white"
              aria-label={title}
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm text-[var(--ma-text-secondary)]">
                <p>Seu navegador não suporta pré-visualização inline de PDF.</p>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border border-[var(--ma-border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--ma-text)] hover:border-[var(--ma-text)]"
                >
                  Abrir em nova aba
                </a>
              </div>
            </object>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--ma-text-secondary)]">
              Gerando relatório…
            </div>
          )}
        </div>

        {/* Footer info */}
        <footer className="border-t border-[var(--ma-border)] bg-white px-6 py-2 font-mono text-[10px] text-[var(--ma-text-secondary)]">
          Relatório gerado 100% no navegador. Nenhum byte foi enviado a servidores externos.
        </footer>
      </DialogContent>
    </Dialog>
  );
}
