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

## 🛡️ Estrategia de Entornos y Seguridad

### 1. Variables de Entorno (Vercel & Local)
El proyecto utiliza `VITE_APP_ENV` para identificar el entorno de ejecución:
- **Local:** Definido en `.env` (generalmente apunta a `development`).
- **Preview (Vercel):** Configurado automáticamente como `Preview` en despliegues desde ramas distintas a `main`.
- **Producción (Vercel):** Configurado como `Production`.

### 2. Guard de Seguridad (supabase.ts)
Para evitar daños accidentales, el archivo `frontend/src/lib/supabase.ts` contiene un **Guard de Seguridad** que bloquea la inicialización si:
- Se intenta conectar a la URL de **Producción** desde un entorno que no sea explícitamente `Production` (case-insensitive).
- Si necesitas trabajar localmente apuntando a producción (NO RECOMENDADO), debes configurar `VITE_APP_ENV=production` en tu `.env` local bajo tu propio riesgo.

## 🚩 Feature flags
- Los features por empresa se controlan en la columna `settings` (JSONB) de InA_companies
- Estructura: `settings -> features -> nombre_del_feature: true/false`
- Ejemplo: `settings.features.biometric_verification = true`
- Nunca hardcodear un feature para un cliente específico en el código
- Para activar un feature: actualizar el campo settings en Supabase (sin deploy)
