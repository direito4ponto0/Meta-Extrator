// Metadata extractor — dispatches to specific extractors based on file type.
// All extraction happens in the browser. Nothing is uploaded.

import exifr from "exifr";
import JSZip from "jszip";
import { parseBlob as parseAudioBlob } from "music-metadata";

// Security: limits to prevent zip-bomb / DoS during extraction
const MAX_ZIP_ENTRIES_EXT = 10000;
const MAX_ZIP_ENTRY_SIZE_EXT = 50 * 1024 * 1024;
const assertZipSafeExt = (zip) => {
  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES_EXT) {
    throw new Error("Arquivo compactado com número excessivo de entradas.");
  }
  for (const name of entries) {
    const entry = zip.files[name];
    if (entry?._data?.uncompressedSize > MAX_ZIP_ENTRY_SIZE_EXT) {
      throw new Error(`Entrada interna excede limite de tamanho (${name}).`);
    }
  }
};

const getExtension = (name) => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

const IMAGE_EXT = [
  "jpg", "jpeg", "jpe", "jfif", "png", "apng", "tif", "tiff", "heic", "heif", "heics", "heifs",
  "webp", "avif", "gif", "bmp", "dib", "ico", "cur", "svg", "psd", "psb", "jp2", "j2k", "jpx",
  "jxl", "hdr", "exr", "tga", "pcx", "xcf",
  // RAW formats
  "dng", "cr2", "cr3", "crw", "nef", "nrw", "arw", "srf", "sr2", "rw2", "raf", "rwl",
  "orf", "pef", "ptx", "x3f", "raw", "3fr", "fff", "iiq", "mrw", "mef", "mos", "erf",
];
const AUDIO_EXT = [
  "mp3", "mp2", "mp1", "wav", "wave", "flac", "ogg", "oga", "opus", "spx", "m4a", "m4b",
  "aac", "aif", "aiff", "aifc", "ape", "wv", "wma", "amr", "ra", "rm", "mid", "midi",
  "ac3", "dts", "dsf", "dff", "tta", "tak", "mka",
];
const VIDEO_EXT = [
  "mp4", "m4v", "m4p", "mov", "qt", "webm", "ogv", "ogm", "avi", "mkv", "mks", "3gp", "3g2",
  "wmv", "flv", "f4v", "f4p", "f4a", "f4b", "asf", "vob", "mts", "m2ts", "ts", "mxf", "rmvb",
  "divx", "mpg", "mpeg", "mpe", "mp1v", "mp2v", "m1v", "m2v",
];
const PDF_EXT = ["pdf"];
const OFFICE_EXT = [
  "docx", "docm", "xlsx", "xlsm", "xlsb", "pptx", "pptm",
  "odt", "ods", "odp", "odg", "odf",
];
const ARCHIVE_EXT = [
  "zip", "jar", "war", "ear", "apk", "ipa", "epub", "cbz", "xpi", "kmz", "rar", "7z",
  "tar", "gz", "tgz", "bz2", "tbz", "xz", "lz", "lzma", "z", "cab", "iso", "dmg", "img",
];
const TEXT_EXT = [
  "txt", "md", "markdown", "csv", "tsv", "log", "json", "jsonl", "ndjson", "xml", "html",
  "htm", "xhtml", "yaml", "yml", "ini", "cfg", "conf", "toml", "env",
  "js", "jsx", "mjs", "cjs", "ts", "tsx", "css", "scss", "sass", "less", "py", "rb",
  "java", "kt", "kts", "go", "rs", "c", "cpp", "cc", "cxx", "h", "hpp", "cs", "php",
  "swift", "sh", "bash", "zsh", "ps1", "bat", "pl", "lua", "sql", "r", "scala", "vue", "svelte",
];
const FONT_EXT = ["ttf", "otf", "woff", "woff2", "eot", "fon", "fnt"];
const EBOOK_EXT = ["epub", "mobi", "azw", "azw3", "fb2", "lit", "lrf", "djvu", "cbr", "cbz"];
const EXEC_EXT = ["exe", "dll", "msi", "elf", "so", "dylib", "app", "deb", "rpm", "appimage"];

