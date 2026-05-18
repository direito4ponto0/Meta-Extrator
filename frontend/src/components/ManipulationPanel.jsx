import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Eraser, PencilSimple, Warning, FileText, Database, CheckCircle, GitDiff, FileArrowDown } from "@phosphor-icons/react";
import {
  getManipulableType,
  getEditableFields,
  stripMetadata,
  editMetadata,
  downloadBlob,
} from "@/lib/manipulateMetadata";
import { hashFile } from "@/lib/hashFile";
import { extractMetadata } from "@/lib/extractMetadata";
import {
  downloadStripJsonReport,
  downloadEditJsonReport,
  buildStripPdfBlob,
  buildEditPdfBlob,
} from "@/lib/reportGenerator";
import { formatBytes } from "@/lib/formatters";
import ReportPreviewDialog from "./ReportPreviewDialog";

const FORMAT_LABEL = {
  jpeg: "JPEG", png: "PNG", webp: "WebP", pdf: "PDF", office: "Office",
};

// Build a fresh report from a manipulated File
const buildPostReport = async (file) => {
  const hashes = await hashFile(file);
  const metadata = await extractMetadata(file);
  return {
    application: "Meta Extrator",
    category: metadata.category,
    file: metadata.file,
    hashes,
    metadata,
  };
};

