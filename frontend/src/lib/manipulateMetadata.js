// Metadata manipulation — strip and edit metadata of supported file types.
// All operations run in the browser using piexifjs (JPEG EXIF), pdf-lib (PDF) and JSZip (Office).

import piexif from "piexifjs";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import extractPngChunks from "png-chunks-extract";
import encodePngChunks from "png-chunks-encode";
import pngText from "png-chunk-text";

// Security limits (defense against zip-bombs and oversized input)
const MAX_OFFICE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB Office files
const MAX_ZIP_ENTRY_SIZE = 50 * 1024 * 1024;    // 50 MB per uncompressed entry
const MAX_ZIP_ENTRIES = 10000;                  // entries cap
const MAX_FIELD_LENGTH = 2000;                  // chars per editable field

const sanitizeFieldValue = (val) => {
  if (val === undefined || val === null) return val;
  let s = String(val);
  // Strip control chars except TAB/LF/CR
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  if (s.length > MAX_FIELD_LENGTH) s = s.slice(0, MAX_FIELD_LENGTH);
  return s;
};

const sanitizeEdits = (edits) => {
  const out = {};
  for (const [k, v] of Object.entries(edits || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = sanitizeFieldValue(v);
  }
  return out;
};

const assertZipSafe = (zip) => {
  const entries = Object.keys(zip.files);
  if (entries.length > MAX_ZIP_ENTRIES) {
    throw new Error("Arquivo compactado com número excessivo de entradas (possível zip-bomb).");
  }
  for (const name of entries) {
    const entry = zip.files[name];
    if (entry?._data?.uncompressedSize > MAX_ZIP_ENTRY_SIZE) {
      throw new Error(`Entrada interna excede o limite de tamanho (${name}).`);
    }
  }
};

const getExtension = (name) => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

// Returns one of: 'jpeg' | 'png' | 'webp' | 'pdf' | 'office' | null
export const getManipulableType = (file) => {
  const ext = getExtension(file.name);
  const mime = (file.type || "").toLowerCase();
  if (["jpg", "jpeg", "jpe", "jfif"].includes(ext) || mime === "image/jpeg") return "jpeg";
  if (ext === "png" || mime === "image/png") return "png";
  if (ext === "webp" || mime === "image/webp") return "webp";
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (["docx", "docm", "xlsx", "xlsm", "pptx", "pptm"].includes(ext)) return "office";
  return null;
};

const fileToDataURL = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

const dataURLToBlob = (dataUrl) => {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/data:(.+);base64/)[1];
  const bytes = atob(body);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

const baseName = (name) => name.replace(/\.[^.]+$/, "");
const ext = (name) => {
  const e = getExtension(name);
  return e ? `.${e}` : "";
};

// ============================================================
// STRIP — remove ALL metadata
// ============================================================
export const stripMetadata = async (file) => {
  const type = getManipulableType(file);
  if (!type) throw new Error("Formato não suportado para eliminação de metadados.");

  if (type === "jpeg") {
    const dataUrl = await fileToDataURL(file);
    const stripped = piexif.remove(dataUrl);
    return {
      blob: dataURLToBlob(stripped),
      filename: `${baseName(file.name)}_sem-metadados${ext(file.name)}`,
    };
  }

  if (type === "png" || type === "webp") {
    // Canvas re-encode drops all ancillary chunks/EXIF
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const outMime = type === "webp" ? "image/webp" : "image/png";
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, outMime, 1));
      return {
        blob,
        filename: `${baseName(file.name)}_sem-metadados${ext(file.name)}`,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (type === "pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buf, { updateMetadata: false });
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setProducer("");
    pdf.setCreator("");
    // Set creation/modification dates to epoch to neutralize timestamps
    const epoch = new Date(0);
    pdf.setCreationDate(epoch);
    pdf.setModificationDate(epoch);
    const out = await pdf.save({ useObjectStreams: false });
    return {
      blob: new Blob([out], { type: "application/pdf" }),
      filename: `${baseName(file.name)}_sem-metadados.pdf`,
    };
  }

  if (type === "office") {
    if (file.size > MAX_OFFICE_FILE_SIZE) {
      throw new Error("Arquivo Office excede o limite de 100 MB para manipulação.");
    }
    const zip = await JSZip.loadAsync(file);
    assertZipSafe(zip);
    const empty = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"></cp:coreProperties>`;
    const emptyApp = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"></Properties>`;
    if (zip.file("docProps/core.xml")) zip.file("docProps/core.xml", empty);
    if (zip.file("docProps/app.xml")) zip.file("docProps/app.xml", emptyApp);
    if (zip.file("docProps/custom.xml")) zip.remove("docProps/custom.xml");
    const mime = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docm: "application/vnd.ms-word.document.macroEnabled.12",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    }[getExtension(file.name)] || "application/zip";
    const blob = await zip.generateAsync({ type: "blob", mimeType: mime });
    return {
      blob,
      filename: `${baseName(file.name)}_sem-metadados${ext(file.name)}`,
    };
  }

  throw new Error("Formato não suportado.");
};

