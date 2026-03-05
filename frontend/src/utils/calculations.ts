import type { TimeEntry, Profile } from '../types';

export const NIGHT_SHIFT_START_HOUR = 18; // 6:00 PM

export interface DayShiftSummary {
    date: string;
    ordinaryHours: number;
    nightHours: number;
    totalCost: number;
}

export function calculateShift(entry: TimeEntry, profile: Profile): DayShiftSummary {
    const clockIn = new Date(entry.timestamp);
    // This is a simplified version for the MVP. 
    // Real logic would calculate the difference between clockIn and clockOut.

    // For now, let's assume entries come in pairs or we calculate from a duration.
    // The requirement says "Los reportes separan automáticamente las horas después de las 6:00 PM".

    return {
        date: clockIn.toISOString().split('T')[0],
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
