---
description: Cómo iniciar la aplicación Asiste360 en ambiente local
---

# 🚀 Cómo iniciar Asiste360 localmente

Para realizar cambios de forma segura, sigue este proceso:

## 1. Instalación de Dependencias
Asegúrate de tener todas las librerías necesarias ejecutando en la raíz del proyecto:
```powershell
# En la raíz del proyecto
npm install
cd frontend
npm install
```

## 2. Configuración de Entorno (.env)
Asegúrate de tener el archivo `.env` en la carpeta `frontend/` con las claves de Supabase.

## 3. Ejecución del Servidor de Desarrollo
Para ver los cambios en tiempo real:
```powershell
cd frontend
npm run dev
```
Esto abrirá la aplicación en `http://localhost:5173`.

// turbo
## Checklist de Inicio
- [ ] ¿Vite indica que el servidor está listo?
- [ ] ¿Aparece la pantalla de Login?
- [ ] ¿No hay errores rojos en la consola del navegador?
