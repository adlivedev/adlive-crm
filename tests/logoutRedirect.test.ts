import { describe, expect, it } from "vitest";

import { resolveLogoutLoginPath } from "@/shared/lib/auth/workspaceAccess";

describe("TC-LOGOUT-REDIRECT — QA-NEW-005: logout vuelve al login del workspace", () => {
  it("no-superadmin con workspace activo → /login?workspace=<slug>", () => {
    expect(resolveLogoutLoginPath(false, "cierto")).toBe("/login?workspace=cierto");
  });

  it("superadmin → /login (sin workspace)", () => {
    expect(resolveLogoutLoginPath(true, "cierto")).toBe("/login");
  });

  it("sin slug conocido → /login", () => {
    expect(resolveLogoutLoginPath(false, null)).toBe("/login");
  });
});
