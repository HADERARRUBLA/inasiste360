-- ============================================================================
-- MIGRACIÓN 0010: RPC de nómina/asistencia por período (MODO SOMBRA)
-- ============================================================================
-- CONTEXTO: Hoy todo el cálculo de nómina (horas trabajadas, llegadas tarde,
-- ausencias no justificadas, horas extra, costo estimado) corre en el
-- navegador (frontend/src/utils/calculations.ts + AdminDashboard.tsx),
-- trayendo TODAS las marcaciones de la sede sin límite de fecha. Esta
-- migración crea el mismo cálculo como funciones de PostgreSQL, para que en
-- el futuro el dashboard pueda pedirle el resultado ya calculado al servidor
-- en vez de descargar todo el historial crudo.
--
-- IMPORTANTE — MODO SOMBRA: esta migración NO cambia el dashboard actual.
-- Solo agrega funciones nuevas que se pueden comparar contra los números de
-- hoy desde un panel nuevo y aislado (ver PayrollRpcShadowPanel.tsx). El
-- cutover real (que el dashboard use estas funciones en vez del cálculo en
-- el navegador) es un paso futuro y separado, sujeto a que los números
-- coincidan validados con datos reales.
--
-- ZONA HORARIA: todo el cálculo de "hora de reloj" (umbral nocturno, hora de
-- inicio de horario, si una fecha es "hoy") se hace en la zona horaria fija
-- 'America/Bogota' (Colombia no tiene horario de verano, así que un
-- desplazamiento constante de zona horaria es equivalente a la aritmética de
-- instantes absolutos que usa hoy el navegador). Confirmado con el usuario
-- que todas las sedes operan en Colombia.
--
-- VENTANA DE CONSULTA: para no escanear el historial completo de marcaciones
-- de la sede (que es como funciona hoy y no escala), estas funciones NO usan
-- un margen fijo de +/-2 días: eso se probó primero y resultó incorrecto con
-- datos reales (ver commit siguiente a la primera versión) — si el turno
-- real de un empleado empezaba antes del margen fijo, la primera marcación
-- que caía dentro de la ventana se malinterpretaba como inicio de turno,
-- inflando el resultado. En su lugar, cada empleado tiene su propio límite
-- inferior de consulta: se busca su última marcación de inicio de turno
-- EXPLÍCITA antes del rango pedido (una búsqueda puntual, no un escaneo
-- completo) y se arranca 2 días antes de esa fecha real (ver CTE
-- profile_window_start). El límite superior sí se mantiene en
-- p_end_date + 2 días — un turno no puede empezar en el futuro, así que ahí
-- el margen fijo nunca infla el resultado, a lo sumo podría subestimar un
-- turno todavía abierto que se extienda más allá del rango pedido.
--
-- DIVERGENCIA DELIBERADA (documentada, no un descuido): el filtro de
-- ausencias no justificadas del navegador solo considera "cubierto por
-- novedad" las novedades de perfiles con role='employee' (por un filtro de
-- alcance en un fetch distinto, no por una regla de negocio intencional).
-- Esta migración considera CUALQUIER novedad aprobada que cubra la fecha,
-- sin importar el rol del perfil — más seguro para nómina (evita falsos
-- positivos de "ausencia no justificada" para un admin con una novedad
-- aprobada real). Se documenta aquí para que no se lea como un bug nuevo.
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- El bloque de autopruebas al final revierte TODA la migración si algo no
-- coincide con lo esperado (ver sección 6) — por eso debe ejecutarse
-- completo, no por fragmentos.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Funciones auxiliares puras (sin acceso a tablas)
-- ----------------------------------------------------------------------------

-- Minutos de solapamiento entre el turno [p_shift_start, p_shift_end] y una
-- ventana de tiempo [p_window_start, p_window_end]. Todo en tiempo local
-- NAIVE (sin zona horaria) — ver nota de zona horaria arriba.
create or replace function public._payroll_overlap_minutes(
    p_shift_start timestamp, p_shift_end timestamp,
    p_window_start timestamp, p_window_end timestamp
) returns numeric
language sql immutable as $$
    select greatest(0, extract(epoch from (least(p_shift_end, p_window_end) - greatest(p_shift_start, p_window_start))) / 60);
$$;

-- Replica el patrón `a || b || c` de JavaScript (donde 0, null y undefined
-- son "falsy"): devuelve el primer valor no nulo y distinto de cero, o 0.
create or replace function public._payroll_truthy_or(variadic p_vals numeric[])
returns numeric
language sql immutable as $$
    select coalesce((select v from unnest(p_vals) as v where v is not null and v <> 0 limit 1), 0);
$$;

-- Código de 3 letras del día de la semana (mismo formato que dayMap en
-- AdminDashboard.tsx: 0=domingo..6=sábado -> 'sun'..'sat'), usado como clave
-- dentro del jsonb work_schedule.
create or replace function public._payroll_day_code(p_date date)
returns text
language sql immutable as $$
    select (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from p_date)::int + 1];
$$;

-- Horario del día para el chequeo de LLEGADA TARDE / AUSENCIA: mismo perfil
-- que company.work_schedule si schedule_mode='branch', si no el propio
-- profile.work_schedule (para 'custom' Y 'open' por igual) — replica
-- exactamente la regla ya usada en el paso de detección de tarde del
-- frontend (AdminDashboard.tsx), no la del paso de nómina (ver función
-- siguiente, que usa una regla distinta a propósito).
create or replace function public._payroll_sched_late(
    p_schedule_mode text, p_profile_schedule jsonb, p_company_schedule jsonb, p_date date
) returns jsonb
language sql immutable as $$
    select (case when p_schedule_mode = 'branch' then p_company_schedule else p_profile_schedule end)
        -> public._payroll_day_code(p_date);
