-- ============================================================
--  Party Favour — App Settings Table
--  Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

CREATE TABLE IF NOT EXISTS public.settings (
    id          TEXT        PRIMARY KEY DEFAULT 'store',   -- single-row: always id = 'store'
    address1    TEXT        NOT NULL DEFAULT '123 Party Lane',
    address2    TEXT                 DEFAULT 'Celebration City',
    phone       TEXT        NOT NULL DEFAULT '(555) 019-2831',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed the one default row so the app always finds a record
INSERT INTO public.settings (id, address1, address2, phone)
VALUES ('store', '123 Party Lane', 'Celebration City', '(555) 019-2831')
ON CONFLICT (id) DO NOTHING;

-- Disable Row Level Security (the app has no auth layer)
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
