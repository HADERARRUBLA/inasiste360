-- MIGRACION 0002: Eliminar politicas RLS heredadas demasiado permisivas
--
-- Se descubrio que, ademas de las politicas creadas en la migracion 0001,
-- existian docenas de politicas previas en las 4 tablas InA_* aplicadas al
-- rol public con condicion "true" (o basadas en auth.uid() = profile_id, que
-- no aplica a nuestro modelo). Postgres combina politicas PERMISSIVE con OR,
-- asi que estas politicas viejas anulaban el aislamiento por organizacion
-- para cualquier usuario autenticado. El bloqueo a anon sigue intacto (es via
-- REVOKE de privilegios base, una capa distinta a RLS).

-- InA_profiles
drop policy if exists "Allow public delete on profiles" on public."InA_profiles";
drop policy if exists "Allow public insert on profiles" on public."InA_profiles";
drop policy if exists "Allow public select on profiles" on public."InA_profiles";
drop policy if exists "Allow public update on profiles" on public."InA_profiles";
drop policy if exists "Public Read Access" on public."InA_profiles";
drop policy if exists "Users can insert own profile" on public."InA_profiles";
drop policy if exists "Users can update own profile" on public."InA_profiles";
drop policy if exists "Users can view own profile" on public."InA_profiles";
drop policy if exists "profile_self_access" on public."InA_profiles";

-- InA_companies
drop policy if exists "allow_all_anon_companies" on public."InA_companies";
drop policy if exists "allow_select_companies" on public."InA_companies";

-- InA_organizations
drop policy if exists "allow_all_anon_orgs" on public."InA_organizations";
drop policy if exists "allow_select_orgs" on public."InA_organizations";

-- InA_time_entries
drop policy if exists "Allow public delete on time_entries" on public."InA_time_entries";
drop policy if exists "Users can delete own time entries" on public."InA_time_entries";
drop policy if exists "Allow public insert on time_entries" on public."InA_time_entries";
drop policy if exists "Users can insert own time entries" on public."InA_time_entries";
drop policy if exists "time_entry_insert" on public."InA_time_entries";
drop policy if exists "Allow public select on time_entries" on public."InA_time_entries";
drop policy if exists "Public Read Access" on public."InA_time_entries";
drop policy if exists "Users can view own time entries" on public."InA_time_entries";
drop policy if exists "time_entry_self_access" on public."InA_time_entries";
drop policy if exists "Allow public update on time_entries" on public."InA_time_entries";
drop policy if exists "Users can update own time entries" on public."InA_time_entries";

-- Verificacion: cada tabla debe mostrar SOLO las politicas con nombre propio
-- de la migracion 0001 (org_select, org_write, companies_select/update/
-- insert/delete, profiles_select_own/org, profiles_write_org,
-- profiles_update_org, profiles_delete_org, entries_select_org,
-- entries_delete_org, admin_branches_all).
select tablename, policyname, roles, cmd
from pg_policies
where tablename in ('InA_profiles','InA_companies','InA_organizations','InA_time_entries','InA_admin_branches')
order by tablename, cmd, policyname;
