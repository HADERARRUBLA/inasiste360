-- ============================================================================
-- MIGRACIÓN 0009: Carpeta HRM del empleado + Supabase Storage (Fase 5)
-- ============================================================================
-- CONTEXTO: primer uso de Supabase Storage en el proyecto. Dos buckets:
--   - employee-photos (PÚBLICO): fotos de perfil nuevas subidas por admins.
--     Se mantiene público a propósito porque el Kiosko de planta consume la
--     foto vía anon key SIN sesión (KioskMode.tsx / kiosk_verify_pin), y no
--     se va a tocar ese flujo en esta fase. El bypass de lectura pública de
--     Supabase Storage no depende de ninguna policy RLS de SELECT — por eso
--     NO se crea policy SELECT para anon/authenticated en este bucket: no
--     hace falta para que el Kiosko/panel vean la foto, y agregarla solo
--     habilitaría listar/enumerar carpetas de organizaciones sin necesidad.
--   - employee-documents (PRIVADO): hoja de vida y adjuntos, más sensibles,
--     solo se sirven a través de la Carpeta del Empleado en el panel admin
--     (siempre autenticado) vía createSignedUrl().
--
-- Convención de rutas (el primer segmento SIEMPRE es organization_id):
--   employee-photos:    {organization_id}/{uuid}-{timestamp}.{ext}
--   employee-documents: {organization_id}/{profile_id}/{archivo}
--
-- ALCANCE: solo datos HR + documentos + fotos de perfil NUEVAS. Migrar fotos
-- ya existentes (base64) y la evidencia del Kiosko quedan fuera de este
-- cambio (deuda técnica anotada en CONTEXT.md).
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. InA_employee_hr_profile — datos de la carpeta del empleado
-- ----------------------------------------------------------------------------
create table if not exists public."InA_employee_hr_profile" (
    profile_id uuid primary key references public."InA_profiles"(id) on delete cascade,
    hire_date date,
    marital_status text,
    children_count integer,
    education_level text,
    eps text,
    arl text,
    compensation_fund text,
    pension_fund text,
    updated_at timestamptz not null default now()
);

alter table public."InA_employee_hr_profile" enable row level security;

drop policy if exists hr_profile_all on public."InA_employee_hr_profile";
create policy hr_profile_all on public."InA_employee_hr_profile"
    for all to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_hr_profile".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    )
    with check (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_hr_profile".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    );

revoke all on public."InA_employee_hr_profile" from anon;


-- ----------------------------------------------------------------------------
-- 2. InA_employee_documents — hoja de vida y adjuntos generales
-- ----------------------------------------------------------------------------
create table if not exists public."InA_employee_documents" (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid not null references public."InA_profiles"(id) on delete cascade,
    doc_type text not null default 'otro' check (doc_type in ('hoja_de_vida', 'otro')),
    file_name text not null,
    storage_path text not null,
    uploaded_by uuid references public."InA_profiles"(id) on delete set null,
    uploaded_at timestamptz not null default now()
);

create index if not exists ina_employee_documents_profile_id_idx
    on public."InA_employee_documents" (profile_id);

alter table public."InA_employee_documents" enable row level security;

drop policy if exists employee_documents_all on public."InA_employee_documents";
create policy employee_documents_all on public."InA_employee_documents"
    for all to authenticated
    using (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_documents".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    )
    with check (
        exists (
            select 1 from public."InA_profiles" p
            where p.id = "InA_employee_documents".profile_id
              and public.is_admin_of_org(p.organization_id)
        )
    );

revoke all on public."InA_employee_documents" from anon;


-- ----------------------------------------------------------------------------
-- 3. Buckets de Storage
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
    ('employee-photos', 'employee-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']),
    ('employee-documents', 'employee-documents', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png',
              'application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;


-- ----------------------------------------------------------------------------
-- 4. Helper: extrae el organization_id del primer segmento de la ruta, SIN
--    lanzar excepción si la ruta está malformada (una excepción en una
--    expresión de policy aborta toda la evaluación, no solo esa fila —
--    esto protegería contra romper el bucket entero por un objeto con ruta
--    inválida, ej. subido manualmente desde el Dashboard de Supabase).
-- ----------------------------------------------------------------------------
create or replace function public.storage_object_org_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
    return ((storage.foldername(object_name))[1])::uuid;
exception when others then
    return null;
end;
$$;


-- ----------------------------------------------------------------------------
-- 5. Policy: employee-photos — solo admins de la organización dueña pueden
--    subir/reemplazar/borrar. La LECTURA pública la resuelve el flag
--    "public" del bucket (bypassa RLS en el endpoint /object/public/...),
--    por eso NO hay policy de select aquí a propósito (agregar una solo
--    habilitaría listar/enumerar carpetas sin necesidad).
--    IMPORTANTE: se filtra bucket_id explícitamente — storage.objects es
--    una sola tabla compartida por todos los buckets, sin este filtro la
--    policy autorizaría sin querer objetos de otros buckets.
-- ----------------------------------------------------------------------------
drop policy if exists employee_photos_admin_all on storage.objects;
create policy employee_photos_admin_all on storage.objects
    for all to authenticated
    using (
        bucket_id = 'employee-photos'
        and public.is_admin_of_org(public.storage_object_org_id(name))
    )
    with check (
        bucket_id = 'employee-photos'
        and public.is_admin_of_org(public.storage_object_org_id(name))
    );


-- ----------------------------------------------------------------------------
-- 6. Policy: employee-documents — bucket privado. Los admins de la
--    organización dueña pueden leer (necesario para createSignedUrl),
--    subir, actualizar y borrar. Nadie más (ni anon, ni admins de otra
--    organización) tiene ninguna policy que los alcance.
-- ----------------------------------------------------------------------------
drop policy if exists employee_documents_admin_all on storage.objects;
create policy employee_documents_admin_all on storage.objects
    for all to authenticated
    using (
        bucket_id = 'employee-documents'
        and public.is_admin_of_org(public.storage_object_org_id(name))
    )
    with check (
        bucket_id = 'employee-documents'
        and public.is_admin_of_org(public.storage_object_org_id(name))
    );


-- ----------------------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------------------
select id, name, public, file_size_limit, allowed_mime_types from storage.buckets
where id in ('employee-photos', 'employee-documents');

select policyname, roles, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and policyname in ('employee_photos_admin_all', 'employee_documents_admin_all');

select tablename, policyname, roles, cmd
from pg_policies
where tablename in ('InA_employee_hr_profile', 'InA_employee_documents');
