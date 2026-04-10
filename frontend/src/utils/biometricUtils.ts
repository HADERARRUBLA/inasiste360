export interface FaceComparisonResult {
  match: boolean;
  distance: number;
  confidence: number;
}

export const FACE_MATCH_THRESHOLD = 0.55;

/**
 * Calcula la distancia Euclidiana entre dos vectores.
 */
export function euclideanDistance(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Los vectores deben tener la misma longitud.');
  }

  let sum = 0;
  for (let i = 0; i < vector1.length; i++) {
    const diff = vector1[i] - vector2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Compara dos vectores faciales y retorna el resultado detallado.
 */
export function compareFaceVectors(
  vector1: number[] | null | undefined, 
  vector2: number[] | null | undefined, 
  threshold: number = FACE_MATCH_THRESHOLD
): FaceComparisonResult {
  if (!vector1 || !vector2 || vector1.length === 0 || vector2.length === 0) {
    return { match: false, distance: Infinity, confidence: 0 };
  }
  
  try {
    const distance = euclideanDistance(vector1, vector2);
    const match = distance <= threshold;
    const confidence = Math.max(0, Math.min(100, Math.round((1 - distance) * 100)));
    return { match, distance, confidence };
  } catch (error) {
    console.error('[Biometría] Error al comparar:', error);
    return { match: false, distance: Infinity, confidence: 0 };
  }
}
