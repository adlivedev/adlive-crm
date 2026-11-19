import type { TenantBranding } from "@/shared/types/database";

export interface PlatformTenantMetric {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  branding: TenantBranding;
  admin_email: string | null;
  user_count: number;
  contact_count: number;
  created_at: string;
}
