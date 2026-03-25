---
description: Proceso paso a paso para desplegar cambios desde local a Vercel (Desarrollo y Producción)
---

# 🚀 Flujo de Despliegue Asiste360

Sigue estos pasos estrictamente para asegurar que los cambios se prueben en desarrollo antes de llegar a los clientes en producción.

## 1. Preparación Local
1. Asegúrate de estar en la rama de desarrollo: `git checkout desarrollo`.
2. Sincroniza con el remoto: `git pull origin desarrollo`.
3. Realiza tus cambios de código.
4. Prueba localmente: `npm run dev` en la carpeta `frontend`.

## 2. Despliegue a Desarrollo (Preview)
1. Agrega tus cambios: `git add .`
2. Haz el commit: `git commit -m "Descripción clara del cambio"`
3. Sube a GitHub: `git push origin desarrollo`
4. **Verificación en Vercel**:
   - Ve al panel de Vercel.
   - Busca el **Deployment** más reciente marcado como **Preview**.
   - Abre la URL generada (ej: `inasiste360-git-desarrollo-inasiste.vercel.app`).
   - Prueba las funciones modificadas.

## 3. Despliegue a Producción (Official)
**IMPORTANTE**: Solo haz esto si la versión de Desarrollo (Preview) funciona perfectamente.
1. Cambia a la rama master: `git checkout master`
2. Sincroniza: `git pull origin master`
3. Mezcla los cambios probados: `git merge desarrollo`
4. Sube a GitHub para desplegar: `git push origin master`
5. **Verificación Final**: Abre [inasiste360.vercel.app](https://inasiste360.vercel.app) y confirma la estabilidad.

## 4. Gestión de Emergencias (Rollback)
Si algo falla en Producción:
1. Ve al panel de Vercel -> `Deployments`.
2. Busca la versión estable anterior (identificada por fecha).
3. Haz clic en los tres puntos (`...`) y selecciona **Promote to Production**.
4. Esto restaurará la versión anterior en segundos.

// turbo
## Checklist de Calidad (No saltar)
- [ ] ¿El Login funciona?
- [ ] ¿Los marcajes guardan foto?
- [ ] ¿El Dashboard muestra datos actualizados?
- [ ] ¿Las alertas de puntualidad se disparan?
