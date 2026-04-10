# SOP - Verificación Biométrica Integral (Face-API)

## Objetivo
Definir los procesos de configuración, registro y verificación de biometría facial dentro de la aplicación In_Asiste360, operando de manera offline una vez descargados los modelos a nivel local y comparando distancias euclidianas.

## Arquitectura de Biometría

### 1. Modelos (face-api.js)
Los modelos de Inteligencia Artificial (Redes Neuronales Residuales y Redes Convolucionales Pequeñas) deben servirse _siempre_ desde la ruta de almacenamiento local para garantizar la latencia baja y resiliencia ante pérdida de internet.
- **Ruta de Modelos:** `frontend/public/models/`
- **Uso Crítico:**
    ```javascript
    await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
    await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
    await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
    ```

### 2. Base de Datos
- **Activación Global por Sede:** Se almacena en la tabla `InA_companies`, en la columna `settings` de tipo JSONB. La key obligatoria a comprobar es `biometric_verification_enabled: boolean`.
- **Registro del Empleado:** Los vectores faciales (`Float32Array` de 128 dimensiones convertido a `number[]`) se almacenan en la tabla `InA_profiles` bajo la columna `face_vector` (como JSON Array o array de punto flotante).
- **Evidencia y Estado:** Cuando un empleado marca, el resultado biométrico (`true` si coincide, `false` si falla o no tiene rostro registrado) se graba en el campo `is_verified` (Booleano) de `InA_time_entries`. El campo `metadata` contiene la captura en base64 de evidencia que es crucial para auditoría.

### 3. Lógica de Comparación Euclidiana
La magia se hace mediante una simple matemática de distancias usando los dos arrays numéricos.
El _umbral máximo de distancia_ define la permisividad de la similitud facial.

- **Fórmula de distancia Euclidiana implementada en `biometricUtils.ts`**:
  ```typescript
  export const compareFaceVectors = (vector1: number[], vector2: number[]): boolean => {
      if (vector1.length !== vector2.length || vector1.length === 0) return false;
      const distance = Math.sqrt(
          vector1.reduce((sum, val, i) => sum + Math.pow(val - vector2[i], 2), 0)
      );
      // El Umbral (Threshold) debe estar alrededor de 0.5 o 0.6.
      return distance < 0.6;
  };
  ```

## Restricciones y Casos Borde (Trampas Conocidas)

1. **Incompatibilidad Mobile - INP (Interaction to Next Paint):**
   - **Trampa:** Bloquear el hilo principal calculando timers o vectores durante los clics en el Kiosko, haciendo que la acción se sienta lenta o aparezcan advertencias en consola de Lighthouse / INP del navegador móvil.
   - **Solución:** Los temporizadores de inactividad de 60 segundos y otros efectos pesados vinculados a botones deben diferirse imperativamente con `setTimeout(..., 0)`.

2. **Carga Diferida para Preservar la Memoria RAM:**
   - **Trampa:** Cargar Face-API junto al montaje de toda la aplicación ralentizará el dashboard.
   - **Solución:** Solo montar y descargar vectores faciales en el momento en que se activa el Flag Global del sistema (`biometric_verification_enabled`), y directamente dentro del componente de consumo (ej. `KioskMode.tsx`).

3. **No Redirigir Sin Limpiar Cámara:**
   - **Trampa:** Dejar streams de video colgando cuando el usuario cambia de menú genera memory leaks y luces de cámara activadas.
   - **Solución:** Antes de salir del componente de captura o de limpiar estados, parar TODOS los tracks:
     `stream.getTracks().forEach(track => track.stop());`

## Pasos para Auditar y Corregir Errores de Biometría

1. Validar si la sede (`InA_companies`) tiene el flag `biometric_verification_enabled: true` en la columna `.settings`.
2. Validar que la ruta de origen en la máquina para los _weights_ devuelva un HTTP 200 para `/models`.
3. Revisar si el `hourly_rate` vs cálculos matemáticos de la base de datos se alteran accidentalmente por fallos en la estructura del perfil que comparte `face_vector`.
4. El Kiosko debe permitir continuar (`is_verified: false`) para crear trazabilidad en vez de evitar bloqueos duros; de este modo el administrador interviene en `AuditSystem.tsx`.
