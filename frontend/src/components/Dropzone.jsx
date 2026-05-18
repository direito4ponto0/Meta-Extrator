import { useCallback, useRef, useState } from "react";
import { UploadSimple, FileMagnifyingGlass } from "@phosphor-icons/react";
import { formatBytes } from "@/lib/formatters";

export default function Dropzone({ onFile, disabled }) {
  const [dragActive, setDragActive] = useState(false);
  const [hoveredFile, setHoveredFile] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = useCallback((files) => {
    if (!files || files.length === 0) return;
    onFile(files[0]);
  }, [onFile]);

  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); if (!disabled) setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); setHoveredFile(null); };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false); setHoveredFile(null);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      data-testid="upload-dropzone"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !disabled) inputRef.current?.click(); }}
      className={`relative cursor-pointer select-none overflow-hidden ${
        dragActive ? "ma-beam-active" : "ma-beam-idle"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
      style={{ minHeight: "420px" }}
      aria-label="Área de upload de arquivo"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle at 20% 30%, rgba(0,47,167,0.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,47,167,0.3), transparent 40%)",
        }}
      />

      <div className="relative flex h-full flex-col items-center justify-center gap-6 px-6 py-16 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center border border-[var(--ma-border)] bg-white transition-colors duration-300 hover:border-[var(--ma-text)]">
          <UploadSimple size={36} weight="thin" className="relative text-[var(--ma-text)]" aria-hidden="true" />
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-[var(--ma-text)] sm:text-4xl lg:text-5xl">
            ARRASTE E SOLTE SEU ARQUIVO AQUI
          </h2>
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-[var(--ma-text-secondary)] sm:text-base">
            ou clique para selecionar. <span className="font-semibold text-[var(--ma-text)]">Qualquer formato</span> é aceito (até 10 GB).
            O arquivo nunca sai do seu navegador.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs uppercase tracking-[0.18em] text-[var(--ma-text-secondary)]">
          <span>IMAGEM</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>PDF</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>OFFICE</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>ÁUDIO</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>VÍDEO</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>ZIP</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>E-BOOK</span>
          <span className="text-[var(--ma-border)]">/</span>
          <span>QUALQUER OUTRO</span>
        </div>

        <div className="group mt-2 inline-flex items-center gap-2 border border-[var(--ma-border)] bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-[var(--ma-text)] transition-colors duration-300 group-hover:border-[var(--ma-text)]">
          <FileMagnifyingGlass size={16} weight="bold" aria-hidden="true" className="transition-transform duration-300 group-hover:rotate-12" />
          Selecionar arquivo
        </div>

        {hoveredFile && (
          <div className="mt-2 font-mono text-xs text-[var(--ma-text-secondary)]">
            {hoveredFile.name} · {formatBytes(hoveredFile.size)}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        data-testid="file-input"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