const detectCategory = (file) => {
  const ext = getExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  if (IMAGE_EXT.includes(ext) || mime.startsWith("image/")) return "image";
  if (PDF_EXT.includes(ext) || mime === "application/pdf") return "pdf";
  if (OFFICE_EXT.includes(ext)) return "office";
  if (AUDIO_EXT.includes(ext) || mime.startsWith("audio/")) return "audio";
  if (VIDEO_EXT.includes(ext) || mime.startsWith("video/")) return "video";
  if (TEXT_EXT.includes(ext) || mime.startsWith("text/")) return "text";
  if (ARCHIVE_EXT.includes(ext) || mime.includes("zip") || mime.includes("compressed")) return "archive";
  if (FONT_EXT.includes(ext) || mime.startsWith("font/")) return "font";
  if (EBOOK_EXT.includes(ext)) return "ebook";
  if (EXEC_EXT.includes(ext)) return "executable";
  return "generic";
};

const baseFileInfo = (file) => ({
  fileName: file.name,
  fileSize: file.size,
  mimeType: file.type || "application/octet-stream",
  lastModified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  extension: getExtension(file.name),
});

// IMAGE
const extractImage = async (file) => {
  let parsed = null;
  try {
    parsed = await exifr.parse(file, {
      tiff: true, ifd0: true, exif: true, gps: true, xmp: true, iptc: true, icc: true,
      interop: true, ihdr: true, jfif: true, translateKeys: true, translateValues: true,
      reviveValues: true, sanitize: true, mergeOutput: false,
    });
  } catch (e) {
    parsed = { error: String(e?.message || e) };
  }

  let dimensions = null;
  try {
    const url = URL.createObjectURL(file);
    dimensions = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
      img.src = url;
    });
  } catch { /* ignore */ }

  let gps = null;
  try {
    const g = await exifr.gps(file);
    if (g && typeof g.latitude === "number" && typeof g.longitude === "number") {
      gps = { latitude: g.latitude, longitude: g.longitude };
    }
  } catch { /* ignore */ }

  return {
    category: "image",
    file: baseFileInfo(file),
    dimensions,
    gps,
    exif: parsed || {},
  };
};

// PDF
const extractPdf = async (file) => {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const meta = await doc.getMetadata().catch(() => ({}));

  const info = meta?.info || {};
  const metadataXmp = meta?.metadata ? meta.metadata.getAll() : null;

  return {
    category: "pdf",
    file: baseFileInfo(file),
    document: {
      pageCount: doc.numPages,
      title: info.Title || null,
      author: info.Author || null,
      subject: info.Subject || null,
      keywords: info.Keywords || null,
      creator: info.Creator || null,
      producer: info.Producer || null,
      creationDate: info.CreationDate || null,
      modificationDate: info.ModDate || null,
      pdfVersion: info.PDFFormatVersion || null,
      isLinearized: info.IsLinearized || false,
      isAcroFormPresent: info.IsAcroFormPresent || false,
      isXFAPresent: info.IsXFAPresent || false,
      isCollectionPresent: info.IsCollectionPresent || false,
      isSignaturesPresent: info.IsSignaturesPresent || false,
    },
    xmp: metadataXmp || null,
  };
};

// OFFICE (docx/xlsx/pptx via ZIP)
const extractOffice = async (file) => {
  const ext = getExtension(file.name);
  const result = {
    category: "office",
    file: baseFileInfo(file),
    documentType: ext.toUpperCase(),
    core: {},
    app: {},
    custom: {},
  };

  try {
    const zip = await JSZip.loadAsync(file);
    assertZipSafeExt(zip);
    const parseXml = (xml) => {
      const out = {};
      if (!xml) return out;
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, "application/xml");
      doc.documentElement.childNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        const name = node.localName || node.nodeName;
        const val = node.textContent?.trim();
        if (val) out[name] = val;
      });
      return out;
    };

    const core = zip.file("docProps/core.xml");
    const app = zip.file("docProps/app.xml");
    const custom = zip.file("docProps/custom.xml");
    if (core) result.core = parseXml(await core.async("string"));
    if (app) result.app = parseXml(await app.async("string"));
    if (custom) result.custom = parseXml(await custom.async("string"));
  } catch (e) {
    result.error = String(e?.message || e);
  }
  return result;
};

