"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/server/audit";
import { getCurrentUser } from "@/server/auth/dal";
import { destroyCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { requestMeta } from "@/server/request-context";

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await recordAudit(db, { actorId: user.id, action: "auth.logout", entity: "User", entityId: user.id, meta: await requestMeta() });
  await destroyCurrentSession();
  redirect("/login");
}
