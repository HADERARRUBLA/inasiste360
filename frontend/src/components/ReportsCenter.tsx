import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { FileDown, Loader2, RefreshCw, AlertTriangle, MapPinned } from 'lucide-react';
import { showToast } from '../lib/toastStore';
import { fetchAllRows } from '../utils/supabasePagination';

interface ReportsCenterProps {
    companyId: string | null;
    companyName?: string | null;
}

interface DailyRow {
    profile_id: string;
    full_name: string;
    national_id: string;
    work_date: string;
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
    leave_type: string | null;
    late_minutes: number;
}

// Mismas etiquetas que LeaveManagement.tsx/AdminDashboard.tsx — se duplica
// aquí a propósito, siguiendo el mismo patrón ya usado en el resto del
// proyecto en vez de introducir un módulo compartido nuevo.
const LEAVE_TYPE_LABELS: Record<string, string> = {
    vacaciones: 'Vacaciones',
    incapacidad_eps: 'Incapacidad EPS',
    incapacidad_arl: 'Incapacidad ARL',
    permiso_remunerado: 'Permiso Remunerado',
    permiso_no_remunerado: 'Permiso No Remunerado',
    licencia_maternidad: 'Licencia de Maternidad',
    licencia_paternidad: 'Licencia de Paternidad',
    luto: 'Luto',
    otro: 'Otro'
};

const fmtMin = (min: number) => {
    if (!min) return '0';
    return Math.round(min).toString();
};

const fmtCost = (n: number) => Math.round(n || 0).toLocaleString('es-CO');

interface OtherSedeInfo {
    totalMinutes: number;
    bySede: { name: string; minutes: number }[];
}

interface LeaveTotal {
    count: number;
    days: number;
}

