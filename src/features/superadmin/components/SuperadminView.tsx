"use client";

import type { PlatformTenantMetric } from "../types";
import { WorkspaceManager } from "./WorkspaceManager";

export function SuperadminView({ initialTenants }: { initialTenants: PlatformTenantMetric[] }) {
  return <WorkspaceManager initialTenants={initialTenants} variant="platform" />;
}
