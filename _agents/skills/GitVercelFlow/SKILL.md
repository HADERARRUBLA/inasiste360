# Skill: Git & Vercel Deployment Flow

Esta skill define el procedimiento operativo estándar para gestionar cambios en el repositorio de GitHub y el despliegue automático en Vercel para el proyecto Asiste360.

## 📋 Objetivos
- Mantener la integridad de la rama `master` (Producción).
- Validar cambios en una rama de `desarrollo` (VPreview).
- Facilitar rollback rápidos en caso de errores en producción.

## 🛠️ Procedimiento

### 1. Desarrollo Iterativo
1. Trabajar en rama `desarrollo`.
2. Probar localmente: `npm run dev`.

### 2. Sincronización Remota
Para subir cambios a desarrollo:
```powershell
git add .
git commit -m "feat: [descripción del cambio]"
git push origin desarrollo
```

### 3. Validación VPreview
- Acceder a la URL de preview generada por Vercel.
- Verificar:
  - Persistencia de datos en Supabase.
  - Funcionamiento de la cámara y reconocimiento facial.
  - Corrección de bugs específicos reportados.

### 4. Merge a Producción
```powershell
git checkout master
git merge desarrollo
git push origin master
```

## 🚨 Caso de Emergencia: Rollback
Si Master falla, NO esperes a Git. Usa el panel de Vercel:
1. Pestaña `Deployments`.
2. En la versión anterior elige `Promote to Production`.
