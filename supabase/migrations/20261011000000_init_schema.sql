-- =====================================================================
-- Demons Despair - Schema Permanente de Migração Automática
-- O Supabase CLI executa automaticamente todos os arquivos da pasta
-- supabase/migrations sempre que o supabase inicia (supabase start).
-- =====================================================================

-- 1. Tabela: characters
CREATE TABLE IF NOT EXISTS public.characters (
    id text NOT NULL PRIMARY KEY,
    user_id text,
    user_email text,
    campaign_id text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 2. Tabela: campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id text NOT NULL PRIMARY KEY,
    master_id text,
    master_email text,
    name text NOT NULL,
    invite_code text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 3. Tabela: custom_items
CREATE TABLE IF NOT EXISTS public.custom_items (
    id text NOT NULL PRIMARY KEY,
    master_id text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 4. Tabela: custom_spells
CREATE TABLE IF NOT EXISTS public.custom_spells (
    id text NOT NULL PRIMARY KEY,
    master_id text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 5. Tabela: bestiary
CREATE TABLE IF NOT EXISTS public.bestiary (
    id text NOT NULL PRIMARY KEY,
    master_id text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 6. Tabela: materials
CREATE TABLE IF NOT EXISTS public.materials (
    id text NOT NULL PRIMARY KEY,
    master_id text,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 7. Tabela: tokens
CREATE TABLE IF NOT EXISTS public.tokens (
    id text NOT NULL PRIMARY KEY,
    campaign_id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 8. Tabela: campaign_configs
CREATE TABLE IF NOT EXISTS public.campaign_configs (
    campaign_id text NOT NULL,
    config_id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (campaign_id, config_id)
);

-- 9. Tabela: vtt_logs
CREATE TABLE IF NOT EXISTS public.vtt_logs (
    id text NOT NULL PRIMARY KEY,
    campaign_id text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- =====================================================================
-- Migração Segura: caso as colunas tenham sido criadas com tipo uuid
-- =====================================================================
DO $$ 
BEGIN
    ALTER TABLE public.characters ALTER COLUMN user_id TYPE text USING user_id::text;
    ALTER TABLE public.campaigns ALTER COLUMN master_id TYPE text USING master_id::text;
    ALTER TABLE public.custom_items ALTER COLUMN master_id TYPE text USING master_id::text;
    ALTER TABLE public.custom_spells ALTER COLUMN master_id TYPE text USING master_id::text;
    ALTER TABLE public.bestiary ALTER COLUMN master_id TYPE text USING master_id::text;
    ALTER TABLE public.materials ALTER COLUMN master_id TYPE text USING master_id::text;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- =====================================================================
-- Políticas de Segurança (Row Level Security - RLS)
-- =====================================================================
ALTER TABLE public.characters DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_spells DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bestiary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tokens DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vtt_logs DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permissao_Total_Characters" ON public.characters;
CREATE POLICY "Permissao_Total_Characters" ON public.characters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Campaigns" ON public.campaigns;
CREATE POLICY "Permissao_Total_Campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Items" ON public.custom_items;
CREATE POLICY "Permissao_Total_Items" ON public.custom_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Spells" ON public.custom_spells;
CREATE POLICY "Permissao_Total_Spells" ON public.custom_spells FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Bestiary" ON public.bestiary;
CREATE POLICY "Permissao_Total_Bestiary" ON public.bestiary FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Materials" ON public.materials;
CREATE POLICY "Permissao_Total_Materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Tokens" ON public.tokens;
CREATE POLICY "Permissao_Total_Tokens" ON public.tokens FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Configs" ON public.campaign_configs;
CREATE POLICY "Permissao_Total_Configs" ON public.campaign_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao_Total_Logs" ON public.vtt_logs;
CREATE POLICY "Permissao_Total_Logs" ON public.vtt_logs FOR ALL USING (true) WITH CHECK (true);

-- Concede privilégios a todos os papéis do Supabase
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
