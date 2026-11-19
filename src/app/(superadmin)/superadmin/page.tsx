import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SuperadminView } from "@/features/superadmin/components/SuperadminView";
import type { PlatformTenantMetric } from "@/features/superadmin/types";
import { createClient } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Superadmin · ADlive",
  robots: { index: false, follow: false },
};

export default async function SuperadminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: isSuperadmin } = await supabase.rpc("is_platform_superadmin");
  if (isSuperadmin !== true) redirect("/dashboard");

  const { data, error } = await supabase.rpc("get_platform_tenant_metrics");
  if (error) throw new Error("No fue posible cargar los workspaces de la plataforma.");

  return <SuperadminView initialTenants={(data ?? []) as unknown as PlatformTenantMetric[]} />;
}
