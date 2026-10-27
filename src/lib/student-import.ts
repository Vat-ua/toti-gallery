import type { ImportRow } from "./admin-types";

export const MAX_IMPORT_ROWS = 500;
export const MAX_IMPORT_BYTES = 200_000;

/** CSV/semicolon CSV and spreadsheet TSV, including quoted delimiters/newlines. */
export function parseStudents(text: string): ImportRow[] {
  if (!text.trim()) throw new Error("Cole uma lista ou escolha um arquivo CSV.");
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("A lista deve ter até 200 KB.");
  text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let quoted = false;
  const counts = new Map([["\t", 0], [";", 0], [",", 0]]);
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    if (char === "\n" && !quoted) break;
    if (!quoted && counts.has(char)) counts.set(char, counts.get(char)! + 1);
  }
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], field = "", afterQuote = false;
  quoted = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === undefined) throw new Error("Há aspas sem fechamento no arquivo.");
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else field += char;
    } else if (char === delimiter || char === "\n" || char === undefined) {
      row.push(field.trim()); field = ""; afterQuote = false;
      if (char !== delimiter) { if (row.some(Boolean)) rows.push(row); row = []; }
    } else if (char === '"' && !field.trim() && !afterQuote) {
      field = ""; quoted = true;
    } else {
      if (afterQuote && char.trim()) throw new Error("Confira as aspas e os separadores do arquivo.");
      field += char;
    }
  }
  const normalized = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_\s]/g, "");
  const first = rows[0]?.map(normalized) || [];
  const emailIndex = first.findIndex(s => ["email", "correioeletronico"].includes(s));
  const nameIndex = first.findIndex(s => ["nome", "name", "nomecompleto"].includes(s));
  const header = emailIndex >= 0 && nameIndex >= 0;
  const data = header ? rows.slice(1) : rows;
  if (!data.length) throw new Error("A lista não contém estudantes.");
  if (data.length > MAX_IMPORT_ROWS) throw new Error("Importe até 500 estudantes por vez.");
  const seen = new Set<string>();
  return data.map((cells, i) => {
    const name = (cells[header ? nameIndex : 0] || "").trim();
    const email = (cells[header ? emailIndex : 1] || "").trim().toLowerCase();
    let error: string | undefined;
    if (cells.length !== 2) error = "Use apenas as colunas Nome e Email.";
    else if (name.length < 2 || name.length > 70) error = "O nome deve ter de 2 a 70 caracteres.";
    else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = "Email inválido.";
    else if (seen.has(email)) error = "Email repetido nesta lista.";
    if (!error) seen.add(email);
    return { line: i + (header ? 2 : 1), name, email, error };
  });
}
