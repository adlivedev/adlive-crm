import type { Metadata } from "next";

import { ContactsView } from "@/features/contacts/components/ContactsView";

export const metadata: Metadata = {
  title: "Contactos",
};

export default function ContactsPage() {
  return <ContactsView />;
}
