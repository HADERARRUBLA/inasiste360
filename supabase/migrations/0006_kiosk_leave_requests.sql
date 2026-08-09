-- ============================================================================
-- MIGRACIÓN 0006: Autoservicio de novedades desde el Kiosko (Fase 3, V2)
-- ============================================================================
-- CONTEXTO: solo tiene sentido para tipos que se piden con anticipación
-- estando presente (vacaciones, permisos) — un empleado incapacitado no
-- puede pasar por el Kiosko a "solicitar" su incapacidad. Las incapacidades
-- y licencias siguen siendo registradas por el admin (V1), normalmente con
-- el soporte médico que el empleado envía por fuera del sistema.
--
-- La solicitud queda en estado 'pending'; el admin la aprueba o rechaza
-- desde LeaveManagement.tsx (usa la política RLS ya existente de la
-- migración 0005, no necesita cambios de RLS aquí).
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

create or replace function public.kiosk_create_leave_request(
    p_profile_id uuid,
    p_type text,
    p_start_date date,
    p_end_date date,
    p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id uuid;
begin
    if p_type not in ('vacaciones', 'permiso_remunerado', 'permiso_no_remunerado') then
        raise exception 'Tipo de novedad no disponible para autoservicio';
    end if;

    if p_end_date < p_start_date then
        raise exception 'La fecha final no puede ser anterior a la fecha de inicio';
    end if;

    if not exists (select 1 from public."InA_profiles" where id = p_profile_id and role = 'employee') then
        raise exception 'Perfil no válido';
    end if;

    insert into public."InA_leave_requests" (
        profile_id, type, start_date, end_date, status, notes, requested_by
    ) values (
        p_profile_id, p_type, p_start_date, p_end_date, 'pending', p_notes, p_profile_id
    ) returning id into v_id;

    return v_id;
end;
$$;

grant execute on function public.kiosk_create_leave_request(uuid, text, date, date, text) to anon;
