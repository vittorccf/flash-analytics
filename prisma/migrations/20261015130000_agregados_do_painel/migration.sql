-- Agregados do painel, mantidos por trigger: o painel lê poucas linhas daqui em vez de varrer "Contact".
CREATE TABLE "ContactStat" (
    "day" DATE NOT NULL,
    "origin" "ContactOrigin" NOT NULL,
    "state" CHAR(2) NOT NULL,
    "ddd" CHAR(2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "ContactStat_pkey" PRIMARY KEY ("day","origin","state","ddd","createdById")
);

-- Dia no fuso de São Paulo ("createdAt" é gravado em UTC, sem fuso), igual às telas.
CREATE FUNCTION contact_stat_day(ts timestamp) RETURNS date
  LANGUAGE sql IMMUTABLE AS $$ SELECT (ts AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')::date $$;

CREATE FUNCTION contact_stat_bump(p_day date, p_origin "ContactOrigin", p_state text, p_ddd text, p_author text, p_delta int)
  RETURNS void LANGUAGE sql AS $$
    INSERT INTO "ContactStat" ("day", "origin", "state", "ddd", "createdById", "count")
    VALUES (p_day, p_origin, p_state, p_ddd, p_author, p_delta)
    ON CONFLICT ("day", "origin", "state", "ddd", "createdById")
    DO UPDATE SET "count" = "ContactStat"."count" + EXCLUDED."count"
  $$;

CREATE FUNCTION contact_stat_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND contact_stat_day(OLD."createdAt") = contact_stat_day(NEW."createdAt")
     AND OLD."origin" = NEW."origin" AND OLD."state" = NEW."state"
     AND left(OLD."phone", 2) = left(NEW."phone", 2) AND OLD."createdById" = NEW."createdById" THEN
    RETURN NULL; -- edição que não muda nenhuma dimensão (nome, e-mail, endereço…)
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM contact_stat_bump(contact_stat_day(OLD."createdAt"), OLD."origin", OLD."state", left(OLD."phone", 2), OLD."createdById", -1);
  END IF;
  IF TG_OP IN ('UPDATE', 'INSERT') THEN
    PERFORM contact_stat_bump(contact_stat_day(NEW."createdAt"), NEW."origin", NEW."state", left(NEW."phone", 2), NEW."createdById", 1);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER contact_stat_sync
  AFTER INSERT OR DELETE OR UPDATE OF "createdAt", "origin", "state", "phone", "createdById" ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION contact_stat_sync();

-- TRUNCATE não dispara trigger de linha: zera os agregados junto.
CREATE FUNCTION contact_stat_truncate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "ContactStat";
  RETURN NULL;
END $$;

CREATE TRIGGER contact_stat_truncate AFTER TRUNCATE ON "Contact" FOR EACH STATEMENT EXECUTE FUNCTION contact_stat_truncate();

-- Reconstrução completa (carga inicial abaixo e conserto manual). Bloqueia escritas em "Contact" enquanto roda.
CREATE FUNCTION contact_stat_rebuild() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  LOCK TABLE "Contact" IN SHARE MODE;
  DELETE FROM "ContactStat";
  INSERT INTO "ContactStat" ("day", "origin", "state", "ddd", "createdById", "count")
  SELECT contact_stat_day("createdAt"), "origin", "state", left("phone", 2), "createdById", count(*)::int
  FROM "Contact"
  GROUP BY 1, 2, 3, 4, 5;
END $$;

SELECT contact_stat_rebuild();