// ============================================================
// WebP RIFF helpers — for EXIF chunk manipulation
// ============================================================
const readFourCC = (view, offset) =>
  String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));

const writeFourCC = (arr, offset, fourcc) => {
  for (let i = 0; i < 4; i++) arr[offset + i] = fourcc.charCodeAt(i);
};

const parseWebpChunks = (buffer) => {
  const view = new DataView(buffer);
  if (readFourCC(view, 0) !== "RIFF" || readFourCC(view, 8) !== "WEBP") {
    throw new Error("Arquivo WebP inválido.");
  }
  const chunks = [];
  let offset = 12;
  while (offset < view.byteLength) {
    const fourcc = readFourCC(view, offset);
    const size = view.getUint32(offset + 4, true);
    const data = new Uint8Array(buffer, offset + 8, size);
    chunks.push({ fourcc, data });
    offset += 8 + size + (size % 2); // padding to even
  }
  return chunks;
};

const buildWebp = (chunks) => {
  let totalSize = 4; // "WEBP"
  for (const c of chunks) totalSize += 8 + c.data.length + (c.data.length % 2);
  const out = new Uint8Array(8 + totalSize);
  writeFourCC(out, 0, "RIFF");
  new DataView(out.buffer).setUint32(4, totalSize, true);
  writeFourCC(out, 8, "WEBP");
  let o = 12;
  for (const c of chunks) {
    writeFourCC(out, o, c.fourcc);
    new DataView(out.buffer).setUint32(o + 4, c.data.length, true);
    out.set(c.data, o + 8);
    o += 8 + c.data.length + (c.data.length % 2);
  }
  return out;
};

// Ensure WebP is extended (VP8X). Returns new chunks with VP8X header.
const ensureVp8x = (chunks) => {
  const existing = chunks.find((c) => c.fourcc === "VP8X");
  if (existing) return chunks;

  const vp8 = chunks.find((c) => c.fourcc === "VP8 " || c.fourcc === "VP8L");
  if (!vp8) throw new Error("WebP sem chunk de imagem (VP8/VP8L).");

  // Extract width/height from VP8/VP8L
  let width = 1, height = 1;
  if (vp8.fourcc === "VP8 ") {
    // VP8 simple format: width/height at offset 6-9
    const dv = new DataView(vp8.data.buffer, vp8.data.byteOffset);
    width = dv.getUint16(6, true) & 0x3FFF;
    height = dv.getUint16(8, true) & 0x3FFF;
  } else {
    // VP8L: width/height encoded in 28 bits starting at byte 1
    const dv = new DataView(vp8.data.buffer, vp8.data.byteOffset);
    const b1 = dv.getUint32(1, true);
    width = (b1 & 0x3FFF) + 1;
    height = ((b1 >> 14) & 0x3FFF) + 1;
  }

  // Build VP8X chunk (10 bytes)
  const vp8xData = new Uint8Array(10);
  vp8xData[0] = 0; // flags - will set EXIF later
  // bytes 1-3: reserved
  // bytes 4-6: width-1 (24-bit LE)
  const w = width - 1;
  vp8xData[4] = w & 0xFF;
  vp8xData[5] = (w >> 8) & 0xFF;
  vp8xData[6] = (w >> 16) & 0xFF;
  const h = height - 1;
  vp8xData[7] = h & 0xFF;
  vp8xData[8] = (h >> 8) & 0xFF;
  vp8xData[9] = (h >> 16) & 0xFF;

  return [{ fourcc: "VP8X", data: vp8xData }, ...chunks];
};

