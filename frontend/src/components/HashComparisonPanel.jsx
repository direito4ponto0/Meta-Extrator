import { useState, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowsLeftRight, ArrowLeft, ArrowRight, CheckCircle, XCircle, FileText, Database, UploadSimple } from "@phosphor-icons/react";
import { hashFileMulti, compareHashes, detectAlgorithmByLength } from "@/lib/hashFile";
import { downloadComparisonJson, buildComparisonPdfBlob } from "@/lib/reportGenerator";
import { formatBytes } from "@/lib/formatters";
import FileDropBox from "./FileDropBox";
import ReportPreviewDialog from "./ReportPreviewDialog";

const DEFAULT_ALGS = ["md5", "sha1", "sha256", "sha512", "blake3"];

export default function HashComparisonPanel() {
  const [mode, setMode] = useState("file-file"); // file-file | file-hash
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => { setResult(null); setProgress(0); };

  const switchMode = (m) => {
    setMode(m);
    setFileA(null);
    setFileB(null);
    setExpectedHash("");
    reset();
  };

  const handleMultipleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    if (files.length === 1) {
      toast.info("Selecione 2 arquivos para comparação.");
      setFileA(files[0]);
      setFileB(null);
    } else if (files.length === 2) {
      setFileA(files[0]);
      setFileB(files[1]);
      toast.success("2 arquivos selecionados!");
    } else {
      toast.warning("Selecione apenas 2 arquivos. Usando os 2 primeiros.");
      setFileA(files[0]);
      setFileB(files[1]);
    }
    reset();
  };

  const handleCompareFiles = async () => {
    if (!fileA || !fileB) { toast.error("Selecione os dois arquivos."); return; }
    setRunning(true); reset();
    try {
      const hashesA = await hashFileMulti(fileA, DEFAULT_ALGS, (d, t) => setProgress((d / t) * 50));
      const hashesB = await hashFileMulti(fileB, DEFAULT_ALGS, (d, t) => setProgress(50 + (d / t) * 50));

      const comparisons = DEFAULT_ALGS.map((alg) => ({
        algorithm: alg.toUpperCase(),
        hashA: hashesA[alg],
        hashB: hashesB[alg],
        match: compareHashes(hashesA[alg], hashesB[alg]),
      }));
      const allMatch = comparisons.every((c) => c.match);

      setResult({
        mode: "file-file",
        fileA: { name: fileA.name, size: fileA.size },
        fileB: { name: fileB.name, size: fileB.size },
        comparisons,
        verdict: allMatch ? "identicos" : "diferentes",
      });
      toast[allMatch ? "success" : "warning"](allMatch ? "Arquivos idênticos" : "Arquivos diferentes");
    } catch (err) {
      toast.error(err?.message || "Falha ao comparar.");
    } finally {
      setRunning(false);
    }
  };

  const handleCompareHash = async () => {
    if (!fileA) { toast.error("Selecione um arquivo."); return; }
    if (!expectedHash.trim()) { toast.error("Informe o hash esperado."); return; }
    setRunning(true); reset();
    try {
      const hashes = await hashFileMulti(fileA, DEFAULT_ALGS, (d, t) => setProgress((d / t) * 100));

      // Find which algorithm matches by length, fallback to all comparisons
      const cleanedExpected = expectedHash.trim().toLowerCase().replace(/\s+/g, "");
      const comparisons = DEFAULT_ALGS.map((alg) => ({
        algorithm: alg.toUpperCase(),
        hashComputed: hashes[alg],
        match: compareHashes(hashes[alg], cleanedExpected),
      }));
      const matched = comparisons.find((c) => c.match);

      setResult({
        mode: "file-hash",
        fileA: { name: fileA.name, size: fileA.size },
        expectedHash: cleanedExpected,
        detectedAlgorithm: detectAlgorithmByLength(cleanedExpected),
        comparisons,
        verdict: matched ? "valido" : "invalido",
        matchedAlgorithm: matched?.algorithm || null,
      });
      toast[matched ? "success" : "warning"](
        matched ? `Hash válido (${matched.algorithm})` : "Hash não confere com nenhum algoritmo"
      );
    } catch (err) {
      toast.error(err?.message || "Falha ao comparar.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div data-testid="comparison-module" className="space-y-8">
      <section className="border border-[var(--ma-border)] bg-white">
        <header className="flex items-center gap-3 border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-4">
          <ArrowsLeftRight size={20} weight="bold" className="text-[var(--ma-accent)]" />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">Comparação Hash</h2>
            <p className="text-xs text-[var(--ma-text-secondary)]">
              Verifique se dois arquivos são idênticos ou se um arquivo corresponde a um hash conhecido.
            </p>
          </div>
        </header>

        <div className="space-y-6 p-6">
          {/* Mode tabs */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => switchMode("file-file")}
              data-testid="mode-file-file"
              className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors bg-white ${
                mode === "file-file"
                  ? "border-[var(--ma-text)] text-[var(--ma-text)]"
                  : "border-[var(--ma-border)] text-[var(--ma-text)] hover:border-[var(--ma-text)]"
              }`}
            >
              <span>Arquivo</span>
              <span className="inline-flex items-center" aria-hidden="true">
                <ArrowLeft size={12} weight="bold" />
                <ArrowRight size={12} weight="bold" className="-ml-0.5" />
              </span>
              <span>Arquivo</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("file-hash")}
              data-testid="mode-file-hash"
              className={`inline-flex items-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors bg-white ${
                mode === "file-hash"
                  ? "border-[var(--ma-text)] text-[var(--ma-text)]"
                  : "border-[var(--ma-border)] text-[var(--ma-text)] hover:border-[var(--ma-text)]"
              }`}
            >
              <span>Arquivo</span>
              <span className="inline-flex items-center" aria-hidden="true">
                <ArrowLeft size={12} weight="bold" />
                <ArrowRight size={12} weight="bold" className="-ml-0.5" />
              </span>
              <span>Hash</span>
            </button>
          </div>

          {mode === "file-file" ? (
            <div className="space-y-4">
              {/* Single upload button for 2 files */}
              <div className="mb-2 text-right">
                <span className="text-xs text-[var(--ma-text-secondary)]">Limite: 10 GB por arquivo</span>
              </div>
              <div className="border-2 border-dashed border-[var(--ma-border)] p-6 hover:border-[var(--ma-text)] transition-all">
                <div className="flex flex-col items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center border-2 border-[var(--ma-border)] bg-white text-[var(--ma-accent)]">
                    <ArrowsLeftRight size={28} weight="bold" />
                  </div>
                  
                  <div className="text-center">
                    <div className="text-sm font-semibold text-[var(--ma-text)]">
                      Selecione 2 arquivos para comparação
                    </div>
                    <div className="mt-1 font-mono text-xs text-[var(--ma-text-secondary)]">
                      Clique no botão abaixo e selecione ambos os arquivos de uma vez
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleMultipleFiles}
                    data-testid="multi-file-input"
                    className="hidden"
                  />
                  
                  <Button
                    type="button"
                    variant="minimal"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 text-xs font-bold uppercase tracking-widest"
                  >
                    <UploadSimple size={16} weight="bold" className="mr-2" />
                    Fazer upload de arquivos para comparação
                  </Button>
                </div>
              </div>

              {/* Display selected files */}
              {(fileA || fileB) && (
                <div className="grid gap-3 md:grid-cols-2">
                  {fileA && (
                    <div className="border border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)] mb-2">
                        Arquivo 1
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--ma-border)] bg-white text-[var(--ma-accent)]">
                          <CheckCircle size={18} weight="fill" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm font-medium" title={fileA.name}>
                            {fileA.name}
                          </div>
                          <div className="font-mono text-xs text-[var(--ma-text-secondary)]">
                            {formatBytes(fileA.size)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {fileB && (
                    <div className="border border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] p-4">
                      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)] mb-2">
                        Arquivo 2
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--ma-border)] bg-white text-[var(--ma-accent)]">
                          <CheckCircle size={18} weight="fill" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-mono text-sm font-medium" title={fileB.name}>
                            {fileB.name}
                          </div>
                          <div className="font-mono text-xs text-[var(--ma-text-secondary)]">
                            {formatBytes(fileB.size)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-right mb-2">
                <span className="text-xs text-[var(--ma-text-secondary)]">Limite: 10 GB</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
              <FileDropBox label="Arquivo" file={fileA} onFile={setFileA} inputId="cmp-file-single" testId="cmp-file-single" variant="compact" />

              <div className="space-y-2">
                <label htmlFor="expected-hash" className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
                  Hash esperado
                </label>
                <textarea
                  id="expected-hash"
                  data-testid="expected-hash-input"
                  rows={4}
                  value={expectedHash}
                  onChange={(e) => setExpectedHash(e.target.value)}
                  placeholder="Cole aqui o hash (MD5, SHA-1, SHA-256, SHA-512 ou BLAKE3)…"
                  className="w-full resize-none rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 font-mono text-xs focus:border-[var(--ma-text)] focus:outline-none"
                />
                {expectedHash.trim() && (
                  <p className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
                    Algoritmo provável: <span className="text-[var(--ma-text)]">{detectAlgorithmByLength(expectedHash) || "desconhecido"}</span>
                  </p>
                )}
              </div>
            </div>
            </div>
          )}

          <Button
            data-testid="compare-btn"
            variant="minimal"
            onClick={mode === "file-file" ? handleCompareFiles : handleCompareHash}
            disabled={running}
            className="w-full py-6 text-sm font-bold uppercase tracking-widest disabled:opacity-50"
          >
            {running ? "Calculando…" : "Comparar"}
          </Button>

          {running && (
            <div className="space-y-2">
              <Progress value={progress} className="h-1 bg-[var(--ma-bg-secondary)]" />
              <div className="text-center font-mono text-xs text-[var(--ma-text-secondary)]">{Math.round(progress)}%</div>
            </div>
          )}
        </div>
      </section>

      {/* Result */}
      {result && (
        <section data-testid="comparison-result" className={`border-2 ${result.verdict === "identicos" || result.verdict === "valido" ? "border-[var(--ma-success)]" : "border-[var(--ma-destructive)]"} bg-white`}>
          <header className={`flex items-center gap-3 border-b border-[var(--ma-border)] px-6 py-4 ${result.verdict === "identicos" || result.verdict === "valido" ? "bg-[rgba(22,163,74,0.06)]" : "bg-[rgba(220,38,38,0.06)]"}`}>
            {result.verdict === "identicos" || result.verdict === "valido" ? (
              <CheckCircle size={24} weight="fill" className="text-[var(--ma-success)]" />
            ) : (
              <XCircle size={24} weight="fill" className="text-[var(--ma-destructive)]" />
            )}
            <div>
              <h3 className="font-display text-lg font-semibold tracking-tight">
                {result.verdict === "identicos" && "Arquivos idênticos"}
                {result.verdict === "diferentes" && "Arquivos diferentes"}
                {result.verdict === "valido" && `Hash válido${result.matchedAlgorithm ? ` (${result.matchedAlgorithm})` : ""}`}
                {result.verdict === "invalido" && "Hash não corresponde"}
              </h3>
              <p className="text-xs text-[var(--ma-text-secondary)]">
                {result.mode === "file-file" ? "Comparação entre dois arquivos" : "Verificação de hash conhecido"}
              </p>
            </div>
          </header>
          <div className="space-y-4 p-6">
            {result.mode === "file-file" ? (
              <div className="space-y-2">
                {result.comparisons.map((c) => (
                  <div key={c.algorithm} className="border border-[var(--ma-border)] p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)]">{c.algorithm}</span>
                      {c.match ? (
                        <span className="inline-flex items-center gap-1 text-[var(--ma-success)] font-semibold">
                          <CheckCircle size={12} weight="fill" /> idênticos
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[var(--ma-destructive)] font-semibold">
                          <XCircle size={12} weight="fill" /> diferem
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-1 font-mono text-[11px] break-all">
                      <div><span className="text-[var(--ma-text-secondary)]">A:</span> {c.hashA}</div>
                      <div><span className="text-[var(--ma-text-secondary)]">B:</span> {c.hashB}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {result.comparisons.map((c) => (
                  <div key={c.algorithm} className={`grid grid-cols-[90px_1fr_auto] items-start gap-3 border p-2 text-xs ${c.match ? "border-[var(--ma-success)]" : "border-[var(--ma-border)]"}`}>
                    <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)]">{c.algorithm}</span>
                    <span className="font-mono break-all">{c.hashComputed}</span>
                    {c.match ? (
                      <CheckCircle size={14} weight="fill" className="text-[var(--ma-success)]" />
                    ) : (
                      <XCircle size={14} weight="fill" className="text-[var(--ma-text-secondary)] opacity-30" />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                data-testid="cmp-pdf-btn"
                variant="minimal"
                onClick={() => setPreviewOpen(true)}
              >
                <FileText size={14} weight="bold" className="mr-2" /> Visualizar PDF
              </Button>
              <Button
                data-testid="cmp-json-btn"
                variant="minimal"
                onClick={() => downloadComparisonJson(result)}
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
        builder={result ? () => buildComparisonPdfBlob(result) : null}
        title="Pré-visualização do relatório de comparação hash"
      />
    </div>
  );
}
