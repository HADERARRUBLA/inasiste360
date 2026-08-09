# CONTEXTO DEL PROYECTO — Asiste360 / IN_ASISTE360

> Documento generado tras análisis completo del código fuente del repositorio `HADERARRUBLA/inasiste360` (rama `master`, commit `f578ed2`).
> Objetivo: servir de punto de partida para retomar el desarrollo con Claude Code y evolucionar el producto hacia un MVP robusto y escalable.

---

## 1. Qué es el producto

**Asiste360** es una plataforma **SaaS multi-tenant de control de asistencia laboral** con:
- Marcación de entrada/salida/pausas vía **PIN** o **reconocimiento facial** (biometría 100% en el navegador).
- **Geovalla (geofencing)**: valida que el empleado esté dentro de un radio configurado de la sede antes de permitir marcar.
- **Cálculo de nómina/horas** (ordinarias, extra diurna, extra nocturna, dominical/festivo) calculado en el cliente.
- **Auditoría visual**: compara foto de referencia vs. foto capturada en cada marcación, con ubicación GPS.
- **Jerarquía SaaS**: Organización (empresa cliente) → Sede(s) → Empleados, con roles `superadmin` / `admin` / `employee`.
- Landing page comercial propia con CTA a un CRM externo (`crm.asiste360.com`), lo que confirma que es un producto que ya se está comercializando, no solo un prototipo.

Dominio de producción: `inasiste360.vercel.app`. Cliente real de referencia mencionado en las directivas: gestión de sedes/empleados con biometría activada por bandera (`settings.features.biometric_verification`).

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 |
| Estilos | Tailwind CSS v4 (utilidades inline, sin librería de componentes tipo shadcn pese a mencionarse en la SOP) |
| Backend | **Ninguno propio** — Supabase como BaaS (Postgres + PostgREST + Auth no usado + Storage no usado) |
| Biometría | `face-api.js` (modelos TinyFaceDetector, FaceLandmark68, FaceRecognitionNet) servidos localmente desde `frontend/public/models/` |
| Mapas | `leaflet` (selector de sede) + iframe de OpenStreetMap embed (auditoría) + Nominatim (geocoding de direcciones) |
| Gráficas | `recharts` |
| Excel | `xlsx` (importación/exportación de empleados y reportes) |
| Hosting | Vercel (proyecto raíz apunta a subcarpeta `frontend/` vía `vercel.json`) |
| Scripts auxiliares | Python (`scripts/*.py`) para inspección/depuración directa de la base de datos vía API de Supabase — no forman parte del build de la app |

No hay backend propio, no hay Edge Functions de Supabase, no hay cola de trabajos, no hay tests automatizados, no hay CI configurado más allá del auto-deploy de Vercel.

---

## 3. Arquitectura y flujo de autenticación (hallazgo importante)

**No se usa Supabase Auth.** El "login" es una consulta directa a la tabla de perfiles:

```ts
supabase.from('InA_profiles').select('*').eq('national_id', id).eq('pin_code', pin).maybeSingle()
```

Esto ocurre tanto para el panel admin (`App.tsx`) como para el Kiosko (`KioskMode.tsx`), usando siempre la **anon key** pública. Esto implica:
- Toda la protección de datos depende **exclusivamente de las políticas RLS (Row Level Security)** configuradas en Supabase — no verificadas en este análisis porque no hay credenciales de base de datos disponibles en este entorno.
- El PIN se almacena y se compara **en texto plano** (`pin_code`).
- No hay sesión de Supabase Auth, por lo tanto `auth.uid()` no está disponible para políticas RLS basadas en el usuario autenticado — si existen políticas RLS, probablemente son permisivas (`anon` puede leer/escribir), lo cual **expondría `pin_code` y `face_vector` de todos los empleados a cualquiera con la anon key** (que es pública por diseño en apps Vite, ya que se embebe en el bundle del navegador).

**Esto es el hallazgo de seguridad más crítico del proyecto** y debe verificarse/resolverse antes de escalar a más clientes.

---

## 4. Modelo de datos (según código actual)

Todas las tablas usan el prefijo **`InA_`** (regla explícita en `directivas/db_schema_sync_SOP.md`). Estructura inferida del código (`types.ts` + componentes), **no confirmada contra el esquema real en vivo**:

### `InA_organizations` (Empresa cliente / tenant)
`id, name, nit, is_active, created_at`

### `InA_companies` (Sede — el nombre técnico quedó de una versión anterior donde "company" = sede)
`id, organization_id (FK), name, address, lat_long (string "lat,lng"), radius_limit, night_shift_start_time, extra_day_start_time, work_schedule (JSONB semanal), settings (JSONB: settings.features.biometric_verification)`

### `InA_profiles` (usuarios: empleados y admins)
`id, organization_id, company_id, full_name, national_id, phone_number, pin_code, face_vector (number[128]), profile_photo (base64), hourly_rate_base, hourly_rate_extra_day, hourly_rate_extra_night, hourly_rate_sunday_holiday, hourly_rate_sunday_holiday_extra_day, hourly_rate_sunday_holiday_extra_night, use_custom_schedule, work_schedule, role ('superadmin'|'admin'|'employee')`

### `InA_time_entries` (marcaciones)
`id, profile_id, company_id, event_type ('in'|'out'|'breakfast'|'lunch'|'active_pause'|'other'), is_verified, clock_in, clock_out, date, location_snapshot {lat,lng}, geo_snapshot, metadata (JSONB: biometric_match, biometric_confidence, method, event_label, is_return, photo_evidence base64)`

### `InA_admin_branches` (tabla puente admin↔sede para multi-sede)
`admin_id, branch_id`

### ⚠️ Alerta de desfase de esquema
Los archivos `db_inspection.txt` / `db_samples.txt` / `te_detailed_def.json` en la raíz del repo muestran un esquema **sin prefijo `InA_`**, sin `organization_id`, con `night_surcharge_pct`/`sunday_holiday_surcharge_pct` (porcentajes) en vez de tarifas por hora, y `geo_snapshot` como tipo `geography(Point,4326)` de PostGIS. Esto es **una instantánea vieja** (previa a la migración a multi-tenant y al prefijo `InA_`, ver commit `24/03` en la SOP de GitHub). **No se debe confiar en estos archivos como verdad actual** — son ruido histórico que conviene archivar o borrar. La verdad actual solo puede confirmarse con acceso directo al proyecto Supabase.

---

## 5. Lógica de negocio central

### 5.1 Kiosko (`KioskMode.tsx`)
1. Empleado ingresa PIN → se busca perfil por `company_id + pin_code`.
2. Se determina la última marcación del día para decidir qué acciones mostrar (Iniciar jornada / Pausas / Reanudar / Finalizar).
3. Si la sede tiene `biometric_verification` activo, se activa cámara, se captura descriptor facial con `face-api.js` y se compara por **distancia euclidiana** contra el vector guardado (umbral `0.55` en `biometricUtils.ts`, aunque la SOP menciona `0.6` — **hay dos valores de umbral distintos en el código, revisar cuál es el vigente**: `biometricUtils.ts` usa `FACE_MATCH_THRESHOLD = 0.55`).
4. Si no hay match, **el sistema permite continuar igualmente** marcando `is_verified: false` (diseño intencional para trazabilidad en vez de bloqueo duro, según la SOP de biometría).
5. La geovalla (`useGeofencing.ts`, fórmula Haversine) bloquea el registro si el navegador reporta ubicación fuera del radio — pero es **enteramente client-side**: nada impide enviar el insert directamente a la API de Supabase evadiendo esta validación.

### 5.2 Cálculo de nómina (`AdminDashboard.tsx`, función `stats` con `useMemo`)
- Toda la lógica de horas ordinarias/extra diurna/extra nocturna/dominical/tardanzas/costo estimado vive **inline dentro de un componente React**, no en `utils/calculations.ts` (ese archivo tiene una función stub `calculateShift()` que **no se usa** — deuda técnica marcada explícitamente en un comentario del propio código).
- La misma lógica de partición de horas está **duplicada** en `exportToICG()` dentro del mismo archivo (para exportar a un formato de nómina externo "ICG"), con ligeras diferencias — riesgo real de que un cambio en una no se replique en la otra.
- El fetch de `InA_time_entries` trae **todos los registros de la sede sin paginar** (`select('*, InA_profiles(*)').eq('company_id', ...)`), y el cálculo se hace 100% en el navegador. Esto **no escalará** más allá de unos pocos miles de registros por sede.