const writeWebpWithExif = (originalBuffer, exifBytes) => {
  let chunks = parseWebpChunks(originalBuffer);
  chunks = ensureVp8x(chunks);

  // Set EXIF flag (bit 3 of VP8X flags byte)
  const vp8x = chunks.find((c) => c.fourcc === "VP8X");
  vp8x.data = new Uint8Array(vp8x.data); // copy to mutate
  vp8x.data[0] |= 0b00001000;

  // Remove existing EXIF chunk(s)
  chunks = chunks.filter((c) => c.fourcc !== "EXIF");

  // EXIF chunk data: piexif gives "Exif\0\0..." prefix; WebP wants only the TIFF data after the prefix
  const exifBuf = typeof exifBytes === "string"
    ? new Uint8Array(Array.from(exifBytes, (ch) => ch.charCodeAt(0)))
    : exifBytes;
  // Strip "Exif\0\0" prefix if present (piexif may include it)
  let exifPayload = exifBuf;
  if (exifBuf[0] === 0x45 && exifBuf[1] === 0x78 && exifBuf[2] === 0x69 && exifBuf[3] === 0x66) {
    exifPayload = exifBuf.subarray(6);
  }
  chunks.push({ fourcc: "EXIF", data: exifPayload });

  return buildWebp(chunks);
};

