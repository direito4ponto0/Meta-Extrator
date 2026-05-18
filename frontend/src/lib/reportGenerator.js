import jsPDF from "jspdf";
import { flattenMetadata } from "./formatters";

// ============================================================
// Common helpers
// ============================================================
const triggerDownload = (blob, filename) => {
  const safeName = String(filename || "Relatorio-Meta-Extrator")
    .replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200) || "Relatorio-Meta-Extrator";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Privacy: report timestamps are always rendered in UTC so the user's local
// time zone / locale never leaks into the generated PDF or JSON output.
const nowStamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
};

const fileStamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}_${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
};

// ============================================================
// Vector logo + watermark
// ============================================================
const drawLogo = (doc, x, y, size = 28, color = [10, 10, 10], opts = {}) => {
  const [r, g, b] = color;
  const strokeScale = typeof opts.strokeScale === "number" ? opts.strokeScale : 1;
  const fillScale = typeof opts.fillScale === "number" ? opts.fillScale : 1;
  // mRenderMode: "fill" (default, solid black M) or "stroke" (outline only).
  // Stroke mode is used by the watermark so the M visually matches the thin
  // lens/handle lines instead of dominating the watermark with a solid glyph.
  const mRenderMode = opts.mRenderMode || "fill";
  doc.setDrawColor(r, g, b);
  doc.setTextColor(r, g, b);

  // Lens
  const cx = x + size * 0.42;
  const cy = y + size * 0.42;
  const radius = size * 0.32;
  doc.setLineWidth(size * 0.075 * strokeScale);
  doc.circle(cx, cy, radius, "S");

  // Handle
  const handleStart = size * 0.66;
  const handleEnd = size * 0.95;
  doc.setLineWidth(size * 0.09 * strokeScale);
  doc.line(x + handleStart, y + handleStart, x + handleEnd, y + handleEnd);

  // M inside the lens
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size * 0.38 * fillScale);
  if (mRenderMode === "stroke") {
    // Draw the M as outline only so it carries the same visual weight as
    // the thin lens/handle strokes when used as a watermark.
    doc.setLineWidth(size * 0.075 * strokeScale);
    doc.text("M", cx, cy + size * 0.13, { align: "center", renderingMode: "stroke" });
  } else {
    doc.text("M", cx, cy + size * 0.13, { align: "center" });
  }
};

const drawWatermark = (doc) => {
  // The magnifying glass and the letter "M" are both drawn as outlined
  // strokes (no filled glyph) with very thin line width and very low
  // opacity, so the watermark stays subtle and never competes with the
  // report content for legibility.
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  // Larger size = strokes spread further apart, so the mark reads as a
  // diffuse background rather than a concentrated symbol.
  const size = Math.min(W, H) * 0.6;
  const x = (W - size) / 2;
  const y = (H - size) / 2;

  try {
    const gs = new doc.GState({ opacity: 0.04 });
    doc.setGState(gs);
  } catch (_) { /* GState may fail in some envs; fallback to faint color */ }

  // Lighter gray + thinner strokes => watermark stays in the background.
  drawLogo(doc, x, y, size, [180, 180, 180], { strokeScale: 0.1, mRenderMode: "stroke" });

  try {
    const gs = new doc.GState({ opacity: 1 });
    doc.setGState(gs);
  } catch (_) { /* ignore */ }
};

// ============================================================
// PDF context with auto watermark on every page
// ============================================================
const SITE_URL_TEXT = "metaextrator.com.br";
const SITE_URL = "https://metaextrator.com.br";

const newPdfDoc = (subtitleText) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;

  // Privacy: explicitly overwrite jsPDF's default /Info dictionary so the
  // PDF metadata never carries the jsPDF library signature or any other
  // information that could hint at the user's environment.
  try {
    doc.setProperties({
      title: "Relatorio Meta Extrator",
      subject: subtitleText || "Relatorio Meta Extrator",
      author: "Meta Extrator",
      keywords: "metaextrator, metadados, hash",
      creator: "Meta Extrator",
    });
  } catch (_) { /* ignore */ }

  const ctx = {
    doc, W, H, margin,
    y: margin,
    subtitle: subtitleText,
  };

  // Watermark + header on first page
  drawWatermark(doc);
  writeBrand(ctx);

  // Hook: whenever a new page is added, paint watermark and header band
  doc.internal.events.subscribe("addPage", () => {
    drawWatermark(doc);
  });

  return ctx;
};

