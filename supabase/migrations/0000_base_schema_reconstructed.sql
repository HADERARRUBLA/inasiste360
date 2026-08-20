-- ============================================================================
-- 0000_base_schema_reconstructed.sql
--
-- Reconstruccion del esquema base de InA_organizations, InA_companies,
-- InA_profiles, InA_time_entries e InA_admin_branches.
--
-- Estas 5 tablas son ANTERIORES al historial de migraciones de este repo
-- (no existe en ningun lado el CREATE TABLE original). Este archivo se
-- generó el 2026-08-19 a partir de una introspección de solo lectura contra
-- el proyecto Supabase real en uso (information_schema.columns,
-- information_schema.table_constraints, pg_indexes), como paso previo a
-- separar Producción de un ambiente de pruebas real en una instancia
-- Supabase distinta.
--
-- Correr este archivo PRIMERO, en una instancia Supabase nueva y vacía,
-- antes de correr 0001_secure_rls_and_kiosk_rpc.sql en adelante (esas sí
-- están completas en el repo y se pueden ejecutar tal cual, en orden).
--
-- No incluye RLS ni políticas: 0001_secure_rls_and_kiosk_rpc.sql se encarga
-- de activar RLS y crear las políticas sobre estas mismas tablas.
--
-- IMPORTANTE al reproducir la secuencia completa en una instancia nueva:
-- SALTAR 0004_open_schedule.sql por completo. Esa migración transforma la
-- columna legada "use_custom_schedule" (ya eliminada del esquema real antes
-- de esta reconstrucción) en schedule_mode/open_no_overtime/
-- open_max_ordinary_minutes — columnas que este script (0000) ya crea
-- directamente en su forma final. Correr 0004 sobre una instancia
-- bootstrapeada con este archivo falla con
-- "column use_custom_schedule does not exist" (confirmado 2026-08-19).
-- Es la única migración del repo con este patrón (agregar columna +
-- copiar de una columna vieja + borrarla) — 0001-0003 y 0005-0010 son
-- seguras de correr tal cual.
-- ============================================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- Usado únicamente por InA_time_entries.geo_snapshot (ver nota al final del
-- archivo: esta columna parece no estar en uso por el frontend actual,
-- que usa location_snapshot jsonb en su lugar. Se incluye para fidelidad
-- exacta con el esquema real, pero vale la pena confirmar si se necesita).
create extension if not exists postgis;

-- ----------------------------------------------------------------------------
-- InA_organizations
-- ----------------------------------------------------------------------------
create table public."InA_organizations" (
    id         uuid primary key default uuid_generate_v4(),
    name       text not null,
    nit        text,
    is_active  boolean default true,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    constraint "InA_organizations_nit_key" unique (nit)
);

-- ----------------------------------------------------------------------------
-- InA_companies (sede)
-- ----------------------------------------------------------------------------
create table public."InA_companies" (
    id                      uuid primary key default uuid_generate_v4(),
    name                    text not null,
    address                 text,
    phone                   text,
    email                   text,
    logo_url                text,
    is_active               boolean default true,
    created_at              timestamptz default now(),
    updated_at              timestamptz default now(),
    lat_long                text,
    radius_limit            integer default 100,
    night_shift_start_time  time default '21:00:00',
    extra_day_start_time    time default '18:00:00',
    work_schedule           jsonb default '{}'::jsonb,
    organization_id         uuid references public."InA_organizations"(id),
    settings                jsonb default '{}'::jsonb
);

