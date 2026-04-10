import type { TimeEntry, Profile } from '../types';

export const NIGHT_SHIFT_START_HOUR = 18; // 6:00 PM

export interface DayShiftSummary {
    date: string;
    ordinaryHours: number;
    nightHours: number;
    totalCost: number;
}

export function calculateShift(_entry: TimeEntry, _profile: Profile): any {
    // NOTA: El cálculo real de nómina está implementado en
    // AdminDashboard.tsx en la función useMemo de statsData.
    // Esta función está reservada para una futura refactorización
    // que centralice toda la lógica de cálculo aquí.
    // Por ahora retorna valores vacíos para no romper imports existentes.
    return {
        date: '',
        ordinaryHours: 0,
        nightHours: 0,
        totalCost: 0
    };
}

/**
 * Calculates the split between ordinary and night hours.
 * Day: Before 18:00
 * Night: After 18:00
 */
export function calculateHoursSplit(start: Date, end: Date) {
    let ordinaryMinutes = 0;
    let nightMinutes = 0;

    let current = new Date(start);
    while (current < end) {
        const hour = current.getHours();
        if (hour >= NIGHT_SHIFT_START_HOUR || hour < 6) { // Assumed night shift 18:00 to 06:00
            nightMinutes++;
        } else {
            ordinaryMinutes++;
        }
        current.setMinutes(current.getMinutes() + 1);
    }

    return {
        ordinaryHours: ordinaryMinutes / 60,
        nightHours: nightMinutes / 60
    };
}
