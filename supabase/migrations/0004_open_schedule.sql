-- ============================================================================
-- MIGRACIÓN 0004: Horario Abierto (tercer modo de jornada)
-- ============================================================================
-- CONTEXTO: hoy InA_profiles.use_custom_schedule (boolean) alterna entre
-- heredar el horario de la sede o usar un horario semanal fijo propio. Se
-- agrega un tercer modo 'open' para roles sin turno fijo (administradores,
-- domiciliarios) cuyas horas igual deben clasificarse en diurna/nocturna/
-- dominical, con horas extra opcionales activadas por un tope configurable.
-- El comportamiento (con o sin horas extra, y el tope) se decide por
-- empleado, no automáticamente por rol.
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

alter table public."InA_profiles"
    add column if not exists schedule_mode text not null default 'branch'
        check (schedule_mode in ('branch', 'custom', 'open')),
    add column if not exists open_no_overtime boolean not null default false,
    add column if not exists open_max_ordinary_minutes integer not null default 480
        check (open_max_ordinary_minutes between 60 and 1440);

-- Backfill: preserva el comportamiento actual de cada perfil existente.
-- Debe correr ANTES de eliminar use_custom_schedule.
update public."InA_profiles"
   set schedule_mode = case when use_custom_schedule then 'custom' else 'branch' end;

-- use_custom_schedule queda reemplazado por schedule_mode; los 3 archivos
-- frontend que lo referenciaban se actualizan en el mismo cambio, así que
-- no queda huérfano ni como fuente de verdad duplicada.
alter table public."InA_profiles" drop column if exists use_custom_schedule;

-- Verificación: confirma que no quedaron perfiles sin clasificar y la
-- distribución de modos (compara el conteo de 'custom' contra el conteo
-- previo de use_custom_schedule=true si lo tienes anotado).
select schedule_mode, count(*) from public."InA_profiles" group by schedule_mode;