### 5.3 Multi-tenancy y permisos
- `superadmin`: ve todas las organizaciones/sedes, gestiona Empresas (`OrganizationManagement.tsx`), Sedes globales (`BranchManagement.tsx`) y Administradores (`AdminManagement.tsx`).
- `admin`: en teoría limitado a su(s) sede(s) vía `InA_admin_branches`, pero **la aplicación de este límite depende de RLS en el backend** — en el frontend, `App.tsx` solo filtra la lista de sedes visibles si `profile.role !== 'superadmin'`, no hay una capa de autorización explícita más allá de eso.
- No existe pantalla de "olvidé mi PIN" ni gestión de contraseñas — es un sistema cerrado, de aprovisionamiento manual por un superadmin.

### 5.4 Feature flags
Por sede, en `InA_companies.settings.features.<nombre> = true/false` (JSONB). Actualmente solo se usa `biometric_verification`. Convención documentada en `DESARROLLO.md`: nunca hardcodear un feature para un cliente específico.

---

## 6. Entornos y despliegue

| Rama | Entorno Vercel | Supabase | Notas |
|---|---|---|---|
| `master` | Production | Supabase PROD | `inasiste360.vercel.app` |
| `develop` | Preview | Supabase DEV | Mencionada en `DESARROLLO.md` |
| `desarrollo` | Preview | Supabase DEV(?) | Mencionada en `directivas/desarrollo_seguro_SOP.md` — **hay ambigüedad**: dos documentos internos usan nombres de rama de desarrollo distintos (`develop` vs `desarrollo`). Confirmar cuál es la rama activa real. |

Guard de seguridad en `frontend/src/lib/supabase.ts`: lanza excepción si se detecta `VITE_APP_ENV=production` en modo `import.meta.env.DEV` (localhost), para evitar apuntar accidentalmente a producción desde el equipo local.

`vercel.json` en la raíz define `installCommand`/`buildCommand`/`outputDirectory` pero **no especifica `frontend/` como root** — probablemente el "Root Directory" está configurado manualmente en el dashboard de Vercel (no verificable desde el código). Vale la pena confirmarlo.

Migraciones: regla en `DESARROLLO.md` — toda columna nueva debe ser nullable o tener DEFAULT; nunca `DROP COLUMN`/`DROP TABLE`/`TRUNCATE`.

---

## 7. Deuda técnica y riesgos identificados (para priorizar en el MVP)

### Seguridad (prioridad alta)
1. **PIN en texto plano** y usado como credencial única de autenticación administrativa — sin hashing, sin rate limiting, sin bloqueo por intentos fallidos.
2. **No se usa Supabase Auth** → sin sesión real, sin JWT de usuario, RLS (si existe) no puede diferenciar usuarios de forma nativa.
3. Toda la superficie de datos sensibles (`face_vector`, `pin_code`, fotos base64) es accedida con la **anon key pública** — el nivel real de exposición depende 100% de políticas RLS no verificadas en este análisis.
4. Reglas de negocio (geovalla, ventana horaria, permisos por rol) son **enforced solo en el cliente** — cualquiera que llame directo a la API REST de Supabase con la anon key puede insertar marcaciones falsas o leer datos de otras sedes si RLS no lo impide.
5. Borrado masivo de `InA_time_entries` (`handleClearRecords` en `AdminDashboard.tsx`) protegido únicamente por dos `window.confirm()` — sin backup automático, sin soft-delete.
6. Fotos de evidencia y foto de perfil se guardan como **base64 dentro de la fila JSONB** (`metadata.photo_evidence`, `profile_photo`) en vez de Supabase Storage — infla el tamaño de la tabla y las respuestas de la API, y no hay CDN/caché de imágenes.

### Escalabilidad
7. Sin paginación en `AdminDashboard`, `EmployeeManagement`, `AuditSystem` — traen todo el dataset de la sede a memoria del navegador.
8. Cálculo de nómina recalculado client-side en cada carga de dashboard (potencialmente costoso con miles de entradas), sin caché ni agregación en base de datos (ni vistas materializadas, ni funciones RPC de Postgres).
9. Lógica de negocio duplicada entre `AdminDashboard.tsx` (stats) y `exportToICG` (mismo archivo) — sin una única fuente de verdad para el cálculo de horas.

### Calidad / mantenibilidad
10. `utils/calculations.ts` tiene código muerto (`calculateShift` sin uso real, documentado como pendiente de refactor por el propio equipo anterior).
11. Cero tests automatizados (unitarios, integración o e2e).
12. Componentes muy grandes con lógica de fetching, cálculo y presentación mezcladas (`AdminDashboard.tsx` 860 líneas, `EmployeeManagement.tsx` 745 líneas) — sin capa de servicios/repositorio separada de Supabase.
13. Doble definición de umbral de coincidencia biométrica (`0.55` en código vs `0.6` documentado en la SOP) — inconsistencia a resolver.
14. Archivos de depuración/inspección obsoletos en la raíz (`db_inspection.txt`, `db_samples.txt`, `compare_ids.txt`, `te_detailed_def.json`, `te_post_params.json`, `supabase_openapi.json`, scripts sueltos en `scripts/`) reflejan un esquema **anterior** al actual — generan confusión y deberían archivarse fuera del repo o en una carpeta `/legacy`.
15. `package-lock.json` en la raíz es un lockfile vacío/placeholder de un proyecto llamado `APPS_illink` que no corresponde a este repo — parece arrastre de otra plantilla.
16. Sin manejo de errores centralizado en React (no hay Error Boundaries); los errores de Supabase se muestran con `alert()` nativo del navegador en varios formularios.
17. Ambigüedad de nombre de rama de desarrollo (`develop` vs `desarrollo`) entre dos documentos SOP.

### Producto / UX
18. No hay recuperación de PIN olvidado, ni invitaciones por email, ni onboarding self-service — todo el aprovisionamiento de usuarios es manual desde el panel admin.
19. El Kiosko permite marcar sin biometría verificada (por diseño, para trazabilidad) pero esto podría no ser lo esperado por todos los clientes — vale la pena que sea configurable si bloquea o no el registro cuando falla la biometría.

---

## 8. Lo que SÍ está bien resuelto (para no reinventar)

- Separación clara de conceptos: Organización → Sede → Empleado, con tabla puente para multi-sede de administradores.
- Sistema de horario semanal por sede y horario personalizado por empleado (`work_schedule` JSONB), con cálculo de tardanzas y horas extra ya contemplando turno nocturno y dominical.
- Buen manejo de recursos de cámara (limpieza de `MediaStream` al salir, `stream.getTracks().forEach(t => t.stop())`) — evita fugas de memoria/cámara encendida.
- Guard de seguridad anti-despliegue-accidental a producción desde localhost.
- Feature flags por sede vía JSONB, evitando hardcodear condicionales por cliente.
- Exportación robusta a Excel multi-hoja (resumen, logs, alertas) y a un formato de nómina externo (ICG).
- Documentación operativa (`directivas/*.md`) sorprendentemente completa dejada por el IDE anterior — es una base excelente de contexto de decisiones ya tomadas, y conviene seguir alimentándola.

---

## 9. Decisiones tomadas (2026-08-08)

Tras revisar el análisis, el usuario (Hader Arrubla) definió el rumbo:

1. **Sin clientes en producción todavía.** Libertad total para hacer cambios de esquema/arquitectura sin necesidad de retrocompatibilidad ni ventanas de migración coordinadas.
2. **Autenticación → Opción B (recomendada):** migrar admins/superadmins a **Supabase Auth real** (email/password o magic link, con sesión JWT y RLS basado en `auth.uid()`). El **Kiosko de planta sigue usando PIN** por UX (rapidez, empleados sin email), pero la validación del PIN debe moverse a una **función RPC de Postgres (`SECURITY DEFINER`)** en vez de leer `pin_code` directo desde el frontend con la anon key.
3. **Rama de desarrollo activa: por confirmar.** Hay que revisar en el Dashboard de Vercel qué rama (`develop` o `desarrollo`) está conectada al entorno Preview/Supabase DEV antes de tocar el flujo de branches.
4. **Volumen proyectado: grande (30+ sedes, 1000+ empleados).** Esto hace **obligatorio, no opcional**, resolver antes de escalar:
   - Paginación en `AdminDashboard`, `EmployeeManagement`, `AuditSystem`.
   - Mover el cálculo de nómina (horas ordinarias/extra/dominicales) a funciones RPC de Postgres o a una vista agregada, eliminando la duplicación actual entre `AdminDashboard.tsx` (stats) y `exportToICG`.
   - Mover fotos (`profile_photo`, `metadata.photo_evidence`) de base64-en-JSONB a Supabase Storage.
5. **Prioridad de trabajo: en paralelo, por impacto/esfuerzo** — no un solo frente a la vez. El orden sugerido de ataque, dado que seguridad y escalabilidad comparten la misma raíz (mover lógica del cliente al servidor vía RLS + RPC de Postgres), es:
   1. Verificar el estado real de RLS/esquema en Supabase (bloqueante para todo lo demás).
   2. Diseñar el esquema de Auth + RPC de PIN (resuelve seguridad Y sienta la base para mover cálculos al servidor).
   3. Migrar cálculo de nómina y listados grandes a paginado/RPC (resuelve escalabilidad).
   4. Mover fotos a Storage.
   5. Continuar con funcionalidades de producto sobre una base ya sólida.
