// utils/biometricUtils.ts

/**
 * Calcula la distancia Euclidiana entre dos vectores.
 * @param vector1 El primer vector (ej. extraído de la cámara en tiempo real).
 * @param vector2 El segundo vector (ej. guardado en la base de datos).
 * @returns La distancia numérica entre los dos vectores.
 */
export function euclideanDistance(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Los vectores deben tener la misma longitud para calcular la distancia.');
  }

  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    const diff = vector1[i] - vector2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compara dos vectores faciales y determina si coinciden según un umbral.
 * @param vector1 Array numérico del primer rostro.
 * @param vector2 Array numérico del segundo rostro.
 * @param threshold Umbral de decisión (0.45 a 0.55 es típicamente un buen balance en face-api).
 * @returns true si la distancia es menor o igual al umbral, false si no.
 */
export function compareFaceVectors(
  vector1: number[] | null | undefined, 
  vector2: number[] | null | undefined, 
  threshold: number = 0.5
): boolean {
  if (!vector1 || !vector2 || vector1.length === 0 || vector2.length === 0) {
    return false;
  }
  
  try {
    const distance = euclideanDistance(vector1, vector2);
    // console.log(`[Biometría] Distancia Euclidiana: ${distance.toFixed(4)} (Umbral: ${threshold})`);
    return distance <= threshold;
  } catch (error) {
    console.error('[Biometría] Error al comparar vectores:', error);
    return false;
  }
}
