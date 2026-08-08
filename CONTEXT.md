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

---

## 10. Cómo correr el proyecto localmente

```bash
cd frontend
npm install
npm run dev
```
Requiere `frontend/.env` con `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV=development` (ver `frontend/.env.example`).