6. **Acceso a Supabase:** el usuario compartirá URL + anon key del proyecto **DEV** directamente en el chat para poder inspeccionar tablas y políticas RLS reales (nunca la `service_role key` ni credenciales de producción).

### Preguntas aún abiertas
- Definir email real para la cuenta "Super Admin" (hoy su `national_id` es literalmente el string `"admin"`, no un correo).

### Resuelto (2026-08-08): ramas `develop` vs `desarrollo`
- **`desarrollo`** está **abandonada**: parada en el commit `b838966` (18 feb 2026), **17 commits detrás de `master`** — le faltan meses de fixes (biometría, kiosko, geo, nómina). Por eso su Preview (`inasiste360-git-desarrollo-...vercel.app`) tiene login roto: es código viejo, no relacionado con la migración RLS.
- **`develop`** sí está casi al día (2 commits detrás de `master`, antes del release de fases 1-5 y de este fix de seguridad) — es la rama que realmente coincide con lo que describe `DESARROLLO.md`.
- **Decisión del usuario:** por ahora no tocar ninguna rama (ni actualizar `develop`, ni borrar `desarrollo`). Pendiente para una sesión futura si se retoma el flujo de Preview antes de mergear a `master`.

## 11. Hallazgo confirmado en vivo (2026-08-08): RLS abierta en Supabase DEV

Se verificó contra el proyecto DEV real (`atrrjjavlxnloknqhnxk.supabase.co`) usando solo la anon key pública, sin ningún login:

```
GET /rest/v1/InA_profiles?select=*&limit=1   → HTTP 200, fila completa incl. pin_code, face_vector, profile_photo
```

Las 5 tablas (`InA_organizations`, `InA_companies`, `InA_profiles`, `InA_time_entries`, `InA_admin_branches`) devuelven `200 OK` a lectura anónima sin restricción — **no hay RLS habilitada**. Esto no es un riesgo teórico, es una fuga de datos activa (PINs, vectores biométricos y fotos de empleados reales del proyecto DEV, incluyendo datos de una empresa llamada "FOODPER-GRUPO HAF" bajo la organización "DEMO-CLIENTES").

Se encontraron 29 perfiles en DEV, de los cuales 3 son admin/superadmin:
- `Super Admin` — `national_id = "admin"` (no es un email, hay que definir uno real para migrarlo a Supabase Auth)
- `Migue` — `miguel@hh.com` (admin, organización `e464aac1-...`)
- `ALEJANDRA` — `gerencia@alimentosfoodper.com` (admin, organización `a4b4932c-...`)

### Remediación preparada
Migración SQL lista para revisión/ejecución en [`supabase/migrations/0001_secure_rls_and_kiosk_rpc.sql`](supabase/migrations/0001_secure_rls_and_kiosk_rpc.sql):
- Habilita RLS con deny-by-default en las 5 tablas.
- Políticas basadas en `auth.uid()` + `organization_id` para el panel admin (requiere completar la migración a Supabase Auth real, ver pasos manuales al final del archivo SQL).
- 4 funciones RPC `SECURITY DEFINER` para el Kiosko (`kiosk_verify_pin`, `kiosk_get_last_entry`, `kiosk_verify_face`, `kiosk_register_entry`) que reemplazan las lecturas directas de `InA_profiles`/`InA_time_entries` — la comparación biométrica ahora ocurre en el servidor y el vector facial almacenado **nunca** se envía al navegador.

**Estado (2026-08-08, actualizado):**
- ✅ SQL de la migración 0001 ejecutado por el usuario en Supabase DEV. Verificado en vivo: `InA_profiles`/`InA_time_entries` ahora devuelven `401 permission denied` a lectura anónima; `InA_companies` sigue legible (intencional); RPC `kiosk_verify_pin` responde solo con campos seguros.
- ✅ `frontend/src/App.tsx` migrado: login ahora usa `supabase.auth.signInWithPassword()` (campos correo/contraseña), restaura sesión en recarga (`onAuthStateChange` + `getSession`), y resuelve el perfil propio vía `InA_profiles.auth_user_id`.
- ✅ `frontend/src/components/KioskMode.tsx` migrado: usa `kiosk_verify_pin`, `kiosk_get_last_entry`, `kiosk_verify_face` (comparación biométrica ahora ocurre en el servidor, el vector nunca llega al navegador) y `kiosk_register_entry` en vez de leer/escribir la tabla directo.
- ✅ `tsc --noEmit` y `npm run build` pasan sin errores.
- ⏳ **Pendiente por el usuario:** crear los 3 usuarios de Supabase Auth (Dashboard → Authentication → Users) y vincularlos con el `UPDATE ... set auth_user_id = ...` (instrucciones al final del archivo SQL) — sin esto el login del panel admin no puede probarse aún.
- ⏳ **Pendiente de prueba manual:** flujo completo del Kiosko con GPS y cámara reales (bloqueado en el navegador sandbox usado para verificación automatizada, por diseño correcto de la geovalla).
- ✅ **Verificado en vivo (2026-08-08) de punta a punta:** se creó el usuario Auth `hader.arrubla@solucioneshys.com` (UID `5a0b370e-b84d-436d-a846-fa1bb0a09a88`), se vinculó a `InA_profiles.auth_user_id` (perfil `national_id='admin'`, role `superadmin`), se le fijó contraseña directo por SQL (`crypt(..., gen_salt('bf'))` sobre `auth.users.encrypted_password`, sin depender del correo — el plan Free de Supabase tiene un límite muy bajo de envío de emails y se agotó durante las pruebas). Con eso, login real funcionando: dashboard, listado de empleados (`EmployeeManagement.tsx`) y navegación completa cargan datos reales bajo las políticas RLS de la migración 0001, sin cambios de código adicionales en esos componentes — sin errores de consola.
- ✅ **Ronda de regresión completa (2026-08-08, ver sección 12):** todos los módulos probados end-to-end (CRUD real, no solo lectura) y un segundo hallazgo de seguridad (políticas RLS heredadas demasiado permisivas) encontrado y corregido.
- 📝 **Nota operativa:** en Supabase Dashboard → Authentication → URL Configuration, se cambió `Site URL` de `http://localhost:3000` a `http://localhost:5173` y se agregó `http://localhost:5173/**` a Redirect URLs, para que los links de recuperación de contraseña apunten al entorno local correcto. Hay que revisar este valor antes de desplegar a Preview/Producción (debería apuntar al dominio real de Vercel en esos entornos, no a localhost).
- ⚠️ **Hallazgo importante (2026-08-08):** `inasiste360.vercel.app` (rama `master`, Producción) usa el **mismo proyecto Supabase** (`atrrjjavlxnloknqhnxk`) que el que se documentó como "DEV" — verificado inspeccionando el bundle JS servido en producción. **No existe una separación real DEV/PROD a nivel de base de datos**, contrario a lo que describe `DESARROLLO.md`. Consecuencia directa: al aplicar la migración 0001 (RLS + RPCs), el código viejo ya desplegado en `master` quedó roto (su login y Kiosko leían la tabla directo, ahora bloqueado por RLS) hasta que el fix de esta sesión se despliegue también a `master`. Pendiente de decisión con el usuario: crear un proyecto Supabase separado para Producción real antes de tener clientes, o aceptar un solo proyecto por ahora dado el estado temprano del producto.

---

## 12. Ronda de regresión completa y segundo hallazgo de seguridad (2026-08-08)

Tras el fix inicial (migración 0001) y el push a `master`/`develop`, se hizo una ronda de pruebas end-to-end de **todos** los módulos del panel admin (no solo lectura — create/update/delete real, con datos de prueba `QA-TEST-*` creados y borrados en cada caso) contra el proyecto Supabase real, antes de avanzar a nuevas funcionalidades. Resultado por módulo:

| Módulo | Resultado |
|---|---|
| Auditoría (`AuditSystem.tsx`) | ✅ OK — foto, veredicto biométrico, GPS |
| Configuración de Sede (`CompanySetup.tsx`) | ✅ OK — UPDATE confirmado |
| Sedes Globales (`BranchManagement.tsx`) | ✅ OK — INSERT + DELETE confirmados |
| Empresas SaaS (`OrganizationManagement.tsx`) | ✅ OK — UI smoke test |
| Administradores (`AdminManagement.tsx`) | ✅ OK (ver incidente de datos abajo) |
| Empleados (`EmployeeManagement.tsx`) | ✅ OK — INSERT + UPDATE + DELETE confirmados |
| Kiosko (PIN, geovalla, RPCs) | ✅ OK — `kiosk_verify_pin`, `kiosk_get_last_entry`, `kiosk_verify_face`, `kiosk_register_entry` probados; captura de cámara real queda pendiente para el usuario en su propio dispositivo |

