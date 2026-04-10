# Guía de trabajo seguro

## Ramas
- `develop` → ambiente de desarrollo en Vercel → Supabase DEV
- `main`    → ambiente de producción en Vercel → Supabase PROD

## Regla de merge
Solo hacer merge de develop → main cuando:
1. El checklist de validación de la fase esté al 100%
2. Se haya probado en el Vercel de develop con datos reales de prueba
3. Se haya revisado que no hay console.log con datos sensibles

## Migraciones de base de datos
Toda nueva columna debe ser: nullable OR tener DEFAULT
Nunca usar: DROP COLUMN, DROP TABLE, TRUNCATE

## Feature flags
- Los features por empresa se controlan en la columna `settings` (JSONB) de InA_companies
- Estructura: `settings -> features -> nombre_del_feature: true/false`
- Ejemplo: `settings.features.biometric_verification = true`
- Nunca hardcodear un feature para un cliente específico en el código
- Para activar un feature: actualizar el campo settings en Supabase (sin deploy)