$$;

-- Horario del día para el cálculo de NÓMINA/clasificación de horas: usa
-- profile.work_schedule solo si schedule_mode='custom', si no
-- company.work_schedule (incluso en 'open' — aunque en ese modo este valor
-- no afecta el resultado, classifyShiftMinutes lo ignora, se calcula igual
-- por fidelidad con el frontend). Regla distinta a _payroll_sched_late a
-- propósito: es una inconsistencia ya existente en el frontend, se replica
-- tal cual, no se "corrige" aquí.
create or replace function public._payroll_sched_payroll(
    p_schedule_mode text, p_profile_schedule jsonb, p_company_schedule jsonb, p_date date
) returns jsonb
language sql immutable as $$
    select (case when p_schedule_mode = 'custom' then p_profile_schedule else p_company_schedule end)
        -> public._payroll_day_code(p_date);
$$;

-- Traducción 1:1 de classifyShiftMinutes() en frontend/src/utils/calculations.ts.
create or replace function public._payroll_classify_minutes(
    p_start timestamptz,
    p_end timestamptz,
    p_night_shift_start time,
    p_day_schedule_end text,
    p_schedule_mode text,
    p_open_no_overtime boolean,
    p_open_max_ordinary_minutes int,
    p_first_in_time timestamptz,
    p_tz text default 'America/Bogota'
) returns table (ordinary numeric, extra_day numeric, extra_night numeric)
language plpgsql stable as $$
declare
    v_start_local timestamp := timezone(p_tz, p_start);
    v_end_local timestamp := timezone(p_tz, p_end);
    v_total_min numeric;
    v_night_threshold timestamp;
    v_ordinary_end timestamp;
    v_night_window_start timestamp;
    v_ordinary numeric;
    v_extra_day numeric;
    v_extra_night numeric;
    v_accounted numeric;
