import { useState, useEffect } from 'react';

interface Location {
    lat: number;
    lng: number;
}

export function useGeofencing(targetLocation: Location | null, radiusMeters: number = 100) {
    const [isInside, setIsInside] = useState<boolean | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    const refresh = () => setRefreshKey(prev => prev + 1);

    const calculateDistance = (loc1: Location, loc2: Location) => {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (loc1.lat * Math.PI) / 180;
        const φ2 = (loc2.lat * Math.PI) / 180;
        const Δφ = ((loc2.lat - loc1.lat) * Math.PI) / 180;
        const Δλ = ((loc2.lng - loc1.lng) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    };

    useEffect(() => {
        if (!targetLocation) return;
        setIsInside(null); // Reset while searching

        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setCurrentLocation(loc);
                const dist = calculateDistance(loc, targetLocation);
                setDistance(dist);
                setIsInside(dist <= radiusMeters);
                setError(null);
            },
            (err) => {
                setError(err.message);
                setIsInside(false);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [targetLocation, radiusMeters, refreshKey]);

    return { isInside, currentLocation, distance, error, refresh };
}
