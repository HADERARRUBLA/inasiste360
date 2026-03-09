# Protocolo de Desarrollo Seguro (Git + Vercel)

Este documento define cómo trabajaremos en nuevas mejoras para **Asiste360** sin poner en riesgo la versión que ya funciona (MVP).

## 1. El Flujo de Trabajo (Branching)

Nunca trabajaremos directamente en la rama `master` para funciones nuevas. Usaremos "Ramas de Desarrollo".

| Rama | Propósito | Estado en Vercel |
| :--- | :--- | :--- |
| **master** | Versión de Producción (MVP). Solo código estable. | [inasiste360.vercel.app](https://inasiste360.vercel.app) |
| **desarrollo** | Nuevas funciones y pruebas. | URL de Previsualización (Vercel la genera sola) |

## 2. Pasos para una Mejora Nueva

1. **Crear Rama:** Antes de tocar el código, crearé una rama como `feat-mejoras-ui` o `fix-error-login`.
2. **Desarrollar:** Haré los cambios solo en esa rama.
3. **Validar en Vercel (Preview):** Vercel detectará la rama y te dará una URL temporal para que pruebes los cambios **sin que afecte a la página principal**.
4. **Merge (Fusión):** Si todo está perfecto, "fusionaremos" esa rama con `master` para que suba a producción.

## 3. Prevención de Errores y Rollbacks

### A. Si un cambio en `master` rompe algo:
Vercel guarda un historial. Podemos volver a una versión anterior con un solo clic:
1. Ve a **Deployments**.
2. Busca la versión que funcionaba (hace 10 min, ayer, etc.).
3. Haz clic en los tres puntos y elige **Promote to Production**. Esto restaurará la versión anterior en segundos.

### C. Seguridad de Base de Datos (RLS):
Cada vez que una operación falle con un error de "Row Level Security (RLS)", debemos:
1. Revisar si la tabla tiene políticas de `INSERT`, `UPDATE` o `DELETE` activas.
2. Aplicar la política correspondiente en Supabase antes de subir el cambio al frontend.

## 4. Próximos Pasos (Propuesta)
- [ ] Configurar rama de `desarrollo`.
- [ ] Implementar sistema de logs más robusto para capturar errores en vivo.
- [ ] Empezar con la primera mejora solicitada usando este flujo.
