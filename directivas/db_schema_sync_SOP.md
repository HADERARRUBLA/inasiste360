# Directiva: Sincronización de Esquema de Base de Datos (SOP)

Este documento define el procedimiento para manejar discrepancias entre el código frontend y el esquema real de Supabase cuando no se tiene acceso directo a las herramientas de introspección de base de datos.

## Contexto
El proyecto utiliza Supabase como backend. Se han detectado errores de restricción (NOT NULL, Foreign Key) que sugieren que el esquema en la nube difiere de las suposiciones iniciales del código.

## Protocolo de Investigación
1.  **Inspección Dinámica**: Si `list_tables` falla, usar un script de Python con el cliente de Supabase para:
    *   Listar las llaves (columnas) de un objeto obtenido con `.select('*').limit(1)`.
    *   Imprimir los nombres exactos de las columnas y tipos detectados.
2.  **Mapeo de Claves Foráneas**: Identificar si la relación es `user_id` -> `profiles.id` o `user_id` -> `auth.users.id`.
    *   Si es hacia `auth.users.id`, se debe asegurar que el perfil tenga el ID de usuario correspondiente.
    *   Si es hacia `profiles.id`, verificar que el nombre de la columna en `time_entries` sea realmente `user_id`.

## Reglas de Implementación
*   **Prefijos de Tablas (IMPORTANTE)**: Todas las consultas a Supabase deben utilizar el prefijo `InA_` (ej. `InA_profiles`, `InA_time_entries`, `InA_companies`). **NUNCA** usar nombres de tabla sin el prefijo, ya que esto romperá la integridad de datos en el entorno productivo.
*   **Neutralidad de Nombres**: Usar siempre los nombres de columna detectados en la DB, incluso si difieren de las convenciones de TypeScript (ajustar `types.ts` en consecuencia).
*   **Manejo de Errores Críticos**:
    *   `null value in column "X" violates not-null constraint`: Añadir "X" al objeto de inserción.
    *   `insert or update... violates foreign key constraint "Y"`: Verificar que el valor del ID enviado exista en la tabla referenciada y que el nombre de la columna sea el correcto.

## Trampas Conocidas
*   **Columnas Duales**: A veces existen `user_id` (para Auth) y `profile_id` (para Negocio). Siempre verificar cuál es la que requiere el FK.
*   **Restricciones de Fecha**: El campo `date` suele ser obligatorio y debe enviarse en formato `YYYY-MM-DD`.

## Ciclo de Aprendizaje
Si un registro falla por esquema, actualizar esta directiva con el hallazgo específico para evitar repetir el error.
