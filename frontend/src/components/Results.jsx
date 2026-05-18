import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DownloadSimple, FileText, Database, ArrowsClockwise, ShareNetwork } from "@phosphor-icons/react";
import HashesPanel from "./HashesPanel";
import LocationMap from "./LocationMap";
import ManipulationPanel from "./ManipulationPanel";
import ReportPreviewDialog from "./ReportPreviewDialog";
import { formatBytes, formatDate, flattenMetadata } from "@/lib/formatters";
import { getCategoryLabel } from "@/lib/extractMetadata";
import { downloadJsonReport, buildPdfReportBlob } from "@/lib/reportGenerator";

const MetadataTable = ({ data, testId }) => {
  const flat = flattenMetadata(data);
  const entries = Object.entries(flat);
  if (entries.length === 0) {
    return (
      <div data-testid={`${testId}-empty`} className="border border-dashed border-[var(--ma-border)] p-8 text-center text-sm text-[var(--ma-text-secondary)]">
        Nenhum metadado nessa categoria.
      </div>
    );
  }
  return (
    <div data-testid={testId} className="overflow-x-auto border border-[var(--ma-border)]">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {entries.map(([k, v], i) => (
            <tr key={k} className={i % 2 === 0 ? "bg-white" : "bg-[var(--ma-bg-secondary)]"}>
              <td className="w-1/3 break-all border-r border-[var(--ma-border)] px-4 py-2 font-mono text-xs font-medium text-[var(--ma-text-secondary)]">
                {k}
              </td>
              <td className="break-all px-4 py-2 font-mono text-xs text-[var(--ma-text)]">
                {String(v)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function Results({ report, onReset, rawFile }) {
  const { file, hashes, category, metadata } = report;
  const gps = metadata?.gps;
  const [previewOpen, setPreviewOpen] = useState(false);

  // Privacy-preserving share: copies a compact, plain-text summary of the
  // report to the clipboard so the user can paste it directly into WhatsApp,
  // e-mail or any chat without uploading anything anywhere.
  const handleShare = async () => {
    try {
      const lines = [
        "META EXTRATOR — Resumo do Relatório",
        "https://metaextrator.com.br",
        "",
        `Arquivo:  ${file.fileName}`,
        `Tamanho:  ${formatBytes(file.fileSize)}`,
        `MIME:     ${file.mimeType}`,
        `Tipo:     ${getCategoryLabel(category)}`,
        "",
        "— Hashes —",
        ...Object.entries(hashes || {}).map(([alg, val]) => `${alg.toUpperCase().padEnd(8)} ${val}`),
        "",
        "Gerado 100% no navegador. Nenhum dado enviado a servidores.",
      ];
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Resumo do relatório copiado para a área de transferência.");
    } catch {
      toast.error("Não foi possível copiar o resumo. Copie manualmente.");
    }
  };

  // Group metadata for tabs
  const categorizedTabs = [];
  if (category === "image") {
    categorizedTabs.push({ key: "exif", label: "EXIF", data: metadata.exif });
    if (metadata.dimensions) categorizedTabs.push({ key: "dimensions", label: "Dimensões", data: metadata.dimensions });
  } else if (category === "pdf") {
    categorizedTabs.push({ key: "document", label: "Documento", data: metadata.document });
    if (metadata.xmp) categorizedTabs.push({ key: "xmp", label: "XMP", data: metadata.xmp });
  } else if (category === "office") {
    categorizedTabs.push({ key: "core", label: "Core", data: metadata.core });
    categorizedTabs.push({ key: "app", label: "App", data: metadata.app });
    if (Object.keys(metadata.custom || {}).length) categorizedTabs.push({ key: "custom", label: "Custom", data: metadata.custom });
  } else if (category === "audio") {
    categorizedTabs.push({ key: "format", label: "Formato", data: metadata.format });
    categorizedTabs.push({ key: "common", label: "Tags", data: metadata.common });
  } else if (category === "video") {
    if (metadata.dimensions) categorizedTabs.push({ key: "dimensions", label: "Dimensões", data: { ...metadata.dimensions, duration: metadata.duration } });
    categorizedTabs.push({ key: "format", label: "Formato", data: metadata.format });
    categorizedTabs.push({ key: "common", label: "Tags", data: metadata.common });
  } else {
    categorizedTabs.push({ key: "all", label: "Geral", data: metadata });
  }
  // Always allow "Tudo"
  categorizedTabs.push({ key: "all", label: "Tudo", data: metadata });

  return (
    <div className="space-y-8 ma-fadeup" data-testid="results-panel">
      {/* Summary + Actions */}
      <section className="grid gap-0 border border-[var(--ma-border)] bg-white md:grid-cols-[1fr_auto]">
        <div className="space-y-3 p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
            Análise concluída · {getCategoryLabel(category)}
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl break-all" data-testid="result-filename">
            {file.fileName}
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[var(--ma-text-secondary)]">Tamanho</dt>
              <dd className="font-mono font-medium text-[var(--ma-text)]" data-testid="result-size">{formatBytes(file.fileSize)}</dd>
            </div>
            <div>
              <dt className="text-[var(--ma-text-secondary)]">MIME</dt>
              <dd className="font-mono font-medium text-[var(--ma-text)]">{file.mimeType}</dd>
            </div>
            <div>
              <dt className="text-[var(--ma-text-secondary)]">Modificado</dt>
              <dd className="font-mono font-medium text-[var(--ma-text)]">{formatDate(file.lastModified)}</dd>
            </div>
            <div>
              <dt className="text-[var(--ma-text-secondary)]">Extensão</dt>
              <dd className="font-mono font-medium text-[var(--ma-text)]">.{file.extension || "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] p-6 md:border-l md:border-t-0">
          <Button
            data-testid="download-pdf-btn"
            variant="minimal"
            onClick={() => setPreviewOpen(true)}
          >
            <FileText size={16} weight="bold" className="mr-2" aria-hidden="true" />
            Visualizar PDF
          </Button>
          <Button
            data-testid="download-json-btn"
            variant="minimal"
            onClick={() => downloadJsonReport(report)}
          >
            <Database size={16} weight="bold" className="mr-2" aria-hidden="true" />
            Baixar JSON
          </Button>
          <Button
            data-testid="share-report-btn"
            variant="minimal"
            onClick={handleShare}
          >
            <ShareNetwork size={16} weight="bold" className="mr-2" aria-hidden="true" />
            Compartilhar resumo
          </Button>
          <Button
            data-testid="reset-btn"
            variant="minimal"
            onClick={onReset}
          >
            <ArrowsClockwise size={14} weight="bold" className="mr-2" aria-hidden="true" />
            Analisar outro arquivo
          </Button>
        </div>
      </section>

      {/* Hashes */}
      <HashesPanel hashes={hashes} />

      {/* GPS Map (if any) */}
      {gps && <LocationMap gps={gps} />}

      {/* Manipulação (eliminar / editar) */}
      {rawFile && <ManipulationPanel file={rawFile} originalReport={report} />}

      {/* Metadata Tabs */}
      <section className="border border-[var(--ma-border)] bg-white">
        <header className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Metadados Extraídos</h3>
          <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
            {Object.keys(flattenMetadata(metadata)).length} campos
          </span>
        </header>
        <div className="p-6">
          <Tabs defaultValue={categorizedTabs[0].key}>
            <TabsList className="h-auto flex-wrap gap-1 rounded-none bg-transparent p-0">
              {categorizedTabs.map((t) => (
                <TabsTrigger
                  key={t.key + t.label}
                  value={t.key}
                  data-testid={`tab-${t.key}`}
                  className="rounded-none border border-[var(--ma-border)] bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-[var(--ma-text)] hover:border-[var(--ma-text)] data-[state=active]:bg-white data-[state=active]:text-[var(--ma-text)] data-[state=active]:border-[var(--ma-text)]"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {categorizedTabs.map((t, idx) => (
              <TabsContent key={t.key + idx} value={t.key} className="mt-6">
                <MetadataTable data={t.data} testId={`metadata-table-${t.key}`} />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <div className="flex justify-center">
        <Button
          variant="minimal"
          onClick={onReset}
          data-testid="analyze-another-btn"
          className="px-8"
        >
          <DownloadSimple size={16} weight="bold" className="mr-2 rotate-180" aria-hidden="true" />
          Analisar outro arquivo
        </Button>
      </div>

      <ReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        builder={() => buildPdfReportBlob(report)}
        title="Pré-visualização do relatório de extração"
      />
    </div>
  );
}
