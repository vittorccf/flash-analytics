// Tipo de imagem pela assinatura dos bytes (não pela extensão nem pelo que o navegador informa).
// Só PNG, JPEG e WebP. SVG fica de fora: é XML e pode carregar script.
const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

export const detectImageType = (buf: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null => {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
};
