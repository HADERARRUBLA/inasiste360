# Protocolo de Desarrollo Seguro Asiste360 (Git + Vercel)

Este documento define el estándar de despliegue para **Asiste360** para garantizar que la versión de producción (`master`) sea siempre estable y funcional.

## 1. Ramas y Entornos

| Rama | Entorno Vercel | Propósito | URL |
| :--- | :--- | :--- | :--- |
| **master** | **Production** | Versión oficial para clientes. | [inasiste360.vercel.app](https://inasiste360.vercel.app) |
| **desarrollo** | **Preview** | Pruebas, nuevas funciones y correcciones. | Generada por Vercel (ver Panel) |

## 2. El Ciclo de Vida del Cambio (Paso a Paso)

### Paso 1: Desarrollo Local
*   Se realizan los cambios en la rama `desarrollo`.
*   Se prueban localmente con `npm run dev`.

### Paso 2: Despliegue a Desarrollo (Preview)
*   Se sube el código: `git push origin desarrollo`.
*   **Vercel** detecta el cambio y genera un **Preview Deployment**.
*   **Acción del Usuario/Agente**: Abrir el link de Preview desde el Panel de Vercel.

### Paso 3: Validación Obligatoria (QA)
Antes de pasar a producción, se debe verificar en el link de **Preview**:
- [ ] **Login**: ¿Entra correctamente?
- [ ] **Marcación**: ¿Registra entradas/salidas con foto?
- [ ] **Auditoría**: ¿Se ven las fotos de referencia y evidencia?
- [ ] **Dashboard**: ¿Los cálculos (horas, costos) son coherentes?

### Paso 4: Paso a Producción (Merge)
Solo cuando el Paso 3 sea exitoso:
1. Sincronizar local: `git checkout master` + `git merge desarrollo`.
2. Subir a Producción: `git push origin master`.
3. Vercel desplegará automáticamente la nueva versión oficial.

## 3. Control y Rescate (Panel de Vercel)

Si algo falla en producción a pesar de las pruebas:
1. **Instant Rollback**: En el panel de Vercel, ve a `Deployments`, busca la versión anterior que funcionaba y selecciona **"Promote to Production"**. Esto restaura el sitio en segundos sin necesidad de git.
2. **Logs en Vivo**: Usa la pestaña `Logs` de Vercel para identificar errores 500 o fallos de API en tiempo real.

## 4. Gestión de Memoria (SOP)
Cada vez que se aprenda una restricción nueva (ej. "Vercel falla si la imagen pesa > 4MB"), se debe actualizar este SOP en la sección **Casos Borde**.

---
*Última actualización: Marzo 2026*