export const getEditableFields = (file) => {
  const type = getManipulableType(file);
  if (type === "jpeg") {
    return [
      {
        section: "Identificação",
        fields: [
          { key: "ImageDescription", label: "Descrição da imagem", type: "text" },
          { key: "Artist", label: "Autor / artista", type: "text" },
          { key: "Copyright", label: "Direitos autorais", type: "text" },
          { key: "ImageUniqueID", label: "ID único da imagem", type: "text" },
          { key: "DocumentName", label: "Nome do documento", type: "text" },
          { key: "HostComputer", label: "Computador host", type: "text" },
          { key: "Software", label: "Software", type: "text" },
        ],
      },
      {
        section: "Câmera",
        fields: [
          { key: "Make", label: "Fabricante (Make)", type: "text" },
          { key: "Model", label: "Modelo", type: "text" },
          { key: "BodySerialNumber", label: "Número de série do corpo", type: "text" },
          { key: "LensMake", label: "Fabricante da lente", type: "text" },
          { key: "LensModel", label: "Modelo da lente", type: "text" },
          { key: "LensSerialNumber", label: "Nº de série da lente", type: "text" },
          { key: "Orientation", label: "Orientação (1=normal, 3=180°, 6=90° CW, 8=90° CCW)", type: "number" },
        ],
      },
      {
        section: "Exposição",
        fields: [
          { key: "ExposureTime_num", label: "Tempo de exposição (segundos, ex: 0.005)", type: "text" },
          { key: "FNumber_num", label: "Abertura f/ (ex: 2.8)", type: "text" },
          { key: "ISOSpeedRatings", label: "ISO", type: "number" },
          { key: "FocalLength_num", label: "Distância focal (mm, ex: 50)", type: "text" },
          { key: "FocalLengthIn35mmFilm", label: "Distância focal equiv. 35mm", type: "number" },
          { key: "ExposureBiasValue_num", label: "Compensação de exposição (EV)", type: "text" },
          { key: "Flash", label: "Flash (0=não disparado, 1=disparado)", type: "number" },
          { key: "WhiteBalance", label: "Balanço de branco (0=auto, 1=manual)", type: "number" },
          { key: "MeteringMode", label: "Modo de medição (0–6)", type: "number" },
          { key: "ExposureMode", label: "Modo de exposição (0=auto, 1=manual, 2=bracket)", type: "number" },
          { key: "ExposureProgram", label: "Programa de exposição (0–8)", type: "number" },
        ],
      },
      {
        section: "Datas",
        fields: [
          { key: "DateTime", label: "Data de modificação (YYYY:MM:DD HH:MM:SS)", type: "text", placeholder: "2026:02:01 12:00:00" },
          { key: "DateTimeOriginal", label: "Data original", type: "text", placeholder: "2026:02:01 12:00:00" },
          { key: "DateTimeDigitized", label: "Data de digitalização", type: "text", placeholder: "2026:02:01 12:00:00" },
          { key: "OffsetTime", label: "Fuso horário (ex: +03:00)", type: "text" },
          { key: "OffsetTimeOriginal", label: "Fuso original", type: "text" },
        ],
      },
      {
        section: "GPS",
        fields: [
          { key: "GPSLatitude", label: "Latitude (graus decimais, ex: -23.5505)", type: "text" },
          { key: "GPSLongitude", label: "Longitude (graus decimais, ex: -46.6333)", type: "text" },
          { key: "GPSAltitude_num", label: "Altitude (metros)", type: "text" },
          { key: "GPSImgDirection_num", label: "Direção da imagem (graus 0–360)", type: "text" },
          { key: "GPSDateStamp", label: "Data GPS (YYYY:MM:DD)", type: "text", placeholder: "2026:02:01" },
          { key: "GPSProcessingMethod", label: "Método de processamento GPS", type: "text" },
        ],
      },
      {
        section: "Conteúdo / Comentário",
        fields: [
          { key: "UserComment", label: "Comentário do usuário", type: "text" },
          { key: "ImageHistory", label: "Histórico da imagem", type: "text" },
          { key: "ColorSpace", label: "Espaço de cor (1=sRGB, 65535=Uncalibrated)", type: "number" },
        ],
      },
    ];
  }
  if (type === "png" || type === "webp") {
    // PNG uses tEXt chunks. WebP uses EXIF (via piexif format).
    if (type === "webp") {
      return [
        {
          section: "EXIF (WebP)",
          fields: [
            { key: "ImageDescription", label: "Descrição da imagem", type: "text" },
            { key: "Artist", label: "Autor / artista", type: "text" },
            { key: "Copyright", label: "Direitos autorais", type: "text" },
            { key: "Software", label: "Software", type: "text" },
            { key: "Make", label: "Fabricante (Make)", type: "text" },
            { key: "Model", label: "Modelo", type: "text" },
            { key: "DateTime", label: "Data (YYYY:MM:DD HH:MM:SS)", type: "text", placeholder: "2026:02:01 12:00:00" },
            { key: "DateTimeOriginal", label: "Data original", type: "text", placeholder: "2026:02:01 12:00:00" },
            { key: "GPSLatitude", label: "Latitude (decimal, ex: -23.5505)", type: "text" },
            { key: "GPSLongitude", label: "Longitude (decimal, ex: -46.6333)", type: "text" },
            { key: "UserComment", label: "Comentário do usuário", type: "text" },
          ],
        },
      ];
    }
    return [
      {
        section: "Propriedades (tEXt chunks)",
        fields: [
          { key: "Title", label: "Título", type: "text" },
          { key: "Author", label: "Autor", type: "text" },
          { key: "Description", label: "Descrição", type: "text" },
          { key: "Copyright", label: "Direitos autorais", type: "text" },
          { key: "Software", label: "Software", type: "text" },
          { key: "Source", label: "Fonte (origem)", type: "text" },
          { key: "Comment", label: "Comentário", type: "text" },
          { key: "Disclaimer", label: "Aviso legal", type: "text" },
          { key: "Warning", label: "Aviso", type: "text" },
          { key: "Creation Time", label: "Data de criação", type: "text", placeholder: "2026-02-01T12:00:00" },
        ],
      },
    ];
  }
  if (type === "pdf") {
    return [
      {
        section: "Propriedades do documento",
        fields: [
          { key: "Title", label: "Título", type: "text" },
          { key: "Author", label: "Autor", type: "text" },
          { key: "Subject", label: "Assunto", type: "text" },
          { key: "Keywords", label: "Palavras-chave (separadas por vírgula)", type: "text" },
          { key: "Creator", label: "Criador (programa que originou)", type: "text" },
          { key: "Producer", label: "Produtor (gerador do PDF)", type: "text" },
          { key: "Language", label: "Idioma (ex: pt-BR)", type: "text" },
        ],
      },
      {
        section: "Datas",
        fields: [
          { key: "CreationDate", label: "Data de criação (YYYY-MM-DDTHH:MM:SS)", type: "text", placeholder: "2026-02-01T12:00:00" },
          { key: "ModificationDate", label: "Data de modificação", type: "text", placeholder: "2026-02-01T12:00:00" },
        ],
      },
    ];
  }
  if (type === "office") {
    return [
      {
        section: "Identificação (core.xml)",
        fields: [
          { key: "title", label: "Título", type: "text" },
          { key: "creator", label: "Autor original", type: "text" },
          { key: "lastModifiedBy", label: "Última modificação por", type: "text" },
          { key: "subject", label: "Assunto", type: "text" },
          { key: "keywords", label: "Palavras-chave", type: "text" },
          { key: "description", label: "Descrição / comentário", type: "text" },
          { key: "category", label: "Categoria", type: "text" },
          { key: "identifier", label: "Identificador", type: "text" },
          { key: "language", label: "Idioma", type: "text" },
          { key: "contentStatus", label: "Status do conteúdo", type: "text" },
          { key: "version", label: "Versão", type: "text" },
          { key: "revision", label: "Número de revisão", type: "text" },
        ],
      },
      {
        section: "Datas (core.xml)",
        fields: [
          { key: "created", label: "Data de criação (ISO 8601)", type: "text", placeholder: "2026-02-01T12:00:00Z" },
          { key: "modified", label: "Data de modificação", type: "text", placeholder: "2026-02-01T12:00:00Z" },
          { key: "lastPrinted", label: "Última impressão", type: "text" },
        ],
      },
      {
        section: "Aplicação (app.xml)",
        fields: [
          { key: "Application", label: "Aplicação (ex: Microsoft Word)", type: "text" },
          { key: "AppVersion", label: "Versão da aplicação", type: "text" },
          { key: "Company", label: "Empresa", type: "text" },
          { key: "Manager", label: "Gerente / supervisor", type: "text" },
          { key: "Template", label: "Modelo (template)", type: "text" },
        ],
      },
    ];
  }
  return [];
};

