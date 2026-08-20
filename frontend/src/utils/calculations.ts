import type { DaySchedule, ScheduleMode } from '../types';

export interface MinuteBuckets {
    ordinary: number;
    extraDay: number;
    extraNight: number;
}

export interface ShiftGroup {
    profileId: string;
    dateKey: string;
    entries: any[];
}

const isShiftStart = (e: any) => e.event_type === 'in' && !e.metadata?.is_return;

/**
 * Agrupa marcaciones por "turno" (delimitado por un evento 'in' que no sea
 * un retorno de pausa), en vez de por la columna `date` de cada evento
 * individual. Evita que un turno que cruza medianoche (in 23:50 / out 00:10)
 * se parta en dos grupos de días distintos y el turno completo se pierda.
 */
export function groupEntriesIntoShifts(entries: any[]): ShiftGroup[] {
    const byProfile: Record<string, any[]> = {};
    entries.forEach(e => {
        if (!e.profile_id) return;
        (byProfile[e.profile_id] ||= []).push(e);
    });

    const groups: ShiftGroup[] = [];
    Object.entries(byProfile).forEach(([profileId, profileEntries]) => {
        const sorted = [...profileEntries].sort(
            (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        );
        let current: ShiftGroup | null = null;
        sorted.forEach(e => {
            if (isShiftStart(e) || !current) {
                const anchorDate = (e.date || e.created_at?.split('T')[0]) as string;
                current = { profileId, dateKey: anchorDate, entries: [] };
                groups.push(current);
            }
            current!.entries.push(e);
        });
    });
    return groups;
}

/** Primer evento 'in' (preferiblemente no-retorno) de un turno ya agrupado. */
export function getFirstInTime(shiftEntries: any[]): Date | null {
    const firstIn = shiftEntries.find(e => e.event_type === 'in' && !e.metadata?.is_return)
        || shiftEntries.find(e => e.event_type === 'in');
    if (!firstIn) return null;
    return new Date(firstIn.clock_in || firstIn.created_at);
}

export interface DayCalcContext {
    nightShiftStartTime: string;
    daySchedule?: DaySchedule;
    scheduleMode: ScheduleMode;
    openNoOvertime?: boolean;
    openMaxOrdinaryMinutes?: number;
    firstInTime?: Date | null;
}

function clockTimeOn(reference: Date, hhmm: string): Date {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(reference);
    d.setHours(h, m, 0, 0);
    return d;
}

/**
 * Clasifica los minutos de un bloque de trabajo [start, end) en
 * ordinaria/extra-diurna/extra-nocturna, según franja horaria.
 *
 * - 'branch'/'custom': el pivote ordinario/extra es la hora de fin del
 *   horario asignado (comportamiento idéntico al que ya existía).
 * - 'open': sin horario fijo. Si `openNoOvertime` es true (cargo de
 *   confianza/dirección), nunca hay extra, solo se separa diurna/nocturna.
 *   Si no, el pivote es dinámico: `firstInTime + openMaxOrdinaryMinutes`.
 *
 * No conoce el concepto de domingo/festivo: cada llamador decide qué hacer
 * con esa clasificación cuando el bloque cae en domingo (los dos lugares que
 * usan esta función hoy tratan el domingo de forma distinta entre sí — una
 * inconsistencia preexistente que no se corrige aquí).
 */
export function classifyShiftMinutes(start: Date, end: Date, ctx: DayCalcContext): MinuteBuckets {
    const totalMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    if (totalMin === 0) return { ordinary: 0, extraDay: 0, extraNight: 0 };

    const nightThreshold = clockTimeOn(start, ctx.nightShiftStartTime || '21:00');

    let ordinaryEnd: Date;
    if (ctx.scheduleMode === 'open') {
        if (ctx.openNoOvertime || !ctx.firstInTime) {
            // Cargo de confianza (o sin 'in' detectable ese turno): nunca hay
            // extra, solo diurna/nocturna.
            ordinaryEnd = new Date(nightThreshold.getTime() + 24 * 60 * 60000);
        } else {
            ordinaryEnd = new Date(ctx.firstInTime.getTime() + (ctx.openMaxOrdinaryMinutes ?? 480) * 60000);
        }
    } else {
        ordinaryEnd = clockTimeOn(start, ctx.daySchedule?.end || '17:00');
    }

    const getOverlap = (t1: Date, t2: Date) => {
        const os = Math.max(start.getTime(), t1.getTime());
        const oe = Math.min(end.getTime(), t2.getTime());
        return Math.max(0, (oe - os) / 60000);
    };

    // Math.max evita doble conteo si ordinaryEnd cae después del inicio de
    // la franja nocturna (posible en 'open' con tope grande).
    const nightWindowStart = new Date(Math.max(ordinaryEnd.getTime(), nightThreshold.getTime()));

    const ordinary = getOverlap(new Date(start.getTime() - 86400000), ordinaryEnd);
    const extraDay = getOverlap(ordinaryEnd, nightWindowStart);
    let extraNight = getOverlap(nightWindowStart, new Date(nightThreshold.getTime() + 86400000));

    // Salvaguarda: en turnos muy largos (más de ~24h desde el inicio de la
    // franja nocturna) no dejar minutos sin clasificar/perdidos.
    const accounted = ordinary + extraDay + extraNight;
    if (accounted < totalMin - 0.01) extraNight += (totalMin - accounted);

    return { ordinary, extraDay, extraNight };
}

export interface SundayMinutes {
    day: number;
    night: number;
}

/**
 * Domingo/festivo: todo el bloque se paga como dominical, sin distinción
 * ordinaria/extra (confirmado con el usuario 2026-08-20) — la única
 * separación es diurno/nocturno según night_shift_start_time. No usa
 * classifyShiftMinutes porque ese pivote ordinaria/extra no aplica aquí.
 */
export function splitSundayMinutes(start: Date, end: Date, nightShiftStartTime: string): SundayMinutes {
    const totalMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    if (totalMin === 0) return { day: 0, night: 0 };

    const nightThreshold = clockTimeOn(start, nightShiftStartTime || '21:00');

    const getOverlap = (t1: Date, t2: Date) => {
        const os = Math.max(start.getTime(), t1.getTime());
        const oe = Math.min(end.getTime(), t2.getTime());
        return Math.max(0, (oe - os) / 60000);
    };

    const day = getOverlap(new Date(start.getTime() - 86400000), nightThreshold);
    let night = getOverlap(nightThreshold, new Date(nightThreshold.getTime() + 86400000));

    // Misma salvaguarda que classifyShiftMinutes para turnos muy largos.
    const accounted = day + night;
    if (accounted < totalMin - 0.01) night += (totalMin - accounted);

    return { day, night };
}
