# DIRECTIVA: IMPORT_EXPORT_EMPLEADOS_SOP

> **ID:** 20260327_IMP_EXP
> **Script Asociado:** N/A (Integrado en Frontend)
> **Última Actualización:** 2026-03-27
> **Estado:** EN_PROCESO

---

## 1. Objetivos y Alcance
Esta directiva define el procedimiento para la gestión masiva de colaboradores (perfiles) utilizando la librería `xlsx`.
- **Objetivo 1:** Exportar la base de datos actual de empleados a un archivo Excel legible.
- **Objetivo 2:** Importar nuevos empleados desde un archivo Excel, respetando las restricciones de la base de datos.
- **Objetivo 3:** Mantener la seguridad y consistencia de los datos (IDs únicos, campos obligatorios).

## 2. Especificación del Formato Excel

### Columnas Requeridas (Estructura de la Plantilla)
| Columna Excel | Campo DB (`InA_profiles`) | Tipo | Notas |
|---------------|---------------------------|------|-------|
| `Nombre Completo` | `full_name` | String | Obligatorio |
| `Identificacion` | `national_id` | String | Obligatorio (Único) |
| `PIN de Acceso` | `pin_code` | String | Obligatorio (4-6 dígitos) |
| `Telefono` | `phone_number` | String | Opcional |
| `Tarifa Base` | `hourly_rate_base` | Number | Obligatorio |
| `Extra Diurna` | `hourly_rate_extra_day` | Number | Opcional |
| `Extra Nocturna` | `hourly_rate_extra_night` | Number | Opcional |
| `Dominical` | `hourly_rate_sunday_holiday` | Number | Opcional |
| `Extra Dom Diurna` | `hourly_rate_sunday_holiday_extra_day` | Number | Opcional |
| `Extra Dom Nocturna` | `hourly_rate_sunday_holiday_extra_night` | Number | Opcional |

## 3. Flujo Lógico de Implementación

### Exportación
1. Obtener la lista de `profiles` filtrada por `company_id`.
2. Mapear los nombres técnicos de la DB a nombres de columna amigables (ver tabla arriba).
3. Generar el `Worksheet` y descargar el archivo como `Empleados_Asiste360_[Sede]_[Fecha].xlsx`.

### Importación
1. Seleccionar archivo `.xlsx` mediante un `input` oculto.
2. Leer el archivo y convertir la primera hoja a JSON.
3. **Validación:**
   - Verificar que existan las columnas obligatorias.
   - Limpiar espacios en blanco.
   - Asegurar que `national_id` y `pin_code` sean strings.
4. **Enriquecimiento:**
   - Asignar el `company_id` y `organization_id` actual de la sesión.
   - Asignar `role` = 'employee' por defecto.
   - Forzar `is_active` = `true`.
5. **Inserción Masiva:**
   - Usar `supabase.from('InA_profiles').upsert()` para evitar duplicados si el ID ya existe (o `insert` si se prefiere error de duplicado).
   - Recargar la lista de empleados tras el éxito.

## 4. Restricciones y Advertencias
- **Biometría:** El rostro (`face_vector`) y la foto (`profile_photo`) **NO** se pueden importar vía Excel por seguridad y limitaciones de formato. Deben capturarse manualmente.
- **Sobreescritura:** Se debe decidir si la importación actualiza empleados existentes (`upsert`) o solo agrega nuevos. Se recomienda `upsert` basado en `national_id`.
- **Límites:** PostgREST maneja bien lotes de hasta 1000 registros, pero se recomienda validar antes de enviar.

## 5. Protocolo de Verificación
1. Exportar la lista actual y verificar que las columnas coincidan con las de la base de datos.
2. Modificar un valor en el Excel (ej. Tarifa Base) e importarlo. Verificar que el cambio se refleje en el dashboard.
3. Intentar importar un archivo con columnas faltantes y verificar que el sistema muestre una alerta amigable.

## 6. Historial de Aprendizaje
| Fecha | Nota |
|-------|------|
| 27/03/26 | Diseño inicial de la directiva de importación/exportación masiva. |