// AUDIO
const extractAudio = async (file) => {
  const out = { category: "audio", file: baseFileInfo(file), format: {}, common: {}, gps: null };
  try {
    const md = await parseAudioBlob(file, { duration: true });
    out.format = md.format || {};
    out.common = md.common || {};
    // Some audio files (mp4/m4a) may carry GPS in iTunes-style tags
    const loc = md.native?.iTunes?.find?.((t) => t.id === "©xyz") || md.common?.location;
    if (loc) out.gps = parseLocationString(loc?.value || loc);
  } catch (e) {
    out.error = String(e?.message || e);
  }
  return out;
};

// VIDEO — use music-metadata (supports mp4/mov via mp4 atoms) + HTML5 video element fallback
const extractVideo = async (file) => {
  const out = { category: "video", file: baseFileInfo(file), format: {}, common: {}, dimensions: null, duration: null, gps: null };

  // Try music-metadata first (works for mp4/mov/webm via mp4)
  try {
    const md = await parseAudioBlob(file, { duration: true });
    out.format = md.format || {};
    out.common = md.common || {};
    const xyz = md.native?.["iTunes"]?.find?.((t) => t.id === "©xyz")?.value
      || md.native?.["mp4"]?.find?.((t) => t.id === "©xyz")?.value;
    if (xyz) out.gps = parseLocationString(xyz);
  } catch (e) {
    out.warning = String(e?.message || e);
  }

  // HTML5 video for dimensions + duration
  try {
    const url = URL.createObjectURL(file);
    const info = await new Promise((resolve) => {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.muted = true;
      v.onloadedmetadata = () => {
        resolve({ width: v.videoWidth, height: v.videoHeight, duration: v.duration });
        URL.revokeObjectURL(url);
      };
      v.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
      v.src = url;
    });
    if (info) {
      out.dimensions = { width: info.width, height: info.height };
      out.duration = info.duration;
    }
  } catch { /* ignore */ }

  return out;
};

// TEXT
const extractText = async (file) => {
  const sample = file.slice(0, Math.min(file.size, 64 * 1024));
  let preview = "";
  try { preview = await sample.text(); } catch { /* ignore */ }
  const lines = preview ? preview.split(/\r\n|\r|\n/).length : null;
  return {
    category: "text",
    file: baseFileInfo(file),
    encoding: "UTF-8 (estimated)",
    sampleLineCount: lines,
    preview: preview.slice(0, 2000),
  };
};

