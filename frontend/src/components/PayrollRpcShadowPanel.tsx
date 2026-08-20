import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { groupEntriesIntoShifts, getFirstInTime, classifyShiftMinutes, splitSundayMinutes } from '../utils/calculations';
import { fetchAllRows } from '../utils/supabasePagination';

interface PayrollRpcShadowPanelProps {
    companyId: string | null;
}

interface DailyRow {
    minutes_work: number;
    ordinary_minutes: number;
    extra_day_minutes: number;
    extra_night_minutes: number;
    extra_sunday_minutes: number;
    breakfast_minutes: number;
    lunch_minutes: number;
    active_pause_minutes: number;
    other_minutes: number;
    cost: number;
    is_late: boolean;
    is_unjustified_absence: boolean;
    late_minutes: number;
}

const emptyRow = (): DailyRow => ({
    minutes_work: 0, ordinary_minutes: 0, extra_day_minutes: 0, extra_night_minutes: 0, extra_sunday_minutes: 0,
    breakfast_minutes: 0, lunch_minutes: 0, active_pause_minutes: 0, other_minutes: 0,
    cost: 0, is_late: false, is_unjustified_absence: false, late_minutes: 0
});

const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };

const NUMERIC_FIELDS: (keyof DailyRow)[] = [
    'minutes_work', 'ordinary_minutes', 'extra_day_minutes', 'extra_night_minutes', 'extra_sunday_minutes',
    'breakfast_minutes', 'lunch_minutes', 'active_pause_minutes', 'other_minutes', 'cost', 'late_minutes'
];
const BOOLEAN_FIELDS: (keyof DailyRow)[] = ['is_late', 'is_unjustified_absence'];

const FIELD_LABELS: Record<keyof DailyRow, string> = {
    minutes_work: 'Min. Trabajo', ordinary_minutes: 'Min. Ordinarios', extra_day_minutes: 'Extra Diurna',
    extra_night_minutes: 'Extra Nocturna', extra_sunday_minutes: 'Extra Dominical', breakfast_minutes: 'Desayuno',
    lunch_minutes: 'Almuerzo', active_pause_minutes: 'Pausa Activa', other_minutes: 'Otros',
    cost: 'Costo', is_late: 'Tarde', is_unjustified_absence: 'Ausencia Injustificada', late_minutes: 'Min. Tarde'
};

