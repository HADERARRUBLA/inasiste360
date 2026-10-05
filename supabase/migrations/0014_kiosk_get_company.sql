-- ============================================================================
-- MIGRACIÓN 0014: Datos de una sede para el Kiosko abierto por enlace directo
-- ============================================================================
-- CONTEXTO: el enlace /?kiosko=<id de sede> abre el Kiosko sin que nadie haya
-- iniciado sesión. Para eso el navegador necesita el nombre, las coordenadas,
-- el radio y la bandera de biometría de ESA sede.
--
-- HALLAZGO: la migración 0001 dejó `grant select on InA_companies to anon`
-- (con el comentario "las sedes sí son legibles anónimamente"), pero la única
-- política de SELECT de esa tabla es `to authenticated`. Con RLS activa y sin
-- política para `anon`, una consulta anónima devuelve 0 filas — por eso hoy
-- hay que entrar como admin para dejar un equipo en modo Kiosko: sin sesión,
-- la lista de sedes llega vacía.
--
-- SOLUCIÓN: en vez de abrir la tabla completa a `anon` (expondría todas las
-- sedes de la plataforma), un RPC que devuelve UNA sola sede, solo si quien
-- llama ya conoce su id (UUID), y solo los campos que el Kiosko necesita.
-- Mismo patrón y mismas columnas que kiosk_find_profile_branches (0013).
-- ============================================================================

create or replace function public.kiosk_get_company(p_company_id uuid)
returns table (
    company_id uuid,
    company_name text,
    lat_long text,
    radius_limit int,
    biometric_verification boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select c.id, c.name, c.lat_long, c.radius_limit,
        coalesce((c.settings -> 'features' ->> 'biometric_verification')::boolean, false)
    from public."InA_companies" c
    where c.id = p_company_id;
$$;

revoke execute on function public.kiosk_get_company(uuid) from public;
grant execute on function public.kiosk_get_company(uuid) to anon, authenticated;

-- Verificación sugerida tras correr esto (reemplaza el uuid por una sede real):
-- select * from public.kiosk_get_company('00000000-0000-0000-0000-000000000000');
-- select proname from pg_proc where proname = 'kiosk_get_company';
