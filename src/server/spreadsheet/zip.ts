// Zip mínimo (o .xlsx é um zip de XMLs), sobre o zlib do Node: sem dependência externa.
// Leitura com limites: número de arquivos e total descompactado (contra "zip bomb"). Sem ZIP64 nem criptografia.
import { crc32, deflateRawSync, inflateRawSync } from "node:zlib";

export class InvalidZipError extends Error {}

const DOS_DATE = ((2024 - 1980) << 9) | (1 << 5) | 1; // data fixa: arquivos gerados iguais para o mesmo conteúdo

export const writeZip = (entries: { name: string; data: Buffer }[]) => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const compressed = deflateRawSync(entry.data);
    const crc = crc32(entry.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versão necessária
    local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, b) => sum + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
};

export const readZip = (buf: Buffer, limits = { maxEntries: 200, maxTotalBytes: 30 * 1024 * 1024 }) => {
  // Fim do diretório central: nos últimos 22 + 65535 bytes (comentário opcional do zip).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new InvalidZipError("Arquivo não é um .xlsx válido.");

  const count = buf.readUInt16LE(eocd + 10);
  if (count > limits.maxEntries) throw new InvalidZipError("Planilha com estrutura grande demais.");
  let pointer = buf.readUInt32LE(eocd + 16);
  let budget = limits.maxTotalBytes;
  const files = new Map<string, Buffer>();

  for (let n = 0; n < count; n++) {
    if (pointer + 46 > buf.length || buf.readUInt32LE(pointer) !== 0x02014b50) throw new InvalidZipError("Planilha corrompida.");
    const method = buf.readUInt16LE(pointer + 10);
    const compressedSize = buf.readUInt32LE(pointer + 20);
    const size = buf.readUInt32LE(pointer + 24);
    const nameLength = buf.readUInt16LE(pointer + 28);
    const extraLength = buf.readUInt16LE(pointer + 30);
    const commentLength = buf.readUInt16LE(pointer + 32);
    const localOffset = buf.readUInt32LE(pointer + 42);
    const name = buf.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    pointer += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (size > budget) throw new InvalidZipError("Planilha descompactada grande demais.");
    if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) throw new InvalidZipError("Planilha corrompida.");
    const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
    const raw = buf.subarray(start, start + compressedSize);
    if (raw.length !== compressedSize) throw new InvalidZipError("Planilha corrompida.");

    let data: Buffer;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) {
      try {
        // maxOutputLength: mesmo que o tamanho declarado minta, a descompressão para no limite.
        data = inflateRawSync(raw, { maxOutputLength: budget });
      } catch {
        throw new InvalidZipError("Planilha descompactada grande demais ou corrompida.");
      }
    } else throw new InvalidZipError("Compressão de planilha não suportada.");

    budget -= data.length;
    files.set(name, data);
  }
  return files;
};
