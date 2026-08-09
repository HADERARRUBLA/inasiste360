-- ============================================================================
-- MIGRACIÓN 0005: Novedades y ausencias (Fase 3, V1)
-- ============================================================================
-- CONTEXTO: registro de vacaciones, incapacidades, permisos y licencias por
-- empleado. V1: el admin registra la novedad directamente (queda 'approved'
-- de inmediato) — no hay autoservicio del empleado todavía (eso es una
-- sub-fase posterior, vía RPC del Kiosko con PIN, igual que las marcaciones).
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

create table if not exists public."InA_leave_requests" (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public."InA_profiles"(id) on delete cascade,
    type text not null check (type in (
        'vacaciones', 'incapacidad_eps', 'incapacidad_arl',
        'permiso_remunerado', 'permiso_no_remunerado',
        'licencia_maternidad', 'licencia_paternidad', 'luto', 'otro'
    )),
    start_date date not null,
    end_date date not null,
    status text not null default 'approved' check (status in ('pending', 'approved', 'rejected')),
    notes text,
    attachment_url text,
    requested_by uuid references public."InA_profiles"(id) on delete set null,
    approved_by uuid references public."InA_profiles"(id) on delete set null,
    created_at timestamptz not null default now(),
    constraint leave_requests_date_order check (end_date >= start_date)
);

create index if not exists ina_leave_requests_profile_id_idx
    on public."InA_leave_requests" (profile_id);

-- ----------------------------------------------------------------------------
-- RLS: mismo patrón que InA_employee_branches — un admin normal gestiona
-- (no solo lee) las novedades de los empleados de SU organización, ya que
-- este módulo lo usan tanto admin como superadmin.
-- ----------------------------------------------------------------------------
alter table public."InA_leave_requests" enable row level security;

drop policy if exists leave_requests_all on public."InA_leave_requests";
create policy leave_requests_all on public."InA_leave_requests"
    for all to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_leave_requests".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    )
    with check (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_leave_requests".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    );

revoke all on public."InA_leave_requests" from anon;

-- Verificación
select tablename, policyname, roles, cmd
from pg_policies
where tablename = 'InA_leave_requests';
