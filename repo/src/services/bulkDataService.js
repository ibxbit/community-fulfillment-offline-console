import { fail, ok } from "./response";

const MAX_ROWS = 5000;

const IMPORT_SCHEMAS = {
  users: {
    required: ["username", "name", "role"],
    types: { username: "string", name: "string", role: "string" },
  },
  requests: {
    required: ["requesterUserId", "requestingOrgId", "itemSku", "quantity"],
    types: {
      requesterUserId: "string",
      requestingOrgId: "string",
      itemSku: "string",
      quantity: "number",
      deliveryWindow: "string",
    },
  },
  shipments: {
    required: ["itemSku", "lot", "warehouseLocation", "requester", "date"],
    types: {
      itemSku: "string",
      lot: "string",
      warehouseLocation: "string",
      requester: "string",
      date: "date",
      documentStatus: "string",
    },
  },
  inventory: {
    required: ["sku", "quantity", "warehouseLocation"],
    types: {
      sku: "string",
      quantity: "number",
      warehouseLocation: "string",
    },
  },
};

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(content) {
  const lines = content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });

    return row;
  });
}

function normalizeValue(rawValue, type) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  if (type === "number") {
    const num = Number(rawValue);
    return Number.isFinite(num) ? num : NaN;
  }

  if (type === "boolean") {
    if (rawValue === true || rawValue === false) {
      return rawValue;
    }

    const value = String(rawValue).toLowerCase();
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    return Symbol("invalid_boolean");
  }

  if (type === "date") {
    const ts = Date.parse(rawValue);
    return Number.isNaN(ts)
      ? Symbol("invalid_date")
      : new Date(ts).toISOString();
  }

  if (type === "array" || type === "object") {
    if (typeof rawValue !== "string") {
      return rawValue;
    }

    try {
      return JSON.parse(rawValue);
    } catch {
      return Symbol("invalid_json");
    }
  }

  return String(rawValue);
}

function validateRows(rows, schema) {
  const errors = [];
  const validRows = [];

  rows.forEach((row, index) => {
    const rowErrors = [];

    for (const field of schema.required) {
      const value = row[field];
      if (
        value === undefined ||
        value === null ||
        String(value).trim() === ""
      ) {
        rowErrors.push(`Missing required field '${field}'`);
      }
    }

    const normalized = { ...row };
    for (const [field, type] of Object.entries(schema.types)) {
      if (
        row[field] === undefined ||
        row[field] === null ||
        row[field] === ""
      ) {
        continue;
      }

      const value = normalizeValue(row[field], type);

      if (type === "number" && Number.isNaN(value)) {
        rowErrors.push(`Field '${field}' must be a number`);
      } else if (typeof value === "symbol") {
        rowErrors.push(`Field '${field}' has invalid ${type} format`);
      } else {
        normalized[field] = value;
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ row: index + 2, errors: rowErrors });
    } else {
      validRows.push(normalized);
    }
  });

  return { validRows, errors };
}

function toCsv(rows) {
  if (rows.length === 0) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    const line = headers
      .map((header) => {
        const value = row[header] ?? "";
        const text = typeof value === "string" ? value : JSON.stringify(value);
        if (text.includes(",") || text.includes('"') || text.includes("\n")) {
          return `"${text.replace(/"/g, '""')}"`;
        }
        return text;
      })
      .join(",");

    lines.push(line);
  }

  return lines.join("\n");
}

function triggerDownload(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function createBulkDataService({ collections }) {
  return {
    getSupportedCollections() {
      return Object.keys(IMPORT_SCHEMAS);
    },

    generateTemplate({ collection, format }) {
      const schema = IMPORT_SCHEMAS[collection];
      if (!schema) {
        return fail("Unsupported collection", 400);
      }

      const sample = schema.required.reduce((acc, key) => {
        acc[key] = "";
        return acc;
      }, {});

      if (format === "json") {
        triggerDownload(
          JSON.stringify([sample], null, 2),
          `${collection}_template.json`,
          "application/json",
        );
      } else {
        triggerDownload(
          toCsv([sample]),
          `${collection}_template.csv`,
          "text/csv;charset=utf-8",
        );
      }

      return ok({ generated: true });
    },

    async exportData({ collection, format }) {
      const repository = collections[collection];
      if (!repository) {
        return fail("Unsupported collection", 400);
      }

      const rows = await repository.find({});

      if (format === "json") {
        triggerDownload(
          JSON.stringify(rows, null, 2),
          `${collection}_export.json`,
          "application/json",
        );
      } else {
        triggerDownload(
          toCsv(rows),
          `${collection}_export.csv`,
          "text/csv;charset=utf-8",
        );
      }

      return ok({ exportedRows: rows.length });
    },

    async importData({ collection, format, content }) {
      const repository = collections[collection];
      const schema = IMPORT_SCHEMAS[collection];

      if (!repository || !schema) {
        return fail("Unsupported collection", 400);
      }

      let rows;
      try {
        rows = format === "json" ? JSON.parse(content) : parseCsv(content);
      } catch {
        return fail("File parsing failed", 400);
      }

      if (!Array.isArray(rows)) {
        return fail("Imported file must contain an array of rows", 400);
      }

      if (rows.length > MAX_ROWS) {
        return fail(`Row limit exceeded. Maximum is ${MAX_ROWS}`, 400);
      }

      const { validRows, errors } = validateRows(rows, schema);
      if (errors.length > 0) {
        // Bulk imports are all-or-nothing: we fail the entire file when any row
        // fails validation so no partial write can leave collections inconsistent.
        return fail("Row validation failed", 422, { errors });
      }

      try {
        // insertMany runs inside one IndexedDB transaction in repository.js.
        // If any write fails, IndexedDB aborts and rolls back the full batch.
        await repository.insertMany(validRows);
      } catch {
        return fail("Import failed; transaction rolled back", 500);
      }

      return ok({ importedRows: validRows.length });
    },
  };
}
