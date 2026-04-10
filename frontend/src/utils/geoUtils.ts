export const GEO_DECIMAL_PRECISION = 7;

// Convierte { lat, lng } a string estandarizado "lat,lng" (sin espacio, 7 decimales)
export function formatLatLng(lat: number, lng: number): string {
    return `${lat.toFixed(GEO_DECIMAL_PRECISION)},${lng.toFixed(GEO_DECIMAL_PRECISION)}`;
}

// Parsea "lat,lng" o "lat, lng" → { lat, lng } o null si inválido
// Rechaza: NaN, lat fuera de [-90,90], lng fuera de [-180,180], string vacío
export function parseLatLng(raw: string | null | undefined): { lat: number; lng: number } | null {
    if (!raw || typeof raw !== 'string') return null;
    const parts = raw.split(',').map(p => parseFloat(p.trim()));
    if (parts.length !== 2) return null;
    
    const [lat, lng] = parts;
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;
    
    return { lat, lng };
}

// Retorna true solo si parseLatLng retorna non-null
export function validateLatLng(raw: string): boolean {
    return parseLatLng(raw) !== null;
}

// Distancia en metros entre dos puntos (fórmula Haversine)
// Esta función reemplaza a calculateDistance que está duplicada en useGeofencing.ts
export function haversineDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number }
): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (val: number) => (val * Math.PI) / 180;
    const phi1 = toRad(a.lat);
    const phi2 = toRad(b.lat);
    const deltaPhi = toRad(b.lat - a.lat);
    const deltaLambda = toRad(b.lng - a.lng);

    const aVar = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                 Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVar), Math.sqrt(1 - aVar));

    return R * c;
}
