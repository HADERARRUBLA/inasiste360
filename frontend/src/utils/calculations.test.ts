import { describe, it, expect } from 'vitest';
import {
    classifyShiftMinutes,
    splitSundayMinutes,
    groupEntriesIntoShifts,
    getFirstInTime,
    type DayCalcContext,
} from './calculations';

// Miércoles 19-ago-2026 (día de semana). Las horas se construyen en hora local,
// igual que lo hacen las funciones bajo prueba.
const at = (h: number, m = 0, dayOffset = 0) => new Date(2026, 7, 19 + dayOffset, h, m);

const branchCtx = (end = '17:00', night = '21:00'): DayCalcContext => ({
    nightShiftStartTime: night,
    scheduleMode: 'branch',
    daySchedule: { start: '08:00', end, active: true },
});

describe('classifyShiftMinutes — horario de sede (ordinaria / extra diurna / extra nocturna)', () => {
    it('turno exacto del horario: todo ordinario', () => {
        expect(classifyShiftMinutes(at(8), at(17), branchCtx())).toEqual({ ordinary: 540, extraDay: 0, extraNight: 0 });
    });

    it('2 horas después de la salida y antes de la franja nocturna: extra diurna', () => {
        expect(classifyShiftMinutes(at(8), at(19), branchCtx())).toEqual({ ordinary: 540, extraDay: 120, extraNight: 0 });
    });

    it('cruza el inicio de la franja nocturna: reparte en extra diurna y extra nocturna', () => {
        expect(classifyShiftMinutes(at(8), at(22), branchCtx())).toEqual({ ordinary: 540, extraDay: 240, extraNight: 60 });
    });

    it('turno que empieza después de la hora de salida: nada ordinario', () => {
        expect(classifyShiftMinutes(at(18), at(23), branchCtx())).toEqual({ ordinary: 0, extraDay: 180, extraNight: 120 });
    });

    it('turno que cruza la medianoche no pierde minutos', () => {
        // 20:00 -> 02:00 del día siguiente: 60 min de extra diurna (20-21) + 300 de nocturna (21-02)
        expect(classifyShiftMinutes(at(20), at(2, 0, 1), branchCtx())).toEqual({ ordinary: 0, extraDay: 60, extraNight: 300 });
    });

    it('respeta la hora de inicio de franja nocturna configurada en la sede', () => {
        // Franja nocturna desde las 19:00: 17-19 extra diurna, 19-20 extra nocturna
        expect(classifyShiftMinutes(at(8), at(20), branchCtx('17:00', '19:00'))).toEqual({ ordinary: 540, extraDay: 120, extraNight: 60 });
    });

    it('bloque vacío o con fin antes del inicio: todo en cero', () => {
        expect(classifyShiftMinutes(at(8), at(8), branchCtx())).toEqual({ ordinary: 0, extraDay: 0, extraNight: 0 });
        expect(classifyShiftMinutes(at(17), at(8), branchCtx())).toEqual({ ordinary: 0, extraDay: 0, extraNight: 0 });
    });
});

describe('classifyShiftMinutes — turnos de más de 36 horas (salvaguarda de minutos sin clasificar)', () => {
    it('39 horas seguidas: los minutos que exceden la ventana nocturna se cuentan como extra nocturna, no se pierden', () => {
        // 08:00 -> 23:00 del día siguiente = 2340 min. Ordinaria 540 (08-17), extra diurna 240 (17-21),
        // extra nocturna 1440 (21:00 -> 21:00 del día siguiente) + 120 de excedente (21:00 -> 23:00)
        expect(classifyShiftMinutes(at(8), at(23, 0, 1), branchCtx())).toEqual({ ordinary: 540, extraDay: 240, extraNight: 1560 });
    });
});