### Segundo hallazgo: políticas RLS heredadas seguían abiertas para `authenticated`
Al auditar `pg_policies` para entender un comportamiento raro en Administradores, se descubrió que **las 4 tablas principales tenían decenas de políticas previas** (de antes de este proyecto de seguridad) con `qual = true` para el rol `{public}` — ej. `"Allow public select/insert/update/delete on profiles"`, `"Public Read Access"`, `"allow_all_anon_companies"`, etc. Postgres combina políticas PERMISSIVE con OR, así que estas políticas viejas **anulaban por completo el aislamiento por organización de la migración 0001 para cualquier usuario autenticado** (no solo superadmin). El bloqueo a `anon` seguía intacto porque se hizo vía `REVOKE` de privilegios base (una capa distinta a RLS), pero para `authenticated` el aislamiento nunca estuvo realmente activo hasta este punto.

**Corregido** en [`supabase/migrations/0002_drop_legacy_permissive_policies.sql`](supabase/migrations/0002_drop_legacy_permissive_policies.sql) — elimina únicamente las políticas heredadas, deja las de la migración 0001 intactas. Verificado con `pg_policies`: cada tabla ahora solo tiene las políticas propias, todas `{authenticated}`, ninguna `{public}`/`true`.

### Incidente de pérdida de datos: 2 perfiles de administrador borrados
Durante esta misma ventana de tiempo, se detectó que los perfiles de `Migue` (`miguel@hh.com`) y `ALEJANDRA` (`gerencia@alimentosfoodper.com`) — confirmados existentes al inicio de la sesión vía una consulta anónima — **ya no estaban en la tabla `InA_profiles`** (confirmado con una consulta como `postgres`, que bypasea RLS). Causa más probable: la política heredada `"Allow public delete on profiles"` (`true` para `{public}`) combinada con privilegios de tabla abiertos permitía a **cualquiera con la anon key borrar cualquier perfil sin autenticación**, antes de que el `REVOKE` de la migración 0001 cerrara esa puerta. No se puede confirmar con certeza si fue una explotación externa real o un accidente previo a esta sesión — el proyecto no tiene backups ni Point-in-Time Recovery habilitado, así que no se pudo hacer forense completo por logs.

**Recuperado manualmente**: se reconstruyeron ambos perfiles con los mismos `id` originales (capturados antes del incidente) para preservar la fila de `InA_admin_branches` de Migue. Quedaron con PIN temporal (`9001`/`9002`) — **pendiente que cada uno lo cambie desde Administradores → Editar**. Cualquier otro dato que tuvieran (teléfono, tarifas) se perdió y debe completarse manualmente si aplica.

### Recomendación para el futuro
- **Habilitar backups en Supabase** (aunque sea manual, exportando la DB periódicamente) — hoy no hay ninguna red de seguridad ante un borrado accidental o malicioso.
- Antes de cualquier futura migración de esquema, correr `select * from pg_policies where tablename = '...'` primero para descartar más sorpresas heredadas en objetos que aún no se hayan tocado (funciones, triggers, vistas).

---

## 13. Fase 1 del roadmap de producto: renovación visual/UX (2026-08-08)

El usuario pidió 5 frentes de trabajo para evolucionar el producto (ver plan completo en `.claude/plans` de la sesión — resumen aquí). Orden confirmado: landing+visual+responsive → multi-sede → novedades/ausencias → nómina avanzada → HRM. Esta sesión completó la **Fase 1**.

### Hallazgo: sistema de tokens de color roto
`frontend/src/index.css` solo definía 7 tokens de color (`background`, `surface`, `primary`, etc.), pero **todo el panel admin** (`App.tsx` + los 9 componentes) usaba masivamente clases como `bg-card`, `text-muted-foreground`, `text-primary-foreground`, `bg-destructive` — más de 100 usos sin token real detrás. Gran parte del panel llevaba tiempo renderizando sin los colores que el código decía que debía tener.

### Qué se implementó
- **`frontend/src/index.css`**: sistema de tokens completo (`background`, `foreground`, `card`, `primary`, `primary-foreground`, `muted`, `muted-foreground`, `destructive`, `destructive-foreground`) para claro (`:root`) y oscuro (`.dark`), usando `@custom-variant dark` de Tailwind v4. Se quitó un `background-color: #ffffff` forzado en `body` que habría roto el modo oscuro.
- **`frontend/src/hooks/useTheme.ts`** + **`frontend/src/components/ThemeToggle.tsx`**: toggle claro/oscuro persistido en `localStorage`, integrado en `App.tsx` y `KioskMode.tsx`. La landing pública (`LandingPage.tsx`) se mantiene siempre oscura (tokens `exec-*` propios, decisión de marca confirmada con el usuario).
- **Responsive real del panel admin**: `App.tsx` — sidebar convertido en drawer móvil (toggle por `display: none/flex` con `lg:flex`, **no** con `translate-x-*`: esas utilidades de Tailwind v4 no aplicaban correctamente en este entorno de pruebas — causa no resuelta del todo, ver nota abajo). Tablas de `EmployeeManagement`, `BranchManagement`, `AdminManagement` envueltas en `overflow-x-auto`. Headers de página (`AdminManagement`, `BranchManagement`, `CompanySetup`, `OrganizationManagement`) convertidos a `flex-col sm:flex-row`.
- **Landing renovada** (`LandingPage.tsx`): hero con ejemplo numérico concreto de ahorro (coherente con la fórmula real de `ROIView`), CTA principal reenfocado a "Agenda tu Demo Gratuita", nuevo botón secundario "Ver mi Ahorro Estimado" que lleva directo a la calculadora, prueba social honesta (se quitó la afirmación no verificable "Fortune 500").
- **Sistema de toasts**: `frontend/src/lib/toastStore.ts` + `frontend/src/components/ToastContainer.tsx` (store pub-sub simple, sin dependencias nuevas). Reemplazados los 17 `alert()` nativos en `AdminManagement`, `BranchManagement`, `AdminDashboard`, `EmployeeManagement`, `CompanySetup`, `OrganizationManagement`.

### ⚠️ Nota técnica pendiente de investigar
Durante las pruebas se encontró que las utilidades `translate-x-0` / `-translate-x-full` de Tailwind v4 (que usan la propiedad CSS nativa `translate`, no `transform`) **no se aplicaban visualmente** pese a que la clase correcta sí estaba en el DOM — verificado con servidor reiniciado y caché de Vite limpiada, así que no era solo un problema de HMR. Se evitó el problema usando `hidden`/`flex` (patrón ya probado en el resto del código) en vez de `translate-*` para el drawer del sidebar. **Si en fases futuras se necesita una animación de deslizamiento real (no solo mostrar/ocultar), investigar esto primero** — podría ser una interacción específica de esta versión de `@tailwindcss/vite` con la propiedad `translate` nativa, o algo del entorno de pruebas usado en esta sesión que no reproduce en un navegador real.

### Verificado
`npm run build` y `tsc --noEmit` limpios. Probado en vivo en 375px/768px/1280px: sidebar/drawer, tablas sin overflow horizontal, toggle claro/oscuro (valores de fondo/texto confirmados vía `getComputedStyle`), login y navegación completa funcionando. **Pendiente para el usuario:** revisión visual directa (capturas de pantalla no fueron posibles en el entorno de pruebas de esta sesión — panel de navegador no se pudo mostrar para captura) y prueba en un dispositivo móvil/tablet real.

### Ronda 2 (mismo día): ajustes a la landing pedidos tras revisión visual del usuario
El usuario revisó capturas de pantalla reales (landing, Comando, Motor de ROI) y pidió 3 ajustes puntuales, todos en `LandingPage.tsx`:
- **Hero**: logo del navbar agrandado (32→36 con doble anillo animado en sentidos opuestos + glow pulsante), texto/botones del hero un nivel más grandes para balance, y la imagen del rostro escaneado (que era un hotlink a una URL de Google, riesgo real de romperse) reemplazada por un emblema `ScanFace` de `lucide-react` con anillos animados — sin dependencias externas.
- **"Centro de Comando"**: el mapa/feed genérico ("Malla de Nodos", nombres ficticios tipo "Marcus Thorne") se reemplazó por un tour de 6 funcionalidades reales del producto (Asistencia en Tiempo Real, Nómina Automática, Auditoría, Geovallas, Multi-sede, Reportes Excel) y el feed de marcaciones/alertas ahora usa nombres y tipos de evento reales del sistema (Llegada Tarde, etc.). El menú lateral de la demo también se alineó a la navegación real de la app (Dashboard/Empleados/Auditoría/Reportes/Sedes).
- **Motor de ROI**: se agregaron inputs de sedes, salario mínimo, auxilio de transporte (editables, con nota de que hay que ajustarlos al valor vigente — no se asumió un valor legal específico para no arriesgar publicar una cifra desactualizada), horas/mes de nómina manual y costo por hora administrativa. Toggle mensual/anual. Se quitó el "ROI Estimado: 340%" que estaba hardcodeado sin base real, reemplazado por "Horas de Nómina Automatizadas/Año" (sí calculable de los inputs). Se agregaron 2 gráficas con `recharts` (ya era dependencia del proyecto): comparativo mensual de costo con/sin la app, y desglose de fuentes de ahorro. Todo en memoria, sin persistencia (confirmado con el usuario).

