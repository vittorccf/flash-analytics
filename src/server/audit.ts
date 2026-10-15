import type { Prisma } from "@/generated/prisma/client";
import { db, type DbTransaction } from "./db";
import { publish } from "./realtime/events";
import type { RequestMeta } from "./request-context";

type AuditInput = {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonObject;
  meta?: RequestMeta;
};

// Append-only por convenção: a aplicação só insere. Em produção, replicar para armazenamento imutável.
export const recordAudit = async (client: DbTransaction | typeof db, input: AuditInput) => {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.meta?.ip ?? null,
      userAgent: input.meta?.userAgent ?? null,
    },
  });
  await publish(client, { type: "audit.recorded", action: input.action });
};
