-- Origem vira o grupo da agenda (família, amigos, trabalho…): o app é agenda de contatos, não CRM.
ALTER TYPE "ContactOrigin" RENAME TO "ContactOrigin_old";
CREATE TYPE "ContactOrigin" AS ENUM ('FAMILIA', 'AMIGOS', 'TRABALHO', 'ESTUDOS', 'SERVICOS', 'OUTRO');
ALTER TABLE "Contact" ALTER COLUMN "origin" TYPE "ContactOrigin" USING (
  CASE "origin"::text
    WHEN 'INDICACAO' THEN 'AMIGOS'
    WHEN 'REDES_SOCIAIS' THEN 'AMIGOS'
    WHEN 'PROSPECCAO' THEN 'TRABALHO'
    ELSE 'OUTRO'
  END
)::"ContactOrigin";
DROP TYPE "ContactOrigin_old";
