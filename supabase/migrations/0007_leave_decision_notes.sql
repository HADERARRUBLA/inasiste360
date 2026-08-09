-- ============================================================================
-- MIGRACIÓN 0007: Observación de aprobación/rechazo de novedades
-- ============================================================================
-- CONTEXTO: el campo `notes` de InA_leave_requests describe la solicitud en
-- sí (lo que escribe quien la crea). Falta un campo separado para que el
-- admin deje constancia de POR QUÉ aprobó o rechazó una solicitud —
-- especialmente importante en un rechazo, para que quede registrado el
-- motivo (y el empleado/auditoría lo pueda consultar después).
--
-- Ejecuta este script completo de una sola vez en:
-- Supabase Dashboard → SQL Editor → New query
-- ============================================================================

alter table public."InA_leave_requests"
    add column if not exists decision_notes text;
