-- ============================================================================
-- MIGRACIÓN: Cierre de brecha de seguridad RLS + RPCs seguras para el Kiosko
-- ============================================================================
-- CONTEXTO: Verificado el 2026-08-08 contra el proyecto DEV (atrrjjavlxnloknqhnxk)
-- que las tablas InA_organizations, InA_companies, InA_profiles, InA_time_entries
-- e InA_admin_branches son 100% legibles con la ANON KEY pública, sin ninguna
-- política RLS. Esto expone en texto plano: pin_code, face_vector (biometría),
-- profile_photo, y toda la data de todas las organizaciones/empresas.
--
-- ⚠️ IMPORTANTE — LEE ANTES DE EJECUTAR ⚠️
-- Esta migración deja el panel Admin INOPERANTE hasta que completes el PASO
-- MANUAL descrito al final de este archivo (crear usuarios de Supabase Auth
-- para tus administradores) Y se actualice el frontend (App.tsx) para usar
-- supabase.auth.signInWithPassword() en vez de leer InA_profiles directo.
-- El Kiosko (PIN de empleados) SÍ sigue funcionando de inmediato porque se
-- migra a funciones RPC que no dependen de sesión de Supabase Auth.
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0. Columna de enlace entre InA_profiles y auth.users (para admins/superadmin)
-- ----------------------------------------------------------------------------
alter table public."InA_profiles"
    add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists ina_profiles_auth_user_id_key
    on public."InA_profiles" (auth_user_id)
    where auth_user_id is not null;


-- ----------------------------------------------------------------------------
-- 1. Funciones auxiliares (SECURITY DEFINER, resuelven "quién soy" sin recursión)
-- ----------------------------------------------------------------------------
create or replace function public.current_profile()
returns public."InA_profiles"
language sql
security definer
stable
set search_path = public
as $$
    select p.*
    from public."InA_profiles" p
    where p.auth_user_id = auth.uid()
    limit 1;
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public."InA_profiles" p
        where p.auth_user_id = auth.uid() and p.role = 'superadmin'
    );
$$;

create or replace function public.current_org_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
    select p.organization_id from public."InA_profiles" p
    where p.auth_user_id = auth.uid()
    limit 1;
$$;

