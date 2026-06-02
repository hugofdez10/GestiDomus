alter table public.invoices
  add column if not exists utility_attachments jsonb not null default '[]'::jsonb;