const ensureSpace = (ctx, needed) => {
  // Reserve room for the footer message (~60pt) on every page
  const bottomReserved = 80;
  if (ctx.y + needed > ctx.H - ctx.margin - bottomReserved) {
    ctx.doc.addPage();
    ctx.y = ctx.margin;
  }
};

const divider = (ctx) => {
  ensureSpace(ctx, 14);
  ctx.doc.setDrawColor(229, 231, 235);
  ctx.doc.setLineWidth(0.5);
  ctx.doc.line(ctx.margin, ctx.y, ctx.W - ctx.margin, ctx.y);
  ctx.y += 14;
};

// ============================================================
// Brand header (logo + name + URL + subtitle + datetime)
// ============================================================
function writeBrand(ctx) {
  const { doc, W, margin } = ctx;
  ctx.y = margin;

  // Logo on left
  drawLogo(doc, margin, ctx.y, 28, [10, 10, 10]);

  // META EXTRATOR name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(10, 10, 10);
  doc.text("META EXTRATOR", margin + 38, ctx.y + 18);

  // Site URL right below the brand name (clickable)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 47, 167);
  doc.textWithLink(SITE_URL_TEXT, margin + 38, ctx.y + 30, { url: SITE_URL });

  // Datetime on the right
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(82, 82, 82);
  doc.text(`Gerado em: ${nowStamp()}`, W - margin, ctx.y + 18, { align: "right" });

  ctx.y += 46;

  // Subtitle line (single line, bold accent)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 47, 167);
  doc.text(ctx.subtitle, margin, ctx.y);
  ctx.y += 8;

  // Accent rule
  doc.setDrawColor(0, 47, 167);
  doc.setLineWidth(1.2);
  doc.line(margin, ctx.y, margin + 60, ctx.y);
  ctx.y += 6;

  // Light divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, ctx.y, W - margin, ctx.y);
  ctx.y += 36;
}

// ============================================================
// Section helpers
// ============================================================
const writeSectionTitle = (ctx, title) => {
  ensureSpace(ctx, 26);
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(12);
  ctx.doc.setTextColor(10, 10, 10);
  ctx.doc.text(title, ctx.margin, ctx.y);
  ctx.y += 16;
};

const writeKeyValue = (ctx, key, value, opts = {}) => {
  const indent = opts.indent || 140;
  ensureSpace(ctx, 14);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(10);
  ctx.doc.setTextColor(82, 82, 82);
  ctx.doc.text(`${key}:`, ctx.margin, ctx.y);
  ctx.doc.setTextColor(10, 10, 10);
  const lines = ctx.doc.splitTextToSize(String(value ?? "—"), ctx.W - ctx.margin - indent - 20);
  ctx.doc.text(lines, ctx.margin + indent, ctx.y);
  ctx.y += 14 * lines.length;
};

const writeHashes = (ctx, hashes) => {
  if (!hashes) return;
  const entries = Object.entries(hashes);
  entries.forEach(([k, v]) => {
    if (!v) return;
    ensureSpace(ctx, 16);
    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setFontSize(10);
    ctx.doc.setTextColor(0, 47, 167);
    ctx.doc.text(k.toUpperCase(), ctx.margin, ctx.y);
    ctx.doc.setFont("courier", "normal");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(10, 10, 10);
    const lines = ctx.doc.splitTextToSize(v, ctx.W - ctx.margin - 90);
    ctx.doc.text(lines, ctx.margin + 70, ctx.y);
    ctx.y += 14 * lines.length;
  });
};

