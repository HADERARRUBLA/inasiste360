import { useState, useEffect } from 'react';
import { haversineDistance } from '../utils/geoUtils';

interface Location {
    lat: number;
    lng: number;
}

export function useGeofencing(targetLocation: Location | null, radiusMeters: number = 100) {
    const [isInside, setIsInside] = useState<boolean | null>(null);
    const [distance, setDistance] = useState<number | null>(null);
    const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
    const [accuracy, setAccuracy] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    // isLoading es true cuando hay una localidad objetivo pero aún no hemos resuelto si estamos dentro
    const isLoading = targetLocation !== null && isInside === null && error === null;

    const refresh = () => setRefreshKey(prev => prev + 1);

    useEffect(() => {
        if (!targetLocation) {
            setIsInside(null);
            setDistance(null);
            setAccuracy(null);
            setError(null);
            return;
        }
        
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
                setAccuracy(position.coords.accuracy);
                const dist = haversineDistance(loc, targetLocation);
                setDistance(dist);
                setIsInside(dist <= radiusMeters);
                setError(null);
            },
            (err) => {
                setError(err.message);
                setIsInside(false);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    }, [targetLocation, radiusMeters, refreshKey]);

    return { isInside, currentLocation, distance, accuracy, isLoading, error, refresh };
}
