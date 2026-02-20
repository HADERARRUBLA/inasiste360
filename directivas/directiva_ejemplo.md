# [Nombre de la Tarea] — SOP (Procedimiento Operativo Estándar)

> **Autor:** Agente de Desarrollo  
> **Fecha de Creación:** YYYY-MM-DD  
> **Última Actualización:** YYYY-MM-DD  
> **Estado:** Borrador | En Progreso | Validado

---

## 1. Objetivo

Describir de forma clara y concisa **qué hace** esta tarea y **por qué** existe.

> _Ejemplo: "Extraer leads de LinkedIn Sales Navigator, calificarlos con IA y registrarlos en un Google Sheet para seguimiento comercial."_

---

## 2. Entradas (Inputs)

| Nombre         | Tipo           | Fuente                  | Obligatorio | Notas                          |
|----------------|----------------|-------------------------|-------------|--------------------------------|
| `ejemplo_api`  | API Key        | `.env` → `EJEMPLO_KEY`  | Sí          | Token de acceso a la API X     |
| `archivo_csv`  | Archivo CSV    | `.tmp/entrada.csv`      | No          | Opcional: lista de seeds       |
| `config_param` | JSON / Dict    | Hardcoded en script     | Sí          | Parámetros de configuración    |

---

## 3. Salidas (Outputs)

| Nombre              | Tipo        | Destino                      | Notas                               |
|---------------------|-------------|------------------------------|--------------------------------------|
| `resultado.csv`     | CSV         | `.tmp/resultado.csv`         | Archivo intermedio procesado         |
| `reporte_final.xlsx`| Excel       | `./output/reporte_final.xlsx`| Entregable final al usuario          |
| `log de ejecución`  | Log         | Consola / archivo `.log`     | Registro de eventos y errores        |

---

## 4. Lógica / Flujo de Trabajo

### Paso 1: Preparación
- Cargar variables de entorno desde `.env`.
- Validar que todas las entradas obligatorias existen.

### Paso 2: Extracción de Datos
- Conectar a la fuente de datos (API, base de datos, archivo).
- Descargar/leer los datos crudos.

### Paso 3: Transformación
- Limpiar datos (eliminar duplicados, normalizar formatos).
- Aplicar lógica de negocio (filtros, cálculos, clasificaciones).

### Paso 4: Carga / Salida
- Guardar resultados en el destino configurado.
- Confirmar la escritura exitosa.

### Paso 5: Logging y Cierre
- Registrar métricas del proceso (registros procesados, errores, tiempo).
- Notificar al usuario si corresponde.

---

## 5. Dependencias

```
# Librerías Python requeridas
pandas>=2.0
python-dotenv>=1.0
requests>=2.28
openpyxl>=3.1     # Si se genera Excel
```

---

## 6. Restricciones y Casos Borde ⚠️

> **Esta sección es CRÍTICA.** Aquí se documenta todo lo que aprendemos sobre errores, límites y comportamientos inesperados. Cada vez que un script falla, la lección se registra aquí.

### Restricciones Conocidas

| #  | Restricción                                         | Descubierta | Impacto                      | Solución                                         |
|----|-----------------------------------------------------|-------------|------------------------------|--------------------------------------------------|
| 1  | _Ejemplo: La API X tiene rate limit de 100 req/min_ | 2024-01-15  | Script falla con error 429   | Implementar `time.sleep(0.6)` entre requests     |
| 2  | _Ejemplo: El campo "fecha" viene en formato mixto_  | 2024-01-16  | Pandas no parsea correctamente| Usar `pd.to_datetime(col, format='mixed')`       |

### Notas de Aprendizaje

- **No hacer:** _(Documentar qué acciones evitar y por qué)_
- **Siempre hacer:** _(Documentar buenas prácticas descubiertas)_
- **Ojo con:** _(Documentar comportamientos sorpresivos)_

---

## 7. Ejecución

```bash
# Desde la raíz del proyecto
python scripts/nombre_tarea.py

# Con parámetros opcionales (si aplica)
python scripts/nombre_tarea.py --modo=completo --limite=500
```

---

## 8. Historial de Cambios

| Fecha      | Cambio                                        | Motivo                               |
|------------|-----------------------------------------------|--------------------------------------|
| YYYY-MM-DD | Creación inicial de la directiva              | Primera implementación               |
| YYYY-MM-DD | Agregada restricción #1 (rate limit)          | Error 429 en producción              |