const daysBetween = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
};

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ companyId, companyName }) => {
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [employees, setEmployees] = useState<{ id: string; full_name: string; national_id: string }[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState('all');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<DailyRow[]>([]);
    const [hasRun, setHasRun] = useState(false);
    // Horas del mismo empleado en OTRAS sedes, el mismo día — para que un
    // empleado multi-sede no se vea como si le faltaran horas en este
    // informe (confirmado con el usuario 2026-08-20: nota en la misma fila,
    // no una columna aparte ni un informe combinado).
    const [otherSedeMap, setOtherSedeMap] = useState<Record<string, OtherSedeInfo>>({});
    const [leaveTotals, setLeaveTotals] = useState<Record<string, LeaveTotal>>({});

    useEffect(() => {
        setSelectedProfileId('all');
        setRows([]);
        setHasRun(false);
        if (!companyId) { setEmployees([]); return; }
        (async () => {
            // Mismo patrón de fusión de LeaveManagement.tsx: empleados con esta
            // sede como principal + autorizados aquí como sede adicional.
            const [{ data: primary }, { data: visiting }] = await Promise.all([
                supabase.from('InA_profiles').select('id, full_name, national_id').eq('company_id', companyId).order('full_name'),
                supabase.from('InA_profiles').select('id, full_name, national_id, assigned_branches:InA_employee_branches!inner(branch_id)').eq('assigned_branches.branch_id', companyId)
            ]);
            const merged = [...(primary || [])];
            (visiting || []).forEach((v: any) => { if (!merged.find(e => e.id === v.id)) merged.push(v); });
            merged.sort((a, b) => a.full_name.localeCompare(b.full_name));
            setEmployees(merged);
        })();
    }, [companyId]);

    const fetchOtherSedeHours = async (profileIds: string[]) => {
        if (profileIds.length === 0) { setOtherSedeMap({}); return; }
        try {
            const { data: otherEntries, error: entriesError } = await fetchAllRows((from, to) =>
                supabase.from('InA_time_entries')
                    .select('profile_id, date, company_id, clock_in, clock_out, total_hours, event_type')
                    .in('profile_id', profileIds)
                    .neq('company_id', companyId)
                    .gte('date', dateRange.start).lte('date', dateRange.end)
                    .in('event_type', ['in', 'out'])
                    .range(from, to)
            );
            if (entriesError) throw entriesError;
            if (!otherEntries || otherEntries.length === 0) { setOtherSedeMap({}); return; }

            const otherCompanyIds = Array.from(new Set(otherEntries.map((e: any) => e.company_id).filter(Boolean)));
            const { data: companies } = await supabase.from('InA_companies').select('id, name').in('id', otherCompanyIds);
            const companyNames: Record<string, string> = {};
            (companies || []).forEach((c: any) => { companyNames[c.id] = c.name; });

            // Aproximado, informativo — no reemplaza el cálculo de nómina real
            // de la otra sede (que agrupa por turno). Suficiente para avisar
            // "tiene tiempo registrado en otra sede", no para pagar con esto.
            const map: Record<string, { minutes: number; sedeMinutes: Record<string, number> }> = {};
            otherEntries.forEach((e: any) => {
                let minutes = 0;
                if (e.total_hours) minutes = e.total_hours * 60;
                else if (e.clock_in && e.clock_out) minutes = Math.max(0, (new Date(e.clock_out).getTime() - new Date(e.clock_in).getTime()) / 60000);
                if (minutes === 0) return;
                const key = `${e.profile_id}|${e.date}`;
                if (!map[key]) map[key] = { minutes: 0, sedeMinutes: {} };
                map[key].minutes += minutes;
                map[key].sedeMinutes[e.company_id] = (map[key].sedeMinutes[e.company_id] || 0) + minutes;
            });

            const result: Record<string, OtherSedeInfo> = {};
            Object.entries(map).forEach(([key, v]) => {
                result[key] = {
                    totalMinutes: v.minutes,
                    bySede: Object.entries(v.sedeMinutes).map(([cid, min]) => ({ name: companyNames[cid] || 'Otra sede', minutes: min }))
                };
            });
            setOtherSedeMap(result);
        } catch (err) {
            console.error('Error consultando horas en otras sedes:', err);
            setOtherSedeMap({});
        }
    };

    const fetchLeaveTotals = async () => {
        const profileIds = selectedProfileId === 'all' ? employees.map(e => e.id) : [selectedProfileId];
        if (profileIds.length === 0) { setLeaveTotals({}); return; }
        try {
            // Cantidad de solicitudes y días por tipo — se consulta directo a
            // InA_leave_requests (no se deriva de los días del RPC) porque
            // ahí sí se puede contar "cuántas solicitudes" además de "cuántos
            // días", cosa que el conteo de días-en-la-grilla no distingue
            // (2 incapacidades de 2 días cada una vs. 1 de 4 días se ven
            // igual si solo se cuentan días).
            const { data, error: leaveError } = await supabase.from('InA_leave_requests')
                .select('profile_id, type, start_date, end_date')
                .in('profile_id', profileIds)
                .eq('status', 'approved')
                .lte('start_date', dateRange.end)
                .gte('end_date', dateRange.start);
            if (leaveError) throw leaveError;

            const totals: Record<string, LeaveTotal> = {};
            (data || []).forEach((lr: any) => {
                const clampedStart = lr.start_date < dateRange.start ? dateRange.start : lr.start_date;
                const clampedEnd = lr.end_date > dateRange.end ? dateRange.end : lr.end_date;
                if (!totals[lr.type]) totals[lr.type] = { count: 0, days: 0 };
                totals[lr.type].count += 1;
                totals[lr.type].days += daysBetween(clampedStart, clampedEnd);
            });
            setLeaveTotals(totals);
        } catch (err) {
            console.error('Error consultando novedades por tipo:', err);
            setLeaveTotals({});
        }
    };

    const runReport = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('payroll_daily_breakdown', {
                p_company_id: companyId, p_start_date: dateRange.start, p_end_date: dateRange.end,
                p_profile_id: selectedProfileId === 'all' ? null : selectedProfileId
            });
            if (rpcError) throw rpcError;
            // Solo filas con algo que mostrar (evita una tabla enorme de días
            // en cero para empleados sin horario activo esos días).
            const withData = (data || []).filter((r: any) =>
                r.minutes_work > 0 || r.breakfast_minutes > 0 || r.lunch_minutes > 0 ||
                r.active_pause_minutes > 0 || r.other_minutes > 0 || r.is_late || r.is_unjustified_absence || r.leave_type
            );
            setRows(withData);
            setHasRun(true);
            await Promise.all([
                fetchOtherSedeHours(Array.from(new Set(withData.map((r: any) => r.profile_id)))),
                fetchLeaveTotals()
            ]);
        } catch (err: any) {
            console.error('Error generando el informe:', err);
            setError(err.message || 'Error desconocido al generar el informe.');
        } finally {
            setLoading(false);
        }
    };

    // Informe 2: agregado por tipo — mismas filas ya traídas para el
    // Informe 1, sumadas por categoría en vez de por empleado/día.
    const categoryTotals = {
        breakfastMinutes: rows.reduce((s, r) => s + r.breakfast_minutes, 0),
        lunchMinutes: rows.reduce((s, r) => s + r.lunch_minutes, 0),
        activePauseMinutes: rows.reduce((s, r) => s + r.active_pause_minutes, 0),
        otherMinutes: rows.reduce((s, r) => s + r.other_minutes, 0),
        unjustifiedAbsences: rows.filter(r => r.is_unjustified_absence).length
    };

    const exportCategoryToExcel = () => {
        const aoa: any[][] = [
            [`Informe Agregado por Tipo${companyName ? ' — ' + companyName : ''}`],
            [`Periodo: ${dateRange.start} a ${dateRange.end}`],
            [],
            ['Tiempos (todos los empleados)', 'Horas'],
            ['Desayuno', (categoryTotals.breakfastMinutes / 60).toFixed(1)],
            ['Almuerzo', (categoryTotals.lunchMinutes / 60).toFixed(1)],
            ['Pausa Activa', (categoryTotals.activePauseMinutes / 60).toFixed(1)],
            ['Otros', (categoryTotals.otherMinutes / 60).toFixed(1)],
            [],
            ['Ausencias No Justificadas (días)', categoryTotals.unjustifiedAbsences],
            [],
            ['Novedades por Tipo', 'Cantidad de Solicitudes', 'Días'],
            ...Object.entries(leaveTotals).map(([type, t]) => [LEAVE_TYPE_LABELS[type] || type, t.count, t.days])
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, 'Agregado por Tipo');
        XLSX.writeFile(wb, `informe_agregado_por_tipo_${dateRange.start}_a_${dateRange.end}.xlsx`);
        showToast('Excel exportado.', 'success');
    };

    const exportToExcel = () => {
        if (rows.length === 0) return;
        const headers = [
            'Empleado', 'Identificación', 'Fecha', 'Min. Trabajo', 'Desayuno (min)', 'Almuerzo (min)',
            'Pausa Activa (min)', 'Otros (min)', 'Ordinaria (min)', 'Extra Diurna (min)', 'Extra Nocturna (min)',
            'Extra Dominical (min)', 'Tardanza (min)', 'Novedad', 'Ausencia Injustificada', 'Costo Estimado',
            'Horas en Otra Sede (mismo día)'
        ];
        const dataRows = rows.map(r => {
            const otherSede = otherSedeMap[`${r.profile_id}|${r.work_date}`];
            return [
                r.full_name, r.national_id, r.work_date, Math.round(r.minutes_work), Math.round(r.breakfast_minutes),
                Math.round(r.lunch_minutes), Math.round(r.active_pause_minutes), Math.round(r.other_minutes),
                Math.round(r.ordinary_minutes), Math.round(r.extra_day_minutes), Math.round(r.extra_night_minutes),
                Math.round(r.extra_sunday_minutes), Math.round(r.late_minutes),
                r.leave_type ? (LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type) : '',
                r.is_unjustified_absence ? 'Sí' : 'No', Math.round(r.cost),
                otherSede ? otherSede.bySede.map(s => `${s.name}: ${(s.minutes / 60).toFixed(1)}h`).join(' · ') : ''
            ];
        });
        const aoa = [
            [`Informe Detallado por Empleado/Día${companyName ? ' — ' + companyName : ''}`],
            [`Periodo: ${dateRange.start} a ${dateRange.end}`],
            [],
            headers,
            ...dataRows
        ];
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Diario');
        XLSX.writeFile(wb, `informe_detalle_diario_${dateRange.start}_a_${dateRange.end}.xlsx`);
        showToast('Excel exportado.', 'success');
    };

    if (!companyId) {
        return <div className="p-8 text-muted-foreground">Selecciona una sede primero.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Informes Operativos</h2>
                <p className="text-muted-foreground font-bold text-sm">Detalle diario por empleado — tiempos trabajados, novedades y tardanzas.</p>
            </div>

            <div className="bg-card border rounded-[2rem] p-6">
                <h3 className="text-sm font-black uppercase tracking-widest text-primary mb-4">1. Detalle por Empleado/Día</h3>
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Desde</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Hasta</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="border rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-muted-foreground block mb-1">Empleado</label>
                        <select value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)} className="border rounded-xl px-3 py-2 text-sm min-w-[200px]">
                            <option value="all">Todos los empleados</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.national_id})</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={runReport}
                        disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-bold disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Generar Informe
                    </button>
                    {rows.length > 0 && (
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
                        >
                            <FileDown className="w-4 h-4" /> Exportar a Excel
                        </button>
                    )}
                </div>
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 mt-4">
                        <AlertTriangle className="w-4 h-4" /> Error: {error}
                    </div>
                )}
            </div>

            {hasRun && !loading && (
                <div className="bg-card border rounded-[2.5rem] overflow-hidden">
                    {rows.length === 0 ? (
                        <p className="text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-30 italic py-16">
                            Sin datos en el rango seleccionado.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-bold whitespace-nowrap">Empleado</th>
                                        <th className="text-left p-3 font-bold whitespace-nowrap">Fecha</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Trabajo</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Desayuno</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Almuerzo</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Ordinaria</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Ex. Diurna</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Ex. Nocturna</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Ex. Dominical</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Tarde (min)</th>
                                        <th className="text-left p-3 font-bold whitespace-nowrap">Novedad</th>
                                        <th className="text-right p-3 font-bold whitespace-nowrap">Costo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r, idx) => {
                                        const otherSede = otherSedeMap[`${r.profile_id}|${r.work_date}`];
                                        return (
                                        <tr key={`${r.profile_id}-${r.work_date}-${idx}`} className="border-t hover:bg-muted/20">
                                            <td className="p-3 font-bold whitespace-nowrap">
                                                {r.full_name}
                                                {otherSede && (
                                                    <span
                                                        title={otherSede.bySede.map(s => `${s.name}: ${(s.minutes / 60).toFixed(1)}h`).join(' · ')}
                                                        className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[9px] font-black uppercase align-middle cursor-help"
                                                    >
                                                        <MapPinned className="w-3 h-3" /> +{(otherSede.totalMinutes / 60).toFixed(1)}h otra sede
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 whitespace-nowrap">{r.work_date}</td>
                                            <td className="p-3 text-right">{fmtMin(r.minutes_work)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.breakfast_minutes)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.lunch_minutes)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.ordinary_minutes)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.extra_day_minutes)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.extra_night_minutes)}</td>
                                            <td className="p-3 text-right">{fmtMin(r.extra_sunday_minutes)}</td>
                                            <td className={`p-3 text-right ${r.is_late ? 'text-amber-600 font-bold' : ''}`}>{r.is_late ? fmtMin(r.late_minutes) : '-'}</td>
                                            <td className="p-3 whitespace-nowrap">
                                                {r.leave_type ? (
                                                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-black uppercase">
                                                        {LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type}
                                                    </span>
                                                ) : r.is_unjustified_absence ? (
                                                    <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-[10px] font-black uppercase">Ausencia Injustificada</span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3 text-right font-bold">${fmtCost(r.cost)}</td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {hasRun && !loading && (
                <div className="bg-card border rounded-[2rem] p-6">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-primary">2. Agregado por Tipo</h3>
                        <button
                            onClick={exportCategoryToExcel}
                            className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors"
                        >
                            <FileDown className="w-4 h-4" /> Exportar a Excel
                        </button>
                    </div>

                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Tiempos (todos los empleados del periodo)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { label: 'Desayuno', minutes: categoryTotals.breakfastMinutes },
                            { label: 'Almuerzo', minutes: categoryTotals.lunchMinutes },
                            { label: 'Pausa Activa', minutes: categoryTotals.activePauseMinutes },
                            { label: 'Otros', minutes: categoryTotals.otherMinutes }
                        ].map(item => (
                            <div key={item.label} className="bg-muted/20 border rounded-2xl p-4 text-center">
                                <p className="text-2xl font-black text-primary">{(item.minutes / 60).toFixed(1)}h</p>
                                <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mt-1">{item.label}</p>
                            </div>
                        ))}
                    </div>

                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 inline-flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                        <span className="text-sm font-bold text-red-700">{categoryTotals.unjustifiedAbsences} día(s) de ausencia no justificada en el periodo</span>
                    </div>

                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-3">Novedades por Tipo</p>
                    {Object.keys(leaveTotals).length === 0 ? (
                        <p className="text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-30 italic py-8">
                            Sin novedades aprobadas en el rango seleccionado.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                    <tr>
                                        <th className="text-left p-3 font-bold">Tipo de Novedad</th>
                                        <th className="text-right p-3 font-bold">Cantidad de Solicitudes</th>
                                        <th className="text-right p-3 font-bold">Días (en el rango)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(leaveTotals).map(([type, t]) => (
                                        <tr key={type} className="border-t">
                                            <td className="p-3 font-bold">{LEAVE_TYPE_LABELS[type] || type}</td>
                                            <td className="p-3 text-right">{t.count}</td>
                                            <td className="p-3 text-right">{t.days}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
