-- ============================================================================
-- MIGRACIÓN 0003: Empleados multi-sede
-- ============================================================================
-- CONTEXTO: Varios comercios rotan empleados entre sedes. Hoy InA_profiles.
-- company_id es un único valor (la "sede principal"), y el Kiosko solo deja
-- marcar al empleado en esa sede. Esta migración agrega una lista de sedes
-- adicionales autorizadas por empleado (InA_employee_branches), replicando
-- exactamente el mismo patrón que ya existe para administradores
-- (InA_admin_branches + UI de checkboxes en AdminManagement.tsx).
--
-- No cambia nada sobre dónde queda registrada una marcación: KioskMode.tsx ya
-- envía como p_company_id la sede donde está físicamente el kiosko, así que
-- una marcación siempre se asocia a la sede real donde ocurrió.
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Tabla InA_employee_branches
-- ----------------------------------------------------------------------------
create table if not exists public."InA_employee_branches" (
    id uuid primary key default gen_random_uuid(),
    employee_id uuid not null references public."InA_profiles"(id) on delete cascade,
    branch_id uuid not null references public."InA_companies"(id) on delete cascade,
    created_at timestamptz not null default now()
);

create unique index if not exists ina_employee_branches_employee_branch_key
    on public."InA_employee_branches" (employee_id, branch_id);


-- ----------------------------------------------------------------------------
-- 2. RLS: a diferencia de InA_admin_branches (solo superadmin), aquí un admin
--    normal también debe poder asignar sedes a SUS propios empleados, porque
--    EmployeeManagement.tsx lo usan tanto admin como superadmin.
-- ----------------------------------------------------------------------------
alter table public."InA_employee_branches" enable row level security;

drop policy if exists employee_branches_all on public."InA_employee_branches";
create policy employee_branches_all on public."InA_employee_branches"
    for all to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_branches".employee_id
              and public.is_admin_of_org(p.organization_id)
        )
    )
    with check (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_branches".employee_id
              and public.is_admin_of_org(p.organization_id)
        )
    );


-- ----------------------------------------------------------------------------
-- 3. kiosk_verify_pin: reconoce PIN también en sedes adicionales autorizadas
-- ----------------------------------------------------------------------------
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
    where (
        p.company_id = p_company_id
        or exists (
            select 1 from public."InA_employee_branches" eb
            where eb.employee_id = p.id and eb.branch_id = p_company_id
        )
    )
      and p.pin_code = p_pin_code
      and p.role = 'employee'
    limit 1;
$$;

-- ----------------------------------------------------------------------------
-- 4. kiosk_register_entry: sin este cambio, un empleado que pasó
--    kiosk_verify_pin en una sede secundaria no podría registrar su
--    marcación (la función seguiría exigiendo company_id = sede principal).
-- ----------------------------------------------------------------------------
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
    if not exists (
        select 1 from public."InA_profiles" p
        where p.id = p_profile_id
          and (
            p.company_id = p_company_id
            or exists (
                select 1 from public."InA_employee_branches" eb
                where eb.employee_id = p.id and eb.branch_id = p_company_id
            )
          )
    ) then
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


-- ----------------------------------------------------------------------------
-- 5. Permisos: la tabla nueva sigue el mismo bloqueo a anon que las demás;
--    solo se accede vía las RPCs del Kiosko (ya otorgadas en 0001) o desde
--    el panel admin autenticado (RLS de arriba).
-- ----------------------------------------------------------------------------
revoke all on public."InA_employee_branches" from anon;


-- Verificación: confirma la tabla, el índice único y la policy nueva.
select tablename, policyname, roles, cmd
from pg_policies
where tablename = 'InA_employee_branches';
