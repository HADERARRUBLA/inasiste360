-- ============================================================================
-- SEED de demo: marcaciones y novedades de ejemplo para "DEMO-CLIENTES"
-- ============================================================================
-- Esto NO es una migración de esquema (no crea tablas ni cambia RLS). Genera
-- datos de ejemplo para TODOS los empleados de la organización llamada
-- exactamente "DEMO-CLIENTES", para poder mostrarle a un prospecto cómo se
-- ve el sistema con actividad real en vez de vacío.
--
-- Para cada empleado, por cada uno de los últimos 14 días (sin domingo):
--   - Inicio de jornada (~08:00, con ~25% de probabilidad de llegar
--     10-25 minutos tarde — para que la alerta de "Llegada Tarde" tenga
--     ejemplos reales que mostrar).
--   - Pausa Desayuno (15 min) y regreso.
--   - Pausa Almuerzo (45 min) y regreso.
--   - Pausa Activa (15 min) y regreso.
--   - Fin de jornada (~17:00).
--   - ~8% de probabilidad de que ese día NO tenga NINGUNA marcación —
--     para que la alerta "Ausencia No Justificada" (Fase 4) tenga un
--     ejemplo real que mostrar, incluido HOY.
--
-- También inserta 3 novedades de ejemplo: una vacación aprobada que cubre
-- hoy (para el panel "Ausencias de Hoy"), una incapacidad ya vencida (para
-- el historial), y un permiso pendiente de aprobación (para el panel de
-- pendientes y el badge del menú).
--
-- REVERSIBLE Y RE-EJECUTABLE: al inicio borra cualquier dato generado por
-- una corrida anterior de este mismo script (marcado internamente con
-- metadata->>'seed_tag' / notas que empiezan con "[DEMO]"), así que puedes
-- correrlo las veces que quieras sin duplicar datos ni afectar marcaciones
-- reales de otras organizaciones.
--
-- Ejecuta este script completo en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

do $$
declare
    v_org_id uuid;
    v_admin_id uuid;
    v_employee record;
    v_day date;
    v_day_start timestamptz;
    v_late_minutes int;
    v_seed_tag constant text := 'demo_clientes_v1';
begin
    select id into v_org_id from public."InA_organizations" where name = 'DEMO-CLIENTES';
    if v_org_id is null then
        raise exception 'No se encontró ninguna organización llamada exactamente "DEMO-CLIENTES". Revisa el nombre exacto en InA_organizations antes de correr este script.';
    end if;

    select id into v_admin_id from public."InA_profiles"
    where organization_id = v_org_id and role in ('admin', 'superadmin')
    limit 1;

    -- Limpieza de corridas anteriores de este script (no toca datos reales
    -- ni de otras organizaciones).
    delete from public."InA_time_entries"
    where metadata->>'seed_tag' = v_seed_tag
      and profile_id in (select id from public."InA_profiles" where organization_id = v_org_id);

    delete from public."InA_leave_requests"
    where notes like '[DEMO]%'
      and profile_id in (select id from public."InA_profiles" where organization_id = v_org_id);

    for v_employee in
        select id, company_id from public."InA_profiles"
        where organization_id = v_org_id and role = 'employee' and company_id is not null
    loop
        for v_day in
            select generate_series(current_date - interval '13 days', current_date, interval '1 day')::date
        loop
            if extract(dow from v_day) = 0 then continue; end if; -- domingo

            if random() < 0.08 then continue; end if; -- ausencia sin justificar, a propósito

            v_late_minutes := case when random() < 0.25 then (10 + floor(random() * 15))::int else 0 end;
            v_day_start := v_day + time '08:00:00' + (v_late_minutes || ' minutes')::interval;

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'in', v_day, v_day_start, true,
                jsonb_build_object('event_label', 'Inicio de Día', 'method', 'pin-only', 'is_return', false, 'seed_tag', v_seed_tag));

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'breakfast', v_day, v_day_start + interval '2 hours', true,
                jsonb_build_object('event_label', 'Pausa Desayuno', 'method', 'pin-only', 'seed_tag', v_seed_tag));
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'in', v_day, v_day_start + interval '2 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Desayuno', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag));

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'lunch', v_day, v_day_start + interval '4 hours 30 minutes', true,
                jsonb_build_object('event_label', 'Pausa Almuerzo', 'method', 'pin-only', 'seed_tag', v_seed_tag));
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'in', v_day, v_day_start + interval '5 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Almuerzo', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag));

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'active_pause', v_day, v_day_start + interval '7 hours', true,
                jsonb_build_object('event_label', 'Pausa Activa', 'method', 'pin-only', 'seed_tag', v_seed_tag));
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'in', v_day, v_day_start + interval '7 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Activa', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag));

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, is_verified, metadata)
            values (v_employee.id, v_employee.company_id, 'out', v_day, v_day_start + interval '9 hours', v_day_start + interval '9 hours', true,
                jsonb_build_object('event_label', 'Fin de Día', 'method', 'pin-only', 'seed_tag', v_seed_tag));
        end loop;
    end loop;

    -- Novedades de ejemplo: una aprobada cubriendo hoy, una aprobada ya
    -- vencida, y una pendiente de aprobación.
    with candidatos as (
        select id, row_number() over (order by random()) as rn
        from public."InA_profiles"
        where organization_id = v_org_id and role = 'employee'
    )
    insert into public."InA_leave_requests" (profile_id, type, start_date, end_date, status, notes, requested_by, approved_by)
    select id, 'vacaciones', current_date - 1, current_date + 2, 'approved', '[DEMO] Vacaciones de ejemplo', v_admin_id, v_admin_id
    from candidatos where rn = 1
    union all
    select id, 'incapacidad_eps', current_date - 8, current_date - 6, 'approved', '[DEMO] Incapacidad de ejemplo', v_admin_id, v_admin_id
    from candidatos where rn = 2
    union all
    select id, 'permiso_remunerado', current_date + 3, current_date + 3, 'pending', '[DEMO] Permiso pendiente de ejemplo', id, null
    from candidatos where rn = 3;
end $$;

-- Verificación
select count(*) as marcaciones_generadas
from public."InA_time_entries"
where metadata->>'seed_tag' = 'demo_clientes_v1';

select p.full_name, l.type, l.start_date, l.end_date, l.status, l.notes
from public."InA_leave_requests" l
join public."InA_profiles" p on p.id = l.profile_id
where l.notes like '[DEMO]%';
