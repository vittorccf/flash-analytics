// CEP: guardado só com os 8 dígitos, exibido como 00000-000. Usado no formulário e no servidor.
export const normalizeZipCode = (input: string) => input.replace(/\D/g, "").slice(0, 8);

export const isValidZipCode = (digits: string) => /^\d{8}$/.test(digits) && digits !== "00000000";

// Máscara progressiva para o campo: "0131" → "0131", "013101" → "01310-1".
export const formatZipCode = (input: string) => {
  const digits = normalizeZipCode(input);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};
