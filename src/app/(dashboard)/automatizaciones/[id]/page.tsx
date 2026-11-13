import type { Metadata } from "next";

import { WorkflowDetailView } from "@/features/workflows/components/WorkflowDetailView";

export const metadata: Metadata = {
  title: "Constructor de workflow",
};

interface WorkflowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function WorkflowDetailPage({ params }: WorkflowDetailPageProps) {
  const { id } = await params;
  return <WorkflowDetailView workflowId={id} />;
}
