-- AI Ad Studio: initial PostgreSQL schema
-- Safe to run more than once. Audio binaries are stored in object storage (R2),
-- never as base64 or large blobs in PostgreSQL.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT UNIQUE,
  email TEXT UNIQUE,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  brand_name TEXT,
  product_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  script_text TEXT,
  campaign_type TEXT,
  target_emotion TEXT,
  dialect TEXT NOT NULL DEFAULT 'algerian_darija',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'محادثة جديدة',
  assistant_role TEXT,
  model_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model_name TEXT,
  token_count INTEGER CHECK (token_count IS NULL OR token_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS voice_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  voice_id TEXT,
  voice_name TEXT,
  dialect TEXT NOT NULL DEFAULT 'algiers_central',
  speaking_rate NUMERIC(4,2) NOT NULL DEFAULT 1.00
    CHECK (speaking_rate BETWEEN 0.50 AND 2.00),
  preferred_emotion TEXT,
  extra_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT voice_preferences_user_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS audio_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES ad_campaigns(id) ON DELETE SET NULL,
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  storage_key TEXT NOT NULL,
  public_url TEXT,
  file_name TEXT,
  mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
  file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  duration_seconds NUMERIC(10,2) CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  voice_id TEXT,
  script_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT audio_assets_storage_key_unique UNIQUE (storage_provider, storage_key)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_updated
  ON projects (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_project_created
  ON ad_campaigns (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created
  ON ad_campaigns (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON ai_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON ai_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_audio_assets_user_created
  ON audio_assets (user_id, created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('0001_initial_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
