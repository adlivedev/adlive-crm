/**
 * MOCK — Agregador central de datos iniciales (Etapa A).
 *
 * Todo el estado reactivo de la aplicación nace de este objeto; el crmStore
 * lo clona en memoria y aplica operaciones CRUD sobre él. En la Etapa B
 * (Supabase vía MCP) este archivo deja de usarse y los servicios consultan
 * la base real sin tocar la UI.
 */

import type {
  AiBot,
  Contact,
  ContactActivity,
  ContactNote,
  ContactTask,
  Conversation,
  CustomFieldDefinition,
  CustomValue,
  Message,
  Opportunity,
  Pipeline,
  PipelineStage,
  Tenant,
  TenantIntegrationVault,
  TenantMember,
  WhatsAppTemplate,
  Workflow,
  WorkflowEnrollment,
} from "@/shared/types/database";

import {
  mockContacts,
  mockContactActivities,
  mockContactNotes,
  mockContactTasks,
} from "./contacts.mock";
import { mockConversations, mockMessages } from "./inbox.mock";
import { mockOpportunities } from "./commercial.mock";
import {
  mockCustomFieldDefinitions,
  mockCustomValues,
  mockAiBots,
  mockIntegrationsVault,
  mockWhatsappTemplates,
} from "./engagement.mock";
import { mockWorkflowEnrollments, mockWorkflows } from "./workflows.mock";
import {
  mockPipelines,
  mockPipelineStages,
  mockTenantMembers,
  mockTenantStats,
  mockTenants,
  type TenantStatsBase,
} from "./tenants.mock";

export interface CrmInitialData {
  tenants: Tenant[];
  tenantMembers: TenantMember[];
  contacts: Contact[];
  customFieldDefinitions: CustomFieldDefinition[];
  customValues: CustomValue[];
  pipelines: Pipeline[];
  pipelineStages: PipelineStage[];
  opportunities: Opportunity[];
  conversations: Conversation[];
  messages: Message[];
  contactNotes: ContactNote[];
  contactTasks: ContactTask[];
  contactActivities: ContactActivity[];
  whatsappTemplates: WhatsAppTemplate[];
  workflows: Workflow[];
  workflowEnrollments: WorkflowEnrollment[];
  aiBots: AiBot[];
  integrationsVault: TenantIntegrationVault[];
}

/** Snapshot inmutable de origen; el store trabaja sobre una copia profunda. */
export const initialData: CrmInitialData = {
  tenants: mockTenants,
  tenantMembers: mockTenantMembers,
  contacts: mockContacts,
  customFieldDefinitions: mockCustomFieldDefinitions,
  customValues: mockCustomValues,
  pipelines: mockPipelines,
  pipelineStages: mockPipelineStages,
  opportunities: mockOpportunities,
  conversations: mockConversations,
  messages: mockMessages,
  contactNotes: mockContactNotes,
  contactTasks: mockContactTasks,
  contactActivities: mockContactActivities,
  whatsappTemplates: mockWhatsappTemplates,
  workflows: mockWorkflows,
  workflowEnrollments: mockWorkflowEnrollments,
  aiBots: mockAiBots,
  integrationsVault: mockIntegrationsVault,
};

export { mockTenantStats, type TenantStatsBase };