// ============================================================
// EDIT — apply user-supplied field values
// ============================================================
const decToDMS = (decimal) => {
  const abs = Math.abs(decimal);
  const d = Math.floor(abs);
  const minFloat = (abs - d) * 60;
  const m = Math.floor(minFloat);
  const s = (minFloat - m) * 60;
  return [
    [d, 1],
    [m, 1],
    [Math.round(s * 100), 100],
  ];
};

// Convert a decimal float to a rational [num, den]
const toRational = (val, denom = 1000) => {
  const n = Math.round(parseFloat(val) * denom);
  return [n, denom];
};

// Lookup piexif tag IDs by name for each IFD
const setIfDefined = (target, ifd, name, value, transform) => {
  if (value === undefined || value === "" || value === null) return;
  const tagId = ifd[name];
  if (tagId === undefined) return;
  target[tagId] = transform ? transform(value) : value;
};

export const editMetadata = async (file, rawEdits) => {
  const type = getManipulableType(file);
  if (!type) throw new Error("Formato não suportado para edição de metadados.");

  // Sanitize all user-supplied inputs: trim length, strip control chars
  const edits = sanitizeEdits(rawEdits);

  // Validate GPS coords ranges
  if (edits.GPSLatitude !== undefined) {
    const v = parseFloat(edits.GPSLatitude);
    if (isNaN(v) || v < -90 || v > 90) throw new Error("Latitude inválida (intervalo: -90 a 90).");
  }
  if (edits.GPSLongitude !== undefined) {
    const v = parseFloat(edits.GPSLongitude);
    if (isNaN(v) || v < -180 || v > 180) throw new Error("Longitude inválida (intervalo: -180 a 180).");
  }
  if (edits.GPSImgDirection_num !== undefined) {
    const v = parseFloat(edits.GPSImgDirection_num);
    if (isNaN(v) || v < 0 || v > 360) throw new Error("Direção da imagem inválida (intervalo: 0 a 360).");
  }

  if (type === "jpeg") {
    const dataUrl = await fileToDataURL(file);
    let existing;
    try { existing = piexif.load(dataUrl); }
    catch { existing = { "0th": {}, "Exif": {}, "GPS": {}, "Interop": {}, "1st": {}, "thumbnail": null }; }

    const z = { ...(existing["0th"] || {}) };
    const ex = { ...(existing["Exif"] || {}) };
    const gps = { ...(existing["GPS"] || {}) };

    const I = piexif.ImageIFD;
    const E = piexif.ExifIFD;
    const G = piexif.GPSIFD;

    // 0th IFD (image identification)
    setIfDefined(z, I, "ImageDescription", edits.ImageDescription);
    setIfDefined(z, I, "Artist", edits.Artist);
    setIfDefined(z, I, "Copyright", edits.Copyright);
    setIfDefined(z, I, "Software", edits.Software);
    setIfDefined(z, I, "DocumentName", edits.DocumentName);
    setIfDefined(z, I, "HostComputer", edits.HostComputer);
    setIfDefined(z, I, "Make", edits.Make);
    setIfDefined(z, I, "Model", edits.Model);
    setIfDefined(z, I, "DateTime", edits.DateTime);
    setIfDefined(z, I, "Orientation", edits.Orientation, (v) => parseInt(v, 10));
    setIfDefined(z, I, "ImageHistory", edits.ImageHistory);

    // Exif IFD (camera / exposure)
    setIfDefined(ex, E, "ImageUniqueID", edits.ImageUniqueID);
    setIfDefined(ex, E, "BodySerialNumber", edits.BodySerialNumber);
    setIfDefined(ex, E, "LensMake", edits.LensMake);
    setIfDefined(ex, E, "LensModel", edits.LensModel);
    setIfDefined(ex, E, "LensSerialNumber", edits.LensSerialNumber);
    setIfDefined(ex, E, "DateTimeOriginal", edits.DateTimeOriginal);
    setIfDefined(ex, E, "DateTimeDigitized", edits.DateTimeDigitized);
    setIfDefined(ex, E, "OffsetTime", edits.OffsetTime);
    setIfDefined(ex, E, "OffsetTimeOriginal", edits.OffsetTimeOriginal);
    setIfDefined(ex, E, "UserComment", edits.UserComment, (v) => `ASCII\0\0\0${v}`);
    setIfDefined(ex, E, "ColorSpace", edits.ColorSpace, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "ISOSpeedRatings", edits.ISOSpeedRatings, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "FocalLengthIn35mmFilm", edits.FocalLengthIn35mmFilm, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "Flash", edits.Flash, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "WhiteBalance", edits.WhiteBalance, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "MeteringMode", edits.MeteringMode, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "ExposureMode", edits.ExposureMode, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "ExposureProgram", edits.ExposureProgram, (v) => parseInt(v, 10));
    setIfDefined(ex, E, "ExposureTime", edits.ExposureTime_num, (v) => toRational(v, 10000));
    setIfDefined(ex, E, "FNumber", edits.FNumber_num, (v) => toRational(v, 10));
    setIfDefined(ex, E, "FocalLength", edits.FocalLength_num, (v) => toRational(v, 10));
    setIfDefined(ex, E, "ExposureBiasValue", edits.ExposureBiasValue_num, (v) => toRational(v, 10));

    // GPS
    if (edits.GPSLatitude && edits.GPSLongitude
      && !isNaN(parseFloat(edits.GPSLatitude)) && !isNaN(parseFloat(edits.GPSLongitude))) {
      const lat = parseFloat(edits.GPSLatitude);
      const lng = parseFloat(edits.GPSLongitude);
      gps[G.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
      gps[G.GPSLatitude] = decToDMS(lat);
      gps[G.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
      gps[G.GPSLongitude] = decToDMS(lng);
    }
    if (edits.GPSAltitude_num !== undefined && edits.GPSAltitude_num !== "" && !isNaN(parseFloat(edits.GPSAltitude_num))) {
      const alt = parseFloat(edits.GPSAltitude_num);
      gps[G.GPSAltitudeRef] = alt >= 0 ? 0 : 1;
      gps[G.GPSAltitude] = toRational(Math.abs(alt), 100);
    }
    if (edits.GPSImgDirection_num !== undefined && edits.GPSImgDirection_num !== "" && !isNaN(parseFloat(edits.GPSImgDirection_num))) {
      gps[G.GPSImgDirectionRef] = "T";
      gps[G.GPSImgDirection] = toRational(parseFloat(edits.GPSImgDirection_num), 100);
    }
    setIfDefined(gps, G, "GPSDateStamp", edits.GPSDateStamp);
    setIfDefined(gps, G, "GPSProcessingMethod", edits.GPSProcessingMethod, (v) => `ASCII\0\0\0${v}`);

    const newExif = {
      "0th": z,
      "Exif": ex,
      "GPS": gps,
      "Interop": existing.Interop || {},
      "1st": existing["1st"] || {},
      "thumbnail": existing.thumbnail || null,
    };
    const exifBytes = piexif.dump(newExif);
    const newDataUrl = piexif.insert(exifBytes, dataUrl);
    return {
      blob: dataURLToBlob(newDataUrl),
      filename: `${baseName(file.name)}_editado${ext(file.name)}`,
    };
  }

  if (type === "png") {
    // PNG metadata via tEXt chunks
    const buf = new Uint8Array(await file.arrayBuffer());
    const chunks = extractPngChunks(buf);

    const wantedKeywords = [
      "Title", "Author", "Description", "Copyright", "Software",
      "Source", "Comment", "Disclaimer", "Warning", "Creation Time",
    ];
    const editedKeywords = new Set(
      wantedKeywords.filter((k) => edits[k] !== undefined && edits[k] !== "")
    );

    // Remove existing tEXt/iTXt/zTXt chunks for keywords we're updating
    const filtered = chunks.filter((c) => {
      if (c.name !== "tEXt" && c.name !== "iTXt" && c.name !== "zTXt") return true;
      try {
        const decoded = c.name === "tEXt" ? pngText.decode(c.data) : null;
        if (decoded && editedKeywords.has(decoded.keyword)) return false;
      } catch { /* ignore */ }
      return true;
    });

    // Build new tEXt chunks for each filled field
    const newChunks = [];
    for (const keyword of wantedKeywords) {
      const value = edits[keyword];
      if (value === undefined || value === "") continue;
      newChunks.push(pngText.encode(keyword, String(value)));
    }

    // Insert new chunks just before the IEND chunk
    const iendIndex = filtered.findIndex((c) => c.name === "IEND");
    const finalChunks = iendIndex >= 0
      ? [...filtered.slice(0, iendIndex), ...newChunks, ...filtered.slice(iendIndex)]
      : [...filtered, ...newChunks];

    const out = encodePngChunks(finalChunks);
    return {
      blob: new Blob([out], { type: "image/png" }),
      filename: `${baseName(file.name)}_editado.png`,
    };
  }

  if (type === "webp") {
    const buf = await file.arrayBuffer();
    // Build a tiny JPEG with the EXIF we want, just to get a clean EXIF byte string via piexif
    const exifStruct = {
      "0th": {},
      "Exif": {},
      "GPS": {},
      "Interop": {},
      "1st": {},
      "thumbnail": null,
    };
    const I = piexif.ImageIFD, E = piexif.ExifIFD, G = piexif.GPSIFD;
    setIfDefined(exifStruct["0th"], I, "ImageDescription", edits.ImageDescription);
    setIfDefined(exifStruct["0th"], I, "Artist", edits.Artist);
    setIfDefined(exifStruct["0th"], I, "Copyright", edits.Copyright);
    setIfDefined(exifStruct["0th"], I, "Software", edits.Software);
    setIfDefined(exifStruct["0th"], I, "Make", edits.Make);
    setIfDefined(exifStruct["0th"], I, "Model", edits.Model);
    setIfDefined(exifStruct["0th"], I, "DateTime", edits.DateTime);
    setIfDefined(exifStruct["Exif"], E, "DateTimeOriginal", edits.DateTimeOriginal);
    setIfDefined(exifStruct["Exif"], E, "UserComment", edits.UserComment, (v) => `ASCII\0\0\0${v}`);
    if (edits.GPSLatitude && edits.GPSLongitude) {
      const lat = parseFloat(edits.GPSLatitude);
      const lng = parseFloat(edits.GPSLongitude);
      exifStruct["GPS"][G.GPSLatitudeRef] = lat >= 0 ? "N" : "S";
      exifStruct["GPS"][G.GPSLatitude] = decToDMS(lat);
      exifStruct["GPS"][G.GPSLongitudeRef] = lng >= 0 ? "E" : "W";
      exifStruct["GPS"][G.GPSLongitude] = decToDMS(lng);
    }
    const exifBytes = piexif.dump(exifStruct);
    const out = writeWebpWithExif(buf, exifBytes);
    return {
      blob: new Blob([out], { type: "image/webp" }),
      filename: `${baseName(file.name)}_editado.webp`,
    };
  }

  if (type === "pdf") {
    const buf = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buf, { updateMetadata: false });
    if (edits.Title !== undefined) pdf.setTitle(edits.Title);
    if (edits.Author !== undefined) pdf.setAuthor(edits.Author);
    if (edits.Subject !== undefined) pdf.setSubject(edits.Subject);
    if (edits.Keywords !== undefined && edits.Keywords !== "") {
      const kws = edits.Keywords.split(",").map((s) => s.trim()).filter(Boolean);
      pdf.setKeywords(kws);
    }
    if (edits.Creator !== undefined) pdf.setCreator(edits.Creator);
    if (edits.Producer !== undefined) pdf.setProducer(edits.Producer);
    if (edits.Language !== undefined && edits.Language !== "") pdf.setLanguage(edits.Language);
    if (edits.CreationDate) {
      const d = new Date(edits.CreationDate);
      if (!isNaN(d.getTime())) pdf.setCreationDate(d);
    }
    if (edits.ModificationDate) {
      const d = new Date(edits.ModificationDate);
      if (!isNaN(d.getTime())) pdf.setModificationDate(d);
    } else {
      pdf.setModificationDate(new Date());
    }
    const out = await pdf.save();
    return {
      blob: new Blob([out], { type: "application/pdf" }),
      filename: `${baseName(file.name)}_editado.pdf`,
    };
  }

  if (type === "office") {
    if (file.size > MAX_OFFICE_FILE_SIZE) {
      throw new Error("Arquivo Office excede o limite de 100 MB para edição.");
    }
    const zip = await JSZip.loadAsync(file);
    assertZipSafe(zip);
    const coreFile = zip.file("docProps/core.xml");
    if (!coreFile) throw new Error("docProps/core.xml não encontrado neste documento.");
    let xml = await coreFile.async("string");

    const xmlEscape = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

    const setOrInsert = (tag, value) => {
      if (value === undefined || value === "") return;
      const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
      const safe = xmlEscape(value);
      if (re.test(xml)) {
        xml = xml.replace(re, `<${tag}>${safe}</${tag}>`);
      } else {
        xml = xml.replace(/<\/cp:coreProperties>/i, `  <${tag}>${safe}</${tag}>\n</cp:coreProperties>`);
      }
    };

    // core.xml
    setOrInsert("dc:title", edits.title);
    setOrInsert("dc:creator", edits.creator);
    setOrInsert("dc:subject", edits.subject);
    setOrInsert("cp:keywords", edits.keywords);
    setOrInsert("dc:description", edits.description);
    setOrInsert("cp:lastModifiedBy", edits.lastModifiedBy);
    setOrInsert("cp:category", edits.category);
    setOrInsert("dc:identifier", edits.identifier);
    setOrInsert("dc:language", edits.language);
    setOrInsert("cp:contentStatus", edits.contentStatus);
    setOrInsert("cp:version", edits.version);
    setOrInsert("cp:revision", edits.revision);
    setOrInsert("dcterms:created", edits.created);
    setOrInsert("cp:lastPrinted", edits.lastPrinted);
    // Always refresh modified
    const modVal = edits.modified || new Date().toISOString();
    if (/<dcterms:modified[^>]*>/i.test(xml)) {
      xml = xml.replace(/<dcterms:modified[^>]*>[\s\S]*?<\/dcterms:modified>/i,
        `<dcterms:modified xsi:type="dcterms:W3CDTF">${xmlEscape(modVal)}</dcterms:modified>`);
    } else {
      xml = xml.replace(/<\/cp:coreProperties>/i,
        `  <dcterms:modified xsi:type="dcterms:W3CDTF">${xmlEscape(modVal)}</dcterms:modified>\n</cp:coreProperties>`);
    }
    zip.file("docProps/core.xml", xml);

    // app.xml
    const appFile = zip.file("docProps/app.xml");
    if (appFile) {
      let appXml = await appFile.async("string");
      const setAppTag = (tag, value) => {
        if (value === undefined || value === "") return;
        const re = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>`, "i");
        const safe = xmlEscape(value);
        if (re.test(appXml)) {
          appXml = appXml.replace(re, `<${tag}>${safe}</${tag}>`);
        } else {
          appXml = appXml.replace(/<\/Properties>/i, `  <${tag}>${safe}</${tag}>\n</Properties>`);
        }
      };
      setAppTag("Application", edits.Application);
      setAppTag("AppVersion", edits.AppVersion);
      setAppTag("Company", edits.Company);
      setAppTag("Manager", edits.Manager);
      setAppTag("Template", edits.Template);
      zip.file("docProps/app.xml", appXml);
    }

    const mime = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docm: "application/vnd.ms-word.document.macroEnabled.12",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      xlsm: "application/vnd.ms-excel.sheet.macroEnabled.12",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      pptm: "application/vnd.ms-powerpoint.presentation.macroEnabled.12",
    }[getExtension(file.name)] || "application/zip";
    const blob = await zip.generateAsync({ type: "blob", mimeType: mime });
    return {
      blob,
      filename: `${baseName(file.name)}_editado${ext(file.name)}`,
    };
  }

  throw new Error("Formato não suportado.");
};

export const downloadBlob = (blob, filename) => {
  // Sanitize filename: keep only safe chars; trim length
  const safeName = String(filename || "arquivo")
    .replace(/[\x00-\x1F\x7F<>:"/\\|?*]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 200) || "arquivo";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
