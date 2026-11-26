import { describe, expect, it } from "vitest";

import { isPublicRoutePath } from "@/shared/lib/publicRoute";

describe("TC-PUBLIC-ROUTE — QA-NEW-010: detección de rutas públicas sin sesión", () => {
  it.each(["/embed/cierto/form", "/embed/adlive/form?theme=dark", "/l/cierto/promo-50gb", "/login", "/register", "/recuperar-contrasena", "/restablecer-contrasena"])(
    "ruta pública: %s",
    (path) => expect(isPublicRoutePath(path.split("?")[0]!)).toBe(true),
  );

  it.each(["/dashboard", "/contactos", "/conversaciones", "/bots-ia", "/ajustes", "/equipo", "/login-extra"])(
    "ruta privada: %s",
    (path) => expect(isPublicRoutePath(path)).toBe(false),
  );
});
