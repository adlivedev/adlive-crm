import type { Metadata } from "next";

import { CampaignsView } from "@/features/campaigns/components/CampaignsView";

export const metadata: Metadata = { title: "Campañas masivas · CRM" };

export default function CampanasPage() {
  return <CampaignsView />;
}