describe('classifyShiftMinutes — horario abierto', () => {
    it('cargo sin extras: nunca genera extra diurna ni nocturna', () => {
        const ctx: DayCalcContext = { nightShiftStartTime: '21:00', scheduleMode: 'open', openNoOvertime: true };
        const r = classifyShiftMinutes(at(8), at(22), ctx);
        expect(r.extraDay).toBe(0);
        expect(r.extraNight).toBe(0);
        expect(r.ordinary).toBe(840);
    });

    it('con tope de jornada: lo que pasa del tope desde la primera entrada es extra', () => {
        const ctx: DayCalcContext = {
            nightShiftStartTime: '21:00', scheduleMode: 'open',
            openMaxOrdinaryMinutes: 480, firstInTime: at(8),
        };
        // Tope 8h desde las 08:00 => 16:00. 08-18: 480 ordinarias + 120 extra diurna
        expect(classifyShiftMinutes(at(8), at(18), ctx)).toEqual({ ordinary: 480, extraDay: 120, extraNight: 0 });
    });

    it('sin entrada detectable en el turno: se comporta como sin extras', () => {
        const ctx: DayCalcContext = { nightShiftStartTime: '21:00', scheduleMode: 'open', firstInTime: null };
        const r = classifyShiftMinutes(at(8), at(18), ctx);
        expect(r.extraDay + r.extraNight).toBe(0);
        expect(r.ordinary).toBe(600);
    });
});

describe('classifyShiftMinutes — no se pierde ni se inventa ningún minuto', () => {
    const casos: Array<[string, Date, Date, DayCalcContext]> = [
        ['turno corto', at(9), at(13), branchCtx()],
        ['turno normal', at(8), at(17), branchCtx()],
        ['turno largo con extras', at(6), at(23, 30), branchCtx()],
        ['cruza medianoche', at(22), at(6, 0, 1), branchCtx()],
        ['turno de 30 horas', at(8), at(14, 0, 1), branchCtx()],
        ['turno de 39 horas', at(8), at(23, 0, 1), branchCtx()],
        ['horario abierto con tope', at(7), at(20), { nightShiftStartTime: '21:00', scheduleMode: 'open', openMaxOrdinaryMinutes: 600, firstInTime: at(7) }],
        ['horario abierto sin extras', at(7), at(23), { nightShiftStartTime: '21:00', scheduleMode: 'open', openNoOvertime: true }],
    ];
    it.each(casos)('%s', (_nombre, start, end, ctx) => {
        const r = classifyShiftMinutes(start, end, ctx);
        const total = (end.getTime() - start.getTime()) / 60000;
        expect(r.ordinary + r.extraDay + r.extraNight).toBeCloseTo(total, 5);
        expect(r.ordinary).toBeGreaterThanOrEqual(0);
        expect(r.extraDay).toBeGreaterThanOrEqual(0);
        expect(r.extraNight).toBeGreaterThanOrEqual(0);
    });
});

describe('splitSundayMinutes — domingo/festivo: solo diurno y nocturno, sin ordinaria/extra', () => {
    it('turno diurno', () => {
        expect(splitSundayMinutes(at(8), at(12), '21:00')).toEqual({ day: 240, night: 0 });
    });

    it('cruza la franja nocturna', () => {
        expect(splitSundayMinutes(at(8), at(22), '21:00')).toEqual({ day: 780, night: 60 });
    });

    it('turno solo nocturno', () => {
        expect(splitSundayMinutes(at(22), at(23), '21:00')).toEqual({ day: 0, night: 60 });
    });

    it('cruza la medianoche', () => {
        expect(splitSundayMinutes(at(20), at(2, 0, 1), '21:00')).toEqual({ day: 60, night: 300 });
    });

    it('respeta la franja nocturna configurada', () => {
        expect(splitSundayMinutes(at(8), at(22), '19:00')).toEqual({ day: 660, night: 180 });
    });

    it('bloque vacío: cero', () => {
        expect(splitSundayMinutes(at(8), at(8), '21:00')).toEqual({ day: 0, night: 0 });
    });

    it('39 horas seguidas: el excedente de la ventana nocturna se cuenta como nocturno, no se pierde', () => {
        // 08:00 -> 23:00 del día siguiente: día 780 (08-21) + noche 1440 + 120 de excedente
        expect(splitSundayMinutes(at(8), at(23, 0, 1), '21:00')).toEqual({ day: 780, night: 1560 });
    });

    it('turno de 30 horas: día + noche suman el total', () => {
        const r = splitSundayMinutes(at(8), at(14, 0, 1), '21:00');
        expect(r.day + r.night).toBeCloseTo(30 * 60, 5);
    });
});

