import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { FileDown, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { showToast } from '../lib/toastStore';

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

export const ReportsCenter: React.FC<ReportsCenterProps> = ({ companyId, companyName }) => {
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rows, setRows] = useState<DailyRow[]>([]);
    const [hasRun, setHasRun] = useState(false);

    const runReport = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('payroll_daily_breakdown', {
                p_company_id: companyId, p_start_date: dateRange.start, p_end_date: dateRange.end
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
        } catch (err: any) {
            console.error('Error generando el informe:', err);
            setError(err.message || 'Error desconocido al generar el informe.');
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (rows.length === 0) return;
        const headers = [
            'Empleado', 'Identificación', 'Fecha', 'Min. Trabajo', 'Desayuno (min)', 'Almuerzo (min)',
            'Pausa Activa (min)', 'Otros (min)', 'Ordinaria (min)', 'Extra Diurna (min)', 'Extra Nocturna (min)',
            'Extra Dominical (min)', 'Tardanza (min)', 'Novedad', 'Ausencia Injustificada', 'Costo Estimado'
        ];
        const dataRows = rows.map(r => [
            r.full_name, r.national_id, r.work_date, Math.round(r.minutes_work), Math.round(r.breakfast_minutes),
            Math.round(r.lunch_minutes), Math.round(r.active_pause_minutes), Math.round(r.other_minutes),
            Math.round(r.ordinary_minutes), Math.round(r.extra_day_minutes), Math.round(r.extra_night_minutes),
            Math.round(r.extra_sunday_minutes), Math.round(r.late_minutes),
            r.leave_type ? (LEAVE_TYPE_LABELS[r.leave_type] || r.leave_type) : '',
            r.is_unjustified_absence ? 'Sí' : 'No', Math.round(r.cost)
        ]);
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
                                    {rows.map((r, idx) => (
                                        <tr key={`${r.profile_id}-${r.work_date}-${idx}`} className="border-t hover:bg-muted/20">
                                            <td className="p-3 font-bold whitespace-nowrap">{r.full_name}</td>
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
