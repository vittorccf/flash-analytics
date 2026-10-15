import { describe, expect, it } from "vitest";
import { parseImportRows } from "@/server/contact-sheet";
import { decodeText, neutralizeFormula, parseCsv, toCsv } from "@/server/spreadsheet/csv";
import { readXlsx, writeXlsx } from "@/server/spreadsheet/xlsx";
import { InvalidZipError, readZip, writeZip } from "@/server/spreadsheet/zip";
import { emailLinks, phoneLinks, whatsappAvailability, whatsappLinks } from "@/lib/contact-channels";
import { contactSchema } from "@/lib/validation";

describe("Excel (.xlsx)", () => {
  it("ida e volta: texto com acento, aspas, <tags>, & e zero à esquerda", () => {
    const rows = [
      ["Nome", "CEP", "Obs"],
      ["José \"Zé\" Ávila", "01310-100", "<b>a & b</b>"],
      ["", "0", ""],
    ];
    expect(readXlsx(writeXlsx(rows))).toEqual(rows);
  });

  it("lê texto compartilhado, números e células puladas (como o Excel salva)", () => {
    const shared = '<sst><si><t>Nome</t></si><si><t>Telefone</t></si><si><r><t>Maria </t></r><r><t>Silva</t></r></si></sst>';
    const sheet =
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>2</v></c><c r="C3"><v>11987654321</v></c></row></sheetData></worksheet>';
    const file = writeZip([
      { name: "xl/sharedStrings.xml", data: Buffer.from(shared) },
      { name: "xl/worksheets/sheet1.xml", data: Buffer.from(sheet) },
    ]);
    expect(readXlsx(file)).toEqual([["Nome", "", "Telefone"], [], ["Maria Silva", "", "11987654321"]]);
  });

  it("recusa zip bomb (descompactado acima do limite) e arquivo que não é zip", () => {
    const bomb = writeZip([{ name: "x.xml", data: Buffer.alloc(5 * 1024 * 1024) }]);
    expect(() => readZip(bomb, { maxEntries: 10, maxTotalBytes: 1024 * 1024 })).toThrow(InvalidZipError);
    expect(() => readZip(Buffer.from("não sou um zip"))).toThrow(InvalidZipError);
  });

  it("descompactação para no limite mesmo se o tamanho declarado mentir", () => {
    const zip = writeZip([{ name: "x.xml", data: Buffer.alloc(2 * 1024 * 1024) }]);
    // Adultera o tamanho declarado no diretório central para 10 bytes.
    const eocd = zip.length - 22;
    const central = zip.readUInt32LE(eocd + 16);
    zip.writeUInt32LE(10, central + 24);
    expect(() => readZip(zip, { maxEntries: 10, maxTotalBytes: 1024 * 1024 })).toThrow(InvalidZipError);
  });
});

describe("CSV", () => {
  it("gera no padrão do Excel em português (BOM, ponto e vírgula, aspas)", () => {
    const csv = toCsv([["Nome", "Obs"], ["Ana; Bia", 'disse "oi"\nnova linha']]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Ana; Bia";"disse ""oi""\nnova linha"');
  });

  it("neutraliza fórmula (injeção de CSV) e a importação desfaz o apóstrofo", () => {
    expect(neutralizeFormula("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(neutralizeFormula("+5511")).toBe("'+5511");
    expect(neutralizeFormula("Maria")).toBe("Maria");
    expect(parseCsv(toCsv([["a"], ["=1+1"]]).replace("\uFEFF", ""))).toEqual([["a"], ["=1+1"]]);
  });

  it("lê ; , ou tabulação, aspas com quebra de linha, e Windows-1252 do Excel antigo", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\r\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv('a;b\n"x\ny";"z"')).toEqual([["a", "b"], ["x\ny", "z"]]);
    expect(decodeText(Buffer.from([0x53, 0xe3, 0x6f]))).toBe("São"); // "São" em Windows-1252
    expect(decodeText(Buffer.from("\uFEFFSão", "utf8"))).toBe("São");
  });
});

describe("importação: mapeamento tolerante", () => {
  it("reconhece cabeçalhos com variações e conserta vícios do Excel", () => {
    const { records, missingColumns, ignoredColumns } = parseImportRows([
      ["Nome completo", "Celular", "Tem WhatsApp", "Município", "Estado", "CEP", "Grupo", "Coluna estranha"],
      ["Maria Silva", "1.1987654321E+10", "sim", "São Paulo", "sp", "1310100", "Amigos", "x"],
      ["", "", "", "", "", "", "", ""],
      ["João Lima", "(21) 3333-4444", "não", "Niterói", "RJ", "", "", ""],
    ]);
    expect(missingColumns).toEqual([]);
    expect(ignoredColumns).toEqual(["Coluna estranha"]);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      line: 2,
      values: { name: "Maria Silva", phone: "11987654321", whatsapp: "true", city: "São Paulo", state: "SP", zipCode: "01310100", origin: "AMIGOS" },
    });
    expect(records[1]).toMatchObject({ line: 4, values: { whatsapp: "false", origin: "OUTRO" } });
    expect(contactSchema.safeParse(records[0]!.values).success).toBe(true);
  });

  it("aponta colunas obrigatórias que faltam", () => {
    expect(parseImportRows([["Nome", "Telefone"]]).missingColumns).toEqual(["Cidade", "UF"]);
  });
});

describe("canais de contato", () => {
  it("WhatsApp: informado vale; sem informação, celular sim e fixo não", () => {
    expect(whatsappAvailability("11987654321", null).available).toBe(true);
    expect(whatsappAvailability("1133334444", null).available).toBe(false);
    expect(whatsappAvailability("1133334444", true).available).toBe(true);
    expect(whatsappAvailability("11987654321", false).available).toBe(false);
  });

  it("monta os links com DDI do Brasil e e-mail codificado", () => {
    expect(whatsappLinks("11987654321").app).toBe("https://wa.me/5511987654321");
    expect(whatsappLinks("11987654321").web).toBe("https://web.whatsapp.com/send?phone=5511987654321");
    expect(phoneLinks("11987654321")).toEqual({ call: "tel:+5511987654321", sms: "sms:+5511987654321" });
    expect(emailLinks("a+b@x.com").gmail).toContain("to=a%2Bb%40x.com");
  });
});
