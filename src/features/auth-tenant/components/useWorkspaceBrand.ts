"use client";

import { useEffect, useState } from "react";

import type { Tenant } from "@/shared/types/database";

export type WorkspaceBrand = Pick<Tenant, "name" | "slug" | "branding" | "status">;

export function useWorkspaceBrand(workspaceSlug: string) {
  const [workspaceTenant, setWorkspaceTenant] = useState<WorkspaceBrand | null>(null);

  useEffect(() => {
    if (!workspaceSlug) {
      setWorkspaceTenant(null);
      return;
    }
    const controller = new AbortController();
    void fetch(`/api/v1/public/workspace?slug=${encodeURIComponent(workspaceSlug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return await response.json() as { workspace: WorkspaceBrand };
      })
      .then((result) => setWorkspaceTenant(result?.workspace ?? null))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setWorkspaceTenant(null);
      });
    return () => controller.abort();
  }, [workspaceSlug]);

  return workspaceTenant;
}
