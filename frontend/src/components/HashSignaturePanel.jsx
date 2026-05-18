import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Copy, FileText, Database, CheckCircle, Fingerprint } from "@phosphor-icons/react";
import { hashFileMulti, HASH_ALGORITHMS } from "@/lib/hashFile";
import { downloadSignatureJson, buildSignaturePdfBlob } from "@/lib/reportGenerator";
import { formatBytes } from "@/lib/formatters";
import FileDropBox from "./FileDropBox";
import ReportPreviewDialog from "./ReportPreviewDialog";

const DEFAULT_SELECTED = ["md5", "sha1", "sha256", "sha512", "blake3"];

export default function HashSignaturePanel() {
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(new Set(DEFAULT_SELECTED));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const toggleAlg = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResult(null);
  };

  const handleSign = async () => {
    if (!file) { toast.error("Selecione um arquivo primeiro."); return; }
    if (selected.size === 0) { toast.error("Selecione ao menos um algoritmo."); return; }
    setRunning(true);
    setProgress(0);
    setResult(null);
    try {
      const hashes = await hashFileMulti(file, Array.from(selected), (done, total) => {
        setProgress((done / total) * 100);
      });
      setResult({
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        hashes,
      });
      toast.success("Assinatura hash gerada com sucesso.");
    } catch (err) {
      toast.error(err?.message || "Falha ao gerar assinatura.");
    } finally {
      setRunning(false);
    }
  };

  const copyHash = async (alg, value) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${alg.toUpperCase()} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div data-testid="signature-module" className="space-y-8">
      <section className="border border-[var(--ma-border)] bg-white">
        <header className="flex items-center gap-3 border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-4">
          <Fingerprint size={20} weight="bold" className="text-[var(--ma-accent)]" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Assinatura Hash</h2>
            <p className="text-xs text-[var(--ma-text-secondary)]">
              Gere a impressão digital criptográfica de um arquivo em múltiplos algoritmos.
            </p>
          </div>
        </header>

        <div className="space-y-6 p-6">
          {/* Algorithm selector */}
          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
              Algoritmos
            </div>
            <div className="flex flex-wrap gap-2">
              {HASH_ALGORITHMS.map((a) => {
                const active = selected.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggleAlg(a.id)}
                    data-testid={`alg-${a.id}`}
                    className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? "border-[var(--ma-text)] bg-white text-[var(--ma-text)]"
                        : "border-[var(--ma-border)] bg-white text-[var(--ma-text)] hover:border-[var(--ma-text)]"
                    }`}
                  >
                    <span className="font-mono">{a.label}</span>
                    <span className={`text-[9px] uppercase tracking-widest ${active ? "text-[var(--ma-text-secondary)]" : "text-[var(--ma-text-secondary)]"}`}>
                      {a.strength}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* File picker */}
          <div className="mb-2 text-right">
            <span className="text-xs text-[var(--ma-text-secondary)]">Limite: 10 GB</span>
          </div>
          <FileDropBox
            label="Arquivo"
            file={file}
            onFile={handleFile}
            inputId="sig-file-input"
            testId="sig-file-input"
          />

          <Button
            data-testid="sign-btn"
            variant="minimal"
            onClick={handleSign}
            disabled={running || !file}
            className="w-full py-6 text-sm font-bold uppercase tracking-widest text-[var(--ma-text)] disabled:opacity-100 disabled:text-[var(--ma-text)] disabled:cursor-not-allowed"
          >
            {running ? "Calculando…" : "Gerar Assinatura"}
          </Button>

          {running && (
            <div className="space-y-2">
              <Progress value={progress} className="h-1 bg-[var(--ma-bg-secondary)]" />
              <div className="text-center font-mono text-xs text-[var(--ma-text-secondary)]">
                {Math.round(progress)}%
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Result */}
      {result && (
        <section data-testid="signature-result" className="border-2 border-[var(--ma-accent)] bg-white">
          <header className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[rgba(0,47,167,0.04)] px-6 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} weight="fill" className="text-[var(--ma-success)]" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Assinatura gerada</h3>
            </div>
            <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
              {formatBytes(result.fileSize)}
            </span>
          </header>
          <div className="space-y-4 p-6">
            <div className="font-mono text-xs break-all text-[var(--ma-text)]">{result.fileName}</div>
            <div className="space-y-2">
              {Object.entries(result.hashes).map(([alg, value]) => (
                <div key={alg} className="grid grid-cols-[90px_1fr_auto] items-start gap-3 border-b border-[var(--ma-border)] py-2">
                  <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)] text-xs">
                    {alg.toUpperCase()}
                  </span>
                  <span className="font-mono text-xs break-all">{value}</span>
                  <button
                    type="button"
                    onClick={() => copyHash(alg, value)}
                    className="inline-flex h-7 w-7 items-center justify-center border border-[var(--ma-border)] text-[var(--ma-text-secondary)] hover:border-[var(--ma-text)] hover:text-[var(--ma-text)]"
                    aria-label={`Copiar ${alg}`}
                  >
                    <Copy size={12} weight="bold" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                data-testid="sig-pdf-btn"
                variant="minimal"
                onClick={() => setPreviewOpen(true)}
              >
                <FileText size={14} weight="bold" className="mr-2" /> Visualizar PDF
              </Button>
              <Button
                data-testid="sig-json-btn"
                variant="minimal"
                onClick={() => downloadSignatureJson(result)}
              >
                <Database size={14} weight="bold" className="mr-2" /> Relatório JSON
              </Button>
            </div>
          </div>
        </section>
      )}

      <ReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        builder={result ? () => buildSignaturePdfBlob(result) : null}
        title="Pré-visualização do relatório de assinatura hash"
      />
    </div>
  );
}
