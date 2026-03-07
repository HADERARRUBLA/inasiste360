# DIRECTIVA: GITHUB_UPLOAD_SOP

> **ID:** 2026-03-04
> **Script Asociado:** N/A (Uso de Git CLI y MCP GitHub)
> **Última Actualización:** 2026-03-04
> **Estado:** ACTIVO

---

## 1. Objetivos y Alcance
- **Objetivo Principal:** Subir el contenido íntegro del proyecto local a un repositorio remoto en GitHub para control de versiones y respaldo.
- **Criterio de Éxito:** El repositorio existe en GitHub y contiene todos los archivos del proyecto (excluyendo los ignorados por `.gitignore`).

## 2. Especificaciones de Entrada/Salida (I/O)

### Entradas (Inputs)
- **Argumentos Requeridos:**
  - `repo_name`: String - Nombre del repositorio en GitHub.
- **Variables de Entorno (.env):**
  - `GITHUB_TOKEN`: Utilizado internamente por el servidor MCP de GitHub (si aplica) o configuración global de Git.

### Salidas (Outputs)
- **Artefactos Generados:**
  - Repositorio remoto en `https://github.com/[user]/[repo_name]`.
- **Retorno de Consola:** URL del repositorio subido.

## 3. Flujo Lógico (Algoritmo)

1. **Estado Local:** Verificar el estado de Git local (`git status`).
2. **Commit:** Agregar y realizar commit de todos los cambios actuales.
3. **Autenticación/Perfil:** Obtener información del usuario autenticado en GitHub.
4. **Creación Remota:** Crear un nuevo repositorio público/privado en GitHub usando herramientas MCP.
5. **Configuración de Remote:** Agregar el origin remoto al repositorio local.
6. **Push:** Subir la rama principal (`master` o `main`) al remoto.

## 4. Herramientas y Librerías
- **Herramientas CLI:** `git` (v2.x+).
- **Servidores MCP:** `github-mcp-server`.

## 5. Restricciones y Casos Borde (Edge Cases)

### Limitaciones Conocidas
- **Límite de Tamaño:** Archivos muy grandes pueden requerir LFS (Git Large File Storage).
- **Conflictos de Historial:** Si el repo remoto se crea con un README/License, puede haber conflictos. Se recomienda crear el repo vacío.

### Errores Comunes y Soluciones
- **Error: remote origin already exists**: Eliminar el remoto existente con `git remote remove origin` o usar un nombre diferente.
- **Error: Authentication failed**: Verificar el token de acceso o la configuración de SSH/HTTPS.

## 6. Protocolo de Errores y Aprendizajes (Memoria Viva)

| Fecha | Error Detectado | Causa Raíz | Solución/Parche Aplicado |
|-------|-----------------|------------|--------------------------|
| 04/03 | N/A | Inicio de tarea | N/A |
| 04/03 | 403 Forbidden | Token MCP sin permisos repo | Crear repo manualmente y usar el link proporcionado por el usuario |
| 07/03 | 404 Not Found (Vercel) | App en subdirectorio `frontend/` sin config raíz | Crear `vercel.json` en raíz con comandos de build apuntando a `frontend/` |

## 7. Ejemplos de Uso

```bash
git remote add origin https://github.com/USER/REPO.git
git push -u origin master
```

## 8. Checklist de Pre-Ejecución
- [x] Repositorio Git local inicializado.
- [ ] Cambios locales commiteados.
- [ ] Acceso a GitHub configurado.

## 9. Checklist Post-Ejecución
- [ ] Repositorio accesible vía web.
- [ ] Archivos verificados en el remoto.
- [ ] Directiva actualizada.