-- ----------------------------------------------------------------------------
-- InA_profiles (empleados y admins)
-- ----------------------------------------------------------------------------
create table public."InA_profiles" (
    id                                      uuid primary key default gen_random_uuid(),
    full_name                               text not null,
    avatar_url                              text,
    created_at                              timestamptz default now(),
    updated_at                              timestamptz default now(),
    pin_code                                text,
    company_id                              uuid references public."InA_companies"(id) on delete set null,
    face_vector                             jsonb,
    hourly_rate_base                        numeric(12,2) default 0,
    night_surcharge_pct                     numeric(5,2) default 35.00,
    sunday_holiday_surcharge_pct            numeric(5,2) default 75.00,
    phone_number                            text,
    national_id                             text,
    role                                    text default 'employee',
    profile_photo                           text,
    hourly_rate_extra_day                   numeric default 0,
    hourly_rate_extra_night                 numeric default 0,
    hourly_rate_sunday_holiday              numeric default 0,
    hourly_rate_sunday_holiday_extra_day    numeric default 0,
    hourly_rate_sunday_holiday_extra_night  numeric default 0,
    work_start_time                         time,
    work_end_time                           time,
    work_schedule                           jsonb default '{}'::jsonb,
    hourly_rate                             numeric default 0,
    work_shift_start                        time default '08:00:00',
    work_shift_end                          time default '17:00:00',
    overtime_threshold                      integer default 8,
    is_active                               boolean default true,
    organization_id                         uuid references public."InA_organizations"(id),
    auth_user_id                            uuid references auth.users(id) on delete set null,
    schedule_mode                           text not null default 'branch'
        constraint "InA_profiles_schedule_mode_check" check (schedule_mode = any (array['branch', 'custom', 'open'])),
    open_no_overtime                        boolean not null default false,
    open_max_ordinary_minutes               integer not null default 480
        constraint "InA_profiles_open_max_ordinary_minutes_check" check (open_max_ordinary_minutes >= 60 and open_max_ordinary_minutes <= 1440),
    constraint "InA_profiles_national_id_key" unique (national_id)
);

create unique index ina_profiles_auth_user_id_key
    on public."InA_profiles" using btree (auth_user_id)
    where (auth_user_id is not null);

-- ----------------------------------------------------------------------------
-- InA_time_entries (marcaciones)
-- ----------------------------------------------------------------------------
create table public."InA_time_entries" (
    id                 uuid primary key default gen_random_uuid(),
    profile_id         uuid not null references public."InA_profiles"(id) on delete cascade,
    date               date not null,
    clock_in           timestamptz not null,
    clock_out          timestamptz,
    total_hours        numeric(5,2),
    status             text default 'active'
        constraint time_entries_status_check check (status = any (array['active', 'paused', 'completed'])),
    edited_manually    boolean default false,
    notes              text,
    created_at         timestamptz default now(),
    updated_at         timestamptz default now(),
    -- Nota: sin FK a InA_companies en el esquema real actual (verificado por
    -- introspección) — se preserva así a propósito, no es un olvido de este
    -- script.
    company_id         uuid,
    event_type         text
        constraint time_entries_event_type_check check (event_type = any (array['in', 'out', 'breakfast', 'lunch', 'active_pause', 'other'])),
    is_verified        boolean default false,
    geo_snapshot       geography,
    metadata           jsonb default '{}'::jsonb,
    location_snapshot  jsonb
);

create index idx_time_entries_date on public."InA_time_entries" using btree (date);
create index idx_time_entries_status on public."InA_time_entries" using btree (status);
create index idx_time_entries_user_id on public."InA_time_entries" using btree (profile_id);

-- ----------------------------------------------------------------------------
-- InA_admin_branches (puente admin <-> sede, multi-sede)
-- ----------------------------------------------------------------------------
create table public."InA_admin_branches" (
    id         uuid primary key default uuid_generate_v4(),
    admin_id   uuid references public."InA_profiles"(id) on delete cascade,
    branch_id  uuid references public."InA_companies"(id) on delete cascade,
    created_at timestamptz default now(),
    constraint "InA_admin_branches_admin_id_branch_id_key" unique (admin_id, branch_id)
);

-- ============================================================================
-- Verificación rápida sugerida tras correr este script:
--
-- select table_name, count(*) from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('InA_organizations','InA_companies','InA_profiles','InA_time_entries','InA_admin_branches')
-- group by table_name order by table_name;
--
-- Debe dar: InA_organizations=6, InA_companies=16, InA_profiles=33
-- (en el original hay un hueco histórico en la posición 21 de una columna ya
-- borrada — no afecta a esta tabla nueva, que no tiene huecos),
-- InA_time_entries=17, InA_admin_branches=4.
-- ============================================================================
