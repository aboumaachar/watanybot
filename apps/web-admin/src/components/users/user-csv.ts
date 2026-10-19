import type { ImportRow } from "./user-management-types";

export const IMPORT_COLUMNS = ["name", "email", "phone", "role", "status", "password"] as const;

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

export function parseImportFile(text: string): ImportRow[] {
  const rows = parseCsv(text.replace(/^\uFEFF/u, ""));
  if (rows.length < 2) return [];
  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const positions = new Map(headers.map((header, index) => [header, index]));
  return rows.slice(1).map((values) => {
    const get = (key: typeof IMPORT_COLUMNS[number]) => values[positions.get(key) ?? -1] || "";
    return {
      name: get("name"),
      email: get("email"),
      phone: get("phone"),
      role: get("role") || "public",
      status: get("status") || "active",
      password: get("password"),
    };
  });
}

export function downloadTextFile(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadImportTemplate() {
  const sample = [
    IMPORT_COLUMNS.join(","),
    '"اسم المستخدم","user@example.com","+96170000000","public","active","ChangeMe123!"',
  ].join("\r\n");
  downloadTextFile("watany-users-import-template.csv", `\uFEFF${sample}\r\n`);
}