**Nota sobre verificación:** durante las pruebas, la navegación por pestañas de la landing (Inteligencia/Comando/Motor de ROI, controlada por `AnimatePresence` de `motion/react`) se veía "atascada" en algunas pruebas automatizadas — se determinó que es porque el entorno de pruebas de esta sesión no compone frames visualmente (mismo problema que impidió tomar capturas de pantalla), por lo que las animaciones basadas en `requestAnimationFrame` nunca completan su callback. No se tocó el mecanismo de `AnimatePresence` en sí. El usuario ya había confirmado visualmente que las 3 vistas funcionan correctamente en su propio navegador antes de esta ronda de cambios.

### Ronda 3: correcciones tras revisión visual real del usuario (capturas de pantalla)
El usuario probó en su propio navegador y encontró 3 problemas reales que las pruebas automatizadas no habían detectado (limitación del entorno de pruebas para juicio visual fino):
- **Hero sobredimensionado**: el aumento de tamaño de texto/botones/panel de la ronda 2 causó que la página se viera "zoomeada", necesitando que el usuario ajustara el zoom del navegador para verla bien. Revertido a los tamaños originales (`text-xl md:text-2xl` subtítulo, botones `px-12 py-6 text-sm`, panel `max-w-[650px]`).
- **Rostro perdido**: el ícono `ScanFace` de lucide-react se veía como un emoji/cartoon, no como un rostro humano siendo escaneado. Reemplazado por `FaceScanEmblem`, un SVG propio con malla de 33 puntos de referencia facial (contorno de mandíbula, cejas, ojos, nariz, boca — al estilo de los landmarks reales que detecta `face-api.js`), con animación de pulso escalonada por punto.
- **Motor de ROI apretado + inputs con flechitas poco prácticos**: se separaron los 4 sliders y los 3 inputs monetarios en dos tarjetas `exec-glass-panel` distintas con más espacio. A los inputs numéricos (salario mínimo, auxilio transporte, costo hora administrativa) se les quitaron los spinners nativos (`[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`) para que se sientan como campos de texto donde se escribe directo.
- **Logo del navbar**: tras dar 4 opciones de dirección visual, el usuario eligió "marco tipo escudo/hexágono" — el logo ahora está recortado (`clip-path` CSS) dentro de una silueta de escudo, con un halo pulsante del mismo shape detrás y un contorno animado (`pathLength` de framer-motion) trazándose alrededor del perímetro. Conecta visualmente con el mensaje de "proteger tu nómina".

### Ronda 4: bug real encontrado por el usuario + ajustes finales
El usuario probó de nuevo y reportó 3 cosas, dos de ellas bugs reales (no solo estética):
- **Bug real confirmado — "Comando" no mostraba nada**: al reemplazar el ícono `ScanFace` en el hero (ronda 3), se quitó `ScanFace` del import de `lucide-react`, pero **seguía usándose** en el array de tarjetas de funcionalidades de `DashboardView` (línea ~490, `icon: ScanFace`) — un `ReferenceError` en tiempo de ejecución que TypeScript **no detectó** (curiosamente `tsc --noEmit` no marcó el identificador indefinido; se verificó con un script aparte comparando identificadores usados vs. importados). Corregido re-agregando `ScanFace` al import — ahí sí tiene sentido usarlo, es un ícono pequeño entre otros 5 íconos de línea, no la pieza central "rostro humano" que sí se cuestionó en el hero.
- **Rostro del hero**: el usuario prefería la imagen original (la que estaba hotlinkeada a una URL de Google) sobre el ícono `ScanFace` y sobre el SVG de malla facial de la ronda 3 — "más humana, más real". Se descargó esa imagen (`curl`, verificada como PNG válido 512×512) y se guardó como asset propio en `frontend/public/face_scan_hero.png`, eliminando la dependencia externa sin perder el aspecto visual que prefería. Se borró el componente `FaceScanEmblem` (SVG de landmarks) por quedar sin uso.
- **Motor de ROI — inputs que no dejaban escribir**: los 3 campos numéricos (salario mínimo, auxilio transporte, costo hora administrativa) usaban `type="number"` con `value={numero}` y `onChange={... parseInt(...) || 0}` — al borrar el campo para escribir un valor nuevo, `parseInt('')` da `NaN`, y `NaN || 0` fuerza el campo de vuelta a `0` a mitad de edición, sensación de "no puedo escribir". Corregido: los 3 campos ahora guardan un **string** en el estado (`minWageInput`, etc.), se filtran caracteres no numéricos en el `onChange`, y el valor numérico real se deriva (`parseInt(...) || 0`) solo para los cálculos — el campo de texto nunca le pelea al usuario mientras edita.

**Lección para las próximas rondas de esta landing:** cuando se quite o cambie un ícono/import, buscar TODOS sus usos en el archivo antes de tocar el import — en este componente hay 5 sub-vistas (`Navbar`, `Sidebar`, `LandingView`, `ROIView`, `DashboardView`) compartiendo un mismo bloque de imports, fácil perder de vista un uso lejano.

### Ronda 5: logo "flotante" (levitación con sombra dinámica)
Con todo lo demás funcionando bien, el usuario pidió opciones para hacer el logo más impactante ("flotante, girando en su eje o algo más top"). Se ofrecieron 4 direcciones (flotante con sombra, rotación 3D tipo medalla, partículas orbitando, combo de las 3) — eligió **flotante con sombra dinámica**.

Implementado en el logo del navbar (`Navbar` en `LandingPage.tsx`): el badge-escudo completo (glow + imagen + contorno animado, todo lo de la ronda 3) ahora vive dentro de un `motion.div` que se mueve en `y: [0, -10, 0]` en loop — sube y baja suavemente. Una sombra elíptica independiente (`bg-black/60 blur-md`, `-z-10`) queda fija en la base del contenedor (no se mueve) y anima `scaleX`/`opacity` con la misma duración/easing, encogiéndose y desvaneciéndose cuando el logo "sube" — la ilusión clásica de un objeto levitando. Se quitó la animación de `scale` (respiración) que tenía antes, para que el movimiento vertical sea el protagonista sin competir con otro efecto.

### Ronda 6: escudo → aro con punto orbitando (guiño al "360" de la marca)
Al usuario le gustó el flotante, pero pidió cambiar el escudo por un aro simple con un punto que le dé la vuelta completa — conectando literalmente con el "360" del nombre de la marca. Implementado: se quitaron los `clipPath` de escudo (glow, badge y contorno SVG); ahora es un badge circular simple (`rounded-full`) con el logo, un aro fijo (`border rounded-full`), y un punto brillante (`w-3 h-3 rounded-full bg-exec-primary` con glow) que orbita 360° alrededor usando la técnica de envolver el punto en un `motion.div` que rota (`animate={{ rotate: 360 }}`, `duration: 4, ease: 'linear'`) con el punto posicionado en el borde superior — el efecto de levitación (float + sombra) de la ronda 5 se mantiene intacto.

### Ronda 7: ajuste final de tamaño del logo dentro del aro
El usuario pidió, en dos pasos sucesivos, que el logo "360" creciera dentro del aro (badge `w-28 h-28 md:w-36 md:h-36`) hasta acercarse al tamaño del círculo y del punto orbitante. Antes de aplicar `object-cover` (opción obvia para "llenar" el círculo), se verificó el archivo fuente (`file logo_intelligence.png` → 800×1200 px, retrato) — con `object-cover` en un contenedor circular eso recorta impredeciblemente los bordes laterales. Se usó en cambio `object-contain` + `scale-150` (sin padding, `inset-0`), que agranda la imagen de forma controlada sin arriesgar un recorte que cambie según el viewport.

Con esto se cerró la Fase 1 (landing + responsive + modo oscuro + pulido) a satisfacción del usuario. Working branch: todo el trabajo de Fase 1 vive en `develop` (Vercel Preview); `master`/producción solo se actualiza cuando el usuario lo pide explícitamente — regla de flujo de trabajo confirmada esta sesión.

---

## 14. Fase 2 del roadmap de producto: empleados multi-sede (2026-08-09)

