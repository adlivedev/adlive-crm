import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/shared/lib/supabase/admin";

export const runtime = "nodejs";

const slugSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(150);

export async function GET(request: Request) {
  const parsed = slugSchema.safeParse(new URL(request.url).searchParams.get("slug") ?? "");
  if (!parsed.success) return NextResponse.json({ error: "Workspace inválido." }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("tenants").select("name,slug,branding,status").eq("slug", parsed.data).eq("status", "active").maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo cargar el workspace." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Workspace no encontrado." }, { status: 404 });
  return NextResponse.json({ workspace: data }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
