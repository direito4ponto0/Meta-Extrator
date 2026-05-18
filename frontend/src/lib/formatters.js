export const formatBytes = (bytes) => {
  if (bytes === 0 || bytes == null) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export const formatDuration = (ms) => {
  if (!ms || ms < 0) return "0s";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

export const formatDate = (d) => {
  if (!d) return "—";
  try {
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return String(d);
  }
};

export const flattenMetadata = (obj, prefix = "") => {
  const out = {};
  if (obj == null) return out;
  if (typeof obj !== "object" || obj instanceof Date) {
    out[prefix || "value"] = obj;
    return out;
  }
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v == null) continue;
    if (v instanceof Date) { out[key] = v.toISOString(); continue; }
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      if (v.every((x) => typeof x !== "object")) { out[key] = v.join(", "); continue; }
      v.forEach((item, i) => Object.assign(out, flattenMetadata(item, `${key}[${i}]`)));
      continue;
    }
    if (typeof v === "object") { Object.assign(out, flattenMetadata(v, key)); continue; }
    out[key] = v;
  }
  return out;
};
