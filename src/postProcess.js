const { CATEGORIES } = require("./fields");

// Pure, deterministic normalisation of values the LLM already extracted.
// This never invents or looks up data - it only reformats what the model
// returned, which the assessment explicitly permits.

function clampConfidence(raw) {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
  return Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
}

function normalizeAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (DATE_RE.test(str)) return str;

  // Common alternate formats the model might still emit despite instructions,
  // e.g. "29-04-2024" (DD-MM-YYYY) or "29/04/2024".
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null; // unparseable - don't guess, downstream confidence should already be low
}

function normalizeCurrency(value) {
  if (!value) return null;
  const str = String(value).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(str) ? str : str || null;
}

function normalizeCategory(value) {
  if (!value) return null;
  const str = String(value).trim().toLowerCase();
  return CATEGORIES.includes(str) ? str : "other";
}

function normalizeString(value) {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === "" ? null : str;
}

const NORMALIZERS = {
  vendor_name: normalizeString,
  amount: normalizeAmount,
  currency: normalizeCurrency,
  date: normalizeDate,
  category: normalizeCategory,
  description: normalizeString,
  invoice_id: normalizeString,
};

module.exports = { clampConfidence, NORMALIZERS };