Implementa la necesidad real del usuario: varios establecimientos rotan empleados entre sedes, y `InA_profiles.company_id` solo admite una "sede principal" — el Kiosko únicamente reconocía el PIN del empleado en esa sede. Decisión ya confirmada con el usuario: lista fija de sedes autorizadas por empleado, asignada por el admin — el mismo patrón que ya existía y funcionaba para administradores multi-sede (`InA_admin_branches` + checkboxes en `AdminManagement.tsx`), replicado sin reinventar nada.

### Qué se implementó
- **`supabase/migrations/0003_employee_multi_branch.sql`** (el usuario debe ejecutarlo en el SQL Editor de Supabase — no hay acceso de escritura a la base de datos desde este entorno):
  - Tabla nueva `InA_employee_branches` (`id`, `employee_id` → `InA_profiles`, `branch_id` → `InA_companies`, `created_at`), índice único `(employee_id, branch_id)`.
  - RLS: a diferencia de `admin_branches_all` (solo superadmin), aquí también un `admin` normal puede gestionar las sedes de **sus propios** empleados (`EmployeeManagement.tsx` lo usan ambos roles) — política vía `exists (... is_admin_of_org(p.organization_id))` uniendo a `InA_profiles`.
  - `kiosk_verify_pin` ampliada: el `WHERE` ahora acepta `p.company_id = p_company_id OR exists (... InA_employee_branches ...)`.
  - **Hallazgo propio durante la implementación (no estaba en el plan original):** `kiosk_register_entry` también validaba `company_id = p_company_id` de forma estricta — sin ampliar esa función también, un empleado que pasara `kiosk_verify_pin` en una sede secundaria habría fallado al intentar registrar la marcación (`KioskMode.tsx` llama a ambas RPCs con el mismo `p_company_id`, el de la sede física del kiosko). Se amplió con la misma condición `OR exists (...)` para que el flujo completo funcione, no solo la verificación de PIN.
- **`frontend/src/components/EmployeeManagement.tsx`**: replicado el patrón de `AdminManagement.tsx`:
  - `formData.managed_branches: string[]` + estado `companies: Company[]` (cargadas por organización en `fetchInitialData`).
  - `fetchProfiles` hace join `assigned_branches:InA_employee_branches(branch_id)`.
  - `handleEdit` puebla `managed_branches` desde ese join.
  - `handleSave`: separa `managed_branches` del payload de `InA_profiles`, guarda el perfil (usando `.select().single()` en el insert para obtener el id nuevo), y hace `delete().eq('employee_id', ...)` + `insert(...)` en `InA_employee_branches` — mismo patrón delete-then-insert que `AdminManagement`.
  - Nueva sección "Sedes Autorizadas" (checkboxes de todas las sedes de la organización, con etiqueta "(Principal)" junto a la sede actual del empleado) ubicada entre la ficha de nómina y la definición de jornada laboral.
  - Badge "+N sedes" en la tabla de colaboradores cuando tienen sedes adicionales asignadas.

### Verificado
`npx tsc --noEmit` y `npm run build` limpios. **Pendiente para el usuario:**
1. Ejecutar `0003_employee_multi_branch.sql` en el SQL Editor de Supabase (DEV) y confirmar la query de verificación al final (política `employee_branches_all` visible en `pg_policies`).
2. Probar en el navegador: editar un empleado, marcar 2+ sedes adicionales, guardar, reabrir el formulario y confirmar que los checkboxes quedan marcados.
3. Probar el Kiosko marcando con el PIN de un empleado en una sede secundaria (no su sede principal) y confirmar que tanto la verificación de PIN como el registro de la marcación funcionan.
4. Confirmar que un empleado SIN esa sede en `InA_employee_branches` sigue sin poder marcar ahí.

No se pudo completar esta verificación en el navegador de prueba de esta sesión porque requiere iniciar sesión como admin/superadmin (credenciales de Supabase Auth no disponibles en este entorno, correctamente no guardadas en ningún archivo del proyecto).

**Actualización — verificado en vivo por el usuario (2026-08-09):** migración `0003` ejecutada en Supabase DEV, checkboxes de "Sedes Autorizadas" probados con éxito. Durante la prueba se encontró un gap real: `EmployeeManagement.tsx` solo listaba empleados con `company_id = sede activa`, así que un empleado autorizado en una sede adicional no aparecía al ver esa sede — **corregido** en `fetchProfiles`: ahora combina dos consultas (sede principal + `InA_employee_branches!inner` filtrado por `branch_id`), deduplicadas, con un badge ámbar "De visita · Principal: [sede]" cuando el empleado aparece por estar autorizado, no por ser su sede principal.

También se encontró, en paralelo, que la geolocalización por IP/red del navegador de prueba (sin GPS real, sobre internet satelital) resuelve a coordenadas erróneas (Dhaka, Bangladesh) — confirmado por el usuario comparando contra Google Maps en el mismo navegador. No es un bug de la app; se agregó una advertencia de baja precisión (`BranchManagement.tsx`/`CompanySetup.tsx`, umbral >150m) y un mensaje de diagnóstico en `KioskMode.tsx` cuando la distancia reportada es absurdamente grande (>5km), sugiriendo revisar GPS/permisos del dispositivo en vez de asumir que el sistema falla.

---

## 15. Fase 2.5: Horario Abierto + corrección de turnos que cruzan medianoche (2026-08-09)

Mientras se probaba la Fase 2 en vivo, el usuario pidió un tercer modo de jornada para roles sin turno fijo (administradores, domiciliarios) cuyas horas igual deben clasificarse en nómina. Decisiones de negocio confirmadas: sí debe existir el concepto de "hora extra" (activado por un tope configurable, no eliminado), y administradores/domiciliarios pueden comportarse distinto — resuelto **por empleado**, no por rol automático (la BD no distingue "domiciliario" como rol formal).

### Qué se implementó
- **`supabase/migrations/0004_open_schedule.sql`** (el usuario debe ejecutarla): `InA_profiles` gana `schedule_mode` (`'branch'|'custom'|'open'`, reemplaza a `use_custom_schedule`, con backfill), `open_no_overtime` (checkbox "cargo de confianza y dirección, sin horas extra") y `open_max_ordinary_minutes` (tope configurable, default 480 = 8h).
- **`frontend/src/utils/calculations.ts`**: reescrito por completo — tenía un stub (`calculateShift`) sin usar en ningún lado, con un comentario que literalmente pedía esta refactorización. Ahora expone:
  - `groupEntriesIntoShifts()`: agrupa marcaciones por **turno** (delimitado por un `event_type='in'` sin `is_return`), no por la columna `date` de cada evento individual. **Corrige un bug preexistente real y confirmado**: un turno que cruza medianoche (in 23:50 / out 00:10) se contaba como 0 minutos porque sus dos eventos caían en grupos de "día" distintos — afecta a cualquier empleado con turno nocturno, en cualquier modo de horario, no solo el nuevo. El usuario confirmó explícitamente incluir este fix en el mismo cambio.
  - `classifyShiftMinutes()`: reemplaza la lógica de `getOverlap`/`schedThreshold`/`nightThreshold` que estaba **duplicada** en dos lugares de `AdminDashboard.tsx` (el `useMemo` del dashboard y `exportToICG`). Preserva el comportamiento exacto para `'branch'`/`'custom'`; agrega `'open'`: si `openNoOvertime`, todo el turno es diurna/nocturna sin extra; si no, el pivote ordinario/extra es dinámico (`primera marcación del día + openMaxOrdinaryMinutes`), no un reloj fijo. Incluye una salvaguarda para no perder minutos en turnos muy largos (>24h desde el inicio de la franja nocturna).
- **`frontend/src/components/AdminDashboard.tsx`**: ambos cálculos duplicados ahora usan las funciones compartidas; el badge de horario de la tabla distingue los 3 modos.
- **`frontend/src/components/EmployeeManagement.tsx`**: el checkbox binario "Usar Horario Personalizado" se reemplazó por un selector de 3 modos (Sede/Personalizado/Abierto, mismo patrón visual de pestañas que ya usa `AdminDashboard.tsx`). En modo "Abierto": checkbox "Cargo de confianza y dirección" + input numérico condicional de minutos ordinarios.

### Verificación de cálculo (2026-08-09) + ajuste de puntualidad en horario abierto
El usuario pidió confirmar explícitamente que los cálculos de costo/horas quedaran correctos antes de seguir. Se corrió un script standalone (`node --experimental-strip-types`, fuera del navegador) con 9 casos concretos contra `calculations.ts`: turno normal, extra diurna, extra diurna+nocturna, turno que cruza medianoche, horario abierto con tope, horario abierto sin extra, y una comparación directa contra la fórmula ORIGINAL (pre-refactor) en 5 escenarios — **resultado idéntico en los 5**, confirmando que los 25 perfiles `branch` y 4 `custom` existentes en DEV no cambian su cálculo. El script se corrió y se borró (no quedó en el repo).