const writeMetadataTable = (ctx, metadata) => {
  const flat = flattenMetadata(metadata);
  const entries = Object.entries(flat).filter(([k]) => !k.startsWith("file."));
  if (entries.length === 0) {
    ensureSpace(ctx, 14);
    ctx.doc.setFont("helvetica", "italic");
    ctx.doc.setFontSize(9);
    ctx.doc.setTextColor(82, 82, 82);
    ctx.doc.text("Nenhum metadado encontrado.", ctx.margin, ctx.y);
    ctx.y += 14;
    return;
  }
  ctx.doc.setFontSize(9);
  entries.forEach(([k, v]) => {
    ensureSpace(ctx, 12);
    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setTextColor(82, 82, 82);
    const keyLines = ctx.doc.splitTextToSize(k, 200);
    ctx.doc.text(keyLines, ctx.margin, ctx.y);
    ctx.doc.setTextColor(10, 10, 10);
    const valLines = ctx.doc.splitTextToSize(String(v), ctx.W - ctx.margin - 220);
    ctx.doc.text(valLines, ctx.margin + 210, ctx.y);
    ctx.y += Math.max(keyLines.length, valLines.length) * 11 + 1;
  });
};

// ============================================================
// Tech stack section (dynamic per report)
// Each report passes only the techs that were actually used during its
// generation, so the "Tecnologias e bibliotecas utilizadas" section reflects
// the real operation and nothing else.
// ============================================================
const TECH_CATALOG = {
  hashWasm: { name: "hash-wasm", desc: "MD5, SHA-1/256/384/512, SHA3 (256/512) e BLAKE3 em WebAssembly, com streaming em chunks." },
  exifr: { name: "exifr", desc: "Extração de EXIF, GPS, XMP, IPTC e ICC em JPEG, TIFF, HEIC, PNG e RAW." },
  musicMetadata: { name: "music-metadata", desc: "Tags ID3, Vorbis, APE, iTunes e átomos MP4 em MP3, FLAC, WAV, M4A e MOV." },
  pdfjs: { name: "pdf.js (pdfjs-dist)", desc: "Leitura de metadados de PDF: autor, criador, datas, XMP e assinaturas." },
  pdfLib: { name: "pdf-lib", desc: "Edição, criação e limpeza de metadados de PDF (Title, Author, etc.)." },
  piexifjs: { name: "piexifjs", desc: "Edição e remoção de EXIF/GPS em arquivos JPEG, 100% em JavaScript." },
  jszip: { name: "JSZip + DOMParser", desc: "Leitura e reescrita dos XMLs internos (docProps) de DOCX, XLSX e PPTX." },
  fileApi: { name: "WebAssembly + File API", desc: "Leitura em chunks de 32 MB via Blob.slice() para suportar até 10 GB sem estourar memória." },
  canvas: { name: "Canvas API", desc: "Re-encode de PNG/WebP para descartar chunks de metadados (tEXt, iTXt, EXIF embutido)." },
  pngChunks: { name: "png-chunks-extract / encode / png-chunk-text", desc: "Manipulação de chunks tEXt/iTXt/zTXt em arquivos PNG." },
  videoEl: { name: "HTMLVideoElement", desc: "Leitura de duração, dimensões e codecs de vídeo via tag <video> oculta." },
  domParser: { name: "DOMParser (XML)", desc: "Análise nativa dos XMLs internos do Office (docProps/core.xml, app.xml, custom.xml)." },
  riff: { name: "WebP RIFF parser (interno)", desc: "Reescrita de chunks RIFF/VP8X/EXIF em arquivos WebP." },
  jspdf: { name: "jsPDF", desc: "Geração deste relatório PDF integralmente no navegador." },
};

// Build a tech-key list for extraction reports based on the file category.
const EXTENSION_TO_CATEGORY = (() => {
  const map = new Map();
  const add = (exts, cat) => exts.forEach((e) => map.set(e, cat));
  add(["jpg", "jpeg", "jpe", "jfif", "png", "apng", "tif", "tiff", "heic", "heif", "webp",
       "avif", "gif", "bmp", "ico", "svg", "psd", "jp2", "jxl", "hdr", "tga", "pcx",
       "dng", "cr2", "cr3", "nef", "arw", "rw2", "raf", "orf", "pef", "raw"], "image");
  add(["pdf"], "pdf");
  add(["docx", "docm", "xlsx", "xlsm", "xlsb", "pptx", "pptm", "odt", "ods", "odp"], "office");
  add(["mp3", "wav", "flac", "ogg", "opus", "m4a", "aac", "aiff", "ape", "wma"], "audio");
  add(["mp4", "m4v", "mov", "webm", "avi", "mkv", "3gp", "wmv", "flv", "mpg", "mpeg"], "video");
  add(["zip", "jar", "apk", "epub"], "archive");
  return map;
})();

