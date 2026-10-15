// CSV no padrão do Excel em português: separador ";" e UTF-8 com BOM (sem o BOM o Excel quebra os acentos).
// Na leitura, aceita ";", "," ou tabulação, aspas (RFC 4180) e arquivos em Windows-1252 (o "CSV" do Excel antigo).

// Injeção de fórmula: célula que começa com = + - @ vira fórmula ao abrir no Excel (ex.: =HYPERLINK(...)).
// Prefixar com apóstrofo faz o Excel tratar como texto. Vale para todo CSV que sai do sistema.
export const neutralizeFormula = (value: string) => (/^[=+\-@\t\r]/.test(value) ? `'${value}` : value);

const quote = (value: string, delimiter: string) =>
  /["\r\n]/.test(value) || value.includes(delimiter) ? `"${value.replace(/"/g, '""')}"` : value;

export const toCsv = (rows: string[][], delimiter = ";") =>
  "\uFEFF" + rows.map((row) => row.map((v) => quote(neutralizeFormula(v), delimiter)).join(delimiter)).join("\r\n") + "\r\n";

// UTF-8 primeiro; se os bytes não forem UTF-8 válido, é o Windows-1252 que o Excel salva em português.
export const decodeText = (buf: Buffer) => {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return text.replace(/^\uFEFF/, "");
};

const detectDelimiter = (firstLine: string) => {
  const counts = [";", ",", "\t"].map((d) => ({ d, n: firstLine.split(d).length }));
  return counts.sort((a, b) => b.n - a.n)[0]!.d;
};

export const parseCsv = (text: string, maxRows = 20_000): string[][] => {
  const delimiter = detectDelimiter(text.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field === "") inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      if (rows.length > maxRows) throw new Error(`O arquivo passa de ${maxRows.toLocaleString("pt-BR")} linhas.`);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Apóstrofo de proteção contra fórmula (gerado pela exportação) sai na volta.
  return rows.map((r) => r.map((v) => v.trim().replace(/^'(?=[=+\-@])/, "")));
};
