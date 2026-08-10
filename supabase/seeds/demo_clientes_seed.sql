-- ============================================================================
-- SEED de demo: marcaciones y novedades de ejemplo para "DEMO-CLIENTES"
-- ============================================================================
-- Esto NO es una migración de esquema (no crea tablas ni cambia RLS). Genera
-- datos de ejemplo para TODOS los empleados de la organización llamada
-- exactamente "DEMO-CLIENTES", para poder mostrarle a un prospecto cómo se
-- ve el sistema con actividad real en vez de vacío.
--
-- Para cada empleado, por cada uno de los últimos 30 días (sin domingo):
--   - Inicio de jornada (~08:00, con ~25% de probabilidad de llegar
--     10-25 minutos tarde — para que la alerta de "Llegada Tarde" tenga
--     ejemplos reales que mostrar).
--   - Pausa Desayuno (15 min) y regreso.
--   - Pausa Almuerzo (45 min) y regreso.
--   - Pausa Activa (15 min) y regreso.
--   - Fin de jornada (~17:00 normalmente).
--   - ~6% de probabilidad de que ese día NO tenga NINGUNA marcación —
--     para que la alerta "Ausencia No Justificada" (Fase 4) tenga un
--     ejemplo real que mostrar, incluido HOY.
--
-- El PRIMER empleado de la lista además trabaja ~35% de sus días con 2-4
-- horas extra (jornada de 11-13h en vez de 9h), para que la alerta "Alerta
-- Horas Extras" también tenga un ejemplo real en el periodo.
--
-- Novedades: una de CADA uno de los 9 tipos posibles (vacaciones,
-- incapacidad EPS/ARL, permisos, licencias, luto, otro), repartidas entre
-- los empleados disponibles, mezclando pasado/futuro y aprobada/pendiente/
-- rechazada — incluye una vacación que cubre HOY (panel "Ausencias de Hoy"),
-- una pendiente (panel de pendientes + badge del menú) y una rechazada con
-- observación de ejemplo (para mostrar el historial auditado).
--
-- REVERSIBLE Y RE-EJECUTABLE: al inicio borra cualquier dato generado por
-- una corrida anterior de este mismo script, así que puedes correrlo las
-- veces que quieras (por ejemplo, para "refrescar" la demo) sin duplicar
-- datos ni afectar marcaciones reales de otras organizaciones.
--
-- Ejecuta este script completo en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

do $$
declare
    v_org_id uuid;
    v_admin_id uuid;
    v_employee_ids uuid[];
    v_overtime_employee_id uuid;
    v_employee_id uuid;
    v_day date;
    v_day_start timestamptz;
    v_late_minutes int;
    v_workday_hours numeric;
    v_seed_tag constant text := 'demo_clientes_v1';
    v_leave_types text[] := array['vacaciones','incapacidad_eps','incapacidad_arl','permiso_remunerado','permiso_no_remunerado','licencia_maternidad','licencia_paternidad','luto','otro'];
    v_leave_starts int[]    := array[0,   -10,  -20,  4,   -15,  -30,  -25,  -5,  8];
    v_leave_durations int[] := array[3,    2,    3,   1,    2,    5,    3,   1,  2];
    v_leave_statuses text[] := array['approved','approved','approved','pending','approved','approved','approved','approved','rejected'];
    i int;
    v_emp_idx int;
