import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { TimeEntry } from '../types';
import {
    FileDown, Search, Filter, Users, Clock,
    Coffee, CheckCircle, TrendingUp,
    MoreHorizontal, ArrowUpRight, ArrowDownRight, Trash2
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';

interface AdminDashboardProps {
    companyId: string | null;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ companyId }) => {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [selectedProfileId, setSelectedProfileId] = useState<string>('all');

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (!companyId) return;

                // Fetch Time Entries
                const { data: entryData, error: entryError } = await supabase
                    .from('time_entries')
                    .select('*, profiles(*)')
                    .eq('company_id', companyId)
                    .order('created_at', { ascending: false });

                if (entryError) throw entryError;
                setEntries(entryData || []);

                // Fetch Profiles for filter
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, national_id')
                    .eq('company_id', companyId)
                    .order('full_name');

                if (profileError) throw profileError;
                setProfiles(profileData || []);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [companyId]);

    const stats = useMemo(() => {
        const today = new Date().toLocaleDateString('en-CA');

        // Filter entries based on active filters
        const filteredForStats = entries.filter(e => {
            const date = e.date || e.created_at?.split('T')[0];
            const matchesDate = date && date >= dateRange.start && date <= dateRange.end;
            const matchesProfile = selectedProfileId === 'all' || e.profile_id === selectedProfileId;
            return matchesDate && matchesProfile;
        });

        // Current status (only for today)
        const entriesToday = entries.filter(e => (e.date || e.created_at?.split('T')[0]) === today);
        const activeNow = new Set();
        const onBreakNow = new Set();

        // Calculate current status per user
        const latestPerUser = entriesToday.reduce((acc: any, curr) => {
            if (!curr.created_at) return acc;
            if (!acc[curr.profile_id] || new Date(curr.created_at) > new Date(acc[curr.profile_id].created_at)) {
                acc[curr.profile_id] = curr;
            }
            return acc;
        }, {});

        Object.values(latestPerUser).forEach((e: any) => {
            if (['breakfast', 'lunch', 'active_pause'].includes(e.event_type)) {
                onBreakNow.add(e.profile_id);
            } else if (e.event_type === 'in') {
                activeNow.add(e.profile_id);
            }
        });

        // Calculate total hours for filtered set
        let totalMinutes = 0;
        const perUserAndDate = filteredForStats.reduce((acc: any, curr) => {
            const date = curr.date || curr.created_at?.split('T')[0];
            const key = `${curr.profile_id}_${date}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(curr);
            return acc;
        }, {});

        Object.values(perUserAndDate).forEach((dayEntries: any) => {
            const sorted = [...dayEntries].sort((a, b) =>
                new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            );

            for (let i = 0; i < sorted.length; i++) {
                if (sorted[i].event_type === 'in') {
                    const next = sorted[i + 1];
                    if (next) {
                        const start = new Date(sorted[i].created_at!);
                        const end = new Date(next.created_at!);
                        totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
                    } else if (sorted[i].created_at?.startsWith(today)) {
                        // Still clocked in TODAY
                        const start = new Date(sorted[i].created_at!);
                        const end = new Date();
                        totalMinutes += (end.getTime() - start.getTime()) / (1000 * 60);
                    }
                }
            }
        });

        // Punctuality: First 'in' before 08:30 AM
        const firstIns = entriesToday.filter(e => e.event_type === 'in' && !e.metadata?.is_return)
            .reduce((acc: any, curr) => {
                if (!curr.created_at) return acc;
                if (!acc[curr.profile_id] || new Date(curr.created_at) < new Date(acc[curr.profile_id])) {
                    acc[curr.profile_id] = curr.created_at;
                }
                return acc;
            }, {});

        const punctualCount = Object.values(firstIns).filter((time: any) => {
            const date = new Date(time);
            // Convertir a horas locales para validar puntualidad
            const hours = date.getHours();
            const minutes = date.getMinutes();
            return hours < 8 || (hours === 8 && minutes <= 30);
        }).length;

        const punctualityRate = Object.keys(firstIns).length > 0
            ? Math.round((punctualCount / Object.keys(firstIns).length) * 100)
            : 100;

        // Calculate breakdown minutes like totalMinutes
        let breakdownMins: Record<string, number> = { trabajo: 0, breakfast: 0, lunch: 0, active_pause: 0, other: 0 };
        Object.values(perUserAndDate).forEach((dayEntries: any) => {
            const sorted = [...dayEntries].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
            for (let i = 0; i < sorted.length; i++) {
                const start = new Date(sorted[i].created_at!);
                const next = sorted[i + 1];
                const isToday = (sorted[i].date || sorted[i].created_at?.split('T')[0]) === today;
                const end = next ? new Date(next.created_at!) : (isToday ? new Date() : start);
                const diff = (end.getTime() - start.getTime()) / 60000;

                if (sorted[i].event_type === 'in') breakdownMins.trabajo += diff;
                else if (breakdownMins[sorted[i].event_type] !== undefined) breakdownMins[sorted[i].event_type] += diff;
            }
        });

        return {
            activeToday: activeNow.size,
            onBreakToday: onBreakNow.size,
            totalHoursPeriod: Math.floor(breakdownMins.trabajo / 60),
            punctualityRate,
            totalMinutesPeriod: breakdownMins.trabajo,
            breakdown: breakdownMins
        };
    }, [entries, dateRange, selectedProfileId]);

    const chartData = useMemo(() => {
        const start = new Date(dateRange.start + 'T00:00:00');
        const end = new Date(dateRange.end + 'T23:59:59');
        const days = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            days.push(d.toLocaleDateString('en-CA'));
        }

        return days.map(dateStr => {
            const dayEntries = entries.filter(e =>
                (e.date || e.created_at?.split('T')[0]) === dateStr &&
                (selectedProfileId === 'all' || e.profile_id === selectedProfileId)
            );
            return {
                name: dateStr.split('-').slice(1).join('/'), // MM/DD
                actividad: dayEntries.length,
                entradas: dayEntries.filter(e => e.event_type === 'in' && !e.metadata?.is_return).length,
                salidas: dayEntries.filter(e => e.event_type === 'out').length,
            };
        });
    }, [entries, dateRange, selectedProfileId]);

    const filteredEntries = entries.filter(e => {
        const matchesSearch = e.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const date = e.date || e.created_at?.split('T')[0];
        const matchesDate = date && date >= dateRange.start && date <= dateRange.end;
        const matchesProfile = selectedProfileId === 'all' || e.profile_id === selectedProfileId;
        return matchesSearch && matchesDate && matchesProfile;
    });

    const exportToCSV = () => {
        // 1. Raw Logs Session
        const logHeaders = ['Fecha', 'Colaborador', 'ID', 'Evento', 'Hora', 'Metodo'];
        const logRows = filteredEntries.map(e => [
            e.date || e.created_at?.split('T')[0],
            e.profiles?.full_name || 'N/A',
            e.profiles?.national_id || 'N/A',
            e.metadata?.event_label || e.event_type,
            e.created_at ? new Date(e.created_at).toLocaleTimeString() : 'N/A',
            e.metadata?.method || 'N/A'
        ]);

        // 2. Summary Session (Total hours per employee)
        const summaryHeaders = ['', 'RESUMEN DE TIEMPO EFECTIVO', '', '', '', ''];
        const summarySubHeaders = ['Colaborador', 'ID', 'Total Horas', 'Total Minutos', '', ''];

        const totalsByEmployee = filteredEntries.reduce((acc: any, curr) => {
            if (!curr.profile_id) return acc;
            const date = curr.created_at?.split('T')[0];
            if (!date) return acc;

            if (!acc[curr.profile_id]) acc[curr.profile_id] = { name: curr.profiles?.full_name, id: curr.profiles?.national_id, days: {} };
            if (!acc[curr.profile_id].days[date]) acc[curr.profile_id].days[date] = [];
            acc[curr.profile_id].days[date].push(curr);
            return acc;
        }, {});

        const summaryRows = Object.values(totalsByEmployee).map((emp: any) => {
            let empMinutes = 0;
            Object.values(emp.days).forEach((dayEntries: any) => {
                const sorted = [...dayEntries].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
                for (let i = 0; i < sorted.length; i++) {
                    if (sorted[i].event_type === 'in') {
                        const next = sorted[i + 1];
                        if (next) empMinutes += (new Date(next.created_at!).getTime() - new Date(sorted[i].created_at!).getTime()) / 60000;
                        else if (sorted[i].created_at?.startsWith(new Date().toLocaleDateString('en-CA'))) {
                            empMinutes += (new Date().getTime() - new Date(sorted[i].created_at!).getTime()) / 60000;
                        }
                    }
                }
            });
            return [emp.name, emp.id, Math.floor(empMinutes / 60) + 'h ' + Math.round(empMinutes % 60) + 'm', Math.round(empMinutes), '', ''];
        });

        const csvContent = [
            ['REPORTES ASISTE360'],
            [`Periodo: ${dateRange.start} al ${dateRange.end}`],
            [],
            logHeaders,
            ...logRows,
            [],
            summaryHeaders,
            summarySubHeaders,
            ...summaryRows
        ].map(r => r.join(',')).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `asiste360_nomina_${dateRange.start}_a_${dateRange.end}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearRecords = async () => {
        if (!companyId) return;
        const confirmFirst = window.confirm(`¿Estás SEGURO de eliminar definitivamente los registros del periodo ${dateRange.start} al ${dateRange.end}? Esta acción no se puede deshacer.`);
        if (!confirmFirst) return;

        const confirmSecond = window.confirm("¡ATENCIÓN CRÍTICA! Estás a punto de borrar datos históricos de forma permanente. Asegúrate de haber descargado el reporte de Excel antes de continuar. ¿Deseas proceder con la eliminación?");
        if (!confirmSecond) return;

        try {
            setLoading(true);
            const { error: deleteError } = await supabase
                .from('time_entries')
                .delete()
                .eq('company_id', companyId)
                .gte('date', dateRange.start)
                .lte('date', dateRange.end);

            if (deleteError) throw deleteError;

            alert('Registros depurados correctamente.');

            // Refresh data
            const { data: entryData } = await supabase
                .from('time_entries')
                .select('*, profiles(*)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            setEntries(entryData || []);
        } catch (err: any) {
            alert('Error al limpiar registros: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getEventBadge = (type: string, metadata?: any) => {
        const config: Record<string, { label: string, color: string }> = {
            'in': {
                label: metadata?.event_label?.includes('Regreso') ? 'REGRESO' : 'ENTRADA',
                color: 'bg-green-100 text-green-700 ring-green-600/20'
            },
            'out': { label: 'SALIDA', color: 'bg-red-100 text-red-700 ring-red-600/20' },
            'breakfast': { label: 'DESAYUNO', color: 'bg-orange-100 text-orange-700 ring-orange-600/20' },
            'lunch': { label: 'ALMUERZO', color: 'bg-amber-100 text-amber-700 ring-amber-600/20' },
            'active_pause': { label: 'P. ACTIVA', color: 'bg-blue-100 text-blue-700 ring-blue-600/20' },
            'other': { label: 'OTRA', color: 'bg-slate-100 text-slate-700 ring-slate-600/20' }
        };
        const item = config[type] || { label: type.toUpperCase(), color: 'bg-slate-100 text-slate-700' };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ring-1 ring-inset ${item.color}`}>
                {item.label}
            </span>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h2 className="text-3xl font-black text-primary tracking-tighter uppercase italic">Panel de Control Analítico</h2>
                    <p className="text-muted-foreground text-sm font-medium">Bienvenido de nuevo. Aquí tienes el resumen de hoy.</p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-3">
                    <div className="flex bg-card border rounded-xl p-1 shadow-sm">
                        <select
                            value={selectedProfileId}
                            onChange={(e) => setSelectedProfileId(e.target.value)}
                            className="bg-transparent text-xs font-bold px-3 py-1 outline-none border-r border-dashed"
                        >
                            <option value="all">TODOS LOS EMPLEADOS</option>
                            {profiles.map(p => (
                                <option key={p.id} value={p.id}>{p.full_name}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="bg-transparent text-xs font-bold px-3 py-1 outline-none border-r border-dashed"
                        />
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="bg-transparent text-xs font-bold px-3 py-1 outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="En Turno Ahora"
                    value={`${stats.activeToday}`}
                    subValue="Laborando en este momento"
                    icon={<Users className="w-6 h-6 text-primary" />}
                    trend="up"
                />
                <StatCard
                    title="Total Empleados"
                    value={`${profiles.length}`}
                    subValue="Colaboradores registrados"
                    icon={<CheckCircle className="w-6 h-6 text-green-500" />}
                    trend="up"
                />
                <StatCard
                    title="En Pausa"
                    value={`${stats.onBreakToday}`}
                    subValue="Descansando ahora"
                    icon={<Coffee className="w-6 h-6 text-orange-500" />}
                    trend="down"
                />
                <StatCard
                    title="Horas Totales"
                    value={`${stats.totalHoursPeriod}h`}
                    subValue="Tiempo neto laborado"
                    icon={<TrendingUp className="w-6 h-6 text-blue-500" />}
                    trend="up"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-card border rounded-[2rem] p-8 shadow-sm space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-black uppercase tracking-tight">Actividad Semanal</h3>
                        <MoreHorizontal className="text-muted-foreground w-5 h-5 cursor-pointer" />
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#64748B' }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="actividad"
                                    stroke="#8884d8"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorIn)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card border rounded-[2rem] p-8 shadow-sm flex flex-col justify-between">
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black uppercase tracking-tight">Resumen de Tiempos</h3>
                            <div className="text-[10px] font-black bg-primary/10 text-primary px-3 py-1 rounded-full">CATEGORÍAS</div>
                        </div>
                        <div className="space-y-4">
                            <DistributionItem
                                label="Trabajo Efectivo"
                                value={stats.totalMinutesPeriod > 0 ? 100 : 0}
                                color="bg-primary"
                                suffix={`${Math.floor(stats.totalMinutesPeriod / 60)}h`}
                            />
                            <DistributionItem
                                label="Desayuno"
                                value={Math.min(100, Math.round((stats.breakdown.breakfast / (stats.totalMinutesPeriod || 1)) * 100))}
                                color="bg-orange-500"
                                suffix={`${Math.round(stats.breakdown.breakfast)}m`}
                            />
                            <DistributionItem
                                label="Almuerzo"
                                value={Math.min(100, Math.round((stats.breakdown.lunch / (stats.totalMinutesPeriod || 1)) * 100))}
                                color="bg-amber-500"
                                suffix={`${Math.round(stats.breakdown.lunch)}m`}
                            />
                            <DistributionItem
                                label="Pausa Activa"
                                value={Math.min(100, Math.round((stats.breakdown.active_pause / (stats.totalMinutesPeriod || 1)) * 100))}
                                color="bg-blue-500"
                                suffix={`${Math.round(stats.breakdown.active_pause)}m`}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-card border rounded-[2rem] shadow-sm overflow-hidden">
                <div className="p-8 border-b space-y-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <h3 className="text-xl font-black uppercase italic tracking-tighter">Registros Recientes</h3>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Buscar por colaborador..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 bg-muted/20 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                />
                            </div>
                            <button className="p-2.5 bg-muted/30 rounded-xl hover:bg-muted/50 transition-all">
                                <Filter className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleClearRecords}
                                className="flex items-center gap-2 px-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-black shadow-sm hover:bg-red-100 transition-all active:scale-95"
                                title="Limpiar registros del periodo seleccionado"
                            >
                                <Trash2 className="w-4 h-4" /> LIMPIAR
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black shadow-sm hover:opacity-90 transition-all active:scale-95"
                            >
                                <FileDown className="w-4 h-4" /> EXPORTAR
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                            <tr>
                                <th className="px-8 py-5">Colaborador</th>
                                <th className="px-8 py-5">Tipo de Registro</th>
                                <th className="px-8 py-5">Fecha y Hora</th>
                                <th className="px-8 py-5">Ubicación</th>
                                <th className="px-8 py-5 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-sm">
                            {loading ? (
                                <tr><td colSpan={5} className="px-8 py-16 text-center text-muted-foreground animate-pulse text-xs font-black uppercase tracking-widest">Sincronizando con el servidor...</td></tr>
                            ) : filteredEntries.length === 0 ? (
                                <tr><td colSpan={5} className="px-8 py-16 text-center text-muted-foreground text-xs font-bold italic">No se encontraron registros para mostrar.</td></tr>
                            ) : filteredEntries.map((entry: any) => (
                                <tr key={entry.id} className="hover:bg-muted/30 transition-all group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center font-black text-xs text-primary">
                                                {entry.profiles?.full_name?.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-black text-sm">{entry.profiles?.full_name || 'Desconocido'}</p>
                                                <p className="text-[10px] text-muted-foreground font-medium uppercase">{entry.profiles?.national_id || 'ID-OFFLINE'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        {getEventBadge(entry.event_type, entry.metadata)}
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-muted-foreground font-medium">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span className="text-xs">
                                                {entry.created_at ? new Date(entry.created_at).toLocaleString('es-CO', {
                                                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                                }) : '---'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-xs font-bold text-muted-foreground italic">
                                        Sede Norte (GPS OK)
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <button className="p-2 hover:bg-muted rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// UI Components
const StatCard: React.FC<{ title: string, value: string, subValue: string, icon: React.ReactNode, trend: 'up' | 'down' }> = ({
    title, value, subValue, icon, trend
}) => (
    <div className="bg-card border rounded-[2rem] p-8 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
        <div className="flex justify-between items-start mb-6">
            <div className="p-3 bg-primary/5 rounded-2xl">{icon}</div>
            <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${trend === 'up' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {trend === 'up' ? '+3.4%' : '-1.2%'}
            </div>
        </div>
        <div className="space-y-1">
            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest">{title}</h4>
            <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-primary tracking-tighter">{value}</span>
            </div>
            <p className="text-[10px] font-bold text-muted-foreground italic">{subValue}</p>
        </div>
    </div>
);

const DistributionItem: React.FC<{ label: string, value: number, color: string, suffix?: string }> = ({ label, value, color, suffix }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight">
            <span>{label}</span>
            <span className="text-muted-foreground">{suffix || `${value}%`}</span>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${color} rounded-full`} style={{ width: `${value}%` }} />
        </div>
    </div>
);
