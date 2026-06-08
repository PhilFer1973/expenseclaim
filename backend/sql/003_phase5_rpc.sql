-- Phase 5 helpers: kNN search over receipt_embeddings + a robust
-- vector_match RPC the backend can call via supabase.rpc(...).
--
-- Run this once in the Supabase SQL editor. Idempotent.

-- Make sure pgvector is enabled (no-op if it already is).
create extension if not exists vector;

-- Drop and recreate so we can safely change the signature.
drop function if exists match_receipt_lines(vector, uuid, int, float);

create or replace function match_receipt_lines(
  query_embedding vector(1536),
  for_employee_id uuid,
  match_limit int default 8,
  min_similarity float default 0.0
)
returns table (
  claim_line_id uuid,
  similarity float,
  category text,
  supplier_name text,
  narrative_final text,
  gross_amount numeric,
  receipt_date date,
  vat_code text,
  is_unrecoverable boolean
)
language sql stable
as $$
  select
    cl.claim_line_id,
    1 - (re.embedding <=> query_embedding) as similarity,
    cl.category,
    cl.supplier_name,
    cl.narrative_final,
    cl.gross_amount,
    cl.receipt_date,
    cl.vat_code::text,
    coalesce(cat.is_unrecoverable, false) as is_unrecoverable
  from receipt_embeddings re
  join claim_lines cl on cl.claim_line_id = re.claim_line_id
  join claims c on c.claim_id = cl.claim_id
  left join categories cat on cat.name = cl.category
  where c.employee_id = for_employee_id
    and cl.category is not null
    and (1 - (re.embedding <=> query_embedding)) >= min_similarity
  order by re.embedding <=> query_embedding asc
  limit match_limit;
$$;

grant execute on function match_receipt_lines(vector, uuid, int, float) to anon, authenticated, service_role;
