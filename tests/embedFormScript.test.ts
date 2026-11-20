import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/v1/embed/[workspaceSlug]/form.js/route";

describe("Script embebible tipo HubSpot", () => {
  it("genera el loader del workspace con atribución de 90 días", async () => {
    const response = await GET(new Request("http://localhost/api/v1/embed/cierto/form.js"), { params: Promise.resolve({ workspaceSlug: "cierto" }) });
    const script = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/javascript");
    expect(script).toContain('[data-crm-form]');
    expect(script).toContain('var MAX_AGE = 90 * 24 * 60 * 60;');
    expect(script).toContain('"/embed/"');
    expect(script).toContain('"cierto"');
    expect(script).toContain('params.set("landing_url"');
    expect(script).not.toContain("public_webhook_token");
  });

  it("rechaza slugs que puedan alterar la URL", async () => {
    const response = await GET(new Request("http://localhost/api/v1/embed/invalid/form.js"), { params: Promise.resolve({ workspaceSlug: "../tenant" }) });
    expect(response.status).toBe(400);
  });
});