// Magic-byte signature table for fallback format detection.
// Sources: https://www.garykessler.net/library/file_sigs.html
const MAGIC_SIGNATURES = [
  // Archives
  { sig: [0x50, 0x4B, 0x03, 0x04], name: "ZIP archive (PK)", category: "archive" },
  { sig: [0x50, 0x4B, 0x05, 0x06], name: "ZIP archive (empty)", category: "archive" },
  { sig: [0x50, 0x4B, 0x07, 0x08], name: "ZIP archive (spanned)", category: "archive" },
  { sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00], name: "RAR v1.5+", category: "archive" },
  { sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00], name: "RAR v5+", category: "archive" },
  { sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C], name: "7-Zip archive", category: "archive" },
  { sig: [0x1F, 0x8B, 0x08], name: "GZIP", category: "archive" },
  { sig: [0x42, 0x5A, 0x68], name: "BZIP2", category: "archive" },
  { sig: [0xFD, 0x37, 0x7A, 0x58, 0x5A, 0x00], name: "XZ", category: "archive" },
  { sig: [0x75, 0x73, 0x74, 0x61, 0x72], name: "TAR", category: "archive", offset: 257 },
  // Executables
  { sig: [0x4D, 0x5A], name: "Windows Executable (PE/DOS)", category: "executable" },
  { sig: [0x7F, 0x45, 0x4C, 0x46], name: "ELF (Linux executable)", category: "executable" },
  { sig: [0xCA, 0xFE, 0xBA, 0xBE], name: "Mach-O Fat Binary / Java Class", category: "executable" },
  { sig: [0xCF, 0xFA, 0xED, 0xFE], name: "Mach-O (macOS executable)", category: "executable" },
  { sig: [0xFE, 0xED, 0xFA, 0xCE], name: "Mach-O (macOS, big-endian)", category: "executable" },
  // Disk images
  { sig: [0x43, 0x44, 0x30, 0x30, 0x31], name: "ISO 9660 disk image", category: "archive", offset: 0x8001 },
  // Fonts
  { sig: [0x00, 0x01, 0x00, 0x00, 0x00], name: "TTF font", category: "font" },
  { sig: [0x4F, 0x54, 0x54, 0x4F], name: "OTF font", category: "font" },
  { sig: [0x77, 0x4F, 0x46, 0x46], name: "WOFF font", category: "font" },
  { sig: [0x77, 0x4F, 0x46, 0x32], name: "WOFF2 font", category: "font" },
  // Office (older OLE-based)
  { sig: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1], name: "MS Office (OLE2) — DOC/XLS/PPT", category: "office" },
  // Misc
  { sig: [0x25, 0x50, 0x44, 0x46], name: "PDF", category: "pdf" },
  { sig: [0x53, 0x51, 0x4C, 0x69, 0x74, 0x65, 0x20, 0x66], name: "SQLite database", category: "database" },
  { sig: [0x42, 0x4D], name: "BMP image", category: "image" },
  { sig: [0xFF, 0xD8, 0xFF], name: "JPEG image", category: "image" },
  { sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], name: "PNG image", category: "image" },
  { sig: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], name: "GIF87a image", category: "image" },
  { sig: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], name: "GIF89a image", category: "image" },
  { sig: [0x52, 0x49, 0x46, 0x46], name: "RIFF container (WAV/AVI/WebP)", category: "generic" },
  { sig: [0x49, 0x44, 0x33], name: "MP3 (ID3v2)", category: "audio" },
  { sig: [0x4F, 0x67, 0x67, 0x53], name: "OGG container", category: "audio" },
  { sig: [0x66, 0x4C, 0x61, 0x43], name: "FLAC audio", category: "audio" },
  { sig: [0x1A, 0x45, 0xDF, 0xA3], name: "Matroska/WebM", category: "video" },
];

const matchSignature = (bytes) => {
  for (const entry of MAGIC_SIGNATURES) {
    if (entry.offset) continue; // skip offset signatures for the 64-byte sample
    const ok = entry.sig.every((b, i) => bytes[i] === b);
    if (ok) return entry;
  }
  return null;
};

// ARCHIVE — try to read entry list when it's a ZIP-based format
const extractArchive = async (file) => {
  const out = {
    category: "archive",
    file: baseFileInfo(file),
    format: file.name.split(".").pop()?.toUpperCase() || "ARCHIVE",
    entries: null,
    entryCount: null,
    note: null,
  };
  try {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4B;
    if (isZip) {
      const zip = await JSZip.loadAsync(file);
      assertZipSafeExt(zip);
      const names = Object.keys(zip.files);
      out.entryCount = names.length;
      out.entries = names.slice(0, 200); // cap preview
      if (names.length > 200) out.note = `Exibindo as primeiras 200 de ${names.length} entradas.`;
    } else {
      out.note = "Formato compactado não-ZIP. Leitura completa requer ferramenta nativa.";
    }
  } catch (e) {
    out.error = String(e?.message || e);
  }
  return out;
};