const guessCategoryFromFileName = (name) => {
  if (!name) return "generic";
  const i = name.lastIndexOf(".");
  const ext = i >= 0 ? name.slice(i + 1).toLowerCase() : "";
  return EXTENSION_TO_CATEGORY.get(ext) || "generic";
};

const techKeysForExtraction = (category) => {
  switch (category) {
    case "image":   return ["exifr", "fileApi", "hashWasm", "jspdf"];
    case "pdf":     return ["pdfjs", "fileApi", "hashWasm", "jspdf"];
    case "office":  return ["jszip", "domParser", "fileApi", "hashWasm", "jspdf"];
    case "audio":   return ["musicMetadata", "fileApi", "hashWasm", "jspdf"];
    case "video":   return ["musicMetadata", "videoEl", "fileApi", "hashWasm", "jspdf"];
    case "archive": return ["jszip", "fileApi", "hashWasm", "jspdf"];
    case "ebook":   return ["jszip", "domParser", "fileApi", "hashWasm", "jspdf"];
    default:        return ["fileApi", "hashWasm", "jspdf"];
  }
};

const techKeysForManipulation = (fileName) => {
  if (!fileName) return ["fileApi", "hashWasm", "jspdf"];
  const i = fileName.lastIndexOf(".");
  const ext = i >= 0 ? fileName.slice(i + 1).toLowerCase() : "";
  if (["jpg", "jpeg", "jpe", "jfif"].includes(ext)) return ["piexifjs", "fileApi", "hashWasm", "jspdf"];
  if (ext === "png") return ["pngChunks", "canvas", "fileApi", "hashWasm", "jspdf"];
  if (ext === "webp") return ["piexifjs", "riff", "canvas", "fileApi", "hashWasm", "jspdf"];
  if (ext === "pdf") return ["pdfLib", "fileApi", "hashWasm", "jspdf"];
  if (["docx", "docm", "xlsx", "xlsm", "pptx", "pptm"].includes(ext)) return ["jszip", "domParser", "fileApi", "hashWasm", "jspdf"];
  return ["fileApi", "hashWasm", "jspdf"];
};

const writeTechSection = (ctx, sectionNumber, techKeys) => {
  const keys = Array.isArray(techKeys) && techKeys.length > 0
    ? techKeys
    : ["fileApi", "hashWasm", "jspdf"];

  writeSectionTitle(ctx, `${sectionNumber}. Tecnologias e bibliotecas utilizadas`);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(9);
  keys.forEach((k) => {
    const t = TECH_CATALOG[k];
    if (!t) return;
    const lines = ctx.doc.splitTextToSize(t.desc, ctx.W - ctx.margin - 200);
    const neededSpace = Math.max(12 * lines.length, 16) + 4;
    ensureSpace(ctx, neededSpace);

    ctx.doc.setFont("helvetica", "bold");
    ctx.doc.setTextColor(0, 47, 167);
    ctx.doc.text(t.name, ctx.margin, ctx.y);

    ctx.doc.setFont("helvetica", "normal");
    ctx.doc.setTextColor(82, 82, 82);
    ctx.doc.text(lines, ctx.margin + 180, ctx.y);

    ctx.y += Math.max(12 * lines.length, 16) + 3;
  });
};

// ============================================================
// Footer applied to ALL pages right before saving
// ============================================================
const FOOTER_TEXT =
  "Este relatório foi gerado integralmente no navegador do usuário, sem upload, transmissão ou armazenamento de dados em servidores externos. Os hashes acima permitem verificar a integridade do arquivo analisado.";

const writeFooterAllPages = (doc) => {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 48;
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);

    // Light separator
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(margin, H - 62, W - margin, H - 62);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(82, 82, 82);
    const lines = doc.splitTextToSize(FOOTER_TEXT, W - margin * 2);
    doc.text(lines, margin, H - 50);

    // Page indicator on the right
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(`Página ${i} de ${total}`, W - margin, H - 24, { align: "right" });
  }
};

