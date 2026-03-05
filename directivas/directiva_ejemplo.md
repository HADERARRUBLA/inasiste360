# DIRECTIVA: [NOMBRE_CLAVE_DE_LA_TAREA_SOP]

> **ID:** [ID_UNICO_O_FECHA]
> **Script Asociado:** `scripts/[nombre_del_script].py`
> **Última Actualización:** [FECHA_ACTUAL]
> **Estado:** [BORRADOR / ACTIVO / DEPRECADO]

---

## 1. Objetivos y Alcance
*Describe aquí QUÉ debe lograr esta tarea y POR QUÉ.*
- **Objetivo Principal:** [Descripción concisa de la meta final, ej: "Extraer datos financieros de la API de AlphaVantage y normalizarlos a CSV".]
- **Criterio de Éxito:** [Condición exacta para considerar la tarea completada, ej: "El archivo output.csv existe y no está vacío".]

## 2. Especificaciones de Entrada/Salida (I/O)
*Define estrictamente los tipos de datos para garantizar determinismo.*

### Entradas (Inputs)
- **Argumentos Requeridos:**
  - `[nombre_arg]`: [Tipo de dato] - [Descripción].
- **Variables de Entorno (.env):**
  - `[NOMBRE_VAR]`: [Descripción del secreto/token necesario].
- **Archivos Fuente:**
  - `[ruta/al/archivo]`: [Descripción].

### Salidas (Outputs)
- **Artefactos Generados:**
  - `[ruta/de/salida]`: [Formato y descripción del contenido].
- **Retorno de Consola:** [Qué debe imprimir el script al finalizar: JSON, Path o Mensaje de éxito].

## 3. Flujo Lógico (Algoritmo)
*NO escribas código aquí. Describe la lógica paso a paso para que cualquier script futuro pueda replicar el proceso.*

1. **Inicialización:** [Ej: Cargar variables de entorno y validar existencia de carpetas].
2. **Adquisición:** [Ej: Conectar a la base de datos X].
3. **Procesamiento:** [Ej: Filtrar filas donde la columna Y sea nula].
4. **Persistencia:** [Ej: Guardar resultado en .tmp/].
5. **Limpieza:** [Ej: Cerrar conexiones].

## 4. Herramientas y Librerías
*Lista blanca de dependencias permitidas.*
- **Librerías Python:** `[pandas]`, `[requests]`, `[os]`.
- **APIs Externas:** [Nombre y versión de la API].

## 5. Restricciones y Casos Borde (Edge Cases)
*Condiciones conocidas que podrían romper el flujo estándar.*

### Limitaciones Conocidas
- **Limitación 1**: Descripción y cómo manejarla
- **Limitación 2**: Descripción y cómo manejarla

### Errores Comunes y Soluciones
- **Error X**: Por qué ocurre y cómo evitarlo
- **Error Y**: Por qué ocurre y cómo evitarlo

### Validaciones Requeridas
- Validación de entrada 1
- Validación de entrada 2
- Verificación de recursos necesarios

## 6. Protocolo de Errores y Aprendizajes (Memoria Viva)
*CRÍTICO: Esta sección se actualiza automáticamente tras fallos. Aquí reside la inteligencia acumulada.*

| Fecha | Error Detectado | Causa Raíz | Solución/Parche Aplicado |
|-------|-----------------|------------|--------------------------|
| [DD/MM] | [Error Type] | [Por qué falló] | [Instrucción: "Usar método X en lugar de Y"] |
| ... | ... | ... | ... |

> **Nota de Implementación:** Si encuentras un nuevo error, **primero** arréglalo en el script, y **luego** documenta la regla aquí para evitar regresiones futuras.

## 7. Ejemplos de Uso
*Comandos para invocar el script asociado.*

```bash
# Ejecución estándar
python scripts/[nombre_del_script].py --input "valor"
```

## 8. Checklist de Pre-Ejecución
- [ ] Variables de entorno configuradas en `.env`
- [ ] Dependencias instaladas (`pip install -r requirements.txt`)
- [ ] Archivos de entrada disponibles y validados
- [ ] Permisos necesarios otorgados (API, archivos, etc.)

## 9. Checklist Post-Ejecución
- [ ] Salidas generadas correctamente
- [ ] Logs revisados para errores/advertencias
- [ ] Resultados validados contra criterios esperados
- [ ] Directiva actualizada con nuevos aprendizajes (si aplica)

## 10. Notas Adicionales
Cualquier contexto que no encaje en las secciones anteriores.

[Placeholder para decisiones de diseño, referencias a documentación externa, o advertencias de seguridad].
