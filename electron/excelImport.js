const ExcelJS = require("exceljs");

/**
 * The person's sheet may have all sorts of extra columns (supplier, notes,
 * last-ordered date, whatever their old system exported). We only care about
 * pulling out the handful of fields a product actually needs, matched by
 * header name rather than column position — so column order doesn't matter
 * and extra columns are just ignored.
 */
const FIELD_SYNONYMS = {
  sku: ["sku", "barcode", "code", "item code", "product code", "upc", "ean", "sku/barcode", "sku / barcode", "sku barcode"],
  cost_price: ["cost price", "cost", "purchase price", "buying price", "cp", "cost rs", "cost price rs"],
  price: ["price", "selling price", "mrp", "sale price", "rate", "unit price", "price rs", "selling price rs"],
  low_stock_threshold: ["threshold", "low stock threshold", "reorder level", "min stock", "minimum stock", "low stock"],
  stock_qty: ["stock", "qty", "quantity", "stock qty", "opening stock", "current stock", "stock quantity"],
  category: ["category", "type", "group", "product category"],
  unit: ["unit", "uom", "measure", "units"],
  name: ["name", "product name", "item name", "product", "description", "item", "product item name"]
};

// Order matters: checked first-to-last, and a field is only matched once.
// cost_price and low_stock_threshold must be checked before the more generic
// "price" and "stock" so "Cost Price" doesn't get claimed by the price field.
const FIELD_ORDER = ["sku", "cost_price", "price", "low_stock_threshold", "stock_qty", "category", "unit", "name"];
const REQUIRED_FIELDS = ["sku", "name", "price"];
const NUMERIC_FIELDS = ["price", "cost_price", "stock_qty", "low_stock_threshold"];

function normalizeHeader(h) {
  return String(h || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 /]/g, "")
    .replace(/\s+/g, " ");
}

function detectColumnMapping(headerRowValues) {
  const headers = headerRowValues.map(normalizeHeader);
  const mapping = {}; // colIndex -> field
  const usedFields = new Set();

  // Pass 1: exact header match
  headers.forEach((h, idx) => {
    if (!h) return;
    for (const field of FIELD_ORDER) {
      if (usedFields.has(field)) continue;
      if (FIELD_SYNONYMS[field].includes(h)) {
        mapping[idx] = field;
        usedFields.add(field);
        break;
      }
    }
  });

  // Pass 2: fallback to "header contains synonym" for anything still unmapped
  headers.forEach((h, idx) => {
    if (mapping[idx] !== undefined || !h) return;
    for (const field of FIELD_ORDER) {
      if (usedFields.has(field)) continue;
      if (FIELD_SYNONYMS[field].some((syn) => h.includes(syn))) {
        mapping[idx] = field;
        usedFields.add(field);
        break;
      }
    }
  });

  return mapping;
}

function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === "") return null;
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

async function parseProductExcel(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("That file doesn't have a readable sheet.");

  // exceljs rows are 1-indexed and row.values[0] is always undefined/empty.
  const headerRowValues = sheet.getRow(1).values.slice(1);
  const mapping = detectColumnMapping(headerRowValues);
  const mappedFields = new Set(Object.values(mapping));

  const missingRequired = REQUIRED_FIELDS.filter((f) => !mappedFields.has(f));
  if (missingRequired.length > 0) {
    throw new Error(
      `Couldn't find a column for: ${missingRequired.join(", ")}. Rename the header row to something like "SKU", "Product Name", and "Price" and try again.`
    );
  }

  const detectedColumns = {};
  Object.entries(mapping).forEach(([idx, field]) => {
    detectedColumns[field] = headerRowValues[Number(idx)];
  });

  const seenSkus = new Set();
  const rows = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = row.values.slice(1);
    if (values.every((v) => v === null || v === undefined || v === "")) return;

    const rec = {
      sku: "",
      name: "",
      price: null,
      cost_price: 0,
      stock_qty: 0,
      unit: "pcs",
      category: "",
      low_stock_threshold: 5
    };

    Object.entries(mapping).forEach(([idx, field]) => {
      const raw = values[Number(idx)];
      if (raw === null || raw === undefined || raw === "") return;
      if (NUMERIC_FIELDS.includes(field)) {
        const num = parseNumber(raw);
        if (num !== null) rec[field] = num;
      } else {
        rec[field] = String(raw).trim();
      }
    });

    let valid = true;
    let reason = "";
    if (!rec.sku || !rec.name) {
      valid = false;
      reason = "Missing SKU or Name";
    } else if (rec.price === null) {
      valid = false;
      reason = "Missing or invalid Price";
    } else if (seenSkus.has(rec.sku)) {
      valid = false;
      reason = "Duplicate SKU within this file";
    }

    if (valid) seenSkus.add(rec.sku);
    rows.push({ ...rec, rowNumber, valid, reason });
  });

  return { rows, detectedColumns };
}

module.exports = { parseProductExcel };
