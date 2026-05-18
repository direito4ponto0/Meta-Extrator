import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { toast } from "sonner";

const HashRow = ({ label, value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copiado para a área de transferência`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  return (
    <div className="grid grid-cols-[80px_1fr_auto] items-start gap-4 border-b border-[var(--ma-border)] py-3 last:border-b-0">
      <div className="text-xs font-bold uppercase tracking-widest text-[var(--ma-accent)]">{label}</div>
      <div className="break-all font-mono text-xs leading-relaxed text-[var(--ma-text)] sm:text-sm" data-testid={`hash-${label.toLowerCase()}`}>
        {value}
      </div>
      <button
        type="button"
        onClick={handleCopy}
        data-testid={`copy-hash-${label.toLowerCase()}-btn`}
        className="inline-flex h-8 w-8 items-center justify-center border border-[var(--ma-border)] text-[var(--ma-text-secondary)] transition-colors hover:border-[var(--ma-text)] hover:text-[var(--ma-text)]"
        aria-label={`Copiar ${label}`}
      >
        {copied ? <Check size={14} weight="bold" /> : <Copy size={14} weight="bold" />}
      </button>
    </div>
  );
};

export default function HashesPanel({ hashes }) {
  return (
    <section data-testid="hashes-panel" className="border border-[var(--ma-border)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Hashes Criptográficos</h3>
        <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">integridade</span>
      </header>
      <div className="px-6 py-2">
        <HashRow label="MD5" value={hashes.md5} />
        <HashRow label="SHA-1" value={hashes.sha1} />
        <HashRow label="SHA-256" value={hashes.sha256} />
      </div>
    </section>
  );
}
