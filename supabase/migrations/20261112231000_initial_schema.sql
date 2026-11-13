-- ADlive CRM: esquema maestro de context/02-base-de-datos-supabase.md
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'agent');
CREATE TYPE agent_presence AS ENUM ('online', 'offline', 'busy');

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    public_webhook_token VARCHAR(64) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_all_contacts BOOLEAN NOT NULL DEFAULT FALSE,
    presence agent_presence NOT NULL DEFAULT 'offline',
    last_assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE TABLE custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    field_key VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) NOT NULL DEFAULT 'text',
    options JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, field_key)
);

CREATE TABLE custom_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    value_key VARCHAR(100) NOT NULL,
    value_content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, value_key)
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    full_name VARCHAR(200) NOT NULL,
    phone_e164 VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    company_name VARCHAR(200),
    lead_source VARCHAR(100) DEFAULT 'WhatsApp',
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_closed_client BOOLEAN NOT NULL DEFAULT FALSE,
    is_starred BOOLEAN NOT NULL DEFAULT FALSE,
    typification VARCHAR(100),
    opt_out_marketing BOOLEAN NOT NULL DEFAULT FALSE,
    utm_source VARCHAR(150),
    utm_medium VARCHAR(150),
    utm_campaign VARCHAR(255),
    utm_content VARCHAR(255),
    utm_term VARCHAR(255),
    fbclid VARCHAR(255),
    landing_url TEXT,
    referrer_url TEXT,
    last_interaction_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, phone_e164)
);

CREATE TYPE stage_type AS ENUM ('open', 'won', 'lost');

CREATE TABLE pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL DEFAULT 'Pipeline Principal',
    is_default BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL,
    stage_category stage_type NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE RESTRICT,
    assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    monetary_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status stage_type NOT NULL DEFAULT 'open',
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE conversation_handler AS ENUM ('bot', 'human');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'template', 'image', 'audio', 'video', 'document', 'system');
CREATE TYPE message_status AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'whatsapp',
    handler_mode conversation_handler NOT NULL DEFAULT 'human',
    unread_count INT NOT NULL DEFAULT 0,
    needs_reply BOOLEAN NOT NULL DEFAULT FALSE,
    last_inbound_at TIMESTAMPTZ,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_message_preview TEXT,
    last_message_media_type message_type DEFAULT 'text',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, contact_id, channel)
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    wa_message_id VARCHAR(150) UNIQUE,
    direction message_direction NOT NULL,
    msg_type message_type NOT NULL DEFAULT 'text',
    body TEXT,
    media_url TEXT,
    media_mime_type VARCHAR(100),
    template_name VARCHAR(150),
    status message_status NOT NULL DEFAULT 'sent',
    error_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    author_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    assigned_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    due_at TIMESTAMPTZ,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contact_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    actor_member_id UUID REFERENCES tenant_members(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    meta_template_id VARCHAR(150),
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'MARKETING',
    language VARCHAR(20) NOT NULL DEFAULT 'es',
    header_type VARCHAR(30) DEFAULT 'NONE',
    header_content TEXT,
    body_text TEXT NOT NULL,
    footer_text VARCHAR(60),
    buttons JSONB DEFAULT '[]'::jsonb,
    variables_count INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'APPROVED',
    rejection_reason TEXT DEFAULT 'NONE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, name, language)
);

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'Draft',
    trigger_type VARCHAR(100) NOT NULL,
    allow_reenrollment BOOLEAN NOT NULL DEFAULT FALSE,
    canvas_definition JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
    enrolled_count INT NOT NULL DEFAULT 0,
    active_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    current_node_id VARCHAR(100),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    wait_expires_at TIMESTAMPTZ,
    execution_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE ai_bots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    product_line VARCHAR(150) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'integrated',
    system_prompt TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tenant_integrations_vault (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    is_connected BOOLEAN NOT NULL DEFAULT FALSE,
    public_metadata JSONB DEFAULT '{}'::jsonb,
    encrypted_credentials TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

CREATE INDEX idx_contacts_tenant_created ON contacts(tenant_id, created_at DESC);
CREATE INDEX idx_contacts_tenant_assigned ON contacts(tenant_id, assigned_member_id);
CREATE INDEX idx_contacts_tags_gin ON contacts USING GIN (tags);
CREATE INDEX idx_contacts_search_trgm ON contacts USING GIN (full_name gin_trgm_ops, phone_e164 gin_trgm_ops);
CREATE INDEX idx_conversations_inbox ON conversations(tenant_id, assigned_member_id, last_message_at DESC);
CREATE INDEX idx_conversations_unanswered ON conversations(tenant_id, needs_reply, last_message_at DESC);
CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_opportunities_kanban ON opportunities(tenant_id, pipeline_id, stage_id, status);
CREATE INDEX idx_contacts_attribution ON contacts(tenant_id, utm_campaign, utm_term, created_at);
