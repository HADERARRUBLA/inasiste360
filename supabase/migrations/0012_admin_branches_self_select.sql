-- ============================================================================
-- MIGRACIÓN 0012: un admin puede leer sus propias sedes asignadas
-- ============================================================================
-- BUG REAL encontrado 2026-08-20: un administrador (no superadmin) con
-- varias sedes a cargo (asignadas desde Gestión de Administradores ->
-- "Sedes Autorizadas", tabla InA_admin_branches) nunca podía ver el
-- selector de "Sede Activa" en el dashboard para cambiar entre ellas.
--
-- Dos causas independientes, ambas necesarias para el fix completo:
-- 1. Frontend (App.tsx, loadCompaniesForProfile): para cualquier perfil
--    que no fuera superadmin, la consulta de sedes SIEMPRE se limitaba a
--    `eq('id', profile.company_id)` — solo la sede principal, ignorando
--    por completo InA_admin_branches. Corregido en el mismo commit que
--    esta migración.
-- 2. Base de datos (esta migración): incluso si el frontend hubiera
--    consultado InA_admin_branches, la política `admin_branches_all` de
--    la migración 0001 usa `using (is_superadmin())` a secas — un admin
--    normal no puede leer NINGUNA fila de esa tabla, ni siquiera las
--    suyas. Esta migración agrega una política adicional de solo lectura
--    para que un admin vea sus propias asignaciones. La gestión (crear/
--    editar/borrar asignaciones) sigue siendo exclusiva de superadmin —
--    Postgres combina políticas PERMISSIVE con OR, así que esto solo
--    AMPLÍA quién puede leer, nunca reduce el control de superadmin.
-- ============================================================================

drop policy if exists admin_branches_all on public."InA_admin_branches";

create policy admin_branches_superadmin_all on public."InA_admin_branches"
    for all to authenticated
    using ( public.is_superadmin() )
    with check ( public.is_superadmin() );

create policy admin_branches_self_select on public."InA_admin_branches"
    for select to authenticated
    using ( admin_id = (public.current_profile()).id );

-- Verificación sugerida tras correr esto:
-- select policyname, cmd, roles from pg_policies where tablename = 'InA_admin_branches';
-- Debe mostrar 2 políticas: admin_branches_superadmin_all (ALL) y
-- admin_branches_self_select (SELECT).