begin
    select id into v_org_id from public."InA_organizations" where name = 'DEMO-CLIENTES';
    if v_org_id is null then
        raise exception 'No se encontró ninguna organización llamada exactamente "DEMO-CLIENTES". Revisa el nombre exacto en InA_organizations antes de correr este script.';
    end if;

    select id into v_admin_id from public."InA_profiles"
    where organization_id = v_org_id and role in ('admin', 'superadmin')
    limit 1;

    select array_agg(id) into v_employee_ids
    from public."InA_profiles"
    where organization_id = v_org_id and role = 'employee' and company_id is not null;

    if v_employee_ids is null or array_length(v_employee_ids, 1) = 0 then
        raise exception 'DEMO-CLIENTES no tiene empleados con company_id asignado.';
    end if;

    v_overtime_employee_id := v_employee_ids[1];

    -- Limpieza de corridas anteriores de este script (no toca datos reales
    -- ni de otras organizaciones).
    delete from public."InA_time_entries"
    where metadata->>'seed_tag' = v_seed_tag
      and profile_id = any(v_employee_ids);

    delete from public."InA_leave_requests"
    where notes like '[DEMO]%'
      and profile_id = any(v_employee_ids);

    foreach v_employee_id in array v_employee_ids
    loop
        for v_day in
            select generate_series(current_date - interval '29 days', current_date, interval '1 day')::date
        loop
            if extract(dow from v_day) = 0 then continue; end if; -- domingo

            if random() < 0.06 then continue; end if; -- ausencia sin justificar, a propósito

            v_late_minutes := case when random() < 0.25 then (10 + floor(random() * 15))::int else 0 end;
            v_day_start := v_day + time '08:00:00' + (v_late_minutes || ' minutes')::interval;

            v_workday_hours := 9;
            if v_employee_id = v_overtime_employee_id and random() < 0.35 then
                v_workday_hours := 9 + 2 + floor(random() * 3); -- jornada de 11 a 13 horas ese día
            end if;

            -- created_at se fija explícitamente igual a clock_in en cada
            -- marcación (en vez de dejar el default now()): al insertar todo
            -- este script en una sola transacción, now() devuelve el MISMO
            -- valor para todas las filas, y varias funciones (incluida
            -- payroll_daily_breakdown) ordenan las marcaciones por created_at
            -- para reconstruir los turnos — con todas empatadas, el orden
            -- real se pierde y se pueden mezclar marcaciones de días
            -- distintos como si fueran un solo turno.
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'in', v_day, v_day_start, v_day_start, true,
                jsonb_build_object('event_label', 'Inicio de Día', 'method', 'pin-only', 'is_return', false, 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'breakfast', v_day, v_day_start + interval '2 hours', v_day_start + interval '2 hours', true,
                jsonb_build_object('event_label', 'Pausa Desayuno', 'method', 'pin-only', 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'in', v_day, v_day_start + interval '2 hours 15 minutes', v_day_start + interval '2 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Desayuno', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'lunch', v_day, v_day_start + interval '4 hours 30 minutes', v_day_start + interval '4 hours 30 minutes', true,
                jsonb_build_object('event_label', 'Pausa Almuerzo', 'method', 'pin-only', 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'in', v_day, v_day_start + interval '5 hours 15 minutes', v_day_start + interval '5 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Almuerzo', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'active_pause', v_day, v_day_start + interval '7 hours', v_day_start + interval '7 hours', true,
                jsonb_build_object('event_label', 'Pausa Activa', 'method', 'pin-only', 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;
            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'in', v_day, v_day_start + interval '7 hours 15 minutes', v_day_start + interval '7 hours 15 minutes', true,
                jsonb_build_object('event_label', 'Regreso de Pausa Activa', 'method', 'pin-only', 'is_return', true, 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;

            insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified, metadata)
            select v_employee_id, p.company_id, 'out', v_day,
                v_day_start + (v_workday_hours || ' hours')::interval,
                v_day_start + (v_workday_hours || ' hours')::interval,
                v_day_start + (v_workday_hours || ' hours')::interval,
                true,
                jsonb_build_object('event_label', 'Fin de Día', 'method', 'pin-only', 'seed_tag', v_seed_tag)
            from public."InA_profiles" p where p.id = v_employee_id;
        end loop;
    end loop;

    -- Novedades: una de cada tipo, repartidas cíclicamente entre los
    -- empleados disponibles (se repiten empleados si hay menos de 9).
    for i in 1 .. array_length(v_leave_types, 1) loop
        v_emp_idx := 1 + mod(i - 1, array_length(v_employee_ids, 1));
        insert into public."InA_leave_requests" (profile_id, type, start_date, end_date, status, notes, decision_notes, requested_by, approved_by)
        values (
            v_employee_ids[v_emp_idx],
            v_leave_types[i],
            current_date + v_leave_starts[i],
            current_date + v_leave_starts[i] + v_leave_durations[i] - 1,
            v_leave_statuses[i],
            '[DEMO] ' || initcap(replace(v_leave_types[i], '_', ' ')) || ' de ejemplo',
            case when v_leave_statuses[i] = 'rejected' then '[DEMO] Rechazado por falta de personal disponible en esas fechas.' else null end,
            case when v_leave_statuses[i] = 'pending' then v_employee_ids[v_emp_idx] else v_admin_id end,
            case when v_leave_statuses[i] = 'pending' then null else v_admin_id end
        );
    end loop;
end $$;

-- Verificación
select count(*) as marcaciones_generadas
from public."InA_time_entries" te
join public."InA_profiles" p on p.id = te.profile_id and p.organization_id = (select id from public."InA_organizations" where name = 'DEMO-CLIENTES')
where te.metadata->>'seed_tag' = 'demo_clientes_v1';

select p.full_name, l.type, l.start_date, l.end_date, l.status, l.notes, l.decision_notes
from public."InA_leave_requests" l
join public."InA_profiles" p on p.id = l.profile_id
where l.notes like '[DEMO]%'
order by l.start_date;
