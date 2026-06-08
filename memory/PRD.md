# SME Expense Claims — v1 PRD

## Product
Android/mobile-first expense claims app for an SME demo employee. Each claim has many lines; each line is one receipt image OR a no-receipt entry. Claude Vision extracts receipt fields; AI suggests top-3 categories with a one-line reason; system locks the VAT code; user types or dictates a narrative auto-summarised to ≤50 chars.

## v1 scope
- Demo employee only (no auth, no approvals, no ERP, no payments, no foreign currency, no project coding).
- Statuses: Draft, Submitted. Submitted = read-only.
- Categories (11): Travel, Accommodation, Subsistence, Client Entertaining, Phone, Publications, Training, Office Supplies, Postage, Marketing, Professional Fees.
- VAT codes (locked): UK20, UK0, UNREC, REVIEW. REVIEW does not block submission.

## Architecture
- Expo SDK 54 (RN, expo-router) — Android-first.
- FastAPI backend (`/api` prefix), Python 3, modular services.
- Supabase Postgres + pgvector + private Storage bucket `receipts`.
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) for Vision + text via Emergent Universal LLM Key.
- OpenAI `text-embedding-3-small` (1536-d) for pgvector embeddings via Emergent Universal LLM Key.
- On-device voice via `expo-speech-recognition` (text-only transcript stored).
- Image pipeline: `expo-image-manipulator` → 1600px long edge, JPEG q=0.7, ≤200 KB → Supabase Storage.

## Design system
Direction A — "Clean & Corporate". Tokens in `/app/frontend/src/theme/tokens.ts`. Hanken Grotesk.

## Build phases
- **Phase 0** — Plumbing (skeleton services, deps, env, tokens).
- **Phase 1** — Supabase bootstrap (schema, triggers, seed, bucket).
- **Phase 2** — Core CRUD (no-receipt path end-to-end).
- **Phase 3** — Receipt capture + Storage upload.
- **Phase 4** — Claude Vision extraction.
- **Phase 5** — Embeddings + category suggestion (pgvector + Claude).
- **Phase 6** — Narrative + voice + 50-char summary.
- **Phase 7** — Validation, flags, submit hardening.
- **Phase 8** — Design polish.
- **Phase 9** — Test pass.

## Out of scope (v2 backlog)
Finance/admin role, approvals, ERP, auth, FX, payment tracking, exports, advanced VAT, project/client coding, supplier-to-category mappings.
