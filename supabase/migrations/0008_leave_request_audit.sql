-- ============================================================================
-- MIGRACIÓN 0008: Trazabilidad de novedades (editar sin perder el historial)
-- ============================================================================
-- CONTEXTO: hoy la única forma de "corregir" una novedad es eliminarla, lo
-- que no deja rastro de qué había antes ni quién la borró. Se agrega edición
-- real + una tabla de auditoría alimentada por un TRIGGER (no por el
-- frontend), para que quede registro de cada cambio y cada eliminación sin
-- importar qué camino del código lo haga.
--
-- organization_id se guarda de forma desnormalizada en la auditoría (no
-- depende de que el registro original de InA_leave_requests siga existiendo)
-- para que la traza sobreviva incluso si la novedad se elimina.
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

create table if not exists public."InA_leave_request_audit" (
    id uuid primary key default gen_random_uuid(),
    leave_request_id uuid,
    organization_id uuid not null references public."InA_organizations"(id) on delete cascade,
    action text not null check (action in ('update', 'delete')),
    changed_by uuid references public."InA_profiles"(id) on delete set null,
    changed_at timestamptz not null default now(),
    old_data jsonb,
    new_data jsonb
);

create index if not exists ina_leave_request_audit_leave_request_id_idx
    on public."InA_leave_request_audit" (leave_request_id);

-- ----------------------------------------------------------------------------
-- Trigger: se dispara solo, sin importar si el UPDATE/DELETE viene del
-- formulario de edición, de la aprobación/rechazo, o de cualquier código
-- futuro — no se puede "olvidar" de auditar un cambio.
-- ----------------------------------------------------------------------------
create or replace function public.log_leave_request_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_changed_by uuid;
    v_org_id uuid;
begin
    v_changed_by := (select id from public."InA_profiles" where auth_user_id = auth.uid());

    if TG_OP = 'DELETE' then
        select organization_id into v_org_id from public."InA_profiles" where id = OLD.profile_id;
        insert into public."InA_leave_request_audit" (leave_request_id, organization_id, action, changed_by, old_data, new_data)
        values (OLD.id, v_org_id, 'delete', v_changed_by, to_jsonb(OLD), null);
        return OLD;
    elsif TG_OP = 'UPDATE' then
        select organization_id into v_org_id from public."InA_profiles" where id = NEW.profile_id;
        insert into public."InA_leave_request_audit" (leave_request_id, organization_id, action, changed_by, old_data, new_data)
        values (NEW.id, v_org_id, 'update', v_changed_by, to_jsonb(OLD), to_jsonb(NEW));
        return NEW;
    end if;
    return null;
end;
$$;

drop trigger if exists leave_request_audit_trigger on public."InA_leave_requests";
create trigger leave_request_audit_trigger
    after update or delete on public."InA_leave_requests"
    for each row execute function public.log_leave_request_change();

-- ----------------------------------------------------------------------------
-- RLS: solo lectura para admins de la organización dueña del registro
-- auditado. Nadie inserta/edita/borra aquí directo — solo el trigger
-- (SECURITY DEFINER, corre con privilegios elevados y no pasa por RLS).
-- ----------------------------------------------------------------------------
alter table public."InA_leave_request_audit" enable row level security;

drop policy if exists leave_request_audit_select on public."InA_leave_request_audit";
create policy leave_request_audit_select on public."InA_leave_request_audit"
    for select to authenticated
    using ( public.is_admin_of_org(organization_id) );

revoke all on public."InA_leave_request_audit" from anon;

-- Verificación
select tablename, policyname, roles, cmd
from pg_policies
where tablename = 'InA_leave_request_audit';
