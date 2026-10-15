// Origem dos números pelo DDD, a partir dos agregados (DDD, UF do endereço) de "ContactStat".
import "server-only";
import { db } from "./db";
import { summarizePhoneRegions, type DddStateCount } from "@/lib/phone-regions";

export const loadPhoneRegions = async () =>
  summarizePhoneRegions(
    await db.$queryRaw<DddStateCount[]>`
      SELECT ddd::text AS ddd, state::text AS state, sum(count)::int AS count
      FROM "ContactStat"
      GROUP BY 1, 2
      HAVING sum(count) > 0`,
  );
