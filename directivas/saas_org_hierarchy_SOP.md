# SOP: Jerarquía SAAS (Empresas y Sedes) - Asiste360

## Objetivo
Implementar una estructura multi-inquilino (multi-tenant) donde existan "Empresas" que agrupen múltiples "Sedes", permitiendo que los administradores gestionen una o varias sedes de su empresa.

## Arquitectura de Datos (Tablas InA_)

### 1. InA_organizations (Nivel Superior)
- `id` (uuid, PK)
- `name` (text, Not Null) - Nombre de la Empresa (ej: "Empresa ABC")
- `nit` (text, Unique) - Identificación tributaria
- `is_active` (boolean, default true)
- `created_at` / `updated_at`

### 2. InA_companies (Nivel Sede - Antiguo Companies)
*Nota: Se mantiene el nombre técnico para evitar roturas de código ya desplegado, pero se trata como "Sede".*
- `id` (uuid, PK)
- `organization_id` (uuid, FK a InA_organizations) - **NUEVO**
- `name` (text) - Nombre de la Sede (ej: "Sede Centro")
- (Columnas existentes: address, lat_long, radius_limit, etc.)

### 3. InA_profiles (Usuarios y Perfiles)
- `id` (uuid, PK)
- `organization_id` (uuid, FK a InA_organizations) - **NUEVO** - Empresa a la que pertenece el usuario.
- `role` ('superadmin', 'admin', 'employee')
- `company_id` (uuid, FK a InA_companies, Nullable) - Sede principal/asignada.
- (Columnas existentes: full_name, national_id, pin_code, etc.)

### 4. InA_admin_branches (Puente de Permisos - Opcional para Múltiples Sedes)
- `admin_id` (uuid, FK a InA_profiles)
- `branch_id` (uuid, FK a InA_companies)

---

## Reglas de Negocio

1. **Super Admin:** Tiene acceso total a todas las Organizaciones (Empresas) y Sedes.
2. **Admin de Empresa:** Tiene acceso a ver y gestionar TODAS las sedes asociadas a su `organization_id`.
3. **Empleado:** Solo ve y registra tiempo en su `company_id` (Sede) asignada.
4. **Login:** El sistema detecta el `organization_id` del usuario al loguearse y filtra el contenido del Dashboard según sus permisos.

---

## Pasos de Implementación

1. **Base de Datos:**
   - Crear tabla `InA_organizations`.
   - Añadir columnas `organization_id` a `InA_companies` e `InA_profiles`.
   - Crear una Organización por defecto y asignar a ella todas las empresas/perfiles actuales para no romper la app existente.
2. **Frontend:**
   - Crear vista de "Gestión de Empresas" (Solo para Super Admin).
   - Actualizar "Gestión de Sedes" para que permita elegir a qué Empresa pertenece cada sede (o se asigne automáticamente a la del admin logueado).
   - Actualizar "Gestión de Administradores" para asignar una Empresa.
3. **Filtrado:**
   - Modificar las queries de Supabase en el Dashboard para filtrar por `organization_id` si el rol es 'admin'.
