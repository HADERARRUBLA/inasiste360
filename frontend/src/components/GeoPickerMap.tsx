import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

// Fix for default marker icons in modern bundlers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface GeoPickerMapProps {
    value: { lat: number; lng: number } | null;
    radius: number;
    onChange?: (pos: { lat: number; lng: number }) => void;
    readonly?: boolean;
    height?: number;
}

export const GeoPickerMap: React.FC<GeoPickerMapProps> = ({
    value,
    radius,
    onChange,
    readonly = false,
    height = 300
}) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const circleRef = useRef<L.Circle | null>(null);

    // Initial Map Setup
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize Map
        const center: L.LatLngExpression = value ? [value.lat, value.lng] : [4.5, -74.0];
        const zoom = value ? 16 : 6;

        const map = L.map(mapContainerRef.current, {
            zoomControl: !readonly,
            dragging: !readonly,
            scrollWheelZoom: !readonly,
        }).setView(center, zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        mapInstanceRef.current = map;

        // Add Marker
        const marker = L.marker(center, {
            draggable: !readonly
        }).addTo(map);
        markerRef.current = marker;

        // Add Circle
        const circle = L.circle(center, {
            radius: radius,
            color: '#3B82F6', // primary blue
            fillColor: '#3B82F6',
            fillOpacity: 0.2,
            weight: 2
        }).addTo(map);
        circleRef.current = circle;

        // Marker/Map Events
        if (!readonly && onChange) {
            marker.on('dragend', () => {
                const { lat, lng } = marker.getLatLng();
                onChange({ lat, lng });
            });

            map.on('click', (e) => {
                const { lat, lng } = e.latlng;
                marker.setLatLng([lat, lng]);
                circle.setLatLng([lat, lng]);
                onChange({ lat, lng });
            });
        }

        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []); // Only on mount

    // Update position and radius when props change
    useEffect(() => {
        if (!mapInstanceRef.current || !markerRef.current || !circleRef.current) return;

        if (value) {
            const pos: L.LatLngExpression = [value.lat, value.lng];
            markerRef.current.setLatLng(pos);
            circleRef.current.setLatLng(pos);
            
            // If the map isn't centered there, or it's Colombias default zoom, adjust
            const currentCenter = mapInstanceRef.current.getCenter();
            if (currentCenter.lat !== value.lat || currentCenter.lng !== value.lng) {
                // If map was at country level (zoom 6), zoom in to the city level
                const currentZoom = mapInstanceRef.current.getZoom();
                mapInstanceRef.current.setView(pos, currentZoom === 6 ? 16 : currentZoom);
            }
        }

        circleRef.current.setRadius(radius);
    }, [value, radius]);

    return (
        <div 
            ref={mapContainerRef} 
            className="w-full rounded-2xl border-2 border-muted overflow-hidden shadow-inner bg-muted/5"
            style={{ height: `${height}px`, zIndex: 1 }}
        />
    );
};
