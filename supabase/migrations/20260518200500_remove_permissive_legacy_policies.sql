-- Remove old broad policies that bypass per-user RLS isolation.
-- RLS policies are OR-ed by Postgres, so any remaining `true` policy would
-- still expose data across authenticated accounts.

drop policy if exists "Acceso total a propiedades" on public.properties;
drop policy if exists "Permitir borrar propiedades" on public.properties;
drop policy if exists "Permitir inserción pública" on public.properties;
drop policy if exists "Permitir lectura pública" on public.properties;
drop policy if exists "properties_all_authenticated" on public.properties;

drop policy if exists "Acceso total a inquilinos" on public.tenants;
drop policy if exists "Acceso total inquilinos" on public.tenants;
drop policy if exists "Permitir borrar inquilinos" on public.tenants;
drop policy if exists "Permitir inserción pública" on public.tenants;
drop policy if exists "Permitir lectura pública" on public.tenants;

drop policy if exists "contracts_all_authenticated" on public.contracts;
drop policy if exists "contracts_delete_authenticated" on public.contracts;

drop policy if exists "invoices_all_authenticated" on public.invoices;

drop policy if exists "Acceso total a gastos" on public.expenses;
drop policy if exists "Permitir todo" on public.expenses;

drop policy if exists "Acceso total pagos" on public.rent_payments;

drop policy if exists "Acceso total tareas" on public.maintenance_tasks;

drop policy if exists "transactions_all_authenticated" on public.transactions;

drop policy if exists "Acceso total público 1hefghf_0" on storage.objects;
drop policy if exists "Acceso total público 1hefghf_1" on storage.objects;
drop policy if exists "Acceso total público 1hefghf_2" on storage.objects;
drop policy if exists "Acceso total público 1hefghf_3" on storage.objects;
drop policy if exists "Subir archivos" on storage.objects;
drop policy if exists "Ver archivos" on storage.objects;