const buildPdfBlob = (doc, filename) => {
  writeFooterAllPages(doc);

  // Privacy: jsPDF hard-codes its own /Producer (e.g. "jsPDF 4.2.1") which
  // could be considered software/equipment information. We rebuild the PDF
  // bytes replacing the /Producer entry with a neutral value before exposing
  // the blob to the user.
  const rawBlob = doc.output("blob");
  return rawBlob.arrayBuffer().then((ab) => {
    const bytes = new Uint8Array(ab);
    const NEUTRAL_PRODUCER = "Meta Extrator";
    // Locate "/Producer (...)" in the PDF stream and replace the value
    // keeping the same byte length (padded with spaces) so that the xref
    // offsets remain valid.
    let i = 0;
    const needle = [0x2F, 0x50, 0x72, 0x6F, 0x64, 0x75, 0x63, 0x65, 0x72]; // "/Producer"
    while (i < bytes.length - needle.length) {
      let match = true;
      for (let k = 0; k < needle.length; k++) {
        if (bytes[i + k] !== needle[k]) { match = false; break; }
      }
      if (match) {
        // Skip whitespace
        let j = i + needle.length;
        while (j < bytes.length && (bytes[j] === 0x20 || bytes[j] === 0x09)) j++;
        if (bytes[j] === 0x28 /* '(' */) {
          // Find closing ')' respecting escape '\)'
          let end = j + 1;
          while (end < bytes.length) {
            if (bytes[end] === 0x5C) { end += 2; continue; }
            if (bytes[end] === 0x29 /* ')' */) break;
            end++;
          }
          const innerStart = j + 1;
          const innerLen = end - innerStart;
          // Build replacement: prefer "Meta Extrator", fall back to a shorter
          // abbreviation when the original slot is too small to fit it.
          const desired = NEUTRAL_PRODUCER;
          const replacement = desired.length <= innerLen
            ? desired.padEnd(innerLen, " ")
            : "Meta".padEnd(innerLen, " ").slice(0, innerLen);
          for (let k = 0; k < innerLen; k++) {
            bytes[innerStart + k] = replacement.charCodeAt(k);
          }
          break;
        }
      }
      i++;
    }
    return { blob: new Blob([bytes], { type: "application/pdf" }), filename };
  });
};

// ============================================================
// Standard subtitle used in every report
// ============================================================
const SUBTITLE_EXTRACT = "Relatório de Análise de Metadados — Processamento 100% local (navegador).";
const SUBTITLE_STRIP = "Relatório de Eliminação de Metadados — Processamento 100% local (navegador).";
const SUBTITLE_EDIT = "Relatório de Edição de Metadados — Processamento 100% local (navegador).";
const SUBTITLE_SIGN = "Relatório de Assinatura Hash — Processamento 100% local (navegador).";
const SUBTITLE_COMPARE = "Relatório de Comparação Hash — Processamento 100% local (navegador).";

// ============================================================
// 1) EXTRACTION REPORT
// ============================================================
export const downloadJsonReport = (report) => {
  const minimal = {
    application: "Meta Extrator",
    operacao: "extracao",
    gerado_em: new Date().toISOString(),
    arquivo: report?.file?.fileName,
    hashes: report?.hashes,
    metadados: report?.metadata,
  };
  const blob = new Blob([JSON.stringify(minimal, null, 2)], { type: "application/json" });
  triggerDownload(blob, `Relatorio-Meta-Extrator_extracao_${fileStamp()}.json`);
};

export const downloadPdfReport = async (report) => {
  const { blob, filename } = await buildPdfReportBlob(report);
  triggerDownload(blob, filename);
};

