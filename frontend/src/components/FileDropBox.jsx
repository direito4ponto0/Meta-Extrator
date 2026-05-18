import { useRef, useState } from "react";
import { FileMagnifyingGlass, UploadSimple } from "@phosphor-icons/react";
import { formatBytes } from "@/lib/formatters";

/**
 * Compact drag-and-drop file picker used by Signature and Comparison panels.
 * Mirrors the main Dropzone behavior but in a smaller footprint.
 */
export default function FileDropBox({
  label,
  file,
  onFile,
  inputId,
  testId,
  variant = "wide", // wide | compact
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  };

  const isCompact = variant === "compact";

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={handleDrop}
      data-testid={testId ? `${testId}-dropbox` : undefined}
      className={`group relative overflow-hidden border-2 border-dashed transition-all ${
        drag
          ? "border-[var(--ma-accent)] bg-[rgba(0,47,167,0.04)]"
          : "border-[var(--ma-border)] hover:border-[var(--ma-text)]"
      } ${isCompact ? "p-5" : "p-6"}`}
    >
      {/* futuristic corner ticks */}
      <span className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-[var(--ma-accent)]/40" aria-hidden="true" />
      <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-[var(--ma-accent)]/40" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-[var(--ma-accent)]/40" aria-hidden="true" />
      <span className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-[var(--ma-accent)]/40" aria-hidden="true" />

      {label && (
        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-text-secondary)]">
          {label}
        </div>
      )}

      <div className={`flex flex-col gap-3 ${isCompact ? "" : "sm:flex-row sm:items-center sm:justify-between"}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[var(--ma-border)] bg-white text-[var(--ma-text)]">
            <UploadSimple size={16} weight="bold" />
          </div>
          <div className="min-w-0 flex-1">
            {file ? (
              <>
                <div className="truncate font-mono text-sm font-medium" title={file.name}>{file.name}</div>
                <div className="font-mono text-xs text-[var(--ma-text-secondary)]">{formatBytes(file.size)}</div>
              </>
            ) : (
              <>
                <div className="text-sm text-[var(--ma-text)]">
                  Arraste o arquivo aqui
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ma-text-secondary)]">
                  ou clique em selecionar
                </div>
              </>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          data-testid={testId}
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex shrink-0 items-center gap-2 border border-[var(--ma-border)] bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-[var(--ma-text)] transition-colors hover:border-[var(--ma-text)]"
        >
          <FileMagnifyingGlass size={12} weight="bold" />
          {file ? "Trocar" : "Selecionar"}
        </button>
      </div>
    </div>
  );
}
