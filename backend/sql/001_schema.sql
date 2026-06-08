-- ============================================================
-- SME Expense Claims v1 — Schema
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards.
-- ============================================================

-- Extensions
create extension if not exists vector;
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
do $$ begin
  create type claim_status as enum ('draft', 'submitted');
exception when duplicate_object then null; end $$;

do $$ begin
  create type receipt_status_t as enum ('receipt', 'no_receipt');
exception when duplicate_object then null; end $$;

do $$ begin
  create type image_quality_t as enum ('ok', 'blurry', 'unreadable');
exception when duplicate_object then null; end $$;

do $$ begin
  create type vat_code_t as enum ('UK20', 'UK0', 'UNREC', 'REVIEW');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 1. employees (demo only in v1)
-- ------------------------------------------------------------
create table if not exists employees (
  employee_id   uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text unique not null,
  is_demo       boolean default true,
  created_at    timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. categories (lookup; category stored as text on lines per spec)
-- ------------------------------------------------------------
create table if not exists categories (
  name             text primary key,
  is_unrecoverable boolean default false,
  sort_order       int default 0
);

-- ------------------------------------------------------------
-- 3. claims
-- ------------------------------------------------------------
create sequence if not exists claim_ref_seq;

create table if not exists claims (
  claim_id            uuid primary key default gen_random_uuid(),
  employee_id         uuid references employees(employee_id) on delete cascade,
  claim_ref           text unique,
  claim_title         text not null,
  status              claim_status not null default 'draft',
  running_gross_total numeric(12,2) default 0,
  created_at          timestamptz default now(),
  submitted_at        timestamptz
);

create index if not exists claims_employee_status_idx on claims (employee_id, status);

-- ------------------------------------------------------------
-- 4. claim_lines
-- ------------------------------------------------------------
create table if not exists claim_lines (
  claim_line_id           uuid primary key default gen_random_uuid(),
  claim_id                uuid references claims(claim_id) on delete cascade,
  receipt_status          receipt_status_t not null,
  image_quality_status    image_quality_t,
  supplier_name           text,
  supplier_vat_number     text,
  receipt_number          text,
  receipt_date            date,
  category                text references categories(name),
  net_amount              numeric(12,2),
  vat_amount              numeric(12,2) default 0,
  gross_amount            numeric(12,2),
  vat_code                vat_code_t not null,
  narrative_final         text,
  voice_transcript_raw    text,
  ai_category_suggestions jsonb,
  ai_category_explanation text,
  duplicate_flag          boolean default false,
  old_receipt_flag        boolean default false,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create index if not exists claim_lines_claim_idx on claim_lines (claim_id);
create index if not exists claim_lines_supplier_idx on claim_lines (lower(supplier_name));

-- ------------------------------------------------------------
-- 5. receipt_images
-- ------------------------------------------------------------
create table if not exists receipt_images (
  image_id      uuid primary key default gen_random_uuid(),
  claim_line_id uuid references claim_lines(claim_line_id) on delete cascade,
  storage_path  text not null,
  byte_size     int,
  width         int,
  height        int,
  is_current    boolean default true,
  uploaded_at   timestamptz default now()
);
create unique index if not exists one_current_image_per_line
  on receipt_images (claim_line_id) where is_current;

-- ------------------------------------------------------------
-- 6. ai_extractions (Claude Vision raw output, versioned)
-- ------------------------------------------------------------
create table if not exists ai_extractions (
  extraction_id uuid primary key default gen_random_uuid(),
  claim_line_id uuid references claim_lines(claim_line_id) on delete cascade,
  model         text not null,
  raw           jsonb not null,
  confidence    numeric(3,2),
  is_current    boolean default true,
  created_at    timestamptz default now()
);
create index if not exists ai_extractions_line_idx on ai_extractions (claim_line_id, is_current);

-- ------------------------------------------------------------
-- 7. category_suggestions (top-3 + reasons, versioned)
-- ------------------------------------------------------------
create table if not exists category_suggestions (
  suggestion_id uuid primary key default gen_random_uuid(),
  claim_line_id uuid references claim_lines(claim_line_id) on delete cascade,
  suggestions   jsonb not null,
  forced_pick   boolean default false,
  is_current    boolean default true,
  created_at    timestamptz default now()
);
create index if not exists category_suggestions_line_idx on category_suggestions (claim_line_id, is_current);

-- ------------------------------------------------------------
-- 8. receipt_embeddings (pgvector)
-- ------------------------------------------------------------
create table if not exists receipt_embeddings (
  claim_line_id uuid primary key references claim_lines(claim_line_id) on delete cascade,
  embedding     vector(1536) not null,
  source_hash   text not null,
  updated_at    timestamptz default now()
);
create index if not exists receipt_embeddings_ivf
  on receipt_embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ------------------------------------------------------------
-- 9. audit_events
-- ------------------------------------------------------------
create table if not exists audit_events (
  event_id      uuid primary key default gen_random_uuid(),
  employee_id   uuid,
  claim_id      uuid,
  claim_line_id uuid,
  event_type    text not null,
  payload       jsonb,
  created_at    timestamptz default now()
);
create index if not exists audit_claim_idx on audit_events (claim_id, created_at);

-- ============================================================
-- Triggers
-- ============================================================

-- claim_ref: EXP-YYYY-NNNN, generated server-side on insert
create or replace function set_claim_ref()
returns trigger language plpgsql as $$
begin
  if new.claim_ref is null then
    new.claim_ref := 'EXP-' || to_char(now(), 'YYYY') || '-'
                  || lpad(nextval('claim_ref_seq')::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_claims_ref on claims;
create trigger trg_claims_ref
  before insert on claims
  for each row execute function set_claim_ref();

-- running_gross_total: keep claims.running_gross_total = SUM(claim_lines.gross_amount)
create or replace function recalc_claim_total(p_claim_id uuid)
returns void language plpgsql as $$
begin
  update claims
     set running_gross_total = coalesce(
       (select sum(gross_amount) from claim_lines where claim_id = p_claim_id),
       0
     )
   where claim_id = p_claim_id;
end $$;

create or replace function trg_lines_recalc()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recalc_claim_total(old.claim_id);
    return old;
  else
    perform recalc_claim_total(new.claim_id);
    return new;
  end if;
end $$;

drop trigger if exists trg_lines_total_iud on claim_lines;
create trigger trg_lines_total_iud
  after insert or update or delete on claim_lines
  for each row execute function trg_lines_recalc();

-- updated_at touch on claim_lines
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_lines_touch on claim_lines;
create trigger trg_lines_touch
  before update on claim_lines
  for each row execute function touch_updated_at();
