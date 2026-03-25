# SOP: Branding Ejecutivo Asiste360 (Golden State)

**Estado Maestro del Branding Visual - Punto de Control Guardado.**

## Objetivo
Documentar las especificaciones visuales de la Landing Page, ROI y Comando de Asiste360 que el usuario ha validado como el "Punto de Control Maestro" para una identidad corporativa de alta fidelidad.

## Componentes Críticos del Logo Monumental
- **Sin Texto Lateral:** El logo debe aparecer sin "Sovereign Intelligence" para maximizar su escala visual.
- **Aro de 360 Grados:** Debe contar con un anillo rotatorio dinámico (Halo) de color primario/40.
- **Backdrop Traslúcido:** Debe tener un contenedor circular blanco con un 10-15% de opacidad y `backdrop-blur` para contrastar limpiamente contra el fondo oscuro.
- **Escala de Hero:** Mínimo `w-64` a `w-80` en dispositivos de escritorio.

## Sistema de Temas (Intelligence Dark)
- **Fondo Global:** `#0b1326` (Azul profundo ejecutivo).
- **Acentos:** Azul Eléctrico (`#0047ab`) para botones principales y llamadas a la acción.
- **Overlay Tecnológico:** Se debe usar la malla de puntos (`point-cloud-overlay`) en todos los fondos para dar textura de "Inteligencia Virtual".

## Estructura de Secciones
1.  **Inteligencia (Hero):** Titular de alto impacto sobre el 5% de fuga de nómina. Incluye escaneo facial biométrico con efecto de láser de barrido.
2.  **Comando (Dashboard):** Entorno de monitoreo oscuro. Incluye mapa de calor de nodos, feed de entradas en tiempo real y alertas de anomalías en rojo crítico.
3.  **Motor de ROI:** Estética de bento-grid con tarjetas de ahorro monumentales (COP).

## Restricciones y Advertencias
- **NO ACTIVAR MODOS CLARO GLOBALES:** Cualquier intervención de temas claros que afecte las variables de `index.css` de forma global desvirtúa la identidad de Centro de Comando.
- **Consistencia de Botones:** Los botones deben usar la clase `metallic-edge` para reflejos metálicos consistentes con el hardware biométrico.
- **Transiciones:** Mantener el `AnimatePresence` de `motion/react` con transiciones de 0.4s-0.5s al cambiar de vista.

## Protocolo de Reversión
En caso de "daño" visual o desvío estético, volver a este punto de control en Git: `git checkout development -- frontend/src/components/LandingPage.tsx frontend/src/components/index.css`.
*(Punto de Control Commit: "Branding Ejecutivo: Golden State v1.0")*
