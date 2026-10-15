-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "district" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" CHAR(8);

-- CEP só com dígitos (a aplicação normaliza; o banco garante).
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_zipCode_digits" CHECK ("zipCode" IS NULL OR "zipCode" ~ '^[0-9]{8}$');
