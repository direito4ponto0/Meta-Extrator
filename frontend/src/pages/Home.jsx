import { useState, useCallback } from "react";
import { toast } from "sonner";
import { MagnifyingGlass, Fingerprint, ArrowsLeftRight } from "@phosphor-icons/react";
import Header from "@/components/Header";
import Dropzone from "@/components/Dropzone";
import ProcessingState from "@/components/ProcessingState";
import Results from "@/components/Results";
import AboutSection from "@/components/AboutSection";
import Footer from "@/components/Footer";
import HashSignaturePanel from "@/components/HashSignaturePanel";
import HashComparisonPanel from "@/components/HashComparisonPanel";
import { hashFile } from "@/lib/hashFile";
import { extractMetadata } from "@/lib/extractMetadata";

const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

const TABS = [
  { id: "extract", label: "Extração de Metadados", icon: MagnifyingGlass },
  { id: "signature", label: "Assinatura Hash", icon: Fingerprint },
  { id: "compare", label: "Comparação Hash", icon: ArrowsLeftRight },
];

export default function Home() {
  const [tab, setTab] = useState("extract");
  const [state, setState] = useState("idle"); // idle | processing | done | error
  const [phase, setPhase] = useState(null); // hashing | extracting
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState(null);
  const [report, setReport] = useState(null);

  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo excede 10 GB. Por favor, escolha um menor.");
      return;
    }
    setCurrentFile(file);
    setState("processing");
    setPhase("hashing");
    setProgress(0);

    try {
      // Phase 1 (0-90%): hashing
      const hashes = await hashFile(file, (done, total) => {
        const pct = (done / total) * 90;
        setProgress(pct);
      });

      // Phase 2 (90-100%): metadata extraction
      setPhase("extracting");
      setProgress(92);
      const metadata = await extractMetadata(file);
      setProgress(100);

      const finalReport = {
        application: "Meta Extrator",
        category: metadata.category,
        file: metadata.file,
        hashes,
        metadata,
      };
      setReport(finalReport);
      setState("done");
      toast.success("Análise concluída");
    } catch (err) {
      console.error(err);
      toast.error(`Falha ao processar arquivo: ${err?.message || err}`);
      setState("idle");
      setPhase(null);
      setProgress(0);
      setCurrentFile(null);
    }
  }, []);

  const reset = () => {
    setState("idle");
    setPhase(null);
    setProgress(0);
    setCurrentFile(null);
    setReport(null);
  };

  const switchTab = (id) => {
    if (state === "processing") return;
    if (id !== "extract") reset();
    setTab(id);
  };

  return (
    <div className="App relative min-h-screen bg-white">
      {/* Subtle grid background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--ma-text) 1px, transparent 1px), linear-gradient(to bottom, var(--ma-text) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[480px] opacity-50"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(0,47,167,0.10) 0%, rgba(0,47,167,0) 70%)",
        }}
      />

      <Header />

      <main className="relative mx-auto max-w-7xl px-6 pt-12 pb-24">
        {/* Hero */}
        <section className="mb-10">
          <div className="space-y-4">
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-[var(--ma-text)] sm:text-4xl lg:text-5xl">
              EXTRAÇÃO E MANIPULAÇÃO ONLINE DE METADADOS E HASH<span className="lowercase">s</span>
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-[var(--ma-text-secondary)] sm:text-lg">
              Extraia EXIF, GPS e metadados de documentos e mídia; gere assinaturas hash
              (MD5, SHA-1/256/384/512, SHA3, BLAKE3) e compare arquivos — tudo localmente,
              gratuito e sem sair do seu navegador.
            </p>
          </div>
        </section>

        {/* Tabs */}
        <nav
          data-testid="module-tabs"
          aria-label="Módulos"
          className="mb-8 flex flex-wrap gap-px border border-[var(--ma-border)] bg-[var(--ma-border)]"
        >
          {TABS.map((t) => {
            const active = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`relative flex flex-1 min-w-[200px] items-center justify-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-widest transition-all border ${
                  active
                    ? "bg-white text-[var(--ma-text)] border-[var(--ma-text)]"
                    : "bg-white text-[var(--ma-text)] border-[var(--ma-border)] hover:border-[var(--ma-text)]"
                }`}
              >
                <Icon size={14} weight="bold" />
                {t.label}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        {tab === "extract" && (
          <>
            {state === "idle" && (
              <>
                <div className="mb-2 text-right">
                  <span className="text-xs text-[var(--ma-text-secondary)]">Limite: 10 GB</span>
                </div>
                <Dropzone onFile={handleFile} />
                <AboutSection />
              </>
            )}
            {state === "processing" && (
              <ProcessingState file={currentFile} phase={phase} progress={progress} />
            )}
            {state === "done" && report && (
              <Results report={report} onReset={reset} rawFile={currentFile} />
            )}
          </>
        )}

        {tab === "signature" && (
          <>
            <HashSignaturePanel />
            <AboutSection />
          </>
        )}

        {tab === "compare" && (
          <>
            <HashComparisonPanel />
            <AboutSection />
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