function computeClientDaily(
    entries: any[], profiles: any[], company: any, leaveRequests: any[], startDate: string, endDate: string
): Map<string, DailyRow> {
    const todayStr = new Date().toLocaleDateString('en-CA');
    const daily = new Map<string, DailyRow>();
    const keyOf = (profileId: string, date: string) => `${profileId}|${date}`;
    const ensureRow = (profileId: string, date: string): DailyRow => {
        const key = keyOf(profileId, date);
        if (!daily.has(key)) daily.set(key, emptyRow());
        return daily.get(key)!;
    };

    for (let d = new Date(startDate + 'T12:00:00'); d.toLocaleDateString('en-CA') <= endDate; d.setDate(d.getDate() + 1)) {
        const dStr = d.toLocaleDateString('en-CA');
        profiles.forEach(p => ensureRow(p.id, dStr));
    }

    const shiftGroups = groupEntriesIntoShifts(entries).filter(g => g.dateKey >= startDate && g.dateKey <= endDate);

    shiftGroups.forEach(group => {
        const profile = profiles.find(p => p.id === group.profileId);
        if (!profile) return;
        const dateObj = new Date(group.dateKey + 'T12:00:00');
        const dayCode = dayMap[dateObj.getDay()];
        const sched = profile.schedule_mode === 'branch' ? company?.work_schedule?.[dayCode] : profile.work_schedule?.[dayCode];
        if (!sched?.active) return;
        const firstIn = getFirstInTime(group.entries);
        if (!firstIn) return;
        const [h, m] = sched.start.split(':').map(Number);
        const schedTime = new Date(firstIn);
        schedTime.setHours(h, m, 0, 0);
        if (firstIn > schedTime) {
            const row = ensureRow(group.profileId, group.dateKey);
            row.is_late = true;
            row.late_minutes = Math.max(row.late_minutes, (firstIn.getTime() - schedTime.getTime()) / 60000);
        }
    });

    const shiftKeys = new Set(shiftGroups.map(g => `${g.profileId}_${g.dateKey}`));
    const rangeEnd = endDate < todayStr ? endDate : todayStr;
    for (let d = new Date(startDate + 'T12:00:00'); d.toLocaleDateString('en-CA') <= rangeEnd; d.setDate(d.getDate() + 1)) {
        const dStr = d.toLocaleDateString('en-CA');
        const dayCode = dayMap[d.getDay()];
        profiles.forEach(profile => {
            const sched = profile.schedule_mode === 'branch' ? company?.work_schedule?.[dayCode] : profile.work_schedule?.[dayCode];
            if (!sched?.active) return;
            if (shiftKeys.has(`${profile.id}_${dStr}`)) return;
            const onLeave = leaveRequests.some((l: any) => l.status === 'approved' && l.profile_id === profile.id && l.start_date <= dStr && l.end_date >= dStr);
            if (onLeave) return;
            ensureRow(profile.id, dStr).is_unjustified_absence = true;
        });
    }

    shiftGroups.forEach(group => {
        const profile = profiles.find(p => p.id === group.profileId);
        if (!profile) return;
        const dateObj = new Date(group.dateKey + 'T12:00:00');
        const dayCode = dayMap[dateObj.getDay()];
        const scheduleMode = profile.schedule_mode || 'branch';
        const profileSched = scheduleMode === 'custom' ? profile.work_schedule?.[dayCode] : company?.work_schedule?.[dayCode];
        const isSunday = dateObj.getDay() === 0;
        const firstInTime = scheduleMode === 'open' ? getFirstInTime(group.entries) : null;
        const row = ensureRow(group.profileId, group.dateKey);
        const sorted = group.entries;

        for (let i = 0; i < sorted.length; i++) {
            const entry = sorted[i];
            const start = new Date(entry.clock_in || entry.created_at!);
            let end = start, diffMin = 0;
            if (entry.total_hours) {
                diffMin = entry.total_hours * 60;
                end = new Date(start.getTime() + diffMin * 60000);
            } else {
                const next = sorted[i + 1];
                const isEntryToday = (entry.date || entry.created_at?.split('T')[0]) === todayStr;
                end = entry.clock_out ? new Date(entry.clock_out) : (next ? new Date(next.clock_in || next.created_at!) : (isEntryToday ? new Date() : start));
                diffMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
            }

            if (entry.event_type !== 'in' && entry.event_type !== 'out') {
                if (entry.event_type === 'breakfast') row.breakfast_minutes += diffMin;
                else if (entry.event_type === 'lunch') row.lunch_minutes += diffMin;
                else if (entry.event_type === 'active_pause') row.active_pause_minutes += diffMin;
                else row.other_minutes += diffMin;
                continue;
            }

            row.minutes_work += diffMin;

            if (isSunday) {
                // Domingo/festivo: sin pivote ordinaria/extra, solo diurno/nocturno
                // (mismo criterio que AdminDashboard.tsx, confirmado 2026-08-20).
                const sunday = splitSundayMinutes(start, end, company?.night_shift_start_time || '21:00');
                const dayRate = profile.hourly_rate_sunday_holiday || profile.hourly_rate_base || 0;
                const nightRate = profile.hourly_rate_sunday_holiday_extra_night || dayRate;
                row.cost += (sunday.day * dayRate / 60) + (sunday.night * nightRate / 60);
                row.extra_sunday_minutes += diffMin;
            } else {
                const buckets = classifyShiftMinutes(start, end, {
                    nightShiftStartTime: company?.night_shift_start_time || '21:00',
                    daySchedule: profileSched,
                    scheduleMode,
                    openNoOvertime: profile.open_no_overtime,
                    openMaxOrdinaryMinutes: profile.open_max_ordinary_minutes,
                    firstInTime
                });
                const baseRate = profile.hourly_rate_base || 0;
                row.cost += (buckets.ordinary * baseRate / 60) +
                    (buckets.extraDay * (profile.hourly_rate_extra_day || baseRate || 0) / 60) +
                    (buckets.extraNight * (profile.hourly_rate_extra_night || baseRate || 0) / 60);
                row.ordinary_minutes += buckets.ordinary;
                row.extra_day_minutes += buckets.extraDay;
                row.extra_night_minutes += buckets.extraNight;
            }
        }
    });

    return daily;
}

