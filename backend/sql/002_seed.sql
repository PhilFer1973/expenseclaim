-- ============================================================
-- SME Expense Claims v1 — Seed data
-- Run AFTER 001_schema.sql.
-- Idempotent: uses ON CONFLICT DO NOTHING.
-- ============================================================

-- Categories (11, fixed v1 list)
insert into categories (name, is_unrecoverable, sort_order) values
  ('Travel',              false, 10),
  ('Accommodation',       false, 20),
  ('Subsistence',         false, 30),
  ('Client Entertaining', true,  40),
  ('Phone',               false, 50),
  ('Publications',        false, 60),
  ('Training',            false, 70),
  ('Office Supplies',     false, 80),
  ('Postage',             false, 90),
  ('Marketing',           false, 100),
  ('Professional Fees',   false, 110)
on conflict (name) do nothing;

-- Demo employee (fixed UUID so frontend can reference it)
insert into employees (employee_id, name, email, is_demo) values
  ('00000000-0000-0000-0000-000000000001', 'Alex Morgan', 'alex.morgan@demo.co.uk', true)
on conflict (employee_id) do nothing;

-- 3 historic submitted claims, 15 lines across 6 suppliers
-- gives pgvector + supplier-history something real on day 1
do $$
declare
  emp uuid := '00000000-0000-0000-0000-000000000001';
  c1 uuid := '10000000-0000-0000-0000-000000000001';
  c2 uuid := '10000000-0000-0000-0000-000000000002';
  c3 uuid := '10000000-0000-0000-0000-000000000003';
begin
  if not exists (select 1 from claims where claim_id = c1) then
    insert into claims (claim_id, employee_id, claim_title, status, submitted_at)
    values
      (c1, emp, 'March client visits', 'submitted', now() - interval '70 days'),
      (c2, emp, 'April team offsite',  'submitted', now() - interval '40 days'),
      (c3, emp, 'Software renewals',   'submitted', now() - interval '20 days');

    insert into claim_lines
      (claim_id, receipt_status, image_quality_status, supplier_name, supplier_vat_number,
       receipt_date, category, net_amount, vat_amount, gross_amount, vat_code,
       narrative_final)
    values
      -- claim 1: client visits
      (c1, 'receipt', 'ok', 'Pret a Manger', 'GB654321987',
        (now() - interval '72 days')::date, 'Subsistence',  10.83,  2.17, 13.00, 'UK20', 'Lunch before client meeting'),
      (c1, 'receipt', 'ok', 'Pret a Manger', 'GB654321987',
        (now() - interval '71 days')::date, 'Subsistence',   6.67,  1.33,  8.00, 'UK20', 'Breakfast on the way'),
      (c1, 'receipt', 'ok', 'Costa Coffee',  'GB111222333',
        (now() - interval '71 days')::date, 'Subsistence',   3.33,  0.67,  4.00, 'UK20', 'Coffee with prospect'),
      (c1, 'receipt', 'ok', 'Travelodge',    'GB445566778',
        (now() - interval '70 days')::date, 'Accommodation', 75.00, 15.00, 90.00, 'UK20', 'Overnight client stay'),
      (c1, 'no_receipt', null, 'TfL',  null,
        (now() - interval '70 days')::date, 'Travel',         5.50,  0.00,  5.50, 'UK0',  'Tube fares no receipt'),

      -- claim 2: team offsite
      (c2, 'receipt', 'ok', 'Premier Inn',   'GB998877665',
        (now() - interval '42 days')::date, 'Accommodation', 108.33, 21.67, 130.00, 'UK20', 'Team offsite hotel'),
      (c2, 'receipt', 'ok', 'Premier Inn',   'GB998877665',
        (now() - interval '41 days')::date, 'Accommodation', 108.33, 21.67, 130.00, 'UK20', 'Team offsite hotel night 2'),
      (c2, 'receipt', 'ok', 'Pret a Manger', 'GB654321987',
        (now() - interval '41 days')::date, 'Subsistence',    16.67,  3.33,  20.00, 'UK20', 'Team breakfast'),
      (c2, 'receipt', 'ok', 'The Ivy',       'GB111000222',
        (now() - interval '40 days')::date, 'Client Entertaining', 100.00, 20.00, 120.00, 'UNREC', 'Client dinner'),
      (c2, 'receipt', 'ok', 'Uber',          'GB223344556',
        (now() - interval '40 days')::date, 'Travel',          12.50,  2.50,  15.00, 'UK20', 'Late ride home'),

      -- claim 3: software renewals
      (c3, 'receipt', 'ok', 'LinkedIn Learning', 'GB778899001',
        (now() - interval '22 days')::date, 'Training',        24.99,  5.00, 29.99, 'UK20', 'Annual learning sub'),
      (c3, 'receipt', 'ok', 'Stationery Express', 'GB556677889',
        (now() - interval '21 days')::date, 'Office Supplies', 18.32,  3.66, 21.98, 'UK20', 'Printer paper & pens'),
      (c3, 'receipt', 'ok', 'Royal Mail',     null,
        (now() - interval '21 days')::date, 'Postage',          8.00,  0.00,  8.00, 'UK0',  'Tracked parcel to client'),
      (c3, 'receipt', 'ok', 'EE',             'GB445500990',
        (now() - interval '20 days')::date, 'Phone',           29.17,  5.83, 35.00, 'UK20', 'Monthly mobile bill'),
      (c3, 'receipt', 'ok', 'LinkedIn Learning', 'GB778899001',
        (now() - interval '20 days')::date, 'Training',        24.99,  5.00, 29.99, 'UK20', 'Course renewal');
  end if;
end $$;
