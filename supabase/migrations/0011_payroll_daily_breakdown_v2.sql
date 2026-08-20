-- ============================================================================
-- MIGRACIÓN 0011: fix de domingo en el RPC + campos nuevos para Informes
-- ============================================================================
-- CONTEXTO: el 20 de agosto se corrigió en el navegador (calculations.ts,
-- AdminDashboard.tsx) un bug real de plata: las tarifas configurables
-- "Extra Dom Diurna/Nocturna" (hourly_rate_sunday_holiday_extra_day/night)
-- nunca se usaban en ningún cálculo — el domingo se pagaba con las tarifas
-- de extra de un día de semana normal. Se confirmó con el usuario la regla
-- correcta: el domingo NO tiene pivote ordinaria/extra, todo el bloque se
-- paga como dominical, la única separación es diurno/nocturno.
--
-- El RPC de 0010 quedó con la lógica vieja (no está en el camino de
-- producción hoy — el dashboard sigue calculando client-side — pero el
-- módulo de Informes nuevo SÍ va a depender de este RPC, así que debe
-- quedar corregido antes de construir el primer informe sobre él).
--
-- Además, esta migración agrega 2 columnas nuevas a la salida diaria,
-- necesarias para el Informe 1 (detalle por empleado/día):
--   - leave_type: tipo de novedad aprobada que cubre ese día (si aplica),
--     null si no hay ninguna. Solo considera novedades APROBADAS (mismo
--     criterio que ya usa is_unjustified_absence) — no se agrega un
--     leave_status separado porque sería trivialmente 'approved' siempre.
--   - late_minutes: magnitud de la llegada tarde (antes solo había
--     is_late boolean). Si el empleado tuvo más de un turno el mismo día
--     y llegó tarde en varios, se toma el peor caso (max), mismo criterio
--     de "un valor por día" que ya usa is_late (bool_or).
--
-- No se toca 0010 (ya aplicada en ambas instancias — las migraciones de
-- este repo son aditivas, nunca se edita una ya aplicada). Esta migración
-- reemplaza las 3 funciones que cambian (_payroll_calc_daily,
-- payroll_daily_breakdown, payroll_period_summary sigue igual de firma
-- pero se recrea junto con las demás por orden de dependencia) vía
-- DROP + CREATE, porque Postgres no permite CREATE OR REPLACE cuando
-- cambia el RETURNS TABLE. El resto de funciones auxiliares de 0010
-- (_payroll_overlap_minutes, _payroll_truthy_or, _payroll_day_code,
-- _payroll_sched_late, _payroll_sched_payroll, _payroll_classify_minutes,
-- _payroll_selftest_check*) no cambian y se siguen usando tal cual.
--
-- Ejecuta este script completo de una sola vez en el SQL Editor de
-- Supabase. Las autopruebas al final revierten TODA la migración si algo
-- no coincide (misma mecánica que 0010).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Función nueva: split diurno/nocturno de domingo, sin pivote
--    ordinaria/extra. Traducción 1:1 de splitSundayMinutes() en
--    frontend/src/utils/calculations.ts.
-- ----------------------------------------------------------------------------
create or replace function public._payroll_split_sunday_minutes(
    p_start timestamptz,
    p_end timestamptz,
    p_night_shift_start time,
    p_tz text default 'America/Bogota'
) returns table (day_minutes numeric, night_minutes numeric)
language plpgsql stable as $$
declare
    v_start_local timestamp := timezone(p_tz, p_start);
    v_end_local timestamp := timezone(p_tz, p_end);
    v_total_min numeric;
    v_night_threshold timestamp;
    v_day numeric;
    v_night numeric;
    v_accounted numeric;
begin
    v_total_min := greatest(0, extract(epoch from (v_end_local - v_start_local)) / 60);
    if v_total_min = 0 then
        return query select 0::numeric, 0::numeric;
        return;
    end if;

    v_night_threshold := v_start_local::date + coalesce(p_night_shift_start, time '21:00');

    v_day := public._payroll_overlap_minutes(v_start_local, v_end_local, v_start_local - interval '24 hours', v_night_threshold);
    v_night := public._payroll_overlap_minutes(v_start_local, v_end_local, v_night_threshold, v_night_threshold + interval '24 hours');

    v_accounted := v_day + v_night;
    if v_accounted < v_total_min - 0.01 then
        v_night := v_night + (v_total_min - v_accounted);
    end if;

    return query select v_day, v_night;