function sumRows(rows: DailyRow[]): DailyRow {
    const total = emptyRow();
    rows.forEach(r => {
        NUMERIC_FIELDS.forEach(f => { (total[f] as number) += (r[f] as number); });
        if (r.is_late) total.is_late = true;
        if (r.is_unjustified_absence) total.is_unjustified_absence = true;
    });
    return total;
}

function fieldsMatch(a: number | boolean, b: number | boolean, isNumeric: boolean): boolean {
    if (isNumeric) return Math.abs((a as number) - (b as number)) <= (Math.max(Math.abs(a as number), Math.abs(b as number)) > 1000 ? 1 : 0.5);
    return a === b;
}

export const PayrollRpcShadowPanel: React.FC<PayrollRpcShadowPanelProps> = ({ companyId }) => {
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [clientTotals, setClientTotals] = useState<Record<string, DailyRow>>({});
    const [rpcTotals, setRpcTotals] = useState<Record<string, DailyRow>>({});
    const [profileNames, setProfileNames] = useState<Record<string, string>>({});
    const [clientDaily, setClientDaily] = useState<Map<string, DailyRow>>(new Map());
    const [rpcDaily, setRpcDaily] = useState<Map<string, DailyRow>>(new Map());
    const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
    const [mismatchCount, setMismatchCount] = useState<{ mismatches: number; total: number } | null>(null);

    const runComparison = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        setMismatchCount(null);
        try {
            const [{ data: compData }, { data: entryData, error: entryError }, { data: primaryProfiles, error: profileError }, { data: visitingProfiles, error: visitingError }] = await Promise.all([
                supabase.from('InA_companies').select('*').eq('id', companyId).single(),
                fetchAllRows((from, to) =>
                    supabase.from('InA_time_entries').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
                ),
                supabase.from('InA_profiles').select('*').eq('company_id', companyId),
                supabase.from('InA_profiles').select('*, assigned_branches:InA_employee_branches!inner(branch_id)').eq('assigned_branches.branch_id', companyId)
            ]);
            if (entryError) throw entryError;
            if (profileError) throw profileError;
            if (visitingError) throw visitingError;

            const mergedProfiles = [...(primaryProfiles || [])];
            (visitingProfiles || []).forEach((v: any) => { if (!mergedProfiles.find(p => p.id === v.id)) mergedProfiles.push(v); });

            const { data: primaryEmps } = await supabase.from('InA_profiles').select('id').eq('company_id', companyId);
            const scopedIds = new Set((primaryEmps || []).map((e: any) => e.id));
            const { data: leaves } = await supabase.from('InA_leave_requests').select('*').eq('status', 'approved');
            const leaveRequests = (leaves || []).filter((l: any) => scopedIds.has(l.profile_id));

            const namesMap: Record<string, string> = {};
            mergedProfiles.forEach(p => { namesMap[p.id] = p.full_name; });
            setProfileNames(namesMap);

            const clientMap = computeClientDaily(entryData || [], mergedProfiles, compData, leaveRequests, dateRange.start, dateRange.end);
            setClientDaily(clientMap);

            const { data: rpcRows, error: rpcError } = await supabase.rpc('payroll_daily_breakdown', {
                p_company_id: companyId, p_start_date: dateRange.start, p_end_date: dateRange.end
            });
            if (rpcError) throw rpcError;

            const rpcMap = new Map<string, DailyRow>();
            (rpcRows || []).forEach((r: any) => {
                rpcMap.set(`${r.profile_id}|${r.work_date}`, {
                    minutes_work: Number(r.minutes_work), ordinary_minutes: Number(r.ordinary_minutes),
                    extra_day_minutes: Number(r.extra_day_minutes), extra_night_minutes: Number(r.extra_night_minutes),
                    extra_sunday_minutes: Number(r.extra_sunday_minutes), breakfast_minutes: Number(r.breakfast_minutes),
                    lunch_minutes: Number(r.lunch_minutes), active_pause_minutes: Number(r.active_pause_minutes),
                    other_minutes: Number(r.other_minutes), cost: Number(r.cost),
                    is_late: r.is_late, is_unjustified_absence: r.is_unjustified_absence,
                    late_minutes: Number(r.late_minutes || 0)
                });
            });
            setRpcDaily(rpcMap);

            const clientByProfile: Record<string, DailyRow[]> = {};
            clientMap.forEach((row, key) => {
                const profileId = key.split('|')[0];
                (clientByProfile[profileId] ||= []).push(row);
            });
            const rpcByProfile: Record<string, DailyRow[]> = {};
            rpcMap.forEach((row, key) => {
                const profileId = key.split('|')[0];
                (rpcByProfile[profileId] ||= []).push(row);
            });

            const clientTotalsMap: Record<string, DailyRow> = {};
            const rpcTotalsMap: Record<string, DailyRow> = {};
            let mismatches = 0, total = 0;
            mergedProfiles.forEach(p => {
                const cTotal = sumRows(clientByProfile[p.id] || []);
                const rTotal = sumRows(rpcByProfile[p.id] || []);
                clientTotalsMap[p.id] = cTotal;
                rpcTotalsMap[p.id] = rTotal;
                [...NUMERIC_FIELDS, ...BOOLEAN_FIELDS].forEach(f => {
                    total++;
                    const isNumeric = NUMERIC_FIELDS.includes(f);
                    if (!fieldsMatch(cTotal[f] as any, rTotal[f] as any, isNumeric)) mismatches++;
                });
            });
            setClientTotals(clientTotalsMap);
            setRpcTotals(rpcTotalsMap);
            setMismatchCount({ mismatches, total });
        } catch (err: any) {
            console.error('Error comparando RPC de nómina:', err);
            setError(err.message || 'Error desconocido al comparar.');
        } finally {
            setLoading(false);
        }
    };

    if (!companyId) {
        return <div className="p-8 text-muted-foreground">Selecciona una sede primero.</div>;
    }

    return (
        <div className="space-y-6">
            <div className="bg-card border rounded-[2rem] p-6">
                <h2 className="text-lg font-black mb-1">Modo Sombra — RPC de Nómina</h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Compara el cálculo del RPC del servidor (<code>payroll_daily_breakdown</code>) contra el cálculo
                    del navegador (las mismas funciones de <code>calculations.ts</code> que usa el dashboard). Solo
                    lectura — no modifica ningún dato ni afecta el dashboard actual.
                </p>
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Desde</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Hasta</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <button
                        onClick={runComparison}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Ejecutar comparación
                    </button>
                </div>
                {error && <p className="text-sm text-red-500 mt-4">Error: {error}</p>}
            </div>

            {mismatchCount && (
                <div className={`rounded-2xl p-4 flex items-center gap-3 border ${mismatchCount.mismatches === 0 ? 'bg-green-500/10 border-green-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                    {mismatchCount.mismatches === 0 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
                    <span className="text-sm font-bold">
                        {mismatchCount.mismatches} de {mismatchCount.total} campos no coinciden (tolerancia ±0.5 min / ±$1)
                    </span>
                </div>
            )}

            {Object.keys(clientTotals).length > 0 && (
                <div className="bg-card border rounded-[2rem] overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="text-left p-3 font-bold">Empleado</th>
                                {[...NUMERIC_FIELDS, ...BOOLEAN_FIELDS].map(f => (
                                    <th key={f} className="text-right p-3 font-bold whitespace-nowrap">{FIELD_LABELS[f]}</th>
                                ))}
                                <th className="p-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(clientTotals).map(profileId => {
                                const cTotal = clientTotals[profileId];
                                const rTotal = rpcTotals[profileId] || emptyRow();
                                return (
                                    <React.Fragment key={profileId}>
                                        <tr className="border-t">
                                            <td className="p-3 font-bold">{profileNames[profileId]}</td>
                                            {[...NUMERIC_FIELDS, ...BOOLEAN_FIELDS].map(f => {
                                                const isNumeric = NUMERIC_FIELDS.includes(f);
                                                const match = fieldsMatch(cTotal[f] as any, rTotal[f] as any, isNumeric);
                                                const cVal = isNumeric ? Math.round(cTotal[f] as number) : (cTotal[f] ? 'Sí' : 'No');
                                                const rVal = isNumeric ? Math.round(rTotal[f] as number) : (rTotal[f] ? 'Sí' : 'No');
                                                return (
                                                    <td key={f} className={`p-3 text-right whitespace-nowrap ${match ? '' : 'bg-red-500/10 text-red-600 font-bold'}`}>
                                                        {cVal} / {rVal}
                                                    </td>
                                                );
                                            })}
                                            <td className="p-3">
                                                <button
                                                    onClick={() => setExpandedProfile(expandedProfile === profileId ? null : profileId)}
                                                    className="text-xs font-bold text-primary underline"
                                                >
                                                    {expandedProfile === profileId ? 'Ocultar' : 'Detalle diario'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedProfile === profileId && (
                                            <tr>
                                                <td colSpan={NUMERIC_FIELDS.length + BOOLEAN_FIELDS.length + 2} className="p-3 bg-muted/20">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr>
                                                                <th className="text-left p-2">Fecha</th>
                                                                {[...NUMERIC_FIELDS, ...BOOLEAN_FIELDS].map(f => (
                                                                    <th key={f} className="text-right p-2 whitespace-nowrap">{FIELD_LABELS[f]}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Array.from(clientDaily.keys())
                                                                .filter(k => k.startsWith(`${profileId}|`))
                                                                .sort()
                                                                .map(key => {
                                                                    const date = key.split('|')[1];
                                                                    const cRow = clientDaily.get(key)!;
                                                                    const rRow = rpcDaily.get(key) || emptyRow();
                                                                    return (
                                                                        <tr key={key} className="border-t">
                                                                            <td className="p-2">{date}</td>
                                                                            {[...NUMERIC_FIELDS, ...BOOLEAN_FIELDS].map(f => {
                                                                                const isNumeric = NUMERIC_FIELDS.includes(f);
                                                                                const match = fieldsMatch(cRow[f] as any, rRow[f] as any, isNumeric);
                                                                                const cVal = isNumeric ? Math.round(cRow[f] as number) : (cRow[f] ? 'Sí' : 'No');
                                                                                const rVal = isNumeric ? Math.round(rRow[f] as number) : (rRow[f] ? 'Sí' : 'No');
                                                                                return (
                                                                                    <td key={f} className={`p-2 text-right whitespace-nowrap ${match ? '' : 'bg-red-500/10 text-red-600 font-bold'}`}>
                                                                                        {cVal} / {rVal}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    );
                                                                })}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};