export default function ManipulationPanel({ file, originalReport }) {
  const type = useMemo(() => getManipulableType(file), [file]);
  const sections = useMemo(() => getEditableFields(file), [file]);
  const [editOpen, setEditOpen] = useState(false);
  const [stripping, setStripping] = useState(false);
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState({});
  const [postResult, setPostResult] = useState(null); // { operation, filename, fileSize, report }

  const handleStrip = async () => {
    setStripping(true);
    setPostResult(null);
    try {
      const { blob, filename } = await stripMetadata(file);
      downloadBlob(blob, filename);
      const newFile = new File([blob], filename, { type: blob.type });
      const report = await buildPostReport(newFile);
      setPostResult({ operation: "eliminacao", filename, fileSize: blob.size, report });
      toast.success("Arquivo sem metadados gerado. Confirmação disponível abaixo.");
    } catch (err) {
      toast.error(err?.message || "Falha ao eliminar metadados");
    } finally {
      setStripping(false);
    }
  };

  const handleEdit = async () => {
    setEditing(true);
    setPostResult(null);
    try {
      const filtered = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined && v !== null)
      );
      const { blob, filename } = await editMetadata(file, filtered);
      downloadBlob(blob, filename);
      const newFile = new File([blob], filename, { type: blob.type });
      const report = await buildPostReport(newFile);
      setPostResult({ operation: "edicao", filename, fileSize: blob.size, report });
      toast.success("Arquivo editado gerado. Relatório disponível abaixo.");
      setEditOpen(false);
    } catch (err) {
      toast.error(err?.message || "Falha ao editar metadados");
    } finally {
      setEditing(false);
    }
  };

  const canEdit = sections.length > 0;
  const canStrip = type !== null;

  return (
    <section data-testid="manipulation-panel" className="border border-[var(--ma-border)] bg-white">
      <header className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] px-6 py-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Manipulação de metadados</h3>
        <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
          {type ? FORMAT_LABEL[type] : "não suportado"}
        </span>
      </header>

      <div className="p-6">
        {!canStrip && (
          <div
            data-testid="manipulation-unsupported"
            className="space-y-3 border border-[var(--ma-border)] bg-[var(--ma-bg-secondary)] p-5"
          >
            <div className="flex items-start gap-3">
              <Warning size={18} weight="bold" className="mt-0.5 shrink-0 text-[var(--ma-warning)]" aria-hidden="true" />
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--ma-text)]">
                  Este formato ainda não suporta eliminação ou edição de metadados.
                </p>
                <p className="text-sm leading-relaxed text-[var(--ma-text-secondary)]">
                  A manipulação está disponível apenas para os formatos abaixo. Para os demais,
                  a aplicação continua oferecendo extração completa de metadados e cálculo de hash.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "JPG / JPEG",
                "PNG",
                "WebP",
                "PDF",
                "DOCX",
                "XLSX",
                "PPTX",
              ].map((f) => (
                <span
                  key={f}
                  className="border border-[var(--ma-border)] bg-white px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ma-text)]"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        )}

        {canStrip && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Strip */}
            <div className="flex flex-col gap-3 border border-[var(--ma-border)] p-5">
              <div className="flex items-center gap-3">
                <Eraser size={22} weight="bold" className="text-[var(--ma-text)]" aria-hidden="true" />
                <div className="font-display text-base font-semibold tracking-tight">Eliminar metadados</div>
              </div>
              <p className="text-sm leading-relaxed text-[var(--ma-text-secondary)]">
                Gera uma cópia limpa do arquivo, removendo EXIF, XMP, IPTC, autoria, GPS, datas e demais
                propriedades incorporadas.
              </p>
              <Button
                data-testid="strip-metadata-btn"
                variant="minimal"
                onClick={handleStrip}
                disabled={stripping}
                className="mt-auto"
              >
                {stripping ? "Processando…" : "Eliminar e baixar"}
              </Button>
            </div>

            {/* Edit */}
            <div className="flex flex-col gap-3 border border-[var(--ma-border)] p-5">
              <div className="flex items-center gap-3">
                <PencilSimple size={22} weight="bold" className="text-[var(--ma-text)]" aria-hidden="true" />
                <div className="font-display text-base font-semibold tracking-tight">Editar metadados</div>
              </div>
              <p className="text-sm leading-relaxed text-[var(--ma-text-secondary)]">
                Edite todos os campos relevantes — identificação, câmera, exposição, datas, GPS e mais.
                Deixe um campo em branco para mantê-lo inalterado.
              </p>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="open-edit-dialog-btn"
                    variant="minimal"
                    disabled={!canEdit}
                    className="mt-auto"
                  >
                    {canEdit ? "Abrir editor" : "Edição não disponível"}
                  </Button>
                </DialogTrigger>
                <DialogContent
                  data-testid="edit-dialog"
                  className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-none border-[var(--ma-text)]"
                >
                  <DialogHeader>
                    <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--ma-accent)]">
                      Edição local · {type ? FORMAT_LABEL[type] : ""}
                    </div>
                    <DialogTitle className="font-display text-2xl font-semibold tracking-tight">
                      Editar metadados
                    </DialogTitle>
                    <DialogDescription className="text-xs text-[var(--ma-text-secondary)]">
                      Todos os campos são opcionais. Apenas os preenchidos serão modificados.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="mt-2 space-y-6">
                    {sections.map((sec) => (
                      <div key={sec.section} className="space-y-3">
                        <div className="border-b border-[var(--ma-border)] pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ma-accent)]">
                          {sec.section}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {sec.fields.map((f) => (
                            <div key={f.key} className="space-y-1">
                              <label
                                htmlFor={`edit-${f.key}`}
                                className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--ma-text-secondary)]"
                              >
                                {f.label}
                              </label>
                              <input
                                id={`edit-${f.key}`}
                                data-testid={`edit-input-${f.key}`}
                                type="text"
                                inputMode={f.type === "number" ? "decimal" : "text"}
                                placeholder={f.placeholder || ""}
                                value={values[f.key] ?? ""}
                                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                                className="w-full rounded-none border border-[var(--ma-border)] bg-white px-3 py-2 font-mono text-sm focus:border-[var(--ma-text)] focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      variant="minimal"
                      onClick={() => setEditOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      data-testid="apply-edit-btn"
                      variant="minimal"
                      onClick={handleEdit}
                      disabled={editing}
                    >
                      {editing ? "Aplicando…" : "Aplicar e baixar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        )}

        {/* Post-manipulation report */}
        {postResult && (
          <div data-testid="post-manipulation-report" className="mt-6 border-2 border-[var(--ma-accent)] bg-white">
            <div className="flex items-center justify-between border-b border-[var(--ma-border)] bg-[rgba(0,47,167,0.04)] px-5 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} weight="fill" className="text-[var(--ma-success)]" aria-hidden="true" />
                <h4 className="text-xs font-bold uppercase tracking-[0.2em]">
                  Relatório do arquivo {postResult.operation === "eliminacao" ? "limpo" : "editado"}
                </h4>
              </div>
              <span className="font-mono text-[10px] text-[var(--ma-text-secondary)]">
                {formatBytes(postResult.fileSize)}
              </span>
            </div>

            <div className="space-y-4 p-5">
              <div className="font-mono text-xs text-[var(--ma-text)] break-all">
                {postResult.filename}
              </div>

              <div className="grid gap-2 text-xs">
                <div className="grid grid-cols-[80px_1fr] items-start gap-3 border-b border-[var(--ma-border)] py-2">
                  <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)]">MD5</span>
                  <span className="font-mono break-all">{postResult.report.hashes.md5}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-start gap-3 border-b border-[var(--ma-border)] py-2">
                  <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)]">SHA-1</span>
                  <span className="font-mono break-all">{postResult.report.hashes.sha1}</span>
                </div>
                <div className="grid grid-cols-[80px_1fr] items-start gap-3 py-2">
                  <span className="font-bold uppercase tracking-widest text-[var(--ma-accent)]">SHA-256</span>
                  <span className="font-mono break-all">{postResult.report.hashes.sha256}</span>
                </div>
              </div>

              {postResult.operation === "eliminacao" ? (
                <>
                  <div className="flex items-start gap-3 border-l-2 border-[var(--ma-success)] bg-[rgba(22,163,74,0.05)] px-4 py-3 text-sm">
                    <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-[var(--ma-success)]" aria-hidden="true" />
                    <p className="text-[var(--ma-text)]">
                      <span className="font-semibold">Metadados eliminados com sucesso.</span> O arquivo limpo foi baixado.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      data-testid="download-strip-pdf-btn"
                      variant="minimal"
                      onClick={() => downloadStripPdfReport(originalReport, postResult.report)}
                    >
                      <FileText size={16} weight="bold" className="mr-2" aria-hidden="true" />
                      Comprovante PDF
                    </Button>
                    <Button
                      data-testid="download-strip-json-btn"
                      variant="minimal"
                      onClick={() => downloadStripJsonReport(originalReport, postResult.report)}
                    >
                      <Database size={16} weight="bold" className="mr-2" aria-hidden="true" />
                      Comprovante JSON
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-[var(--ma-text-secondary)]">
                    Escolha o tipo de relatório que deseja baixar:
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2 border border-[var(--ma-border)] p-4">
                      <div className="flex items-center gap-2">
                        <GitDiff size={18} weight="bold" className="text-[var(--ma-text)]" aria-hidden="true" />
                        <div className="text-sm font-semibold">Comparativo</div>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--ma-text-secondary)]">
                        Dados originais lado a lado com os dados editados.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button
                          data-testid="download-edit-compare-pdf-btn"
                          variant="minimal"
                          onClick={() => downloadEditPdfReport(originalReport, postResult.report, "comparison")}
                        >
                          <FileText size={14} weight="bold" className="mr-2" aria-hidden="true" /> PDF
                        </Button>
                        <Button
                          data-testid="download-edit-compare-json-btn"
                          variant="minimal"
                          onClick={() => downloadEditJsonReport(originalReport, postResult.report, "comparison")}
                        >
                          <Database size={14} weight="bold" className="mr-2" aria-hidden="true" /> JSON
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 border border-[var(--ma-border)] p-4">
                      <div className="flex items-center gap-2">
                        <FileArrowDown size={18} weight="bold" className="text-[var(--ma-text)]" aria-hidden="true" />
                        <div className="text-sm font-semibold">Apenas editado</div>
                      </div>
                      <p className="text-xs leading-relaxed text-[var(--ma-text-secondary)]">
                        Apenas os dados finais, sem mostrar os originais.
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button
                          data-testid="download-edit-only-pdf-btn"
                          variant="minimal"
                          onClick={() => downloadEditPdfReport(originalReport, postResult.report, "edited-only")}
                        >
                          <FileText size={14} weight="bold" className="mr-2" aria-hidden="true" /> PDF
                        </Button>
                        <Button
                          data-testid="download-edit-only-json-btn"
                          variant="minimal"
                          onClick={() => downloadEditJsonReport(originalReport, postResult.report, "edited-only")}
                        >
                          <Database size={14} weight="bold" className="mr-2" aria-hidden="true" /> JSON
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-[var(--ma-text-secondary)]">
          Todas as operações de manipulação acontecem no seu navegador. O arquivo original
          permanece intacto; uma nova cópia é gerada para download.
        </p>
      </div>
    </section>
  );
}
