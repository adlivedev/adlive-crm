/**
 * Restauración idempotente (Iteración 12E):
 * la cuenta superadmin desarrollo@adlive.com.co fue renombrada por el antiguo
 * PATCH de tenants y quedó como emanueel031@gmail.com (un solo user_id dueño
 * de adlive y cierto). Este script separa ambas cuentas, repara las filas
 * tenant_members y verifica que cada dueño apunte a su propia cuenta.
 *
 * Temporal: se ejecuta durante el build en Vercel y luego se elimina.
 * No imprime secretos ni contraseñas.
 */
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SUPER_EMAIL = "desarrollo@adlive.com.co";
const OWNER_EMAIL = "emanueel031@gmail.com";

const result = {
  steps: [],
  superEmailRestored: false,
  ownerAccountSeparated: false,
  superadminRowIntact: false,
  ciertoOwner: null,
  adliveOwner: null,
  ok: false,
};

if (!url || !serviceKey) {
  console.log("RESTORE_DUAL_OWNERS_RESULT " + JSON.stringify({ ...result, fatal: "missing-env" }));
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

function step(name, ok) {
  result.steps.push({ name, ok: Boolean(ok) });
  if (!ok) throw new Error(`step-failed:${name}`);
}

try {
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  step("list-users", !listError);
  const users = list?.users ?? [];
  const byEmail = (email) => users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) ?? null;

  let superUser = byEmail(SUPER_EMAIL);
  let ownerUser = byEmail(OWNER_EMAIL);

  /* Estado roto detectado en producción: la cuenta superadmin fue renombrada
     al correo del dueño de CIERTO. Se revierte el renombrado. */
  if (!superUser && ownerUser) {
    const renamed = await admin.auth.admin.updateUserById(ownerUser.id, { email: SUPER_EMAIL, email_confirm: true });
    step("rename-back-super-email", !renamed.error && renamed.data?.user);
    superUser = renamed.data.user;
    ownerUser = null;
    result.superEmailRestored = true;
  }

  if (!superUser) {
    const created = await admin.auth.admin.createUser({
      email: SUPER_EMAIL,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
    });
    step("create-super-user", !created.error && created.data?.user);
    superUser = created.data.user;
  }

  if (!ownerUser || ownerUser.id === superUser.id) {
    const created = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: randomBytes(32).toString("base64url"),
      email_confirm: true,
    });
    step("create-owner-user", !created.error && created.data?.user);
    ownerUser = created.data.user;
    result.ownerAccountSeparated = true;
  }

  /* Cada fila de dueño apunta a la cuenta de su correo, sin tocar otras filas. */
  const ownerFix = await admin.from("tenant_members").update({ user_id: ownerUser.id }).eq("email", OWNER_EMAIL).eq("role", "owner");
  step("point-owner-members", !ownerFix.error);
  const superFix = await admin.from("tenant_members").update({ user_id: superUser.id }).eq("email", SUPER_EMAIL).eq("role", "owner");
  step("point-super-members", !superFix.error);

  const { data: saRow } = await admin.from("platform_superadmins").select("user_id").eq("user_id", superUser.id).maybeSingle();
  if (!saRow) {
    const inserted = await admin.from("platform_superadmins").insert({ user_id: superUser.id, email: SUPER_EMAIL });
    step("ensure-superadmin-row", !inserted.error);
  }
  result.superadminRowIntact = true;

  const { data: members, error: membersError } = await admin.from("tenant_members").select("tenant_id,email,role,user_id").eq("role", "owner");
  step("read-back-owners", !membersError);
  const adlive = (members ?? []).find((member) => member.email?.toLowerCase() === SUPER_EMAIL.toLowerCase());
  const cierto = (members ?? []).find((member) => member.email?.toLowerCase() === OWNER_EMAIL.toLowerCase());
  step("verify-distinct-users", adlive && cierto && adlive.user_id !== cierto.user_id);
  step("verify-superadmin-account", adlive.user_id === superUser.id && cierto.user_id === ownerUser.id);
  result.ciertoOwner = { email: cierto.email, userIdMatch: cierto.user_id === ownerUser.id };
  result.adliveOwner = { email: adlive.email, userIdMatch: adlive.user_id === superUser.id };
  result.ok = true;
} catch (error) {
  result.fatal = error instanceof Error ? error.message : "unknown";
}

console.log("RESTORE_DUAL_OWNERS_RESULT " + JSON.stringify(result));
process.exit(result.ok ? 0 : 1);
