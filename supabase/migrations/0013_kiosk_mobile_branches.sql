-- ============================================================================
-- MIGRACIÓN 0013: Kiosko desde celular para empleados flotantes (multi-sede)
-- ============================================================================
-- CONTEXTO: hoy el Kiosko asume una tablet física fija por sede — la sede
-- (company_id, coordenadas GPS) se decide UNA VEZ desde el panel/localStorage
-- del dispositivo, nunca la elige quien va a marcar. Un empleado que visita
-- varias sedes en un día, usando su propio celular, no tiene forma de decir
-- "estoy en la Sede B ahora": el celular no tiene ninguna sede de referencia
-- confiable guardada.
--
-- MODELO DE NEGOCIO CONFIRMADO (2026-08-20): cada sede que visite ese día es
-- un turno independiente (Fin de Jornada real al salir, Inicio de Jornada
-- nuevo al llegar a la siguiente) — no un solo turno "pausado" cruzando
-- sedes. Esto no requiere ningún cambio al motor de nómina/turnos ya
-- validado; el badge "+Xh en otra sede" del módulo de Informes (sección 22)
-- ya cubre la visibilidad de ese caso.
--
-- Lo único que falta es CÓMO elige la sede alguien sin ningún dispositivo
-- pre-configurado. Se agrega un RPC nuevo que, dado cédula+PIN (no solo
-- PIN, para no tener que adivinar la sede primero), devuelve ÚNICAMENTE las
-- sedes donde ESA persona específica está autorizada (su sede principal +
-- InA_employee_branches) — nunca la lista completa de la organización ni de
-- la plataforma.
--
-- RIESGO ENCONTRADO Y MITIGADO: buscar por cédula+PIN sin sede amplía la
-- superficie de fuerza bruta respecto a kiosk_verify_pin (que hoy exige
-- conocer sede+PIN juntos) — con este RPC alguien solo necesita cédula+PIN,
-- sin saber a qué empresa pertenece. Se agrega control de intentos
-- fallidos: 5 intentos fallidos con la misma cédula bloquean 15 minutos; el
-- contador se reinicia solo si el intento anterior fue hace más de 30
-- minutos, o de inmediato tras un login correcto.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla de control de intentos fallidos, por cédula. Sin políticas RLS
--    con USING/CHECK (RLS habilitada = deny-by-default) — nadie accede
--    directo desde el cliente, solo la toca el RPC de abajo (SECURITY
--    DEFINER, corre con privilegio de dueño).
-- ----------------------------------------------------------------------------
create table if not exists public."InA_kiosk_login_attempts" (
    national_id text primary key,
    failed_count int not null default 0,
    locked_until timestamptz,
    last_attempt_at timestamptz not null default now()
);

alter table public."InA_kiosk_login_attempts" enable row level security;
revoke all on public."InA_kiosk_login_attempts" from anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. RPC: sedes autorizadas de un empleado, dado cédula + PIN.
-- ----------------------------------------------------------------------------
create or replace function public.kiosk_find_profile_branches(p_national_id text, p_pin_code text)
returns table (
    company_id uuid,
    company_name text,
    lat_long text,
    radius_limit int,
    biometric_verification boolean,
    is_primary boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_locked_until timestamptz;
    v_failed_count int;
    v_last_attempt timestamptz;
    v_profile_id uuid;
    v_profile_company_id uuid;
begin
    select locked_until, failed_count, last_attempt_at
      into v_locked_until, v_failed_count, v_last_attempt
    from public."InA_kiosk_login_attempts"
    where national_id = p_national_id;

    if v_locked_until is not null and v_locked_until > now() then
        raise exception 'Demasiados intentos fallidos. Intenta de nuevo en unos minutos.';
    end if;

    select p.id, p.company_id into v_profile_id, v_profile_company_id
    from public."InA_profiles" p
    where p.national_id = p_national_id
      and p.pin_code = p_pin_code
      and p.role = 'employee'
    limit 1;

    if v_profile_id is null then
        if v_last_attempt is null or v_last_attempt < now() - interval '30 minutes' then
            v_failed_count := 1;
        else
            v_failed_count := coalesce(v_failed_count, 0) + 1;
        end if;

        insert into public."InA_kiosk_login_attempts" (national_id, failed_count, last_attempt_at, locked_until)
        values (
            p_national_id, v_failed_count, now(),
            case when v_failed_count >= 5 then now() + interval '15 minutes' else null end
        )
        on conflict (national_id) do update set
            failed_count = excluded.failed_count,
            last_attempt_at = excluded.last_attempt_at,
            locked_until = excluded.locked_until;

        return; -- sin filas: cédula/PIN incorrectos, mismo resultado que antes para quien consulta
    end if;

    -- Login correcto: limpia el contador de intentos fallidos.
    insert into public."InA_kiosk_login_attempts" (national_id, failed_count, last_attempt_at, locked_until)
    values (p_national_id, 0, now(), null)
    on conflict (national_id) do update set
        failed_count = 0, last_attempt_at = now(), locked_until = null;

    return query
    select c.id, c.name, c.lat_long, c.radius_limit,
        coalesce((c.settings -> 'features' ->> 'biometric_verification')::boolean, false),
        true
    from public."InA_companies" c
    where c.id = v_profile_company_id
    union
    select c.id, c.name, c.lat_long, c.radius_limit,
        coalesce((c.settings -> 'features' ->> 'biometric_verification')::boolean, false),
        false
    from public."InA_employee_branches" eb
    join public."InA_companies" c on c.id = eb.branch_id
    where eb.employee_id = v_profile_id
    order by 6 desc, 2;
end;
$$;

revoke execute on function public.kiosk_find_profile_branches(text, text) from public;
grant execute on function public.kiosk_find_profile_branches(text, text) to anon;

-- Verificación sugerida tras correr esto:
-- select proname from pg_proc where proname = 'kiosk_find_profile_branches';
-- select tablename from pg_tables where tablename = 'InA_kiosk_login_attempts';