export const buildPdfReportBlob = (report) => {
  const ctx = newPdfDoc(SUBTITLE_EXTRACT);

  writeSectionTitle(ctx, "1. Arquivo analisado");
  writeKeyValue(ctx, "Nome", report.file.fileName);
  if (report.file.size != null) writeKeyValue(ctx, "Tamanho", `${report.file.size} bytes`);
  if (report.file.type) writeKeyValue(ctx, "Tipo MIME", report.file.type);
  ctx.y += 6;
  divider(ctx);

  writeSectionTitle(ctx, "2. Hashes criptográficos");
  writeHashes(ctx, report.hashes);
  ctx.y += 6;
  divider(ctx);

  writeSectionTitle(ctx, "3. Categoria detectada");
  writeKeyValue(ctx, "Categoria", report.category || "—");
  ctx.y += 6;
  divider(ctx);

  writeSectionTitle(ctx, "4. Metadados extraídos");
  writeMetadataTable(ctx, report.metadata);
  ctx.y += 6;
  divider(ctx);

  writeTechSection(ctx, 5, techKeysForExtraction(report.category));

  return buildPdfBlob(ctx.doc, `Relatorio-Meta-Extrator_extracao_${fileStamp()}.pdf`);
};

// ============================================================
// 2) STRIP REPORT
// ============================================================
export const downloadStripJsonReport = (originalReport, newReport) => {
  const minimal = {
    application: "Meta Extrator",
    operacao: "eliminacao",
    gerado_em: new Date().toISOString(),
    status: "sucesso",
    mensagem: "Todos os metadados foram eliminados com sucesso.",
    arquivo_original: originalReport?.file?.fileName,
    arquivo_limpo: newReport?.file?.fileName,
    hashes_arquivo_limpo: newReport?.hashes,
  };
  const blob = new Blob([JSON.stringify(minimal, null, 2)], { type: "application/json" });
  triggerDownload(blob, `Relatorio-Meta-Extrator_eliminacao_${fileStamp()}.json`);
};

export const downloadStripPdfReport = async (originalReport, newReport) => {
  const { blob, filename } = await buildStripPdfBlob(originalReport, newReport);
  triggerDownload(blob, filename);
};

export const buildStripPdfBlob = (originalReport, newReport) => {
  const ctx = newPdfDoc(SUBTITLE_STRIP);

  ensureSpace(ctx, 56);
  ctx.doc.setFillColor(220, 252, 231);
  ctx.doc.rect(ctx.margin, ctx.y, ctx.W - ctx.margin * 2, 40, "F");
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(22, 101, 52);
  ctx.doc.text("Metadados eliminados com sucesso", ctx.margin + 12, ctx.y + 16);
  ctx.doc.setFont("helvetica", "normal");
  ctx.doc.setFontSize(9);
  ctx.doc.text("O arquivo limpo foi gerado e baixado.", ctx.margin + 12, ctx.y + 30);
  ctx.y += 56;
  divider(ctx);

  writeSectionTitle(ctx, "1. Arquivos");
  writeKeyValue(ctx, "Arquivo original", originalReport.file.fileName);
  writeKeyValue(ctx, "Arquivo limpo", newReport.file.fileName);
  ctx.y += 6;
  divider(ctx);

  writeSectionTitle(ctx, "2. Hashes do arquivo limpo");
  writeHashes(ctx, newReport.hashes);
  ctx.y += 6;
  divider(ctx);

  writeTechSection(ctx, 3, techKeysForManipulation(originalReport?.file?.fileName));

  return buildPdfBlob(ctx.doc, `Relatorio-Meta-Extrator_eliminacao_${fileStamp()}.pdf`);
};

// ============================================================
// 3) EDIT REPORT (comparison | edited-only)
// ============================================================
export const downloadEditJsonReport = (originalReport, newReport, mode = "comparison") => {
  const minimal = {
    application: "Meta Extrator",
    operacao: "edicao",
    gerado_em: new Date().toISOString(),
    modo: mode === "comparison" ? "comparativo" : "apenas_editado",
    arquivo_original: originalReport?.file?.fileName,
    arquivo_editado: newReport?.file?.fileName,
    hashes_arquivo_editado: newReport?.hashes,
    metadados_editados: newReport?.metadata,
    ...(mode === "comparison" ? {
      hashes_arquivo_original: originalReport?.hashes,
      metadados_originais: originalReport?.metadata,
    } : {}),
  };
  const blob = new Blob([JSON.stringify(minimal, null, 2)], { type: "application/json" });
  const suffix = mode === "comparison" ? "comparativo" : "editado";
  triggerDownload(blob, `Relatorio-Meta-Extrator_edicao_${suffix}_${fileStamp()}.json`);
};