end;
$$;

revoke execute on function public._payroll_split_sunday_minutes(timestamptz, timestamptz, time, text) from public;


-- ----------------------------------------------------------------------------
-- 2. Recrear el motor privado y las 2 funciones públicas que dependen de su
--    firma (drop + create porque cambia el RETURNS TABLE).
-- ----------------------------------------------------------------------------
drop function if exists public.payroll_daily_breakdown(uuid, date, date, uuid);
drop function if exists public.payroll_period_summary(uuid, date, date, uuid);
drop function if exists public._payroll_calc_daily(uuid, date, date, uuid);

create function public._payroll_calc_daily(
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
    is_unjustified_absence boolean,
    leave_type text,
    late_minutes numeric
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
            row_number() over (partition by re.profile_id order by re.clock_in, re.id) as rn
        from raw_entries re
    ),
    shift_marked as (
        select f.*, (is_explicit_start or rn = 1) as is_shift_start
        from flagged f
    ),
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
    shift_first_in as (
        select sir.profile_id, sir.shift_seq,
            coalesce(
                min(sir.clock_in) filter (where sir.is_explicit_start),
                min(sir.clock_in) filter (where coalesce(sir.event_type, '') = 'in')
            ) as first_in_time
        from shifts_in_range sir
        group by sir.profile_id, sir.shift_seq
    ),
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
    classified as (
        select
            emf.profile_id, emf.anchor_date, emf.clock_in, emf.entry_end, emf.diff_min, emf.shift_seq,
            (extract(dow from emf.anchor_date) = 0) as is_sunday,
            pp.schedule_mode, pp.open_no_overtime, pp.open_max_ordinary_minutes,
            pp.hourly_rate_base, pp.hourly_rate_extra_day, pp.hourly_rate_extra_night, pp.hourly_rate_sunday_holiday,
            pp.hourly_rate_sunday_holiday_extra_night,
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
        select cl.*, buckets.ordinary, buckets.extra_day, buckets.extra_night,
            sunday_buckets.day_minutes as sunday_day_minutes, sunday_buckets.night_minutes as sunday_night_minutes
        from classified cl
        cross join lateral public._payroll_classify_minutes(
            cl.clock_in, cl.entry_end, cl.night_shift_start_time, cl.day_schedule_end,
            cl.schedule_mode, cl.open_no_overtime, cl.open_max_ordinary_minutes,
            cl.first_in_time, v_tz
        ) buckets
        cross join lateral public._payroll_split_sunday_minutes(
            cl.clock_in, cl.entry_end, cl.night_shift_start_time, v_tz
        ) sunday_buckets
    ),
    classify_results2 as (
        select cr.*,
            public._payroll_truthy_or(case when cr.is_sunday then cr.hourly_rate_sunday_holiday end, cr.hourly_rate_base) as base_rate,
            public._payroll_truthy_or(
                cr.hourly_rate_sunday_holiday_extra_night,
                public._payroll_truthy_or(case when cr.is_sunday then cr.hourly_rate_sunday_holiday end, cr.hourly_rate_base)
            ) as sunday_night_rate
        from classify_results cr
    ),
    -- Domingo: sin pivote ordinaria/extra (confirmado con el usuario
    -- 2026-08-20) — todo el bloque va a extra_sunday_minutes, y el costo se
    -- calcula con el split diurno/nocturno propio (sunday_day_minutes/
    -- sunday_night_minutes), usando hourly_rate_sunday_holiday_extra_night
    -- para la franja nocturna en vez de la tarifa de extra de semana.
    work_rows as (
        select
            cr.profile_id, cr.anchor_date as work_date, cr.diff_min as work_minutes,
            case when cr.is_sunday then 0 else cr.ordinary end as ordinary_minutes,
            case when cr.is_sunday then 0 else cr.extra_day end as extra_day_minutes,
            case when cr.is_sunday then 0 else cr.extra_night end as extra_night_minutes,
            case when cr.is_sunday then cr.diff_min else 0 end as extra_sunday_minutes,
            case when cr.is_sunday
                then (cr.sunday_day_minutes * cr.base_rate / 60 + cr.sunday_night_minutes * cr.sunday_night_rate / 60)
                else (cr.ordinary * cr.base_rate / 60
                     + cr.extra_day * public._payroll_truthy_or(cr.hourly_rate_extra_day, cr.base_rate) / 60
                     + cr.extra_night * public._payroll_truthy_or(cr.hourly_rate_extra_night, cr.base_rate) / 60)
            end as cost
        from classify_results2 cr
    ),
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
    -- late_calc: además de is_late (bool_or, como antes), se agrega
    -- late_minutes (magnitud, peor caso del día si hubo más de un turno).
    late_calc as (
        select s.profile_id, s.anchor_date as work_date,
            bool_or(
                sfi.first_in_time is not null
                and coalesce((public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'active')::boolean, false)
                and timezone(v_tz, sfi.first_in_time) > (timezone(v_tz, sfi.first_in_time))::date
                    + coalesce(nullif(public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'start', '')::time, time '00:00')
            ) as is_late,
            max(
                case when sfi.first_in_time is not null
                    and coalesce((public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'active')::boolean, false)
                then greatest(0, extract(epoch from (
                    timezone(v_tz, sfi.first_in_time) - (
                        (timezone(v_tz, sfi.first_in_time))::date
                        + coalesce(nullif(public._payroll_sched_late(pp.schedule_mode, pp.work_schedule, c.work_schedule, s.anchor_date) ->> 'start', '')::time, time '00:00')
                    )
                )) / 60)
                else 0 end
            ) as late_minutes
        from (select distinct sir.profile_id, sir.shift_seq, sir.anchor_date from shifts_in_range sir) s
        join shift_first_in sfi on sfi.profile_id = s.profile_id and sfi.shift_seq = s.shift_seq
        join profile_pool_scoped pp on pp.id = s.profile_id
        cross join company c
        group by s.profile_id, s.anchor_date
    ),
    all_days as (
        select generate_series(p_start_date, p_end_date, interval '1 day')::date as work_date
    ),
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
    -- leave_daily: tipo de novedad APROBADA que cubre el día (si hay más de
    -- una superpuesta, caso raro, se toma la de start_date más reciente).
    -- No se expone leave_status por separado: al filtrar solo 'approved'
    -- sería trivialmente constante, sin valor informativo adicional.
    leave_daily as (
        select pp.id as profile_id, ad.work_date,
            (select lr.type from public."InA_leave_requests" lr
             where lr.profile_id = pp.id and lr.status = 'approved'
               and lr.start_date <= ad.work_date and lr.end_date >= ad.work_date
             order by lr.start_date desc limit 1) as leave_type
        from profile_pool_scoped pp
        cross join all_days ad
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
        coalesce(dw.cost, 0), coalesce(lc.is_late, false), coalesce(ac.is_unjustified_absence, false),
        ld.leave_type, coalesce(lc.late_minutes, 0)
    from grid g
    left join daily_work dw on dw.profile_id = g.profile_id and dw.work_date = g.work_date
    left join daily_breaks db on db.profile_id = g.profile_id and db.work_date = g.work_date
    left join late_calc lc on lc.profile_id = g.profile_id and lc.work_date = g.work_date
    left join absence_calc ac on ac.profile_id = g.profile_id and ac.work_date = g.work_date
    left join leave_daily ld on ld.profile_id = g.profile_id and ld.work_date = g.work_date
    order by g.full_name, g.work_date;
end;
$$;

revoke execute on function public._payroll_calc_daily(uuid, date, date, uuid) from public;

create function public.payroll_daily_breakdown(
    p_company_id uuid, p_start_date date, p_end_date date, p_profile_id uuid default null
) returns table (
    profile_id uuid, full_name text, national_id text, work_date date,
    minutes_work numeric, ordinary_minutes numeric, extra_day_minutes numeric,
    extra_night_minutes numeric, extra_sunday_minutes numeric,
    breakfast_minutes numeric, lunch_minutes numeric, active_pause_minutes numeric, other_minutes numeric,
    cost numeric, is_late boolean, is_unjustified_absence boolean,
    leave_type text, late_minutes numeric
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

-- payroll_period_summary: firma de salida NO cambia (sigue sin
-- leave_type/late_minutes, no tendría sentido agregado sin más contexto).
-- Se recrea igual porque _payroll_calc_daily se recreó arriba (drop+create),
-- y esta función la referencia en su cuerpo.
create function public.payroll_period_summary(
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

grant execute on function public.payroll_period_summary(uuid, date, date, uuid) to authenticated;
grant execute on function public.payroll_daily_breakdown(uuid, date, date, uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. AUTOPRUEBAS — mismo patrón/organización centinela que 0010. Reutiliza
--    los mismos 4 perfiles y escenarios A-L; solo cambia el escenario D
--    (domingo) para que cruce la franja nocturna y ejercite de verdad el fix
--    (con la lógica vieja, este escenario habría dado un costo distinto), y
--    se agregan 3 verificaciones nuevas (late_minutes, leave_type x2).
-- ----------------------------------------------------------------------------
do $$
declare
    v_org_id uuid := 'ffffffff-0000-0000-0000-000000000001';
    v_company_id uuid := 'ffffffff-0000-0000-0000-000000000002';
    v_p1 uuid := 'ffffffff-0000-0000-0000-000000000011';
    v_p2 uuid := 'ffffffff-0000-0000-0000-000000000012';
    v_p3 uuid := 'ffffffff-0000-0000-0000-000000000013';
    v_p4 uuid := 'ffffffff-0000-0000-0000-000000000014';
    v_failures text[] := array[]::text[];
    v_row record;
begin
    if exists (select 1 from public."InA_organizations" where id = v_org_id or name = 'ZZ_SELFTEST_PAYROLL_ORG') then
        raise exception 'PAYROLL_RPC_SELFTEST: ya existe una organización centinela de una corrida anterior sin limpiar. Aborta por seguridad — revisa manualmente antes de reintentar.';
    end if;

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
        hourly_rate_sunday_holiday_extra_night,
        open_no_overtime, open_max_ordinary_minutes, work_schedule
    ) values
        (v_p1, v_org_id, v_company_id, 'ZZ Selftest Branch', 'ZZ-001', 'employee', 'branch', 10000, 15000, 20000, 25000, 30000, false, 480, '{}'::jsonb),
        (v_p2, v_org_id, v_company_id, 'ZZ Selftest Open SinOvertime', 'ZZ-002', 'employee', 'open', 10000, 15000, 20000, 25000, 30000, true, 480, '{}'::jsonb),
        (v_p3, v_org_id, v_company_id, 'ZZ Selftest Open ConTope', 'ZZ-003', 'employee', 'open', 10000, 15000, 20000, 25000, 30000, false, 480, '{}'::jsonb),
        (v_p4, v_org_id, v_company_id, 'ZZ Selftest Ausencias', 'ZZ-004', 'employee', 'branch', 10000, 15000, 20000, 25000, 30000, false, 480, '{}'::jsonb);

    -- A: P1 lunes 2024-01-01, turno ordinario 08:00-17:00 (540 min, todo ordinario)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-01', '2024-01-01 08:00:00-05', null, '2024-01-01 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-01', '2024-01-01 17:00:00-05', '2024-01-01 17:00:00-05', '2024-01-01 17:00:00-05', true);

    -- B: P1 martes 2024-01-02, llegada tarde (08:20, 20 min tarde) + 2h extra diurna (hasta 19:00)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-02', '2024-01-02 08:20:00-05', null, '2024-01-02 08:20:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-02', '2024-01-02 19:00:00-05', '2024-01-02 19:00:00-05', '2024-01-02 19:00:00-05', true);

    -- C: P1 miércoles 2024-01-03, turno cruza a horario nocturno (08:00-22:30)
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-03', '2024-01-03 08:00:00-05', null, '2024-01-03 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-03', '2024-01-03 22:30:00-05', '2024-01-03 22:30:00-05', '2024-01-03 22:30:00-05', true);

    -- D (MODIFICADO respecto a 0010): P1 domingo 2024-01-07, 08:00-22:00 (840 min),
    -- cruza la franja nocturna (21:00) a propósito para ejercitar el fix:
    -- 780 min diurnos a hourly_rate_sunday_holiday (25000) + 60 min nocturnos
    -- a hourly_rate_sunday_holiday_extra_night (30000) = 325000 + 30000 = 355000.
    -- Con la lógica vieja (0010) este mismo escenario habría dado un costo
    -- distinto, calculado con las tarifas de extra de semana.
    insert into public."InA_time_entries" (profile_id, company_id, event_type, date, clock_in, clock_out, created_at, is_verified) values
        (v_p1, v_company_id, 'in', '2024-01-07', '2024-01-07 08:00:00-05', null, '2024-01-07 08:00:00-05', true),
        (v_p1, v_company_id, 'out', '2024-01-07', '2024-01-07 22:00:00-05', '2024-01-07 22:00:00-05', '2024-01-07 22:00:00-05', true);

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
    --    remanente de redondeo de extra_night
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
    v_failures := public._payroll_selftest_check(v_failures, 'B martes tarde+extra', 'late_minutes', v_row.late_minutes, 20);

    -- C
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-03';
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'ordinary_minutes', v_row.ordinary_minutes, 540);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'extra_day_minutes', v_row.extra_day_minutes, 240);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'extra_night_minutes', v_row.extra_night_minutes, 90);
    v_failures := public._payroll_selftest_check(v_failures, 'C miercoles nocturno', 'cost', v_row.cost, 180000);

    -- D (valores nuevos: cruza la franja nocturna del domingo)
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1) where work_date = '2024-01-07';
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo cruza nocturno', 'minutes_work', v_row.minutes_work, 840);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo cruza nocturno', 'ordinary_minutes', v_row.ordinary_minutes, 0);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo cruza nocturno', 'extra_sunday_minutes', v_row.extra_sunday_minutes, 840);
    v_failures := public._payroll_selftest_check(v_failures, 'D domingo cruza nocturno', 'cost', v_row.cost, 355000);

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

    -- J: ausencia no justificada (martes, sin novedad) vs cubierta por novedad (miércoles),
    -- + leave_type nuevo: null cuando no hay novedad, 'vacaciones' cuando sí.
    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p4) where work_date = '2024-01-02';
    v_failures := public._payroll_selftest_check_bool(v_failures, 'J ausencia sin novedad', 'is_unjustified_absence', v_row.is_unjustified_absence, true);
    if v_row.leave_type is not null then
        v_failures := v_failures || format('[J ausencia sin novedad / leave_type] esperado=null actual=%s', v_row.leave_type);
    end if;

    select * into v_row from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p4) where work_date = '2024-01-03';
    v_failures := public._payroll_selftest_check_bool(v_failures, 'J ausencia con novedad aprobada', 'is_unjustified_absence', v_row.is_unjustified_absence, false);
    if v_row.leave_type is distinct from 'vacaciones' then
        v_failures := v_failures || format('[J ausencia con novedad aprobada / leave_type] esperado=vacaciones actual=%s', coalesce(v_row.leave_type, 'null'));
    end if;

    -- L: agregado del período completo para P1 (valores actualizados por el
    -- nuevo escenario D)
    select
        sum(minutes_work) as minutes_work, sum(cost) as total_cost,
        count(*) filter (where is_late)::int as lates,
        sum(extra_day_minutes) as extra_day, sum(extra_night_minutes) as extra_night,
        sum(extra_sunday_minutes) as extra_sunday, sum(breakfast_minutes) as breakfast,
        count(*) filter (where is_unjustified_absence)::int as unjustified_absences
    into v_row
    from public._payroll_calc_daily(v_company_id, '2024-01-01', '2024-01-07', v_p1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'minutes_work', v_row.minutes_work, 3535);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'total_cost', v_row.total_cost, 849166.67, 1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'lates', v_row.lates, 1);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_day', v_row.extra_day, 360);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_night', v_row.extra_night, 90);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'extra_sunday', v_row.extra_sunday, 840);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'breakfast', v_row.breakfast, 15);
    v_failures := public._payroll_selftest_check(v_failures, 'L periodo completo P1', 'unjustified_absences', v_row.unjustified_absences, 0);

    -- ---- Limpieza incondicional (corre siempre, haya o no fallos) ----
    delete from public."InA_leave_requests" where profile_id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_time_entries" where profile_id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_profiles" where id in (v_p1, v_p2, v_p3, v_p4);
    delete from public."InA_companies" where id = v_company_id;
    delete from public."InA_organizations" where id = v_org_id;

    if array_length(v_failures, 1) > 0 then
        raise exception 'PAYROLL_RPC_SELFTEST_V2 FALLÓ (% de 45 verificaciones):
%', array_length(v_failures, 1), array_to_string(v_failures, E'\n');
    end if;

    raise notice 'PAYROLL_RPC_SELFTEST_V2: 45/45 VERIFICACIONES OK';
end;
$$;

-- Verificación final (visible en la pestaña de resultados del SQL Editor)
select 'PAYROLL_RPC_SELFTEST_V2: si ves esta fila sin errores arriba, las autopruebas pasaron y la migración quedó instalada.' as resultado;