create or replace function public.is_admin_of_org(target_org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select public.is_superadmin() or (public.current_org_id() = target_org_id);
$$;


-- ----------------------------------------------------------------------------
-- 2. Habilitar RLS en todas las tablas (deny-by-default a partir de aquí)
-- ----------------------------------------------------------------------------
alter table public."InA_organizations"  enable row level security;
alter table public."InA_companies"      enable row level security;
alter table public."InA_profiles"       enable row level security;
alter table public."InA_time_entries"   enable row level security;
alter table public."InA_admin_branches" enable row level security;


-- ----------------------------------------------------------------------------
-- 3. Políticas: InA_organizations
--    Solo superadmin ve/edita organizaciones. Un admin ve la suya propia (solo lectura).
-- ----------------------------------------------------------------------------
drop policy if exists org_select on public."InA_organizations";
create policy org_select on public."InA_organizations"
    for select to authenticated
    using ( public.is_superadmin() or id = public.current_org_id() );

drop policy if exists org_write on public."InA_organizations";
create policy org_write on public."InA_organizations"
    for all to authenticated
    using ( public.is_superadmin() )
    with check ( public.is_superadmin() );


-- ----------------------------------------------------------------------------
-- 4. Políticas: InA_companies (Sedes)
--    Superadmin: todo. Admin: lectura y edición solo de sedes de su organización.
-- ----------------------------------------------------------------------------
drop policy if exists companies_select on public."InA_companies";
create policy companies_select on public."InA_companies"
    for select to authenticated
    using ( public.is_admin_of_org(organization_id) );

drop policy if exists companies_update on public."InA_companies";
create policy companies_update on public."InA_companies"
    for update to authenticated
    using ( public.is_admin_of_org(organization_id) )
    with check ( public.is_admin_of_org(organization_id) );

drop policy if exists companies_insert_delete on public."InA_companies";
create policy companies_insert_delete on public."InA_companies"
    for insert to authenticated
    with check ( public.is_superadmin() );

drop policy if exists companies_delete on public."InA_companies";
create policy companies_delete on public."InA_companies"
    for delete to authenticated
    using ( public.is_superadmin() );


-- ----------------------------------------------------------------------------
-- 5. Políticas: InA_profiles
--    - Un usuario autenticado siempre puede leer/editar SU PROPIA fila.
--    - Admin/superadmin pueden gestionar perfiles de empleados de su organización.
--    - NINGÚN acceso anónimo directo (el Kiosko usa las RPCs de la sección 8).
-- ----------------------------------------------------------------------------
drop policy if exists profiles_select_own on public."InA_profiles";
create policy profiles_select_own on public."InA_profiles"
    for select to authenticated
    using ( auth_user_id = auth.uid() );

drop policy if exists profiles_select_org on public."InA_profiles";
create policy profiles_select_org on public."InA_profiles"
    for select to authenticated
    using ( public.is_admin_of_org(organization_id) );

drop policy if exists profiles_write_org on public."InA_profiles";
create policy profiles_write_org on public."InA_profiles"
    for insert to authenticated
    with check ( public.is_admin_of_org(organization_id) );

drop policy if exists profiles_update_org on public."InA_profiles";
create policy profiles_update_org on public."InA_profiles"
    for update to authenticated
    using ( public.is_admin_of_org(organization_id) or auth_user_id = auth.uid() )
    with check ( public.is_admin_of_org(organization_id) or auth_user_id = auth.uid() );

drop policy if exists profiles_delete_org on public."InA_profiles";
create policy profiles_delete_org on public."InA_profiles"
    for delete to authenticated
    using ( public.is_admin_of_org(organization_id) );


-- ----------------------------------------------------------------------------
-- 6. Políticas: InA_time_entries
--    Admin/superadmin ven y gestionan marcaciones de su organización
--    (vía join a InA_profiles). El Kiosko inserta por RPC (sección 8).
-- ----------------------------------------------------------------------------
drop policy if exists entries_select_org on public."InA_time_entries";
create policy entries_select_org on public."InA_time_entries"
    for select to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_time_entries".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    );

drop policy if exists entries_delete_org on public."InA_time_entries";
create policy entries_delete_org on public."InA_time_entries"
    for delete to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_time_entries".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    );


-- ----------------------------------------------------------------------------
-- 7. Políticas: InA_admin_branches (solo superadmin gestiona asignaciones)
-- ----------------------------------------------------------------------------
drop policy if exists admin_branches_all on public."InA_admin_branches";
create policy admin_branches_all on public."InA_admin_branches"
    for all to authenticated
    using ( public.is_superadmin() )
    with check ( public.is_superadmin() );


-- ============================================================================
-- 8. RPCs SEGURAS PARA EL KIOSKO (rol `anon`, sin sesión de Supabase Auth)
--    Reemplazan las lecturas directas de InA_profiles que hacía KioskMode.tsx.
--    Nunca devuelven pin_code. El vector facial NUNCA sale al navegador:
--    la comparación biométrica se hace aquí adentro, server-side.
-- ============================================================================

-- 8.1 Verifica PIN de un empleado en una sede y devuelve solo lo necesario
--     para pintar la UI del kiosko (sin pin_code, sin face_vector crudo).
create or replace function public.kiosk_verify_pin(p_company_id uuid, p_pin_code text)
returns table (
    id uuid,
    full_name text,
    profile_photo text,
    has_face_vector boolean
)
language sql
security definer
set search_path = public
as $$
    select p.id, p.full_name, p.profile_photo, (p.face_vector is not null) as has_face_vector
    from public."InA_profiles" p
    where p.company_id = p_company_id
      and p.pin_code = p_pin_code
      and p.role = 'employee'
    limit 1;
$$;

-- 8.2 Última marcación del empleado (para decidir qué botones mostrar)
create or replace function public.kiosk_get_last_entry(p_profile_id uuid)
returns table ( event_type text, created_at timestamptz )
language sql
security definer
set search_path = public
as $$
    select te.event_type, te.created_at
    from public."InA_time_entries" te
    where te.profile_id = p_profile_id
    order by te.created_at desc
    limit 1;
$$;

-- 8.3 Compara el vector capturado en cámara contra el guardado, SIN exponerlo.
--     Distancia euclidiana, mismo umbral que frontend/src/utils/biometricUtils.ts
create or replace function public.kiosk_verify_face(p_profile_id uuid, p_captured_vector double precision[])
returns table ( match boolean, confidence int )
language plpgsql
security definer
set search_path = public
as $$
declare
    v_stored jsonb;
    v_stored_arr double precision[];
    v_distance double precision := 0;
    v_threshold constant double precision := 0.55; -- mantener sincronizado con biometricUtils.ts
    i int;
begin
    select p.face_vector into v_stored from public."InA_profiles" p where p.id = p_profile_id;

    if v_stored is null or p_captured_vector is null then
        return query select false, 0;
        return;
    end if;

    select array_agg((elem)::double precision)
      into v_stored_arr
      from jsonb_array_elements_text(v_stored) as elem;

    if array_length(v_stored_arr, 1) is distinct from array_length(p_captured_vector, 1) then
        return query select false, 0;
        return;
    end if;

    for i in 1 .. array_length(v_stored_arr, 1) loop
        v_distance := v_distance + (v_stored_arr[i] - p_captured_vector[i]) ^ 2;
    end loop;
    v_distance := sqrt(v_distance);

    return query select
        (v_distance <= v_threshold),
        greatest(0, least(100, round((1 - v_distance) * 100)))::int;
end;
$$;

-- 8.4 Registra la marcación (evita que cualquiera inserte filas arbitrarias
--     directo a InA_time_entries con la anon key).
create or replace function public.kiosk_register_entry(
    p_profile_id uuid,
    p_company_id uuid,
    p_event_type text,
    p_is_verified boolean,
    p_location jsonb,
    p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if not exists (select 1 from public."InA_profiles" where id = p_profile_id and company_id = p_company_id) then
        raise exception 'Perfil no pertenece a la sede indicada';
    end if;

    insert into public."InA_time_entries" (
        profile_id, company_id, event_type, date, clock_in, clock_out,
        is_verified, location_snapshot, metadata
    ) values (
        p_profile_id, p_company_id, p_event_type,
        (now() at time zone 'utc')::date,
        now(),
        case when p_event_type = 'out' then now() else null end,
        p_is_verified, p_location, p_metadata
    ) returning id into v_id;

    return v_id;
end;
$$;

-- Permisos: el rol anon SOLO puede ejecutar estas RPCs, nunca leer las tablas directo.
revoke all on public."InA_profiles" from anon;
revoke all on public."InA_time_entries" from anon;
revoke all on public."InA_companies" from anon;
revoke all on public."InA_organizations" from anon;
revoke all on public."InA_admin_branches" from anon;

-- Sedes sí necesitan ser legibles anónimamente en LandingPage/selector inicial de sede
-- (App.tsx hace un select a InA_companies antes del login). Ajusta si prefieres
-- mover esto también a una RPC pública de solo-lectura limitada.
grant select on public."InA_companies" to anon;

grant execute on function public.kiosk_verify_pin(uuid, text) to anon;
grant execute on function public.kiosk_get_last_entry(uuid) to anon;
grant execute on function public.kiosk_verify_face(uuid, double precision[]) to anon;
grant execute on function public.kiosk_register_entry(uuid, uuid, text, boolean, jsonb, jsonb) to anon;


-- ============================================================================
-- PASO MANUAL PENDIENTE (fuera de este script, en el Dashboard de Supabase):
--
-- 1. Ve a Authentication → Users → "Add user" (o "Invite") y crea una cuenta
--    para cada administrador real:
--      - gerencia@alimentosfoodper.com  (perfil "ALEJANDRA", admin)
--      - miguel@hh.com                  (perfil "Migue", admin)
--      - hader.arrubla@solucioneshys.com (perfil "Super Admin", superadmin —
--        national_id actual es el string "admin", se reemplaza por este email)
--
-- 2. Copia el UUID de cada usuario creado (columna "UID" en la tabla de Users)
--    y ejecuta, por cada uno:
--
--    update public."InA_profiles"
--    set auth_user_id = '<uuid-del-usuario-creado>'
--    where national_id = '<national_id-actual-del-admin>';
--
-- 3. Recién después de esto, el frontend (App.tsx) debe migrarse para usar
--    supabase.auth.signInWithPassword() en el login del panel admin. Ese
--    cambio de código lo preparo aparte cuando confirmes que ya creaste
--    las cuentas.
-- ============================================================================
