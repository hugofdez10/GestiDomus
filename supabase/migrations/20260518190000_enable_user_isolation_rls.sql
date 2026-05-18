-- Isolate tenant data per Supabase Auth user.
-- Existing rows are assigned to the oldest auth user so the original account
-- keeps the current dataset after RLS is enabled. Review this assignment if the
-- production database already has multiple real owners.

create or replace function public.set_owner_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  return new;
end;
$$;

do $$
declare
  table_name text;
  table_names text[] := array[
    'properties',
    'tenants',
    'contracts',
    'invoices',
    'expenses',
    'rent_payments',
    'maintenance_tasks',
    'transactions',
    'property_documents'
  ];
  bootstrap_owner uuid;
begin
  select id
    into bootstrap_owner
    from auth.users
   order by created_at asc
   limit 1;

  foreach table_name in array table_names loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists owner_id uuid references auth.users(id) on delete cascade',
        table_name
      );

      if bootstrap_owner is not null then
        execute format(
          'update public.%I set owner_id = $1 where owner_id is null',
          table_name
        )
        using bootstrap_owner;
      end if;

      execute format(
        'alter table public.%I alter column owner_id set default auth.uid()',
        table_name
      );

      execute format(
        'create index if not exists %I on public.%I(owner_id)',
        table_name || '_owner_id_idx',
        table_name
      );

      execute format('alter table public.%I enable row level security', table_name);
      execute format('alter table public.%I force row level security', table_name);

      execute format('drop trigger if exists set_%I_owner_id on public.%I', table_name, table_name);
      execute format(
        'create trigger set_%I_owner_id before insert on public.%I for each row execute function public.set_owner_id()',
        table_name,
        table_name
      );

      execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (owner_id = auth.uid())',
        table_name || '_select_own',
        table_name
      );

      execute format(
        'create policy %I on public.%I for insert to authenticated with check (owner_id = auth.uid())',
        table_name || '_insert_own',
        table_name
      );

      execute format(
        'create policy %I on public.%I for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid())',
        table_name || '_update_own',
        table_name
      );

      execute format(
        'create policy %I on public.%I for delete to authenticated using (owner_id = auth.uid())',
        table_name || '_delete_own',
        table_name
      );
    end if;
  end loop;
end $$;

update storage.buckets
   set public = false
 where id in ('vault', 'property-docs');

drop policy if exists "vault_property_docs_select_own" on storage.objects;
drop policy if exists "vault_property_docs_insert_authenticated" on storage.objects;
drop policy if exists "vault_property_docs_update_own" on storage.objects;
drop policy if exists "vault_property_docs_delete_own" on storage.objects;

create policy "vault_property_docs_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('vault', 'property-docs')
  and owner = auth.uid()
);

create policy "vault_property_docs_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('vault', 'property-docs')
);

create policy "vault_property_docs_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('vault', 'property-docs')
  and owner = auth.uid()
)
with check (
  bucket_id in ('vault', 'property-docs')
  and owner = auth.uid()
);

create policy "vault_property_docs_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('vault', 'property-docs')
  and owner = auth.uid()
);
