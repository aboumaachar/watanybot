-- ============================================================
-- WatanyBot - Initial Database Schema
-- ============================================================
-- Generated for PostgreSQL 15+
-- Migration: 01_schema.sql
-- This file initializes all tables for production deployment
-- ============================================================

-- Enable UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable table statistics
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ============================================================
-- 1. USERS & AUTHENTICATION
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    phone_number VARCHAR(20),
    avatar_url VARCHAR(500),
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('superadmin', 'admin', 'moderator', 'user')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Sessions/Tokens
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(50) NOT NULL DEFAULT 'bearer' CHECK (token_type IN ('bearer', 'refresh', 'api_key')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    revoked_at TIMESTAMP WITH TIME ZONE,
    permissions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- ============================================================
-- 2. RBAC (Role-Based Access Control)
-- ============================================================

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    granted_by UUID REFERENCES users(id),
    UNIQUE(user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

-- ============================================================
-- 3. AUDIT LOGGING
-- ============================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type_id ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================================
-- 4. KNOWLEDGE BASE
-- ============================================================

CREATE TABLE kb_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_version VARCHAR(10) NOT NULL DEFAULT 'v3' CHECK (kb_version IN ('v2', 'v3')),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    tags VARCHAR(500) ARRAY,
    source_url VARCHAR(1000),
    chunk_index INTEGER,
    embedding VECTOR(1536),  -- For vector search (requires pgvector extension)
    search_vector tsvector,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_entries_kb_version ON kb_entries(kb_version);
CREATE INDEX idx_kb_entries_category ON kb_entries(category);
CREATE INDEX idx_kb_entries_tags ON kb_entries USING GIN(tags);
CREATE INDEX idx_kb_entries_search_vector ON kb_entries USING GIN(search_vector);
-- CREATE INDEX idx_kb_entries_embedding ON kb_entries USING ivfflat (embedding vector_cosine_ops);  -- Vector similarity

-- Search Log
CREATE TABLE kb_search_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query TEXT NOT NULL,
    results_count INTEGER,
    top_result_id UUID REFERENCES kb_entries(id),
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    session_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kb_search_logs_user_id ON kb_search_logs(user_id);
CREATE INDEX idx_kb_search_logs_created_at ON kb_search_logs(created_at DESC);

-- ============================================================
-- 5. CASES & LEGAL ISSUES
-- ============================================================

CREATE TABLE cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    case_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_to UUID REFERENCES users(id),
    attachments JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_cases_user_id ON cases(user_id);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_assigned_to ON cases(assigned_to);

-- ============================================================
-- 6. DOCUMENTS & FILES
-- ============================================================

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_hash VARCHAR(64),  -- SHA256 hash
    category VARCHAR(100),
    visibility VARCHAR(50) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'internal', 'public')),
    tags VARCHAR(500) ARRAY,
    download_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_visibility ON documents(visibility);

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url VARCHAR(1000),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_user_id_read_at ON notifications(user_id, read_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- 8. MARKETPLACE
-- ============================================================

CREATE TABLE marketplace_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    quantity_available INTEGER,
    images JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'sold', 'archived')),
    ratings_avg DECIMAL(3, 2),
    ratings_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_marketplace_items_seller_id ON marketplace_items(seller_id);
CREATE INDEX idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX idx_marketplace_items_status ON marketplace_items(status);

-- ============================================================
-- 9. JOBS
-- ============================================================

CREATE TABLE job_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    posted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    company_name VARCHAR(255),
    location VARCHAR(255),
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('full_time', 'part_time', 'contract', 'freelance')),
    salary_min DECIMAL(12, 2),
    salary_max DECIMAL(12, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    requirements TEXT ARRAY,
    benefits TEXT ARRAY,
    status VARCHAR(50) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'paused')),
    applications_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_job_listings_posted_by ON job_listings(posted_by);
CREATE INDEX idx_job_listings_status ON job_listings(status);
CREATE INDEX idx_job_listings_created_at ON job_listings(created_at DESC);

CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES job_listings(id) ON DELETE CASCADE,
    applicant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resume_url VARCHAR(1000),
    cover_letter TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'rejected', 'accepted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(job_id, applicant_id)
);

CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_applicant_id ON job_applications(applicant_id);
CREATE INDEX idx_job_applications_status ON job_applications(status);

-- ============================================================
-- 10. SALARY CALCULATOR
-- ============================================================

CREATE TABLE salary_calculations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    base_salary DECIMAL(12, 2) NOT NULL,
    position_title VARCHAR(255),
    experience_years INTEGER,
    location VARCHAR(255),
    deductions JSONB DEFAULT '{}'::jsonb,
    gross_salary DECIMAL(12, 2),
    net_salary DECIMAL(12, 2),
    calculation_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_salary_calculations_user_id ON salary_calculations(user_id);
CREATE INDEX idx_salary_calculations_created_at ON salary_calculations(created_at DESC);

-- ============================================================
-- 11. WHATSAPP INTEGRATION
-- ============================================================

CREATE TABLE whatsapp_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(20) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    context JSONB DEFAULT '{}'::jsonb,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(phone_number)
);

CREATE TABLE whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    content TEXT NOT NULL,
    message_type VARCHAR(50) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'document')),
    media_url VARCHAR(1000),
    status VARCHAR(50) NOT NULL DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_whatsapp_messages_conversation_id ON whatsapp_messages(conversation_id);
CREATE INDEX idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);

-- ============================================================
-- 12. SYSTEM CONFIGURATION & SETTINGS
-- ============================================================

CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    data_type VARCHAR(50),
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE feature_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage BETWEEN 0 AND 100),
    user_whitelist UUID ARRAY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- INSERT Default Roles
-- ============================================================

INSERT INTO roles (name, description, permissions) VALUES
    ('superadmin', 'Full system access', '{"users":"*","roles":"*","audit":"*","settings":"*","all":"*"}'::jsonb),
    ('admin', 'Administrative access', '{"users":"read,write","roles":"read","audit":"read","content":"write"}'::jsonb),
    ('moderator', 'Content moderation', '{"content":"read,write","cases":"read,write","reports":"read"}'::jsonb),
    ('user', 'Regular user access', '{"profile":"read,write","kb":"read","search":"read"}'::jsonb);

-- ============================================================
-- INSERT Feature Flags
-- ============================================================

INSERT INTO feature_flags (name, enabled, description, rollout_percentage) VALUES
    ('kb_v2_enabled', FALSE, 'Enable Knowledge Base v2', 0),
    ('kb_v3_enabled', TRUE, 'Enable Knowledge Base v3', 100),
    ('salary_calculator', TRUE, 'Enable Salary Calculator Feature', 100),
    ('cases_module', TRUE, 'Enable Cases/Legal Issues Module', 100),
    ('marketplace', TRUE, 'Enable Marketplace Feature', 100),
    ('job_listings', TRUE, 'Enable Job Listings Feature', 100),
    ('whatsapp_integration', TRUE, 'Enable WhatsApp Integration', 100),
    ('advanced_search', TRUE, 'Enable Advanced Search Features', 100);

-- ============================================================
-- CREATE INDEXES FOR COMMON QUERIES
-- ============================================================

-- Text search index for KB
CREATE INDEX idx_kb_entries_text_search ON kb_entries 
    USING GIN(to_tsvector('english', title || ' ' || content));

-- Date range queries
CREATE INDEX idx_users_created_at_range ON users(created_at DESC);
CREATE INDEX idx_cases_created_at_range ON cases(created_at DESC);
CREATE INDEX idx_documents_created_at_range ON documents(created_at DESC);

-- ============================================================
-- GRANTS & PERMISSIONS (for application user)
-- ============================================================

-- Creating limited application role (uncomment and configure as needed)
-- CREATE ROLE watanbot_app WITH LOGIN PASSWORD 'secure_password';
-- GRANT CONNECT ON DATABASE watanbot_prod TO watanbot_app;
-- GRANT USAGE ON SCHEMA public TO watanbot_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO watanbot_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO watanbot_app;

-- ============================================================
-- Migration Complete
-- ============================================================
-- Schema version: 1
-- Created: 2025-02-25
-- All tables and indexes created successfully