export const downloadEditPdfReport = async (originalReport, newReport, mode = "comparison") => {
  const { blob, filename } = await buildEditPdfBlob(originalReport, newReport, mode);
  triggerDownload(blob, filename);
};

export const buildEditPdfBlob = (originalReport, newReport, mode = "comparison") => {
  const ctx = newPdfDoc(SUBTITLE_EDIT);

  writeSectionTitle(ctx, "1. Arquivos");
  writeKeyValue(ctx, "Arquivo original", originalReport.file.fileName);
  writeKeyValue(ctx, "Arquivo editado", newReport.file.fileName);
  ctx.y += 6;
  divider(ctx);

  if (mode === "comparison") {
    writeSectionTitle(ctx, "2. Hashes — Arquivo original");
    writeHashes(ctx, originalReport.hashes);
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "3. Metadados originais");
    writeMetadataTable(ctx, originalReport.metadata);
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "4. Hashes — Arquivo editado");
    writeHashes(ctx, newReport.hashes);
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "5. Metadados após edição");
    writeMetadataTable(ctx, newReport.metadata);
    ctx.y += 6;
    divider(ctx);
  } else {
    writeSectionTitle(ctx, "2. Hashes — Arquivo editado");
    writeHashes(ctx, newReport.hashes);
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "3. Metadados após edição");
    writeMetadataTable(ctx, newReport.metadata);
    ctx.y += 6;
    divider(ctx);
  }

  writeTechSection(ctx, mode === "comparison" ? 6 : 4, techKeysForManipulation(originalReport?.file?.fileName));

  const suffix = mode === "comparison" ? "comparativo" : "editado";
  return buildPdfBlob(ctx.doc, `Relatorio-Meta-Extrator_edicao_${suffix}_${fileStamp()}.pdf`);
};

// ============================================================
// 4) HASH SIGNATURE REPORT
// ============================================================
export const downloadSignatureJson = (result) => {
  const data = {
    application: "Meta Extrator",
    operacao: "assinatura_hash",
    gerado_em: new Date().toISOString(),
    arquivo: result.fileName,
    tipo_mime: result.mimeType,
    tamanho_bytes: result.fileSize,
    assinaturas_hash: result.hashes,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, `Relatorio-Meta-Extrator_assinatura_${fileStamp()}.json`);
};

export const downloadSignaturePdf = async (result) => {
  const { blob, filename } = await buildSignaturePdfBlob(result);
  triggerDownload(blob, filename);
};

export const buildSignaturePdfBlob = (result) => {
  const ctx = newPdfDoc(SUBTITLE_SIGN);

  writeSectionTitle(ctx, "1. Arquivo");
  writeKeyValue(ctx, "Nome", result.fileName);
  writeKeyValue(ctx, "Tipo MIME", result.mimeType);
  writeKeyValue(ctx, "Tamanho", `${result.fileSize} bytes`);
  ctx.y += 6;
  divider(ctx);

  writeSectionTitle(ctx, "2. Assinaturas criptográficas");
  writeHashes(ctx, result.hashes);
  ctx.y += 6;
  divider(ctx);

  writeTechSection(ctx, 3, ["fileApi", "hashWasm", "jspdf"]);

  return buildPdfBlob(ctx.doc, `Relatorio-Meta-Extrator_assinatura_${fileStamp()}.pdf`);
};

