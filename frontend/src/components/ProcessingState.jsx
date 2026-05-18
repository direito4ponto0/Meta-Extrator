import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/formatters";
import { CircleNotch } from "@phosphor-icons/react";

export default function ProcessingState({ file, phase, progress }) {
  const phaseLabel = {
    hashing: "Calculando hashes criptográficos (MD5 · SHA-1 · SHA-256)",
    extracting: "Extraindo metadados",
    done: "Concluído",
  }[phase] || "Processando";

  return (
    <div
      data-testid="processing-state"
      className="relative overflow-hidden border border-[var(--ma-border)] bg-white p-8 sm:p-12"
      style={{ minHeight: "420px" }}
    >
      <div className="ma-scan-line" aria-hidden="true" />
      <div className="flex flex-col items-center justify-center gap-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center border border-[var(--ma-border)]">
          <CircleNotch size={36} weight="bold" className="animate-spin text-[var(--ma-accent)]" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
            {phaseLabel}
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Analisando arquivo
          </h2>
          <p className="font-mono text-sm text-[var(--ma-text-secondary)]">
            {file.name} · {formatBytes(file.size)}
          </p>
        </div>

        <div className="w-full max-w-md space-y-2">
          <Progress value={progress} data-testid="processing-progress" className="h-1 bg-[var(--ma-bg-secondary)]" />
          <div className="flex justify-between font-mono text-xs text-[var(--ma-text-secondary)]">
            <span>{Math.round(progress)}%</span>
            <span>{phase === "hashing" ? "fase 1/2" : phase === "extracting" ? "fase 2/2" : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