describe('groupEntriesIntoShifts', () => {
    const e = (profile_id: string, event_type: string, created_at: string, extra: Record<string, unknown> = {}) =>
        ({ profile_id, event_type, created_at, ...extra });

    it('un día completo con pausa de almuerzo es un solo turno', () => {
        const grupos = groupEntriesIntoShifts([
            e('p1', 'in', '2026-08-19T13:00:00Z'),
            e('p1', 'lunch', '2026-08-19T17:00:00Z'),
            e('p1', 'in', '2026-08-19T18:00:00Z', { metadata: { is_return: true } }),
            e('p1', 'out', '2026-08-19T22:00:00Z'),
        ]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].entries).toHaveLength(4);
        expect(grupos[0].dateKey).toBe('2026-08-19');
    });

    it('dos días distintos son dos turnos', () => {
        const grupos = groupEntriesIntoShifts([
            e('p1', 'in', '2026-08-19T13:00:00Z'), e('p1', 'out', '2026-08-19T22:00:00Z'),
            e('p1', 'in', '2026-08-20T13:00:00Z'), e('p1', 'out', '2026-08-20T22:00:00Z'),
        ]);
        expect(grupos.map(g => g.dateKey)).toEqual(['2026-08-19', '2026-08-20']);
    });

    it('un turno que cruza la medianoche NO se parte en dos', () => {
        const grupos = groupEntriesIntoShifts([
            e('p1', 'in', '2026-08-20T04:50:00Z', { date: '2026-08-19' }),
            e('p1', 'out', '2026-08-20T05:10:00Z', { date: '2026-08-20' }),
        ]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].dateKey).toBe('2026-08-19');
        expect(grupos[0].entries).toHaveLength(2);
    });

    it('separa a cada empleado', () => {
        const grupos = groupEntriesIntoShifts([
            e('p1', 'in', '2026-08-19T13:00:00Z'), e('p2', 'in', '2026-08-19T13:05:00Z'),
            e('p1', 'out', '2026-08-19T22:00:00Z'), e('p2', 'out', '2026-08-19T22:05:00Z'),
        ]);
        expect(grupos).toHaveLength(2);
        expect(grupos.every(g => g.entries.length === 2)).toBe(true);
    });

    it('ordena por fecha de creación aunque lleguen desordenadas', () => {
        const grupos = groupEntriesIntoShifts([
            e('p1', 'out', '2026-08-19T22:00:00Z'),
            e('p1', 'in', '2026-08-19T13:00:00Z'),
        ]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].entries.map(x => x.event_type)).toEqual(['in', 'out']);
    });

    it('ignora marcaciones sin empleado', () => {
        expect(groupEntriesIntoShifts([{ event_type: 'in', created_at: '2026-08-19T13:00:00Z' }])).toEqual([]);
    });

    it('una salida huérfana (sin entrada) abre su propio grupo en vez de perderse', () => {
        const grupos = groupEntriesIntoShifts([e('p1', 'out', '2026-08-19T22:00:00Z')]);
        expect(grupos).toHaveLength(1);
        expect(grupos[0].entries).toHaveLength(1);
    });
});

describe('getFirstInTime', () => {
    it('devuelve la primera entrada que no es retorno de pausa', () => {
        const t = getFirstInTime([
            { event_type: 'in', metadata: { is_return: true }, created_at: '2026-08-19T18:00:00Z' },
            { event_type: 'in', created_at: '2026-08-19T13:00:00Z' },
        ]);
        expect(t?.toISOString()).toBe('2026-08-19T13:00:00.000Z');
    });

    it('prefiere clock_in sobre created_at', () => {
        const t = getFirstInTime([{ event_type: 'in', clock_in: '2026-08-19T12:55:00Z', created_at: '2026-08-19T13:00:00Z' }]);
        expect(t?.toISOString()).toBe('2026-08-19T12:55:00.000Z');
    });

    it('sin ninguna entrada: null', () => {
        expect(getFirstInTime([{ event_type: 'out', created_at: '2026-08-19T22:00:00Z' }])).toBeNull();
    });
});
