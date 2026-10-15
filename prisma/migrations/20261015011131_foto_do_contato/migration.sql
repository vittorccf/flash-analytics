/*
  Warnings:

  - You are about to drop the `UserAvatar` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "UserAvatar" DROP CONSTRAINT "UserAvatar_userId_fkey";

-- DropTable
DROP TABLE "UserAvatar";

-- CreateTable
CREATE TABLE "ContactPhoto" (
    "contactId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactPhoto_pkey" PRIMARY KEY ("contactId")
);

-- AddForeignKey
ALTER TABLE "ContactPhoto" ADD CONSTRAINT "ContactPhoto_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Limites também no banco: foto até 1 MB e só os formatos aceitos.
ALTER TABLE "ContactPhoto" ADD CONSTRAINT "ContactPhoto_size" CHECK (octet_length("data") <= 1048576);
ALTER TABLE "ContactPhoto" ADD CONSTRAINT "ContactPhoto_mime" CHECK ("mimeType" IN ('image/png', 'image/jpeg', 'image/webp'));