Al revisar el caso de "cargo de confianza" (sin horas extra) surgió una pregunta real: ¿debía perder también el recargo nocturno? El usuario aclaró que **para estos cargos lo importante no es el recargo/hora extra** (se manejan con compensatorios y salario emocional aparte), sino poder **controlar puntualidad y cumplimiento** del horario pactado. Esto expuso un gap: el modo "Abierto" desactivaba por completo la detección de "llegada tarde" al no tener horario contra qué comparar.

**Corregido**: se agregó un **horario de referencia opcional** para el modo "Abierto" — reutiliza la misma grilla semanal que ya existía para "Personalizado" (extraída a un componente compartido `WeeklyScheduleGrid` en `EmployeeManagement.tsx`), detrás de un checkbox "Definir horario de referencia (solo seguimiento de puntualidad, no afecta nómina)", sin marcar por defecto (opcional, confirmado con el usuario). En `AdminDashboard.tsx`, la detección de llegada tarde ya no excluye el modo `'open'` — compara contra `profile.work_schedule` igual que `'custom'` cuando el admin definió una franja activa; si no la definió, simplemente no hay seguimiento, igual que antes. El cálculo de nómina/extra (`classifyShiftMinutes`) es completamente independiente de este horario de referencia — nunca lo usa para pago, solo `groupEntriesIntoShifts`/detección de tardanza lo consultan.

### Nota de diseño importante
El domingo se mantiene **inconsistente entre los dos consumidores**, tal como ya estaba antes de este cambio (gap preexistente, fuera de alcance): el `useMemo` del dashboard sigue calculando el split diurna/nocturna internamente para el costo pero muestra el 100% del día bajo "extraSunday" en el resumen; `exportToICG` corta directo a "Recargo Dominical" sin dividir. `classifyShiftMinutes()` deliberadamente no conoce el concepto de domingo — cada llamador decide, igual que antes.

### Verificado
`npx tsc --noEmit` y `npm run build` limpios. Verificado en el navegador que la app carga sin errores de consola tras el cambio (no se pudo probar el flujo autenticado completo por falta de credenciales en este entorno, igual que en la Fase 2). **Pendiente para el usuario:**
1. Ejecutar `0004_open_schedule.sql` en Supabase DEV, confirmar con el `select ... group by schedule_mode` que no quedan perfiles sin clasificar.
2. Configurar un empleado en modo "Horario Abierto" (con y sin "cargo de confianza") y confirmar que el dashboard y la exportación ICG clasifican sus horas coherentemente.
3. Confirmar que un turno que cruza medianoche (cualquier modo de horario) ya no se cuenta como 0 minutos.

---

## 16. Fase 3: Novedades y ausencias, V1 (2026-08-09)

Primer módulo de novedades: vacaciones, incapacidades (EPS/ARL), permisos (remunerado/no remunerado), licencias (maternidad/paternidad), luto, otro. **V1 según lo acordado**: el admin registra la novedad directamente ya-aprobada (`status='approved'` fijo al crear) — sin flujo de solicitud/aprobación ni autoservicio del empleado todavía (eso queda para una sub-fase posterior vía RPC del Kiosko, igual patrón que las marcaciones por PIN). Tampoco se integró aún con las alertas de "falta" del dashboard ni con el cálculo de nómina — esa integración está roadmapeada explícitamente para la Fase 4, no en el alcance de esta V1.

### Qué se implementó
- **`supabase/migrations/0005_leave_requests.sql`** (el usuario debe ejecutarla): tabla `InA_leave_requests` (`profile_id`, `type` con 9 valores fijos por `check`, `start_date`/`end_date` con `check (end_date >= start_date)`, `status`, `notes`, `attachment_url` — reservado para cuando exista el bucket de Storage en la Fase 5, `requested_by`/`approved_by`). RLS mismo patrón que `InA_employee_branches`: un admin normal gestiona (no solo lee) las novedades de los empleados de su organización.
- **`frontend/src/types.ts`**: `LeaveType`, `LeaveStatus`, `LeaveRequest`.
- **`frontend/src/components/LeaveManagement.tsx`** (nuevo): listado + formulario de registro, filtrado por la sede activa (mismo criterio que `EmployeeManagement` — empleados con esa sede como `company_id`). Al guardar, `requested_by`/`approved_by` se llenan con el perfil del admin autenticado (prop `currentProfileId`, viene de `userProfile.id` en `App.tsx`).
- **`frontend/src/App.tsx`**: nueva pestaña "Novedades" en la navegación (visible para admin y superadmin, no solo superadmin), entre "Empleados" y "Auditoría".

### Nota técnica: embed con múltiples FK a InA_profiles
`InA_leave_requests` tiene 3 columnas que referencian `InA_profiles` (`profile_id`, `requested_by`, `approved_by`). El embed de Supabase/PostgREST es ambiguo si no se especifica cuál FK usar — se usó `InA_profiles!profile_id(...)` explícitamente en el `select`. Si en el futuro se necesita traer también el nombre de quien aprobó, hay que embeber por separado con `InA_profiles!approved_by(...)`.

### Verificado
`npx tsc --noEmit` y `npm run build` limpios, app cargando sin errores de consola. **Pendiente para el usuario:**
1. Ejecutar `0005_leave_requests.sql` en Supabase DEV.
2. Registrar una novedad de prueba y confirmar que aparece en la tabla filtrada por la sede activa.
3. Decidir cuándo se aborda la V2 (autoservicio del empleado) y la integración con alertas/nómina (Fase 4).

**Actualización — V2 implementado el mismo día (2026-08-09):** el usuario pidió seguir con la V2, pero durante el diseño se identificó que el autoservicio por Kiosko no tiene sentido para TODOS los tipos de novedad — un empleado incapacitado está en casa, no puede pasar por el Kiosko a "solicitar" su incapacidad. El usuario confirmó explícitamente el flujo real: para incapacidades médicas, el empleado envía el soporte por chat al admin, y es el admin quien la registra (con el adjunto, cuando exista Storage en la Fase 5). Esto acotó la V2 a **solo vacaciones y permisos** (remunerado/no remunerado) — lo único que realmente se pide con anticipación, estando presente.

### Qué se implementó (V2)
- **`supabase/migrations/0006_kiosk_leave_requests.sql`** (el usuario debe ejecutarla): RPC `kiosk_create_leave_request(p_profile_id, p_type, p_start_date, p_end_date, p_notes)`, `SECURITY DEFINER`, otorgada a `anon` (mismo patrón que las demás RPCs del Kiosko). Valida en el servidor (no solo en el frontend) que `p_type` sea uno de los 3 tipos permitidos para autoservicio — defensa en profundidad, ya que cualquiera con la anon key podría llamar la RPC directo. Inserta con `status='pending'`, `requested_by = p_profile_id` (el propio empleado), `approved_by = null`. No requiere cambios de RLS: la política de la migración 0005 ya cubre que el admin apruebe/rechace.
- **`frontend/src/components/KioskMode.tsx`**: nuevo paso `'leave'` en el flujo del Kiosko. Después de verificar el PIN, aparece un botón secundario "Solicitar Vacaciones o Permiso" (discreto, no compite visualmente con los botones principales de marcación) que lleva a un formulario simple (tipo, fecha desde/hasta, nota opcional). Al enviar, queda pendiente de aprobación — el mensaje de confirmación se lo deja claro al empleado.
- **`frontend/src/components/LeaveManagement.tsx`**: nueva columna "Estado" con badge (Pendiente/Aprobada/Rechazada) y botones de Aprobar/Rechazar que aparecen solo en solicitudes `pending`, actualizando `status` y `approved_by` con el perfil del admin autenticado.

### Verificado
`npx tsc --noEmit` y `npm run build` limpios, app cargando sin errores de consola (en una pestaña nueva del navegador de pruebas — la anterior mostró un error 500 de Vite que resultó ser caché HMR obsoleta, no un error real, confirmado comparando contra el resultado limpio de `npm run build`). **Pendiente para el usuario:**
1. Ejecutar `0006_kiosk_leave_requests.sql` en Supabase DEV.
2. Probar el flujo completo: Kiosko → PIN → "Solicitar Vacaciones o Permiso" → enviar → confirmar que aparece como "Pendiente" en `LeaveManagement.tsx` → Aprobar/Rechazar desde el panel admin.
3. Confirmar que intentar pedir una incapacidad vía RPC directo (con un `p_type` no permitido) es rechazado por la validación del servidor, no solo por la UI.

