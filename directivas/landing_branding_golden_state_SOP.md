# SOP: Branding Ejecutivo Asiste360 (Golden State)

**Estado Maestro del Branding Visual - Punto de Control Guardado.**

## Objetivo
Documentar las especificaciones visuales de la Landing Page, ROI y Comando de Asiste360 que el usuario ha validado como el "Punto de Control Maestro" para una identidad corporativa de alta fidelidad.

## 🛡️ Aislamiento de Entornos (Protocolo de Coexistencia)
- **Operativo (Aplicación Interna):** Toda la funcionalidad interna de InAsiste360 (Dashboard, Empleados, Configuración) debe permanecer en un diseño **CLARO (Light Theme)** para máxima legibilidad de datos.
- **Ejecutivo (Ventas/Landing):** La landing page debe permanecer en un diseño **OSCURO (Sovereign Intelligence)** para comunicar autoridad y tecnología.
- **Implementación Técnica de Blindaje:** 
    - Las variables globales de `index.css` (clases estándar de Tailwind como `bg-background`, `bg-card`, `text-primary`) SIEMPRE deben apuntar al tema CLARO.
    - La Landing Page debe usar exclusivamente tokens de estilo con el prefijo `exec-` (ej. `bg-exec-bg`, `text-exec-primary`, `exec-glass-panel`).
    - **ADVERTENCIA:** No redefinir variables globales dentro de clases locales para evitar "fugas" de CSS a través del DOM. Usar prefijos exclusivos es la única garantía de aislamiento 100%.

## Componentes Críticos del Logo Monumental
- **Sin Texto Lateral:** El logo debe aparecer sin "Sovereign Intelligence" para maximizar su escala visual.
- **Aro de 360 Grados:** Debe contar con un anillo rotatorio dinámico (Halo) de color `exec-primary/40`.
- **Backdrop Traslúcido:** Debe tener un contenedor circular blanco con un 10-15% de opacidad y `backdrop-blur` para contrastar limpiamente contra el fondo oscuro.
- **Escala de Hero:** Mínimo `w-64` a `w-80` en dispositivos de escritorio.

## Sistema de Temas (Intelligence Dark)
- **Fondo Landing:** `#0b1326` (Azul profundo ejecutivo).
- **Acentos de Ventas:** Azul Eléctrico (`#0047ab`) para botones principales y llamadas a la acción en la landing.
- **Overlay Tecnológico:** Usar la clase `exec-point-cloud` en todos los fondos de la landing.

## Estructura de Secciones
1.  **Inteligencia (Hero):** Titular sobre el 5% de fuga de nómina. Incluye escaneo facial biométrico con láser de barrido.
2.  **Comando (Dashboard Mockup):** Entorno de monitoreo oscuro. Incluye mapa de calor de nodos, feed de entradas en tiempo real y alertas de anomalías.
3.  **Motor de ROI:** Estética de bento-grid con tarjetas de ahorro monumentales (COP).

## Restricciones y Advertencias
- **NO ACTIVAR MODOS CLARO GLOBALES EN LA LANDING:** La landing es sínteca y ejecutiva por definición.
- **Consistencia de Botones:** Usar la clase `exec-metallic-edge` para reflejos metálicos consistentes.
- **Transiciones:** Mantener el `AnimatePresence` de `motion/react` con transiciones de 0.4s-0.5s.

## Protocolo de Reversión
En caso de desvío estético, volver a este punto de control:
*   **Git Tag:** `GOLDEN_STATE_v1.1_ISOLATED`
*   **Directiva:** Seguir esta SOP y verificar que `LandingPage.tsx` use tokens `exec-`.
