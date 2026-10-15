// Telefone brasileiro: guardado só com dígitos (DDD + número), exibido formatado.
import { isKnownDdd } from "./ddd";

export const normalizePhone = (input: string) => {
  let digits = input.replace(/\D/g, "");
  if (digits.length > 11 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
};

export const isValidBrPhone = (digits: string) => {
  if (!/^\d{10,11}$/.test(digits)) return false;
  // DDD precisa existir (tabela da Anatel): "20", "30", "50"… não são DDDs.
  if (!isKnownDdd(digits.slice(0, 2))) return false;
  // Celular (11 dígitos) começa com 9 depois do DDD.
  return digits.length === 10 || digits[2] === "9";
};

export const formatPhone = (digits: string) =>
  digits.length === 11
    ? `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
    : digits.length === 10
      ? `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
      : digits;