### Actualización: visibilidad de pendientes + observación de decisión (2026-08-09)
El usuario preguntó dónde ve el admin las solicitudes que llegan del autoservicio, y pidió poder dejar constancia del motivo al aprobar/rechazar. Se agregó:
- **`supabase/migrations/0007_leave_decision_notes.sql`** (el usuario debe ejecutarla): columna `InA_leave_requests.decision_notes`, separada del `notes` original de la solicitud (que describe el pedido, no la decisión).
- **`LeaveManagement.tsx`**: sección ámbar destacada "N Solicitudes Pendientes de Aprobación" arriba de la tabla (solo aparece si hay pendientes), y un modal de confirmación al aprobar/rechazar que pide una observación — **obligatoria en rechazos**, opcional en aprobaciones. La tabla también muestra la observación de decisión (↳) debajo de la nota original cuando existe.
- **`App.tsx`**: badge numérico ámbar en la pestaña "Novedades" del menú con el conteo de pendientes de la sede activa — visible desde cualquier pantalla, se carga al iniciar sesión/cambiar de sede (consulta propia, independiente de haber visitado el módulo) y se actualiza en vivo vía la prop `onPendingCountChange` cada vez que `LeaveManagement` refresca sus datos (crear, aprobar, rechazar, eliminar).

**Verificado:** `tsc`/`build` limpios, app cargando sin errores en pestaña nueva del navegador de pruebas. Pendiente para el usuario: ejecutar `0007_leave_decision_notes.sql` y confirmar visualmente el badge + el modal de decisión.

### Actualización: bug multi-sede en Novedades + edición con historial auditado (2026-08-09)
El usuario reportó que un empleado de las pruebas multi-sede (Fase 2) no aparecía en Novedades, y pidió poder editar una novedad sin perder trazabilidad (hoy la única corrección posible era eliminar, sin dejar rastro).

**Bug real encontrado y corregido:** `LeaveManagement.tsx` se armó ANTES de que se implementara el fix de visibilidad multi-sede en `EmployeeManagement.tsx` (sesión del mismo día), y nunca se le replicó — su `fetchData` solo traía empleados con `company_id = sede activa`, sin considerar `InA_employee_branches`. Corregido con el mismo patrón de fusión de dos consultas ya usado en `EmployeeManagement.tsx`, aplicado tanto al selector de empleados del formulario como al filtro de la lista de novedades (para que una novedad recién creada para un empleado "de visita" no desaparezca de la vista).

**Edición con auditoría (nuevo):**
- **`supabase/migrations/0008_leave_request_audit.sql`** (el usuario debe ejecutarla): tabla `InA_leave_request_audit` + un **trigger** `AFTER UPDATE OR DELETE` en `InA_leave_requests` (función `log_leave_request_change`, `SECURITY DEFINER`) que registra automáticamente cada cambio — sin depender de que el frontend "se acuerde" de auditar. Guarda `old_data`/`new_data` como JSONB completo de la fila, quién hizo el cambio (resuelto desde `auth.uid()`), y `organization_id` **desnormalizado** (no depende de que el registro original siga existiendo) para que la traza sobreviva incluso si la novedad se elimina — eso es justo lo que preocupaba al usuario ("no quedaría trazabilidad"). RLS de solo lectura por organización; nadie escribe ahí directo, solo el trigger.
- **`LeaveManagement.tsx`**: botón "Editar" (reutiliza el mismo formulario de creación, precargado) y botón "Ver Historial" por fila, que abre un modal listando cada cambio (quién, cuándo, qué campo cambió de qué a qué) leyendo de la tabla de auditoría.

**Verificado:** `npx tsc --noEmit` y `npm run build` limpios, app cargando sin errores en pestaña nueva. **Pendiente para el usuario:**
1. Ejecutar `0008_leave_request_audit.sql` en Supabase DEV.
2. Confirmar que el empleado multi-sede ya aparece en el selector de Novedades al ver la sede donde está "de visita".
3. Editar una novedad existente y confirmar que el historial muestra el cambio con el detalle correcto.
4. Eliminar una novedad de prueba y confirmar (vía SQL Editor, consultando `InA_leave_request_audit`) que quedó el registro de la eliminación aunque la fila original ya no exista.

### Actualización: panel "Ausencias de Hoy" en el dashboard (2026-08-09)
El usuario preguntó si las novedades deberían aparecer en las alertas del dashboard para dar contexto de por qué falta alguien. Se revisó el código de alertas y hoy solo existen 2 tipos (`Llegada Tarde`, `Alerta Horas Extras`) — todavía no hay una alerta de "ausencia/no marcó", así que no había riesgo inmediato de falsos positivos. Aun así, se implementó un panel **informativo** (no una alerta — deliberadamente con estilo azul neutral, no rojo/ámbar) en `AdminDashboard.tsx`: "N Colaboradores con Ausencia Justificada Hoy", listando a quién y qué tipo de novedad aprobada cubre la fecha de hoy, scopeado igual que `LeaveManagement.tsx` (sede principal + empleados "de visita" multi-sede).

**Decisión explícita de alcance:** no se tocó el fetch principal de `profiles` en `AdminDashboard.tsx` (línea ~70), que **también tiene el mismo gap de multi-sede** (`eq('company_id', companyId)` sin considerar `InA_employee_branches`) — pero ese fetch alimenta todo el cálculo de horas/costos/alertas existente, y ampliarlo cambiaría de qué sede "cuentan" las horas de un empleado multi-sede para nómina, una decisión de negocio que no se ha confirmado con el usuario (a diferencia de la visibilidad, que sí). Se dejó anotado aquí para no perderlo — probablemente hay que resolverlo como parte de la Fase 4 (nómina avanzada), cuando se defina explícitamente ese comportamiento.

**Verificado:** `tsc`/`build` limpios, app cargando sin errores en pestaña nueva. Pendiente para el usuario: confirmar visualmente el panel con un empleado que tenga una novedad aprobada cubriendo la fecha de hoy.

---

## 17. Fase 4: nómina avanzada (2026-08-09) — migración a RPC aplazada deliberadamente

El roadmap original planteaba mover el cálculo de nómina a una función RPC de Postgres. Al revisarlo con el usuario, **se decidió aplazarlo**: la lógica (agrupación de turnos, franjas diurna/nocturna, horario abierto) ya está probada y correcta en `calculations.ts` (verificada con un script de casos concretos en la Fase 2.5), y escribir ~200 líneas de PL/pgSQL sin poder probarlas contra datos reales (sin acceso de escritura a la BD en este entorno) es un riesgo real sobre plata de nómina, sin beneficio inmediato — hoy no hay otro consumidor de estos números fuera del frontend. Queda como deuda técnica anotada para cuando haya un motivo concreto (ej. una app externa que necesite los mismos cálculos).

En su lugar, esta fase resolvió 2 cosas de bajo riesgo y valor real, encontradas al revisar el código:

### 1. Bug corregido: horas multi-sede perdidas en el dashboard
`AdminDashboard.tsx` (el `useEffect` principal que trae `profiles`) tenía el mismo gap de multi-sede ya corregido en `EmployeeManagement.tsx` y `LeaveManagement.tsx` esta sesión — el fetch era `eq('company_id', companyId)`, solo la sede principal. Las horas trabajadas por un empleado multi-sede en una sede "de visita" no se contaban en NINGÚN dashboard (ni el de la sede donde marcó, ni el de su sede principal). Corregido con el mismo patrón de fusión de dos consultas. Al ser `profiles` el estado compartido por todo el `useMemo` de `stats`, esto arregla automáticamente el conteo de empleados, horas, costo, alertas y las exportaciones ICG/Excel para estos casos.

### 2. Nueva alerta: Ausencia No Justificada + exclusión de novedades aprobadas
Hoy no existía ninguna detección de "no llegó" — solo `Llegada Tarde` y `Alerta Horas Extras`. Se agregó, dentro del mismo `useMemo` de `stats`: por cada día del rango seleccionado (nunca días futuros) y cada perfil con horario activo ese día (mismo criterio que ya usa la detección de tardanza), si no hay ninguna marcación ese día y no hay una novedad aprobada (`InA_leave_requests`, ya se traía para el panel "Ausencias de Hoy" de la sesión anterior) que cubra la fecha → se cuenta como `unjustifiedAbsences` en el resumen del empleado y, si es hoy, se agrega a las alertas con `severity: 'error'` — mismo patrón que las alertas existentes. `exportToExcel` gana la columna "Ausencias No Justificadas" en la hoja de resumen.

### Verificado
`npx tsc --noEmit` y `npm run build` limpios, app cargando sin errores en pestaña nueva del navegador de pruebas. **Pendiente para el usuario:**
1. Confirmar que un empleado multi-sede que marcó en una sede secundaria ahora aparece en las horas/costo de esa sede.
2. Crear una novedad aprobada cubriendo hoy para un empleado con horario activo, y confirmar que NO aparece como ausencia no justificada.
3. Con otro empleado sin marcación ni novedad hoy, confirmar que SÍ aparece la alerta.
4. Revisar la columna nueva en el Excel exportado.

---

## 10. Cómo correr el proyecto localmente

```bash
cd frontend
npm install
npm run dev
```
Requiere `frontend/.env` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV=development` (ver `frontend/.env.example`).
