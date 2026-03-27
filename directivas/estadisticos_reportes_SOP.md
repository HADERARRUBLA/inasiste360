# DIRECTIVA: ESTADISTICOS_REPORTES_SOP

> **ID:** 20260325_EST
> **Script Asociado:** `scripts/update_dashboard_reports.py` (Referencial)
> **Última Actualización:** 2026-03-25
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance
Esta directiva define las mejoras en el sistema de reportes y estadísticas de Asiste360.
- **Objetivo 1:** Cambiar la exportación de CSV a Excel (.xlsx) real.
- **Objetivo 2:** Incluir reportes detallados de pausas (desayuno, almuerzo, etc.) totales y por empleado.
- **Objetivo 3:** Reportar llegadas tarde totales y por empleado.
- **Objetivo 4:** Implementar alertas y reportes de horas extras (diurnas, nocturnas, dominicales).

## 2. Especificaciones de Implementación

### Exportación a Excel
- Usar la librería `xlsx` en el frontend para generar archivos `.xlsx`.
- El archivo debe contener múltiples hojas o secciones claras: Log Detallado, Resumen de Horas/Pausas, Alertas y Novedades.

### Lógica de Tiempos y Pausas
- **Eventos de Pausa:** `breakfast`, `lunch`, `active_pause`, `other`.
- **Cálculo:** Diferencia de tiempo entre el inicio de la pausa y el siguiente evento (usualmente un 'in' marcado como retorno).
- **Consolidación:** Sumar minutos totales por tipo de pausa y por empleado.

### Llegadas Tarde
- Comparar el primer evento `in` del día (que no sea retorno) con el `work_schedule` (ya sea personalizado del perfil o global de la sede).
- Almacenar el conteo de llegadas tarde y los minutos de retraso.

### Horas Extras
- **Diurnas:** Horas trabajadas después del horario de salida programado y antes del inicio de la jornada nocturna (ej. 21:00).
- **Nocturnas:** Horas trabajadas durante el periodo nocturno definido (ej. 21:00 a 06:00).
- **Dominicales:** Horas trabajadas en domingo.
- **Alertas:** Notificar si un empleado supera un umbral de horas extras (configurable o por defecto).

## 3. Restricciones y Casos Borde
- **Sin Regresiones:** El "Branding Ejecutivo" (Landing page dark mode) no debe verse afectado. Los estilos del dashboard deben permanecer consistentes con el diseño premium actual.
- **Datos Faltantes:** Manejar casos donde no hay `work_schedule` definido.
- **Zonas Horarias:** Asegurar que los cálculos de fecha/hora sean consistentes (usar `toLocaleDateString('en-CA')` para comparaciones de fecha).

## 4. Protocolo de Verificación
1. Verificar que el botón "DESCARGAR EXCEL COMPLETO" genere un archivo `.xlsx`.
2. Confirmar que los totales de pausas coincidan con la sumatoria de logs.
3. Validar que las llegadas tarde se marquen correctamente según el horario configurado.

## 5. Historial de Aprendizaje
| Fecha | Nota |
|-------|------|
| 25/03/26 | Inicio de mejoras de estadísticos: Excel, Pausas, Tardanzas y Extras. |
| 27/03/26 | Error de Cálculo 0m | Los registros sembrados en batch tenían el mismo `created_at`. Solución: Usar `clock_in` y `clock_out` prioritariamente. |
| 27/03/26 | Error Schema Cache | PostgREST fallaba por columnas inexistentes (ej. `hourly_rate_sunday`). Ajustado a `hourly_rate_sunday_holiday`. |