begin
    v_total_min := greatest(0, extract(epoch from (v_end_local - v_start_local)) / 60);
    if v_total_min = 0 then
        return query select 0::numeric, 0::numeric, 0::numeric;
        return;
    end if;

    v_night_threshold := v_start_local::date + coalesce(p_night_shift_start, time '21:00');

    if p_schedule_mode = 'open' then
        if coalesce(p_open_no_overtime, false) or p_first_in_time is null then
            v_ordinary_end := v_night_threshold + interval '24 hours';
        else
            v_ordinary_end := timezone(p_tz, p_first_in_time) + ((coalesce(p_open_max_ordinary_minutes, 480)) || ' minutes')::interval;
        end if;
    else
        v_ordinary_end := v_start_local::date + coalesce(nullif(p_day_schedule_end, '')::time, time '17:00');
    end if;

    v_night_window_start := greatest(v_ordinary_end, v_night_threshold);

    v_ordinary := public._payroll_overlap_minutes(v_start_local, v_end_local, v_start_local - interval '24 hours', v_ordinary_end);
    v_extra_day := public._payroll_overlap_minutes(v_start_local, v_end_local, v_ordinary_end, v_night_window_start);
    v_extra_night := public._payroll_overlap_minutes(v_start_local, v_end_local, v_night_window_start, v_night_threshold + interval '24 hours');

    v_accounted := v_ordinary + v_extra_day + v_extra_night;
    if v_accounted < v_total_min - 0.01 then
        v_extra_night := v_extra_night + (v_total_min - v_accounted);
    end if;

    return query select v_ordinary, v_extra_day, v_extra_night;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2. Motor privado: desglose diario por empleado (no otorgado a anon/
--    authenticated — solo lo llaman las funciones públicas de la sección 3,
--    que corren como SECURITY DEFINER y por lo tanto tienen privilegio de
--    dueño para invocarlo aunque esté revocado de PUBLIC).
-- ----------------------------------------------------------------------------
create or replace function public._payroll_calc_daily(
    p_company_id uuid,
    p_start_date date,
    p_end_date date,
    p_profile_id uuid default null
) returns table (
    profile_id uuid,
    full_name text,
    national_id text,
    work_date date,
    minutes_work numeric,
    ordinary_minutes numeric,
    extra_day_minutes numeric,
    extra_night_minutes numeric,
    extra_sunday_minutes numeric,
    breakfast_minutes numeric,
    lunch_minutes numeric,
    active_pause_minutes numeric,
    other_minutes numeric,
    cost numeric,
    is_late boolean,
    is_unjustified_absence boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
    v_tz constant text := 'America/Bogota';
    v_today date := (timezone(v_tz, now()))::date;
begin
    if not exists (select 1 from public."InA_companies" where id = p_company_id) then
        raise exception 'Sede % no encontrada.', p_company_id;
    end if;
    if p_end_date < p_start_date then
        raise exception 'El rango de fechas es inválido (fin antes que inicio).';
    end if;

    return query
    with company as (
        select * from public."InA_companies" where id = p_company_id
    ),
    -- Perfiles de la sede: principal (company_id = sede) + "de visita"
    -- multi-sede (InA_employee_branches) — mismo patrón que
    -- AdminDashboard.tsx fetchData(). Sin filtro de rol: el fetch actual del
    -- dashboard tampoco filtra por rol para la sede principal, se replica
    -- igual por fidelidad.
    profile_pool as (
        select p.* from public."InA_profiles" p where p.company_id = p_company_id
        union
        select p.* from public."InA_profiles" p
        join public."InA_employee_branches" eb on eb.employee_id = p.id
        where eb.branch_id = p_company_id
    ),
    profile_pool_scoped as (
        select * from profile_pool where p_profile_id is null or id = p_profile_id
    ),
    -- Límite inferior de la ventana de consulta, POR EMPLEADO: no es
    -- simplemente "p_start_date - 2" a secas (eso puede cortar un turno que
    -- realmente empezó mucho antes del rango pedido, y entonces la primera
    -- marcación que quede dentro de la ventana —una pausa, un regreso,
    -- cualquier cosa— se malinterpreta como si fuera el inicio de un turno
    -- nuevo, inflando el resultado si termina emparejada con datos lejanos).
    -- En vez de eso, se busca la última marcación de inicio de turno
    -- EXPLÍCITA ('in', no is_return) de cada empleado, en cualquier fecha
    -- hasta p_start_date, y se arranca 2 días antes de esa fecha real (o de
    -- p_start_date si no hay ninguna, igual que antes). Esto nunca inventa
    -- un inicio de turno falso, y solo hace una búsqueda puntual e indexable
    -- por empleado — no vuelve a escanear todo el historial completo.
    profile_window_start as (
        select pps.id as profile_id,
            coalesce(
                (select te2.date from public."InA_time_entries" te2
                 where te2.profile_id = pps.id and te2.company_id = p_company_id
                   and coalesce(te2.event_type, '') = 'in'
                   and coalesce((te2.metadata->>'is_return')::boolean, false) = false
                   and te2.date <= p_start_date
                 order by te2.clock_in desc limit 1),
                p_start_date
            ) - 2 as window_start
        from profile_pool_scoped pps
    ),
    -- Marcaciones de la sede desde el inicio de ventana calculado arriba
    -- (por empleado) hasta p_end_date + 2 días, agrupadas en turnos igual
    -- que groupEntriesIntoShifts() del frontend: un turno nuevo empieza en
    -- cada 'in' que no sea is_return (o en la primera marcación de la
    -- persona dentro de la ventana, si de verdad no hay ninguna marcación
    -- de inicio explícita antes del rango — caso ya cubierto arriba).
    raw_entries as (
        select te.id, te.profile_id, te.date, te.clock_in, te.clock_out,
               te.total_hours, te.event_type, te.metadata, te.created_at
        from public."InA_time_entries" te
        join profile_window_start pws on pws.profile_id = te.profile_id
        where te.company_id = p_company_id
          and te.profile_id in (select id from profile_pool_scoped)
          and te.date between pws.window_start and (p_end_date + 2)
    ),
    flagged as (
        select re.*,
            (coalesce(re.event_type, '') = 'in' and coalesce((re.metadata->>'is_return')::boolean, false) = false) as is_explicit_start,
            -- Se ordena por clock_in (no por created_at): clock_in es distinto
            -- y correcto en cada marcación, mientras que created_at puede
            -- repetirse exactamente si varias filas se insertaron en la misma
            -- transacción (p.ej. un script de carga de datos de demo) — con
            -- created_at empatado, desempatar por id (aleatorio) revuelve el
            -- orden real y arma turnos con marcaciones de días distintos. En
            -- el uso real del Kiosko clock_in y created_at son prácticamente
            -- el mismo instante siempre, así que esto no cambia nada ahí.
            row_number() over (partition by re.profile_id order by re.clock_in, re.id) as rn
        from raw_entries re
    ),
    shift_marked as (
        select f.*, (is_explicit_start or rn = 1) as is_shift_start
        from flagged f
    ),
    -- NOTA: _payroll_calc_daily declara RETURNS TABLE(profile_id, work_date,
    -- cost, is_late, ...), lo que hace que PL/pgSQL cree variables internas
    -- con esos mismos nombres. Por eso, en TODO este cuerpo, cualquier
    -- columna cuyo nombre coincida con una columna de salida (profile_id,
    -- work_date, cost, is_late, minutes_work, etc.) se referencia SIEMPRE
    -- calificada con el alias de su CTE/tabla — nunca "a secas" — para que
    -- Postgres no la confunda con la variable de PL/pgSQL ("column
    -- reference is ambiguous").
    shift_seq_calc as (
        select sm.*,
            sum(case when is_shift_start then 1 else 0 end) over (
                partition by sm.profile_id order by sm.clock_in, sm.id rows unbounded preceding
            ) as shift_seq
        from shift_marked sm
    ),
    shifts as (
        select ssc.*,
            first_value(ssc.date) over (partition by ssc.profile_id, ssc.shift_seq order by ssc.clock_in, ssc.id) as anchor_date,
            lead(ssc.clock_in) over (partition by ssc.profile_id, ssc.shift_seq order by ssc.clock_in, ssc.id) as next_clock_in
        from shift_seq_calc ssc
    ),
    shifts_in_range as (
        select * from shifts where shifts.anchor_date between p_start_date and p_end_date
    ),
    -- Primera hora de entrada de cada turno (getFirstInTime): la primera
    -- marcación 'in' que no sea is_return; si no hay ninguna, la primera
    -- 'in' a secas. Se usa min(clock_in) como equivalente de "la más
    -- temprana por created_at" — válido porque dentro de un mismo turno
    -- clock_in y created_at avanzan juntos en la práctica.
    shift_first_in as (
        select sir.profile_id, sir.shift_seq,
            coalesce(
                min(sir.clock_in) filter (where sir.is_explicit_start),
                min(sir.clock_in) filter (where coalesce(sir.event_type, '') = 'in')
            ) as first_in_time
        from shifts_in_range sir
        group by sir.profile_id, sir.shift_seq
    ),
    -- Duración de cada marcación individual: misma cadena de respaldo que
    -- el frontend (total_hours "truthy" -> clock_out -> siguiente marcación
    -- del mismo turno -> "ahora" si es hoy -> 0).
    entry_minutes as (
        select s.*,
            case
                when s.total_hours is not null and s.total_hours <> 0
                    then s.clock_in + ((s.total_hours * 60) || ' minutes')::interval
                when s.clock_out is not null then s.clock_out
                when s.next_clock_in is not null then s.next_clock_in
                when s.date = v_today then now()
                else s.clock_in
            end as entry_end,
            case when s.total_hours is not null and s.total_hours <> 0 then s.total_hours * 60 end as diff_min_override
        from shifts_in_range s
    ),
    entry_minutes_final as (
        select em.*,
            coalesce(em.diff_min_override, greatest(0, extract(epoch from (em.entry_end - em.clock_in)) / 60)) as diff_min
        from entry_minutes em
    ),
    -- Clasificación de las marcaciones de TRABAJO ('in'/'out').
    classified as (
        select
            emf.profile_id, emf.anchor_date, emf.clock_in, emf.entry_end, emf.diff_min, emf.shift_seq,
            (extract(dow from emf.anchor_date) = 0) as is_sunday,
            pp.schedule_mode, pp.open_no_overtime, pp.open_max_ordinary_minutes,
            pp.hourly_rate_base, pp.hourly_rate_extra_day, pp.hourly_rate_extra_night, pp.hourly_rate_sunday_holiday,
            c.night_shift_start_time,
            (public._payroll_sched_payroll(pp.schedule_mode, pp.work_schedule, c.work_schedule, emf.anchor_date) ->> 'end') as day_schedule_end,
            sfi.first_in_time
        from entry_minutes_final emf
        join profile_pool_scoped pp on pp.id = emf.profile_id
        cross join company c
        left join shift_first_in sfi on sfi.profile_id = emf.profile_id and sfi.shift_seq = emf.shift_seq
        where coalesce(emf.event_type, '') in ('in', 'out')
    ),
    classify_results as (
        select cl.*, buckets.ordinary, buckets.extra_day, buckets.extra_night
        from classified cl
        cross join lateral public._payroll_classify_minutes(
            cl.clock_in, cl.entry_end, cl.night_shift_start_time, cl.day_schedule_end,
            cl.schedule_mode, cl.open_no_overtime, cl.open_max_ordinary_minutes,
            cl.first_in_time, v_tz
        ) buckets
    ),
    classify_results2 as (
        select cr.*,
            public._payroll_truthy_or(case when cr.is_sunday then cr.hourly_rate_sunday_holiday end, cr.hourly_rate_base) as base_rate
        from classify_results cr
    ),
    -- Domingo: todo el tiempo trabajado va al bucket extra_sunday (no se
    -- reparte en ordinary/extra_day/extra_night), pero el COSTO sigue
    -- usando el split ordinary/extra_day/extra_night calculado arriba,
    -- solo que con hourly_rate_sunday_holiday como tarifa base — igual que
    -- AdminDashboard.tsx.
    work_rows as (
        select
            cr.profile_id, cr.anchor_date as work_date, cr.diff_min as work_minutes,
            case when cr.is_sunday then 0 else cr.ordinary end as ordinary_minutes,
            case when cr.is_sunday then 0 else cr.extra_day end as extra_day_minutes,
            case when cr.is_sunday then 0 else cr.extra_night end as extra_night_minutes,
            case when cr.is_sunday then cr.diff_min else 0 end as extra_sunday_minutes,
            (cr.ordinary * cr.base_rate / 60
             + cr.extra_day * public._payroll_truthy_or(cr.hourly_rate_extra_day, cr.base_rate) / 60
             + cr.extra_night * public._payroll_truthy_or(cr.hourly_rate_extra_night, cr.base_rate) / 60
            ) as cost
        from classify_results2 cr
    ),
    -- Marcaciones que NO son trabajo (breakfast/lunch/active_pause/otro).
    break_rows as (
        select
            emf.profile_id, emf.anchor_date as work_date,
            case when emf.event_type = 'breakfast' then emf.diff_min else 0 end as breakfast_minutes,
            case when emf.event_type = 'lunch' then emf.diff_min else 0 end as lunch_minutes,
            case when emf.event_type = 'active_pause' then emf.diff_min else 0 end as active_pause_minutes,
            case when emf.event_type is distinct from 'breakfast'
                  and emf.event_type is distinct from 'lunch'
                  and emf.event_type is distinct from 'active_pause'
                 then emf.diff_min else 0 end as other_minutes
        from entry_minutes_final emf
        where emf.event_type is null or emf.event_type not in ('in', 'out')
    ),
    daily_work as (
        select wr.profile_id, wr.work_date,
            sum(wr.work_minutes) as minutes_work, sum(wr.ordinary_minutes) as ordinary_minutes,
            sum(wr.extra_day_minutes) as extra_day_minutes, sum(wr.extra_night_minutes) as extra_night_minutes,
            sum(wr.extra_sunday_minutes) as extra_sunday_minutes, sum(wr.cost) as cost
        from work_rows wr group by wr.profile_id, wr.work_date
    ),
    daily_breaks as (
        select br.profile_id, br.work_date,
            sum(br.breakfast_minutes) as breakfast_minutes, sum(br.lunch_minutes) as lunch_minutes,
            sum(br.active_pause_minutes) as active_pause_minutes, sum(br.other_minutes) as other_minutes
        from break_rows br group by br.profile_id, br.work_date
    ),
    -- Llegada tarde: un turno se marca tarde si su primera entrada supera la
    -- hora de inicio programada del día (regla _payroll_sched_late). Si dos
    -- turnos distintos del mismo empleado caen el mismo día calendario y
    -- ambos llegan tarde, aquí se cuenta como UN día tarde (bool_or), no
    -- como dos — divergencia menor y documentada respecto al conteo por
    -- turno del frontend (userSummaries.lates cuenta turnos, no días); caso
    -- extremadamente raro en la práctica (doble turno el mismo día).
    late_calc as (
        select s.profile_id, s.anchor_date as work_date,
            bool_or(
                sfi.first_in_time is not null
                and coalesce((public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'active')::boolean, false)
                and timezone(v_tz, sfi.first_in_time) > (timezone(v_tz, sfi.first_in_time))::date
                    + coalesce(nullif(public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'start', '')::time, time '00:00')
            ) as is_late
        from (select distinct sir.profile_id, sir.shift_seq, sir.anchor_date from shifts_in_range sir) s
        join shift_first_in sfi on sfi.profile_id = s.profile_id and sfi.shift_seq = s.shift_seq
        join profile_pool_scoped pp on pp.id = s.profile_id
        cross join company c
        group by s.profile_id, s.anchor_date
    ),
    all_days as (
        select generate_series(p_start_date, p_end_date, interval '1 day')::date as work_date
    ),
    -- Ausencia no justificada: día con horario activo (regla
    -- _payroll_sched_late, misma que usa el frontend para este chequeo),
    -- sin ningún turno registrado ese día, sin novedad aprobada que lo
    -- cubra (ver divergencia deliberada documentada en el encabezado), y
    -- nunca un día futuro.
    absence_calc as (
        select pp.id as profile_id, ad.work_date,
            (
                coalesce((public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, ad.work_date) ->> 'active')::boolean, false)
                and ad.work_date <= v_today
                and not exists (
                    select 1 from shifts_in_range sir
                    where sir.profile_id = pp.id and sir.anchor_date = ad.work_date
                )
                and not exists (
                    select 1 from public."InA_leave_requests" lr
                    where lr.profile_id = pp.id and lr.status = 'approved'
                      and lr.start_date <= ad.work_date and lr.end_date >= ad.work_date
                )
            ) as is_unjustified_absence
        from profile_pool_scoped pp
        cross join all_days ad
        cross join company c
    ),
    grid as (
        select pp.id as profile_id, pp.full_name, pp.national_id, ad.work_date
        from profile_pool_scoped pp
        cross join all_days ad
    )
    select
        g.profile_id, g.full_name, g.national_id, g.work_date,
        coalesce(dw.minutes_work, 0), coalesce(dw.ordinary_minutes, 0),
        coalesce(dw.extra_day_minutes, 0), coalesce(dw.extra_night_minutes, 0), coalesce(dw.extra_sunday_minutes, 0),
        coalesce(db.breakfast_minutes, 0), coalesce(db.lunch_minutes, 0),
        coalesce(db.active_pause_minutes, 0), coalesce(db.other_minutes, 0),
        coalesce(dw.cost, 0), coalesce(lc.is_late, false), coalesce(ac.is_unjustified_absence, false)
    from grid g
    left join daily_work dw on dw.profile_id = g.profile_id and dw.work_date = g.work_date
    left join daily_breaks db on db.profile_id = g.profile_id and db.work_date = g.work_date
    left join late_calc lc on lc.profile_id = g.profile_id and lc.work_date = g.work_date
    left join absence_calc ac on ac.profile_id = g.profile_id and ac.work_date = g.work_date
    order by g.full_name, g.work_date;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3. Funciones públicas: resumen del período y desglose diario. El chequeo
--    de autorización (admin de la organización dueña de la sede) vive AQUÍ,
--    en la superficie pública — no dentro de _payroll_calc_daily — para que
--    el motor de cálculo se pueda probar directamente (ver sección 6) sin
--    necesitar una sesión autenticada.
-- ----------------------------------------------------------------------------
create or replace function public.payroll_period_summary(
    p_company_id uuid, p_start_date date, p_end_date date, p_profile_id uuid default null
) returns table (
    profile_id uuid, name text, national_id text, minutes_work numeric,
    breakfast numeric, lunch numeric, active_pause numeric, others numeric,
    lates int, extra_day numeric, extra_night numeric, extra_sunday numeric,
    total_cost numeric, unjustified_absences int
)
language plpgsql stable security definer set search_path = public as $$
declare
    v_org_id uuid;
begin
    select organization_id into v_org_id from public."InA_companies" where id = p_company_id;
    if v_org_id is null then
        raise exception 'Sede % no encontrada.', p_company_id;
    end if;
    if not public.is_admin_of_org(v_org_id) then
        raise exception 'No tiene permiso de administrador sobre esta organización.';
    end if;

    return query
    select d.profile_id, d.full_name, d.national_id,
        sum(d.minutes_work), sum(d.breakfast_minutes), sum(d.lunch_minutes),
        sum(d.active_pause_minutes), sum(d.other_minutes),
        count(*) filter (where d.is_late)::int,
        sum(d.extra_day_minutes), sum(d.extra_night_minutes), sum(d.extra_sunday_minutes),
        sum(d.cost), count(*) filter (where d.is_unjustified_absence)::int
    from public._payroll_calc_daily(p_company_id, p_start_date, p_end_date, p_profile_id) d
    group by d.profile_id, d.full_name, d.national_id;
end;
$$;

create or replace function public.payroll_daily_breakdown(
    p_company_id uuid, p_start_date date, p_end_date date, p_profile_id uuid default null
) returns table (
    profile_id uuid, full_name text, national_id text, work_date date,
    minutes_work numeric, ordinary_minutes numeric, extra_day_minutes numeric,
    extra_night_minutes numeric, extra_sunday_minutes numeric,
    breakfast_minutes numeric, lunch_minutes numeric, active_pause_minutes numeric, other_minutes numeric,
    cost numeric, is_late boolean, is_unjustified_absence boolean
)
language plpgsql stable security definer set search_path = public as $$
declare
    v_org_id uuid;
begin
    select organization_id into v_org_id from public."InA_companies" where id = p_company_id;
    if v_org_id is null then
        raise exception 'Sede % no encontrada.', p_company_id;
    end if;
    if not public.is_admin_of_org(v_org_id) then
        raise exception 'No tiene permiso de administrador sobre esta organización.';
    end if;

    return query select * from public._payroll_calc_daily(p_company_id, p_start_date, p_end_date, p_profile_id);
end;
$$;


-- ----------------------------------------------------------------------------
-- 4. Permisos
-- ----------------------------------------------------------------------------
revoke execute on function public._payroll_overlap_minutes(timestamp, timestamp, timestamp, timestamp) from public;
revoke execute on function public._payroll_truthy_or(numeric[]) from public;
revoke execute on function public._payroll_day_code(date) from public;
revoke execute on function public._payroll_sched_late(text, jsonb, jsonb, date) from public;
revoke execute on function public._payroll_sched_payroll(text, jsonb, jsonb, date) from public;
revoke execute on function public._payroll_classify_minutes(timestamptz, timestamptz, time, text, text, boolean, int, timestamptz, text) from public;
revoke execute on function public._payroll_calc_daily(uuid, date, date, uuid) from public;

grant execute on function public.payroll_period_summary(uuid, date, date, uuid) to authenticated;
grant execute on function public.payroll_daily_breakdown(uuid, date, date, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. Utilidades de autoprueba (se dejan instaladas para futuras migraciones
--    del mismo estilo; no otorgadas a PUBLIC).
-- ----------------------------------------------------------------------------
create or replace function public._payroll_selftest_check(
    p_failures text[], p_scenario text, p_field text, p_actual numeric, p_expected numeric, p_tolerance numeric default 0.5
) returns text[]
language sql immutable as $$
    select case when abs(coalesce(p_actual, 0) - p_expected) > p_tolerance
        then p_failures || format('[%s / %s] esperado=%s actual=%s', p_scenario, p_field, p_expected, coalesce(p_actual, 0))
        else p_failures
    end;
$$;

create or replace function public._payroll_selftest_check_bool(
    p_failures text[], p_scenario text, p_field text, p_actual boolean, p_expected boolean
) returns text[]
language sql immutable as $$
    select case when coalesce(p_actual, false) is distinct from p_expected
        then p_failures || format('[%s / %s] esperado=%s actual=%s', p_scenario, p_field, p_expected, coalesce(p_actual, false))
        else p_failures
    end;
$$;

revoke execute on function public._payroll_selftest_check(text[], text, text, numeric, numeric, numeric) from public;
revoke execute on function public._payroll_selftest_check_bool(text[], text, text, boolean, boolean) from public;


-- ----------------------------------------------------------------------------
-- 6. AUTOPRUEBAS — datos de un organización centinela (prefijo 'ffffffff-',
--    nombre 'ZZ_SELFTEST_PAYROLL_ORG'), se insertan, se verifican contra
--    valores calculados a mano, y se BORRAN antes de terminar, sin importar
--    el resultado. Si algo no coincide, TODA la migración se revierte (el
--    editor SQL de Supabase ejecuta el script pegado como una transacción
--    implícita) — así un RPC roto nunca queda instalado. Todas las fechas
--    de prueba son fijas en el pasado (enero 2024), no dependen de "hoy".
-- ----------------------------------------------------------------------------
do $$
declare
    v_org_id uuid := 'ffffffff-0000-0000-0000-000000000001';
    v_company_id uuid := 'ffffffff-0000-0000-0000-000000000002';
    v_p1 uuid := 'ffffffff-0000-0000-0000-000000000011'; -- horario de sede ("branch")
    v_p2 uuid := 'ffffffff-0000-0000-0000-000000000012'; -- horario abierto, sin overtime
    v_p3 uuid := 'ffffffff-0000-0000-0000-000000000013'; -- horario abierto, con tope
    v_p4 uuid := 'ffffffff-0000-0000-0000-000000000014'; -- para ausencias/novedades
    v_failures text[] := array[]::text[];
    v_row record;
begin
    if exists (select 1 from public."InA_organizations" where id = v_org_id or name = 'ZZ_SELFTEST_PAYROLL_ORG') then
        raise exception 'PAYROLL_RPC_SELFTEST: ya existe una organización centinela de una corrida anterior sin limpiar. Aborta por seguridad — revisa manualmente antes de reintentar.';
    end if;

    -- ---- Datos de prueba ----
    insert into public."InA_organizations" (id, name) values (v_org_id, 'ZZ_SELFTEST_PAYROLL_ORG');

    insert into public."InA_companies" (id, organization_id, name, night_shift_start_time, work_schedule)
    values (v_company_id, v_org_id, 'ZZ_SELFTEST_PAYROLL_COMPANY', '21:00:00', jsonb_build_object(
        'mon', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', true),
        'tue', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', true),
        'wed', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', true),
        'thu', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', true),
        'fri', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', true),
        'sat', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', false),
        'sun', jsonb_build_object('start', '08:00', 'end', '17:00', 'active', false)
    ));

    insert into public."InA_profiles" (
        id, organization_id, company_id, full_name, national_id, role, schedule_mode,
        hourly_rate_base, hourly_rate_extra_day, hourly_rate_extra_night, hourly_rate_sunday_holiday,
        open_no_overtime, open_max_ordinary_minutes, work_schedule
    ) values
        (v_p1, v_org_id, v_company_id, 'ZZ Selftest Branch', 'ZZ-001', 'employee', 'branch', 10000, 15000, 20000, 25000, false, 480, '{}'::jsonb),
        (v_p2, v_org_id, v_company_id, 'ZZ Selftest Open SinOvertime', 'ZZ-002', 'employee', 'open', 10000, 15000, 20000, 25000, true, 480, '{}'::jsonb),
        (v_p3, v_org_id, v_company_id, 'ZZ Selftest Open ConTope', 'ZZ-003', 'employee', 'open', 10000, 15000, 20000, 25000, false, 480, '{}'::jsonb),
        (v_p4, v_org_id, v_company_id, 'ZZ Selftest Ausencias', 'ZZ-004', 'employee', 'branch', 10000, 15000, 20000, 25000, false, 480, '{}'::jsonb);

    -- A: P1 lunes 2024-01-01, turno ordinario 08:00-17:00 (540 min, todo ordinario)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-01', '2024-01-01 08:00:00-05', null, '2024-01-01 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-01', '2024-01-01 17:00:00-05', '2024-01-01 17:00:00-05', '2024-01-01 17:00:00-05', true);

    -- B: P1 martes 2024-01-02, llegada tarde (08:20) + 2h extra diurna (hasta 19:00)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-02', '2024-01-02 08:20:00-05', null, '2024-01-02 08:20:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-02', '2024-01-02 19:00:00-05', '2024-01-02 19:00:00-05', '2024-01-02 19:00:00-05', true);

    -- C: P1 miércoles 2024-01-03, turno cruza a horario nocturno (08:00-22:30)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-03', '2024-01-03 08:00:00-05', null, '2024-01-03 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-03', '2024-01-03 22:30:00-05', '2024-01-03 22:30:00-05', '2024-01-03 22:30:00-05', true);

    -- D: P1 domingo 2024-01-07, 08:00-12:00 (240 min, todo a extra_sunday)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-07', '2024-01-07 08:00:00-05', null, '2024-01-07 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-07', '2024-01-07 12:00:00-05', '2024-01-07 12:00:00-05', '2024-01-07 12:00:00-05', true);

    -- G: P1 jueves 2024-01-04, pausa desayuno + regreso (is_return) -> UN solo turno
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified, metadata) values
        (v_p1, v_company_id, 'in', '2024-01-04', '2024-01-04 08:00:00-05', null, '2024-01-04 08:00:00-05', true, '{}'::jsonb),
        (v_p1, v_company_id, 'breakfast', '2024-01-04', '2024-01-04 10:00:00-05', null, '2024-01-04 10:00:00-05', true, '{}'::jsonb),
        (v_p1, v_company_id, 'in', '2024-01-04', '2024-01-04 10:15:00-05', null, '2024-01-04 10:15:00-05', true, jsonb_build_object('is_return', true)),
        (v_p1, v_company_id, 'out', '2024-01-04', '2024-01-04 17:00:00-05', '2024-01-04 17:00:00-05', '2024-01-04 17:00:00-05', true, '{}'::jsonb);

    -- H: P1 viernes 2024-01-05, 'in' sin cierre y sin siguiente marcación, fecha pasada -> diffMin=0
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-05', '2024-01-05 08:00:00-05', null, '2024-01-05 08:00:00-05', true);

    -- I: P1 sábado 2024-01-06, total_hours=2 explícito (debe ignorar clock_out de 15h)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, total_hours, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-06', '2024-01-06 08:00:00-05', '2024-01-06 23:00:00-05', 2, '2024-01-06 08:00:00-05', true);

    -- E: P2 (open, sin overtime) 2024-01-01, 06:00-20:00 (14h, todo ordinario)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p2, v_company_id, 'in', '2024-01-01', '2024-01-01 06:00:00-05', null, '2024-01-01 06:00:00-05', true),
        (v_p2, v_company_id, 'out', '2024-01-01', '2024-01-01 20:00:00-05', '2024-01-01 20:00:00-05', '2024-01-01 20:00:00-05', true);

    -- K: P2 (open, sin overtime) 2024-01-04 08:00 a 2024-01-06 08:00 (48h) -> fuerza el
    --    remanente de redondeo de extra_night (ver cálculo en el plan)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p2, v_company_id, 'in', '2024-01-04', '2024-01-04 08:00:00-05', null, '2024-01-04 08:00:00-05', true),
        (v_p2, v_company_id, 'out', '2024-01-06', '2024-01-06 08:00:00-05', '2024-01-06 08:00:00-05', '2024-01-06 08:00:00-05', true);

    -- F: P3 (open, tope 480 min) 2024-01-01, 06:00-15:00 (540 min: 480 ordinario + 60 extra diurna)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p3, v_company_id, 'in', '2024-01-01', '2024-01-01 06:00:00-05', null, '2024-01-01 06:00:00-05', true),
        (v_p3, v_company_id, 'out', '2024-01-01', '2024-01-01 15:00:00-05', '2024-01-01 15:00:00-05', '2024-01-01 15:00:00-05', true);

    -- J: P4 sin ninguna marcación en todo el rango. Novedad aprobada solo el 2024-01-03.
    insert into public."InA_leave_requests" (profile_id, type, start_date, end_date, status, notes)
    values (v_p4, 'vacaciones', '2024-01-03', '2024-01-03', 'approved', 'ZZ selftest leave');

    -- ================= Verificaciones =================

    -- A
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-01';
    v_failures := public._payroll_selftest_check(v_failures, 'A lunes ordinario', 'minutes_work', v_row.minutes_work, 540);
    v_failures := public._payroll_selftest_check(v_failures, 'A lunes ordinario', 'ordinary_minutes', v_row.ordinary_minutes, 540);
    v_failures := public._payroll_selftest_check(v_failures, 'A lunes ordinario', 'cost', v_row.cost, 90000);
    v_failures := public._payroll_selftest_check_bool(v_failures, 'A lunes ordinario', 'is_late', v_row.is_late, false);

    -- B
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-02';
    v_failures := public._payroll_selftest_check(v_failures, 'B martes tarde+extra', 'minutes_work', v_row.minutes_work, 640);
    v_failures := public._payroll_selftest_check(v_failures, 'B martes tarde+extra', 'ordinary_minutes', v_row.ordinary_minutes, 520);
    v_failures := public._payroll_selftest_check(v_failures, 'B martes tarde+extra', 'extra_day_minutes', v_row.extra_day_minutes, 120);
    v_failures := public._payroll_selftest_check(v_failures, 'B martes tarde+extra', 'cost', v_row.cost, 116666.67, 1);
    v_failures := public._payroll_selftest_check_bool(v_failures, 'B martes tarde+extra', 'is_late', v_row.is_late, true);

    -- C
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-03';
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'ordinary_minutes', v_row.ordinary_minutes, 540);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'extra_day_minutes', v_row.extra_day_minutes, 240);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'extra_night_minutes', v_row.extra_night_minutes, 90);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'cost', v_row.cost, 180000);

    -- D
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-07';
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo', 'minutes_work', v_row.minutes_work, 240);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo', 'ordinary_minutes', v_row.ordinary_minutes, 0);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo', 'extra_sunday_minutes', v_row.extra_sunday_minutes, 240);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo', 'cost', v_row.cost, 100000);

    -- G
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-04';
    v_failures := public._payroll_selftest_check(v_failures, 'G desayuno+regreso', 'minutes_work', v_row.minutes_work, 525);
    v_failures := public._payroll_selftest_check(v_failures, 'G desayuno+regreso', 'breakfast_minutes', v_row.breakfast_minutes, 15);
    v_failures := public._payroll_selftest_check(v_failures, 'G desayuno+regreso', 'cost', v_row.cost, 87500);

    -- H
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-05';
    v_failures := public._payroll_selftest_check(v_failures, 'H turno abierto pasado', 'minutes_work', v_row.minutes_work, 0);

    -- I
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-06';
    v_failures := public._payroll_selftest_check(v_failures, 'I total_hours explicito', 'minutes_work', v_row.minutes_work, 120);
    v_failures := public._payroll_selftest_check(v_failures, 'I total_hours explicito', 'cost', v_row.cost, 20000);

    -- E
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p2) where work_date = '2024-01-01';
    v_failures := public._payroll_selftest_check(v_failures, 'E open sin overtime', 'minutes_work', v_row.minutes_work, 840);
    v_failures := public._payroll_selftest_check(v_failures, 'E open sin overtime', 'ordinary_minutes', v_row.ordinary_minutes, 840);
    v_failures := public._payroll_selftest_check(v_failures, 'E open sin overtime', 'extra_day_minutes', v_row.extra_day_minutes, 0);

    -- K (remanente de redondeo)
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p2) where work_date = '2024-01-04';
    v_failures := public._payroll_selftest_check(v_failures, 'K remanente 48h', 'minutes_work', v_row.minutes_work, 2880);
    v_failures := public._payroll_selftest_check(v_failures, 'K remanente 48h', 'ordinary_minutes', v_row.ordinary_minutes, 2220);
    v_failures := public._payroll_selftest_check(v_failures, 'K remanente 48h', 'extra_night_minutes', v_row.extra_night_minutes, 660);

    -- F
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p3) where work_date = '2024-01-01';
    v_failures := public._payroll_selftest_check(v_failures, 'F open con tope', 'ordinary_minutes', v_row.ordinary_minutes, 480);
    v_failures := public._payroll_selftest_check(v_failures, 'F open con tope', 'extra_day_minutes', v_row.extra_day_minutes, 60);
    v_failures := public._payroll_selftest_check(v_failures, 'F open con tope', 'cost', v_row.cost, 95000);

    -- J: ausencia no justificada (martes, sin novedad) vs cubierta por novedad (miércoles)
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p4) where work_date = '2024-01-02';
    v_failures := public._payroll_selftest_check_bool(v_failures, 'J ausencia sin novedad', 'is_unjustified_absence', v_row.is_unjustified_absence, true);

    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p4) where work_date = '2024-01-03';
    v_failures := public._payroll_selftest_check_bool(v_failures, 'J ausencia con novedad aprobada', 'is_unjustified_absence', v_row.is_unjustified_absence, false);

    -- L: agregado del período completo para P1 (valida la agregación de
    -- payroll_period_summary de punta a punta contra totales calculados a mano)
    select
        sum(minutes_work) as minutes_work, sum(cost) as total_cost,
        count(*) filter (where is_late)::int as lates,
        sum(extra_day_minutes) as extra_day, sum(extra_night_minutes) as extra_night,
        sum(extra_sunday_minutes) as extra_sunday, sum(breakfast_minutes) as breakfast,
        count(*) filter (where is_unjustified_absence)::int as unjustified_absences
    into v_row
    from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'minutes_work', v_row.minutes_work, 2935);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'total_cost', v_row.total_cost, 594166.67, 1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'lates', v_row.lates, 1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_day', v_row.extra_day, 360);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_night', v_row.extra_night, 90);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_sunday', v_row.extra_sunday, 240);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'breakfast', v_row.breakfast, 15);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'unjustified_absences', v_row.unjustified_absences, 0);

    -- ---- Limpieza incondicional (corre siempre, haya o no fallos) ----
    delete from public."InA_leave_requests" where profile_id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_time_entries" where profile_id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_profiles" where id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_companies" where id = v_company_id;
    delete from public."InA_organizations" where id = v_org_id;

    if array_length(v_failures, 1) > 0 then
        raise exception 'PAYROLL_RPC_SELFTEST FALLÓ (% de 42 verificaciones):
%', array_length(v_failures, 1), array_to_string(v_failures, E'\n');
    end if;

    raise notice 'PAYROLL_RPC_SELFTEST: 42/42 VERIFICACIONES OK';
end;
$$;

-- Verificación final (visible en la pestaña de resultados del SQL Editor)
select 'PAYROLL_RPC_SELFTEST: si ves esta fila sin errores arriba, las autopruebas pasaron y la migración quedó instalada.' as resultado;
