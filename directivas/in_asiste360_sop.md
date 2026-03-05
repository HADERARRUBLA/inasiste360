# DIRECTIVA: IN_ASISTE360_SOP

> **ID:** 20260222
> **Script Asociado:** `scripts/in_asiste360_init.py`
> **Última Actualización:** 2026-02-22
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance
Esta directiva define los estándares y procedimientos para el desarrollo de la plataforma In_Asiste360.
- **Objetivo Principal:** Construir una plataforma multi-tenant de asistencia con biometría facial y geolocalización.
- **Criterio de Éxito:** Un empleado puede marcar su asistencia usando FaceID o PIN, el sistema valida su ubicación y calcula correctamente sus horas laboradas incluyendo recargos.

## 2. Especificaciones de Entrada/Salida (I/O)

### Entradas (Inputs)
- **Supabase credentials:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- **User Data:** Perfiles, coordenadas de sedes, configuraciones salariales.

### Salidas (Outputs)
- **Web App:** Aplicación React desplegada.
- **Database:** Esquema PostgreSQL en Supabase con RLS activo.
- **Logs:** Registros de tiempo en la tabla `time_entries`.

## 3. Flujo Lógico (Algoritmo)

1. **Configuración de Infraestructura:** Configurar Supabase (Tablas, Auth, RLS).
2. **Desarrollo Frontend:** 
    - Crear sistema de autenticación multi-tenant.
    - Implementar modo Kiosko con reconocimiento facial.
    - Implementar Dashboard administrativo para reportes.
3. **Cálculo de Nómina:** Lógica para separar horas ordinarias de nocturnas (después de las 18:00) y aplicar recargos.
4. **Validación Geográfica:** Comparar `geo_snapshot` con `lat_long` de la empresa dentro del `radius_limit`.

## 4. Herramientas y Librerías
- **Frontend:** React, Vite, TS, Tailwind, shadcn/ui.
- **Biometría:** `face-api.js`.
- **Backend:** Supabase (Auth, DB, Functions).

## 5. Restricciones y Casos Borde (Edge Cases)

### Limitaciones Conocidas
- **Biometría:** Depende de la calidad de la cámara y luz ambiente. Los vectores son sensibles a cambios drásticos.
- **Geofencing:** Requiere permisos de ubicación en el navegador.

### Errores Comunes y Soluciones
- **Fallas de RLS:** Asegurarse de que cada consulta incluya el `company_id` o que las políticas de RLS estén correctamente vinculadas al `auth.uid()`.

## 6. Protocolo de Errores y Aprendizajes (Memoria Viva)
| Fecha | Error Detectado | Causa Raíz | Solución/Parche Aplicado |
|-------|-----------------|------------|--------------------------|
| 22/02 | N/A | Inicio del proyecto | Definición inicial de la arquitectura. |

## 8. Checklist de Pre-Ejecución
- [ ] Supabase Project creado.
- [ ] Variables de entorno configuradas localmente.

## 9. Checklist Post-Ejecución
- [ ] Tablas creadas en Supabase.
- [ ] Auth configurado.
- [ ] Kiosko funcional.
