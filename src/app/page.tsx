import { redirect } from "next/navigation";

/** Punto de entrada: toda la operación vive tras el login. */
export default function HomePage() {
  redirect("/login");
}
