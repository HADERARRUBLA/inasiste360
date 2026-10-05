# DIRECTIVA: CHECKLIST_REGRESION_SOP

> **ID:** 20261005_REG
> **Última Actualización:** 2026-10-05
> **Estado:** ACTIVO

---

## 1. Objetivo
Revisión de ~10 minutos para confirmar que **lo básico** funciona antes y después de cada paso a Producción. Hay clientes reales usando el sistema: lo básico no puede fallar.

Flujo: `develop` → Preview (base de **pruebas**) → Pull Request → `master` (Producción, base de **producción**).

## 2. Antes de fusionar — en el Preview de `develop` (datos de DEMO-CLIENTES)
- [ ] El PR muestra **todos los checks en verde** (`frontend` + Vercel).
- [ ] Si el cambio necesita SQL: ya corrido en el Supabase de **pruebas**.
- [ ] **Login de administrador** con correo y contraseña → carga el dashboard con datos.
- [ ] **Selector de sede** (si el admin tiene varias): cambia de sede y los datos cambian.
- [ ] **Kiosko por enlace de sede** (`?kiosko=<id>`): abre con el nombre de la sede, **sin botón de salir**. Marcar entrada con PIN (con GPS y cámara si la sede tiene biometría) → mensaje de éxito.
- [ ] La marcación aparece en el **Dashboard** y en **Auditoría** (foto, ubicación).
- [ ] **Kiosko celular** (`?kiosko=movil`): cédula + PIN → lista de sedes del empleado → marcar.
- [ ] **Informes**: generar el Informe 1 en un rango con datos → la tabla se llena y el Excel se descarga y abre.
- [ ] **Exportar Excel** desde el Dashboard → descarga y abre.
- [ ] **Empleados**: abrir uno, editar y guardar un campo. **Novedades**: crear una y verla en la lista.
- [ ] Probar también desde el **celular** (panel y Kiosko).

## 3. Después de fusionar — en Producción (`in.asiste360.com`)
- [ ] En Vercel → Deployments aparece una fila nueva con la insignia **Production**, estado **Ready**.
- [ ] Si el cambio necesita SQL: ya corrido en el Supabase de **producción** (idealmente *antes* de fusionar).
- [ ] La landing carga sin errores.
- [ ] **Login de administrador** real → dashboard con los datos del cliente.
- [ ] El **enlace de Kiosko** de una sede real abre y muestra el nombre correcto.
- [ ] Una marcación con un **empleado de prueba** acordado con el cliente.
- [ ] **NUNCA** usar el botón "Borrar registros" del Dashboard en Producción durante las pruebas.

## 4. Si algo falla en Producción
1. **Instant Rollback** (Vercel → Deployments → fila anterior que funcionaba → `⋯` → *Instant Rollback*). Restaura el código en segundos.
2. El rollback **no revierte la base de datos**: las migraciones SQL son solo aditivas, así que el código anterior sigue funcionando con ellas.
3. Anotar qué falló y corregirlo en `develop`; nunca directo en `master` (está protegida).

## 5. Reglas que no se negocian
- Nada llega a `master` sin Pull Request y sin el check `frontend` en verde.
- Migraciones SQL: solo columnas nullable o con DEFAULT; nunca `DROP COLUMN`, `DROP TABLE` ni `TRUNCATE`. Se corren a mano en **ambos** Supabase.
- Typecheck real: `npm run typecheck` (el `tsc --noEmit` de la raíz no revisa nada).