// ============================================================
// 5) HASH COMPARISON REPORT
// ============================================================
export const downloadComparisonJson = (result) => {
  const data = {
    application: "Meta Extrator",
    operacao: "comparacao_hash",
    gerado_em: new Date().toISOString(),
    modo: result.mode === "file-file" ? "arquivo_x_arquivo" : "arquivo_x_hash",
    veredito: result.verdict,
    ...(result.mode === "file-file"
      ? {
          arquivo_a: result.fileA,
          arquivo_b: result.fileB,
          comparacoes: result.comparisons,
        }
      : {
          arquivo: result.fileA,
          hash_esperado: result.expectedHash,
          algoritmo_detectado: result.detectedAlgorithm,
          algoritmo_correspondente: result.matchedAlgorithm,
          comparacoes: result.comparisons,
        }),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  triggerDownload(blob, `Relatorio-Meta-Extrator_comparacao_${result.verdict}_${fileStamp()}.json`);
};

export const downloadComparisonPdf = async (result) => {
  const { blob, filename } = await buildComparisonPdfBlob(result);
  triggerDownload(blob, filename);
};

export const buildComparisonPdfBlob = (result) => {
  const ctx = newPdfDoc(SUBTITLE_COMPARE);

  // Verdict banner
  ensureSpace(ctx, 50);
  const positive = result.verdict === "identicos" || result.verdict === "valido";
  const [r, g, b] = positive ? [220, 252, 231] : [254, 226, 226];
  const [tr, tg, tb] = positive ? [22, 101, 52] : [153, 27, 27];
  ctx.doc.setFillColor(r, g, b);
  ctx.doc.rect(ctx.margin, ctx.y, ctx.W - ctx.margin * 2, 36, "F");
  ctx.doc.setFont("helvetica", "bold");
  ctx.doc.setFontSize(11);
  ctx.doc.setTextColor(tr, tg, tb);
  const label = {
    identicos: "Arquivos idênticos",
    diferentes: "Arquivos diferentes",
    valido: `Hash válido${result.matchedAlgorithm ? ` (${result.matchedAlgorithm})` : ""}`,
    invalido: "Hash não corresponde",
  }[result.verdict];
  ctx.doc.text(label, ctx.margin + 12, ctx.y + 22);
  ctx.y += 50;
  divider(ctx);

  if (result.mode === "file-file") {
    writeSectionTitle(ctx, "1. Arquivos comparados");
    writeKeyValue(ctx, "Arquivo A", result.fileA.name);
    writeKeyValue(ctx, "Arquivo B", result.fileB.name);
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "2. Comparações por algoritmo");
    result.comparisons.forEach((c) => {
      ensureSpace(ctx, 40);
      ctx.doc.setFont("helvetica", "bold");
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(0, 47, 167);
      ctx.doc.text(`${c.algorithm}   ${c.match ? "idênticos" : "diferem"}`, ctx.margin, ctx.y);
      ctx.y += 12;
      ctx.doc.setFont("courier", "normal");
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(82, 82, 82);
      const aLines = ctx.doc.splitTextToSize(`A: ${c.hashA}`, ctx.W - ctx.margin * 2);
      ctx.doc.text(aLines, ctx.margin, ctx.y);
      ctx.y += 10 * aLines.length;
      const bLines = ctx.doc.splitTextToSize(`B: ${c.hashB}`, ctx.W - ctx.margin * 2);
      ctx.doc.text(bLines, ctx.margin, ctx.y);
      ctx.y += 10 * bLines.length + 6;
    });
  } else {
    writeSectionTitle(ctx, "1. Verificação");
    writeKeyValue(ctx, "Arquivo", result.fileA.name);
    writeKeyValue(ctx, "Hash esperado", result.expectedHash);
    writeKeyValue(ctx, "Algoritmo detectado", result.detectedAlgorithm || "—");
    ctx.y += 6;
    divider(ctx);

    writeSectionTitle(ctx, "2. Hashes calculados do arquivo");
    result.comparisons.forEach((c) => {
      ensureSpace(ctx, 22);
      ctx.doc.setFont("helvetica", "bold");
      ctx.doc.setFontSize(10);
      ctx.doc.setTextColor(c.match ? 22 : 0, c.match ? 101 : 47, c.match ? 52 : 167);
      ctx.doc.text(`${c.algorithm}${c.match ? "  (corresponde)" : ""}`, ctx.margin, ctx.y);
      ctx.doc.setFont("courier", "normal");
      ctx.doc.setFontSize(8);
      ctx.doc.setTextColor(10, 10, 10);
      const lines = ctx.doc.splitTextToSize(c.hashComputed, ctx.W - ctx.margin - 130);
      ctx.doc.text(lines, ctx.margin + 110, ctx.y);
      ctx.y += 12 * lines.length + 4;
    });
  }
  ctx.y += 6;
  divider(ctx);

  writeTechSection(ctx, 3, ["fileApi", "hashWasm", "jspdf"]);

  return buildPdfBlob(ctx.doc, `Relatorio-Meta-Extrator_comparacao_${result.verdict}_${fileStamp()}.pdf`);
};
