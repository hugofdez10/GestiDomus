alter table public.properties
  add column if not exists insurance_company text,
  add column if not exists insurance_policy_number text;
