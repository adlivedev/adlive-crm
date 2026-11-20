import { NextResponse } from "next/server";
import { z } from "zod";

import { authErrorStatus, requireTenantAdminOrPlatformSuperadmin } from "@/shared/lib/serverAuth";
import { brandingSchema } from "@/shared/lib/validation/branding";
import type { TenantBranding } from "@/shared/types/database";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const uploadSchema = z.object({
  tenantId: z.string().uuid(),
  variant: z.enum(["logo_url", "logo_dark_url"]),
});

const FILE_SIGNATURES = {
  "image/png": { extension: "png", matches: (bytes: Buffer) => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/jpeg": { extension: "jpg", matches: (bytes: Buffer) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/webp": { extension: "webp", matches: (bytes: Buffer) => bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" },
} as const;

type AllowedMimeType = keyof typeof FILE_SIGNATURES;

function isAllowedMimeType(value: string): value is AllowedMimeType {
  return value in FILE_SIGNATURES;
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  let supabase: Awaited<ReturnType<typeof requireTenantAdminOrPlatformSuperadmin>>["supabase"] | null = null;

  try {
    const formData = await request.formData();
    const parsed = uploadSchema.safeParse({
      tenantId: formData.get("tenantId"),
      variant: formData.get("variant"),
    });
    const file = formData.get("file");
    if (!parsed.success || !(file instanceof File)) {
      return NextResponse.json({ error: "Selecciona una imagen, un workspace y una variante válidos." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "La imagen debe pesar entre 1 byte y 2 MB." }, { status: 400 });
    }
    if (!isAllowedMimeType(file.type)) {
      return NextResponse.json({ error: "Solo se permiten imágenes PNG, JPEG o WebP." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const signature = FILE_SIGNATURES[file.type];
    if (bytes.length !== file.size || !signature.matches(bytes)) {
      return NextResponse.json({ error: "El contenido del archivo no coincide con una imagen PNG, JPEG o WebP válida." }, { status: 400 });
    }

    const context = await requireTenantAdminOrPlatformSuperadmin(parsed.data.tenantId);
    supabase = context.supabase;
    const tenantResult = await supabase
      .from("tenants")
      .select("branding")
      .eq("id", parsed.data.tenantId)
      .single();
    if (tenantResult.error) return NextResponse.json({ error: "No se pudo cargar la marca del workspace." }, { status: 500 });

    uploadedPath = `${parsed.data.tenantId}/${parsed.data.variant}-${Date.now()}.${signature.extension}`;
    const uploadResult = await supabase.storage.from("tenant-branding").upload(uploadedPath, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadResult.error) {
      uploadedPath = null;
      return NextResponse.json({ error: "No se pudo subir la imagen. Revisa el bucket y sus políticas." }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from("tenant-branding").getPublicUrl(uploadedPath);
    const currentBranding = brandingSchema.parse(tenantResult.data.branding) as TenantBranding;
    const branding = { ...currentBranding, [parsed.data.variant]: publicUrl };
    const updateResult = await supabase
      .from("tenants")
      .update({ branding })
      .eq("id", parsed.data.tenantId)
      .select("id, branding")
      .single();
    if (updateResult.error) {
      await supabase.storage.from("tenant-branding").remove([uploadedPath]);
      return NextResponse.json({ error: "La imagen se subió, pero no se pudo actualizar la marca." }, { status: 500 });
    }

    return NextResponse.json({ url: publicUrl, tenant: updateResult.data }, { status: 201 });
  } catch (error) {
    if (supabase && uploadedPath) await supabase.storage.from("tenant-branding").remove([uploadedPath]);
    const status = authErrorStatus(error);
    return NextResponse.json({ error: status === 500 ? "No se pudo procesar la imagen." : "No autorizado." }, { status });
  }
}