// FONT — read header
const extractFont = async (file) => {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const tag = String.fromCharCode(...head);
  let format = "Desconhecido";
  if (tag === "OTTO") format = "OpenType (CFF)";
  else if (tag === "wOFF") format = "WOFF";
  else if (tag === "wOF2") format = "WOFF2";
  else if (head[0] === 0x00 && head[1] === 0x01 && head[2] === 0x00 && head[3] === 0x00) format = "TrueType";
  return {
    category: "font",
    file: baseFileInfo(file),
    format,
    note: "Metadados detalhados de fonte (name table) requerem parser dedicado; aqui é exibido apenas o formato.",
  };
};

// EBOOK — EPUB is ZIP-based, others are proprietary
const extractEbook = async (file) => {
  const ext = getExtension(file.name);
  if (ext === "epub") {
    try {
      const zip = await JSZip.loadAsync(file);
      assertZipSafeExt(zip);
      const opf = Object.keys(zip.files).find((n) => n.endsWith(".opf"));
      const out = { category: "ebook", file: baseFileInfo(file), format: "EPUB", metadata: {} };
      if (opf) {
        const xml = await zip.file(opf).async("string");
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        ["title", "creator", "subject", "description", "publisher", "date", "language", "identifier", "rights"].forEach((tag) => {
          const el = doc.getElementsByTagName(`dc:${tag}`)[0] || doc.getElementsByTagName(tag)[0];
          if (el && el.textContent) out.metadata[tag] = el.textContent.trim();
        });
      }
      return out;
    } catch (e) {
      return { category: "ebook", file: baseFileInfo(file), format: ext.toUpperCase(), error: String(e?.message || e) };
    }
  }
  return {
    category: "ebook",
    file: baseFileInfo(file),
    format: ext.toUpperCase(),
    note: "Formato de e-book proprietário. Extração detalhada requer parser dedicado.",
  };
};

// EXECUTABLE — basic magic byte info
const extractExecutable = async (file) => {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const matched = matchSignature(head);
  return {
    category: "executable",
    file: baseFileInfo(file),
    detectedFormat: matched?.name || "Executável (formato não identificado)",
    magicBytes: Array.from(head.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join(" "),
    note: "Análise profunda de binários (símbolos, seções, imports) requer ferramentas como objdump, dumpbin ou Ghidra.",
  };
};

// GENERIC
const extractGeneric = async (file) => {
  let magicHex = "";
  let detected = null;
  try {
    const buf = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    magicHex = Array.from(buf.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    detected = matchSignature(buf);
  } catch { /* ignore */ }
  return {
    category: "generic",
    file: baseFileInfo(file),
    magicBytes: magicHex || null,
    detectedFormat: detected?.name || "Formato não reconhecido pela análise de magic bytes",
    suggestedCategory: detected?.category || null,
    note: "O hash criptográfico do arquivo foi calculado integralmente. Para metadados específicos deste formato, é necessária uma ferramenta nativa especializada.",
  };
};

// Helper for GPS strings like "+37.7749-122.4194/"
const parseLocationString = (str) => {
  if (!str || typeof str !== "string") return null;
  const m = str.match(/([+-]\d+\.\d+)([+-]\d+\.\d+)/);
  if (!m) return null;
  return { latitude: parseFloat(m[1]), longitude: parseFloat(m[2]) };
};

export const extractMetadata = async (file) => {
  const category = detectCategory(file);
  switch (category) {
    case "image":      return extractImage(file);
    case "pdf":        return extractPdf(file);
    case "office":     return extractOffice(file);
    case "audio":      return extractAudio(file);
    case "video":      return extractVideo(file);
    case "text":       return extractText(file);
    case "archive":    return extractArchive(file);
    case "font":       return extractFont(file);
    case "ebook":      return extractEbook(file);
    case "executable": return extractExecutable(file);
    default:           return extractGeneric(file);
  }
};

export const getCategoryLabel = (category) => {
  const labels = {
    image: "Imagem",
    pdf: "PDF",
    office: "Documento",
    audio: "Áudio",
    video: "Vídeo",
    text: "Texto",
    archive: "Arquivo Compactado",
    font: "Fonte",
    ebook: "E-book",
    executable: "Executável",
    generic: "Arquivo Genérico",
  };
  return labels[category] || "Arquivo";
};
