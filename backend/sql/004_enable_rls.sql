-- ============================================================
-- SME Expense Claims v1 — Enable Row Level Security (RLS)
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: ENABLE ROW LEVEL SECURITY is idempotent.
-- ============================================================
--
-- WHY:
--   Supabase exposes every table over a public PostgREST API at the
--   project URL. Without RLS, the public "publishable"/anon key can read,
--   edit and delete any row. This migration closes that hole.
--
-- WHY THIS IS SAFE FOR THE APP:
--   The backend (FastAPI on Azure) connects with the SERVICE-ROLE / secret
--   key, which BYPASSES RLS entirely. The mobile app never talks to Supabase
--   directly. So enabling RLS with NO policies = deny-all for the public key,
--   while the backend keeps full access. No policies are required.
--
--   If a future feature ever connects to Supabase with the publishable/anon
--   key (e.g. direct-from-device reads), add explicit policies then.
-- ============================================================

alter table employees            enable row level security;
alter table categories           enable row level security;
alter table claims               enable row level security;
alter table claim_lines          enable row level security;
alter table receipt_images       enable row level security;
alter table ai_extractions       enable row level security;
alter table category_suggestions enable row level security;
alter table receipt_embeddings   enable row level security;
alter table audit_events         enable row level security;

-- No policies are created on purpose: with RLS enabled and no policy, the
-- anon/publishable role is denied all access, and the service-role key the
-- backend uses bypasses RLS regardless.
