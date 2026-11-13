import type { Metadata } from "next";

import { ContactDetailView } from "@/features/contacts/components/detail/ContactDetailView";

export const metadata: Metadata = {
  title: "Ficha del contacto",
};

interface ContactDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params;
  return <ContactDetailView contactId={id} />;
}
