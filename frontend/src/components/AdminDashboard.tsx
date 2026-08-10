import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { TimeEntry } from '../types';
import * as XLSX from 'xlsx';
import {
    FileDown, Search, Users, Clock,
    CheckCircle, TrendingUp, AlertTriangle,
    MoreHorizontal, ArrowUpRight, ArrowDownRight, Trash2, CalendarOff
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { showToast } from '../lib/toastStore';
import { groupEntriesIntoShifts, getFirstInTime, classifyShiftMinutes } from '../utils/calculations';
import { fetchAllRows } from '../utils/supabasePagination';

interface AdminDashboardProps {
    companyId: string | null;
    view?: 'analytics' | 'reports';
}

const dayMap: Record<number, string> = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
};

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

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ companyId, view = 'analytics' }) => {
    const [entries, setEntries] = useState<TimeEntry[]>([]);
    const [profiles, setProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 7)).toLocaleDateString('en-CA'),
        end: new Date().toLocaleDateString('en-CA')
    });
    const [selectedProfileId, setSelectedProfileId] = useState<string>('all');
    const [viewTab, setViewTab] = useState<'analytics' | 'reports'>(view);
    const [reportType, setReportType] = useState<'employees' | 'hours' | 'alerts' | 'leaves'>('employees');

    // Sync viewTab if prop changes
    useEffect(() => {
        setViewTab(view);
    }, [view]);

    const [company, setCompany] = useState<any>(null);
    const [leaveRequests, setLeaveRequests] = useState<any[]>([]);

    // Novedades de esta sede, TODOS los estados (principal + "de visita"
    // multi-sede, mismo patrón que EmployeeManagement/LeaveManagement) — se
    // usan para el panel "Ausencias de Hoy" (solo aprobadas), la exclusión
    // de ausencias no justificadas (solo aprobadas), y la sección de
    // Novedades en Reportes (todos los estados, para que el reporte del
    // periodo sea completo).
    useEffect(() => {
        const fetchLeaveRequests = async () => {
            if (!companyId) { setLeaveRequests([]); return; }
            // Las 3 consultas son independientes entre sí — lanzarlas en
            // paralelo en vez de esperar una tras otra reduce el tiempo de
            // carga a el de la más lenta, no a la suma de las tres.
            const [{ data: primaryEmps }, { data: visitingEmps }, { data: leaves, error }] = await Promise.all([
                supabase.from('InA_profiles').select('id').eq('company_id', companyId).eq('role', 'employee'),
                supabase
                    .from('InA_profiles')
                    .select('id, assigned_branches:InA_employee_branches!inner(branch_id)')
                    .eq('role', 'employee')
                    .eq('assigned_branches.branch_id', companyId),
                supabase
                    .from('InA_leave_requests')
                    .select('*, InA_profiles!profile_id(full_name)')
                    .order('start_date', { ascending: false })
            ]);
            if (error) { console.error('Error cargando novedades:', error); return; }
            const scopedIds = new Set([...(primaryEmps || []).map((e: any) => e.id), ...(visitingEmps || []).map((e: any) => e.id)]);
            setLeaveRequests((leaves || []).filter((l: any) => scopedIds.has(l.profile_id)));
        };
        fetchLeaveRequests();
    }, [companyId]);

    const todayAbsences = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        return leaveRequests.filter(l => l.status === 'approved' && l.start_date <= todayStr && l.end_date >= todayStr);
    }, [leaveRequests]);

    const leaveRequestsInRange = useMemo(() => {
        return leaveRequests.filter(l => l.start_date <= dateRange.end && l.end_date >= dateRange.start);
    }, [leaveRequests, dateRange]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                if (!companyId) return;

                // Las 4 consultas no dependen entre sí — lanzarlas juntas con
                // Promise.all en vez de una tras otra evita sumar la latencia
                // de cada viaje de ida y vuelta al servidor.
                const [
                    { data: compData },
                    { data: entryData, error: entryError },
                    { data: primaryProfiles, error: profileError },
                    { data: visitingProfiles, error: visitingError }
                ] = await Promise.all([
                    supabase.from('InA_companies').select('*').eq('id', companyId).single(),
                    // Paginado con fetchAllRows: Supabase limita cada consulta
                    // a 1000 filas por defecto, y una sede con suficiente
                    // historial de marcaciones supera eso fácilmente — sin
                    // paginar, se pierden marcaciones (y por lo tanto horas y
                    // empleados enteros) en silencio, sin ningún error.
                    // order() incluye 'id' como desempate: sin un orden 100%
                    // determinístico, filas con el mismo created_at pueden
                    // repetirse o perderse entre páginas de .range().
                    fetchAllRows((from, to) =>
                        supabase.from('InA_time_entries').select('*, InA_profiles(*)').eq('company_id', companyId).order('created_at', { ascending: false }).order('id', { ascending: true }).range(from, to)
                    ),
                    // Perfiles: sede principal + empleados "de visita" multi-sede
                    // (mismo patrón ya usado en EmployeeManagement.tsx y
                    // LeaveManagement.tsx) — sin esto, las horas trabajadas por
                    // un empleado multi-sede en esta sede no se contaban en
                    // ningún dashboard de nómina.
                    supabase.from('InA_profiles').select('*').eq('company_id', companyId).order('full_name'),
                    supabase.from('InA_profiles').select('*, assigned_branches:InA_employee_branches!inner(branch_id)').eq('assigned_branches.branch_id', companyId)
                ]);

                setCompany(compData);

                if (entryError) throw entryError;
                setEntries(entryData || []);

                if (profileError) throw profileError;
                if (visitingError) throw visitingError;

                const mergedProfiles = [...(primaryProfiles || [])];
                (visitingProfiles || []).forEach((v: any) => {
                    if (!mergedProfiles.find(p => p.id === v.id)) mergedProfiles.push(v);
                });
                mergedProfiles.sort((a, b) => a.full_name.localeCompare(b.full_name));
                setProfiles(mergedProfiles);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [companyId]);

    const stats = useMemo(() => {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const now = new Date();

        // 1. Basic Filtering
        const filteredForStats = entries.filter(e => {
            const date = e.date || e.created_at?.split('T')[0];
            const matchesDate = date && date >= dateRange.start && date <= dateRange.end;
            const matchesProfile = selectedProfileId === 'all' || e.profile_id === selectedProfileId;
            return matchesDate && matchesProfile;
        });

        const entriesToday = entries.filter(e => (e.date || e.created_at?.split('T')[0]) === todayStr);

        // 2. Active Now Calculation
        const activeNow = new Set();
        const onBreakNow = new Set();
        const latestPerUser = entriesToday.reduce((acc: any, curr) => {
            if (!curr.created_at) return acc;
            if (!acc[curr.profile_id] || new Date(curr.created_at) > new Date(acc[curr.profile_id].created_at)) {
                acc[curr.profile_id] = curr;
            }
            return acc;
        }, {});

        Object.values(latestPerUser).forEach((e: any) => {
            if (['breakfast', 'lunch', 'active_pause'].includes(e.event_type)) onBreakNow.add(e.profile_id);
            else if (e.event_type === 'in') activeNow.add(e.profile_id);
        });

        // 3. Punctuality & Late Alerts (Entire Period)
        let totalLatesPeriod = 0;
        const alertEntries: any[] = [];
        const userSummaries: Record<string, any> = {};

        // Initialize user summaries
        profiles.forEach(p => {
            userSummaries[p.id] = {
                name: p.full_name,
                national_id: p.national_id,
                minutesWork: 0,
                breakfast: 0,
                lunch: 0,
                activePause: 0,
                others: 0,
                lates: 0,
                extraDay: 0,
                extraNight: 0,
                extraSunday: 0,
                totalCost: 0,
                unjustifiedAbsences: 0
            };
        });

        // Agrupar marcaciones por turno (no por la columna `date` de cada
        // evento suelto) para no perder turnos que cruzan medianoche, y
        // filtrar por el rango de fechas usando el ancla del turno.
        const shiftGroups = groupEntriesIntoShifts(entries)
            .filter(g => g.dateKey >= dateRange.start && g.dateKey <= dateRange.end);

        shiftGroups.forEach(group => {
            const { profileId, dateKey: dateStr, entries: dayEntries } = group;
            const profile = profiles.find(p => p.id === profileId);
            if (!profile) return;

            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayCode = dayMap[dateObj.getDay()];
            // 'branch' compara contra el horario de la sede. 'custom' y 'open'
            // comparan contra el horario propio del perfil — en 'open' esto es
            // un horario de referencia OPCIONAL (solo seguimiento de
            // puntualidad, nunca afecta el cálculo de nómina/extra). Si no se
            // definió ninguna franja activa, `profileSched?.active` da falso
            // y simplemente no hay seguimiento para ese día, como hoy.
            const profileSched = profile.schedule_mode === 'branch' ? (company?.work_schedule?.[dayCode]) : (profile.work_schedule?.[dayCode]);

            if (profileSched?.active) {
                const firstIn = getFirstInTime(dayEntries);

                if (firstIn) {
                    const [schedH, schedM] = profileSched.start.split(':').map(Number);
                    const schedTime = new Date(firstIn);
                    schedTime.setHours(schedH, schedM, 0, 0);

                    if (firstIn > schedTime) {
                        totalLatesPeriod++;
                        userSummaries[profileId].lates++;
                        const diffMin = Math.round((firstIn.getTime() - schedTime.getTime()) / 60000);
                        if (dateStr === todayStr) {
                            alertEntries.push({
                                name: profile.full_name,
                                type: 'Llegada Tarde',
                                desc: `${diffMin} min tarde (${dateStr})`,
                                time: firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                severity: 'error'
                            });
                        }
                    }
                }
            }
        });

        // 3.5 Ausencias no justificadas: día con horario activo, sin ninguna
        // marcación ese día, y sin una novedad aprobada (InA_leave_requests)
        // que cubra la fecha. Nunca se evalúan días futuros.
        {
            const shiftGroupKeys = new Set(shiftGroups.map(g => `${g.profileId}_${g.dateKey}`));
            const rangeEnd = dateRange.end < todayStr ? dateRange.end : todayStr;
            for (let d = new Date(dateRange.start + 'T12:00:00'); d.toLocaleDateString('en-CA') <= rangeEnd; d.setDate(d.getDate() + 1)) {
                const dStr = d.toLocaleDateString('en-CA');
                const dayCode = dayMap[d.getDay()];
                profiles.forEach(profile => {
                    const sched = profile.schedule_mode === 'branch' ? company?.work_schedule?.[dayCode] : profile.work_schedule?.[dayCode];
                    if (!sched?.active) return;
                    if (shiftGroupKeys.has(`${profile.id}_${dStr}`)) return;
                    const onLeave = leaveRequests.some((l: any) => l.status === 'approved' && l.profile_id === profile.id && l.start_date <= dStr && l.end_date >= dStr);
                    if (onLeave) return;

                    userSummaries[profile.id].unjustifiedAbsences++;
                    if (dStr === todayStr) {
                        alertEntries.push({
                            name: profile.full_name,
                            type: 'Ausencia No Justificada',
                            desc: `No registró marcación (${dStr})`,
                            time: '--:--',
                            severity: 'error'
                        });
                    }
                });
            }
        }

        // 4. Payroll & Breakdown Calculation
        let estimatedCost = 0;
        let totalMinutesWork = 0;
        const globalBreakdown: Record<string, number> = { trabajo: 0, breakfast: 0, lunch: 0, active_pause: 0 };

        shiftGroups.forEach(group => {
            const { profileId, dateKey: dateStr, entries: sorted } = group;
            const profile = profiles.find(p => p.id === profileId);
            if (!profile) return;

            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayCode = dayMap[dateObj.getDay()];
            const scheduleMode = profile.schedule_mode || 'branch';
            const profileSched = scheduleMode === 'custom' ? (profile.work_schedule?.[dayCode]) : (company?.work_schedule?.[dayCode]);
            const isSunday = dateObj.getDay() === 0;
            const firstInTime = scheduleMode === 'open' ? getFirstInTime(sorted) : null;

            for (let i = 0; i < sorted.length; i++) {
                const entry = sorted[i];
                const start = new Date(entry.clock_in || entry.created_at!);
                let end = start;
                let diffMin = 0;

                if (entry.total_hours) {
                    diffMin = entry.total_hours * 60;
                    end = new Date(start.getTime() + diffMin * 60000);
                } else {
                    const next = sorted[i + 1];
                    const isEntryToday = (entry.date || entry.created_at?.split('T')[0]) === todayStr;
                    end = entry.clock_out
                        ? new Date(entry.clock_out)
                        : (next ? new Date(next.clock_in || next.created_at!) : (isEntryToday ? new Date() : start));
                    diffMin = Math.max(0, (end.getTime() - start.getTime()) / 60000);
                }

                if (entry.event_type !== 'in' && entry.event_type !== 'out') {
                    if (globalBreakdown[entry.event_type] !== undefined) {
                        globalBreakdown[entry.event_type] += diffMin;
                    }
                    if (entry.event_type === 'breakfast') userSummaries[profileId].breakfast += diffMin;
                    else if (entry.event_type === 'lunch') userSummaries[profileId].lunch += diffMin;
                    else if (entry.event_type === 'active_pause') userSummaries[profileId].activePause += diffMin;
                    else userSummaries[profileId].others += diffMin;
                    continue;
                }

                userSummaries[profileId].minutesWork += diffMin;
                globalBreakdown.trabajo += diffMin;
                totalMinutesWork += diffMin;

                // --- Calculate Smart Cost & Extras ---
                const buckets = classifyShiftMinutes(start, end, {
                    nightShiftStartTime: company?.night_shift_start_time || '21:00',
                    daySchedule: profileSched,
                    scheduleMode,
                    openNoOvertime: profile.open_no_overtime,
                    openMaxOrdinaryMinutes: profile.open_max_ordinary_minutes,
                    firstInTime
                });

                const baseRate = isSunday ? (profile.hourly_rate_sunday_holiday || profile.hourly_rate_base || 0) : (profile.hourly_rate_base || 0);

                const cost = (buckets.ordinary * baseRate / 60) +
                             (buckets.extraDay * (profile.hourly_rate_extra_day || baseRate || 0) / 60) +
                             (buckets.extraNight * (profile.hourly_rate_extra_night || baseRate || 0) / 60);

                estimatedCost += cost;
                userSummaries[profileId].totalCost += cost;

                if (isSunday) {
                    userSummaries[profileId].extraSunday += diffMin;
                } else {
                    userSummaries[profileId].extraDay += buckets.extraDay;
                    userSummaries[profileId].extraNight += buckets.extraNight;
                }
            }
        });

        // Add Multi-hour Overtime alerts
        Object.values(userSummaries).forEach((sum: any) => {
            const totalExtraMins = sum.extraDay + sum.extraNight + sum.extraSunday;
            if (totalExtraMins > 600) { // More than 10 hours of extra work in period
                alertEntries.push({
                    name: sum.name,
                    type: 'Alerta Horas Extras',
                    desc: `${Math.round(totalExtraMins / 60)}h extras en el periodo`,
                    time: '--:--',
                    severity: 'warning'
                });
            }
        });

        return {
            totalEmployees: profiles.length,
            activeToday: activeNow.size,
            onBreakToday: onBreakNow.size,
            latesToday: totalLatesPeriod,
            estimatedCost: Math.round(estimatedCost),
            totalHoursPeriod: Math.floor(totalMinutesWork / 60),
            totalMinutesPeriod: totalMinutesWork,
            breakdown: globalBreakdown,
            alerts: alertEntries,
            userSummaries
        };
    }, [entries, profiles, company, dateRange, selectedProfileId, leaveRequests]);

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
        const matchesSearch = e.InA_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const date = e.date || e.created_at?.split('T')[0];
        const matchesDate = date && date >= dateRange.start && date <= dateRange.end;
        const matchesProfile = selectedProfileId === 'all' || e.profile_id === selectedProfileId;
        return matchesSearch && matchesDate && matchesProfile;
    });

    const exportToICG = () => {
        const rows: any[] = [['CodEmpleado', 'Fecha', 'Concepto', 'Unidades', 'Descripcion']];

        // Misma agrupación por turno (no por fecha de cada evento suelto)
        // que el useMemo principal, para no perder turnos que cruzan medianoche.
        const shiftGroupsForExport = groupEntriesIntoShifts(entries)
            .filter(g => g.dateKey >= dateRange.start && g.dateKey <= dateRange.end);

        shiftGroupsForExport.forEach(group => {
            let dOrd = 0, dExtD = 0, dExtN = 0, dDom = 0;
            const { profileId, dateKey: dateStr, entries: sorted } = group;
            const profile = profiles.find(p => p.id === profileId);
            if (!profile) return;

            const dateObj = new Date(dateStr + 'T12:00:00');
            const dayCode = dayMap[dateObj.getDay()];
            const scheduleMode = profile.schedule_mode || 'branch';
            const profileSched = scheduleMode === 'custom' ? (profile.work_schedule?.[dayCode]) : (company?.work_schedule?.[dayCode]);
            const isSunday = dateObj.getDay() === 0;
            const firstInTime = scheduleMode === 'open' ? getFirstInTime(sorted) : null;

            sorted.forEach((e: any, idx: number) => {
                if (e.event_type !== 'in') return;
                const start = new Date(e.clock_in || e.created_at!);
                const next = sorted[idx + 1];
                const end = next ? new Date(next.clock_in || next.created_at!) : (dateStr === new Date().toLocaleDateString('en-CA') ? new Date() : start);
                const diff = (end.getTime() - start.getTime()) / 60000;

                if (isSunday) {
                    dDom += diff;
                } else {
                    const buckets = classifyShiftMinutes(start, end, {
                        nightShiftStartTime: company?.night_shift_start_time || '21:00',
                        daySchedule: profileSched,
                        scheduleMode,
                        openNoOvertime: profile.open_no_overtime,
                        openMaxOrdinaryMinutes: profile.open_max_ordinary_minutes,
                        firstInTime
                    });
                    dOrd += buckets.ordinary;
                    dExtD += buckets.extraDay;
                    dExtN += buckets.extraNight;
                }
            });

            if (dOrd > 0) rows.push([profile.national_id, dateStr, '1', (dOrd / 60).toFixed(2), 'HE Ordinarias']);
            if (dExtD > 0) rows.push([profile.national_id, dateStr, '2', (dExtD / 60).toFixed(2), 'HE Diurnas']);
            if (dExtN > 0) rows.push([profile.national_id, dateStr, '3', (dExtN / 60).toFixed(2), 'HE Nocturnas']);
            if (dDom > 0) rows.push([profile.national_id, dateStr, '4', (dDom / 60).toFixed(2), 'Recargo Dominical']);
        });

        const csvContent = rows.map(r => r.map((cell: any) => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `ICG_Import_${dateRange.start}_a_${dateRange.end}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToExcel = () => {
        // 1. Logs Sheet
        const logHeaders = ['Fecha', 'Colaborador', 'ID', 'Evento', 'Hora', 'Metodo', 'Evidencia', 'Biometria', 'Confianza'];
        const logRows = filteredEntries.map(e => [
            e.date || e.created_at?.split('T')[0],
            e.InA_profiles?.full_name || 'N/A',
            e.InA_profiles?.national_id || 'N/A',
            e.metadata?.event_label || e.event_type,
            e.created_at ? new Date(e.created_at).toLocaleTimeString() : 'N/A',
            e.metadata?.method || 'N/A',
            e.metadata?.photo_evidence ? 'CON FOTO' : 'SIN FOTO',
            e.metadata?.biometric_match === true ? 'OK' : e.metadata?.biometric_match === false ? 'FALLO' : 'N/A',
            e.metadata?.biometric_confidence ? `${e.metadata.biometric_confidence}%` : 'N/A'
        ]);

        // 2. Summary Sheet
        const summaryHeaders = ['Colaborador', 'ID', 'Min. Trabajo', 'Desayuno (min)', 'Almuerzo (min)', 'P. Activa (min)', 'Otros/Pausas (min)', 'HE Diurna', 'HE Nocturna', 'Extra Dominical', 'Tardanzas (veces)', 'Ausencias No Justificadas', 'Coste Proyectado'];
        const summaryRows = Object.values(stats.userSummaries).map((s: any) => [
            s.name, s.national_id, Math.round(s.minutesWork), Math.round(s.breakfast), Math.round(s.lunch), Math.round(s.activePause), Math.round(s.others),
            Math.round(s.extraDay), Math.round(s.extraNight), Math.round(s.extraSunday), s.lates, s.unjustifiedAbsences, Math.round(s.totalCost)
        ]);

        // 3. Alerts Sheet
        const alertHeaders = ['Colaborador', 'Tipo Alerta', 'Fecha/Hora', 'Descripcion'];
        const alertRows = stats.alerts.map((a: any) => [a.name, a.type, a.time, a.desc]);

        // 4. Novedades Sheet (InA_leave_requests reales del periodo, no las alertas del sistema)
        const leaveHeaders = ['Colaborador', 'Tipo', 'Fecha Inicio', 'Fecha Fin', 'Estado', 'Notas'];
        const leaveRows = leaveRequestsInRange.map((l: any) => [
            l.InA_profiles?.full_name || 'N/A',
            LEAVE_TYPE_LABELS[l.type] || l.type,
            l.start_date,
            l.end_date,
            l.status === 'pending' ? 'Pendiente' : l.status === 'approved' ? 'Aprobada' : 'Rechazada',
            l.notes || ''
        ]);

        const wb = XLSX.utils.book_new();
        
        const ws_summary = XLSX.utils.aoa_to_sheet([['RESUMEN DE ASISTENCIA Y NOMINA'], [`Periodo: ${dateRange.start} a ${dateRange.end}`], [], summaryHeaders, ...summaryRows]);
        XLSX.utils.book_append_sheet(wb, ws_summary, "Resumen General");

        const ws_logs = XLSX.utils.aoa_to_sheet([['LOGS DETALLADOS'], [], logHeaders, ...logRows]);
        XLSX.utils.book_append_sheet(wb, ws_logs, "Logs de Eventos");

        const ws_alerts = XLSX.utils.aoa_to_sheet([['ALERTAS DEL SISTEMA'], [], alertHeaders, ...alertRows]);
        XLSX.utils.book_append_sheet(wb, ws_alerts, "Alertas");

        const ws_leaves = XLSX.utils.aoa_to_sheet([['NOVEDADES DEL PERIODO'], [`Periodo: ${dateRange.start} a ${dateRange.end}`], [], leaveHeaders, ...leaveRows]);
        XLSX.utils.book_append_sheet(wb, ws_leaves, "Novedades");

        XLSX.writeFile(wb, `asiste360_reporte_completo_${dateRange.start}_a_${dateRange.end}.xlsx`);
    };

    const exportToCSV = exportToExcel; // Alias for compatibility

    const handleClearRecords = async () => {
        if (!companyId) return;
        const confirmFirst = window.confirm(`¿Estás SEGURO de eliminar definitivamente los registros del periodo ${dateRange.start} al ${dateRange.end}? Esta acción no se puede deshacer.`);
        if (!confirmFirst) return;

        const confirmSecond = window.confirm("¡ATENCIÓN CRÍTICA! Estás a punto de borrar datos históricos de forma permanente. Asegúrate de haber descargado el reporte de Excel antes de continuar. ¿Deseas proceder con la eliminación?");
        if (!confirmSecond) return;

        try {
            setLoading(true);
            const { error: deleteError } = await supabase
                .from('InA_time_entries')
                .delete()
                .eq('company_id', companyId)
                .gte('date', dateRange.start)
                .lte('date', dateRange.end);

            if (deleteError) throw deleteError;

            showToast('Registros depurados correctamente.', 'success');

            // Refresh data
            const { data: entryData } = await supabase
                .from('InA_time_entries')
                .select('*, InA_profiles(*)')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            setEntries(entryData || []);
        } catch (err: any) {
            showToast('Error al limpiar registros: ' + err.message, 'error');
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
                    <h2 className="text-3xl font-black text-primary tracking-tighter uppercase italic">Panel de Control Analítico v2.0</h2>
                    <p className="text-muted-foreground text-sm font-medium">Bienvenido de nuevo. Aquí tienes el resumen de hoy.</p>
                </div>
                <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="flex bg-muted/30 p-1 rounded-xl border">
                        <button
                            onClick={() => setViewTab('analytics')}
                            className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewTab === 'analytics' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-white/50'}`}
                        >
                            Métricas
                        </button>
                        <button
                            onClick={() => setViewTab('reports')}
                            className={`px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${viewTab === 'reports' ? 'bg-primary text-white shadow-md' : 'text-muted-foreground hover:bg-white/50'}`}
                        >
                            Reportes
                        </button>
                    </div>

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

            {viewTab === 'analytics' ? (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Total Empleados"
                            value={`${profiles.length}`}
                            subValue="En esta sede"
                            icon={<Users className="w-6 h-6 text-primary" />}
                            trend="up"
                        />
                        <StatCard
                            title="En Turno"
                            value={`${stats.activeToday}`}
                            subValue="Laborando ahora"
                            icon={<Clock className="w-6 h-6 text-green-500" />}
                            trend="up"
                        />
                        <StatCard
                            title="Coste Estimado"
                            value={`$${stats.estimatedCost.toLocaleString()}`}
                            subValue="Nómina proyectada"
                            icon={<TrendingUp className="w-6 h-6 text-green-500" />}
                            trend="up"
                        />
                        <StatCard
                            title="Horas Periodo"
                            value={`${stats.totalHoursPeriod}h`}
                            subValue="Total trabajadas"
                            icon={<FileDown className="w-6 h-6 text-blue-500" />}
                            trend="up"
                        />
                    </div>

                    {/* Charts & Alerts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-card border rounded-[2rem] p-8 shadow-sm space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black uppercase tracking-tight">Actividad en el Periodo</h3>
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
                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                                        <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                                        <Area type="monotone" dataKey="actividad" stroke="#8884d8" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-card border rounded-[2rem] p-8 shadow-sm flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-black uppercase tracking-tight">Alertas Recientes</h3>
                                <div className="text-[10px] font-black bg-red-100 text-red-700 px-3 py-1 rounded-full uppercase">Hoy</div>
                            </div>

                            <div className="space-y-4 flex-1">
                                {stats.alerts.filter(a => a.time !== '--:--' || a.type.includes('Llegada')).length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-30 grayscale">
                                        <CheckCircle className="w-12 h-12 mb-2" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">Sin alertas</p>
                                    </div>
                                ) : stats.alerts.slice(0, 5).map((alert: any, i: number) => (
                                    <div key={i} className={`p-4 rounded-2xl border-l-4 flex items-center justify-between transition-all hover:translate-x-1 ${alert.severity === 'error' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-500'}`}>
                                        <div>
                                            <p className="text-[11px] font-black uppercase leading-tight">{alert.name}</p>
                                            <p className={`text-[10px] font-black mt-1 ${alert.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`}>{alert.desc}</p>
                                        </div>
                                        <div className="text-right"><p className="text-[10px] font-black text-muted-foreground">{alert.time}</p></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Ausencias de Hoy — informativo, no es una alerta */}
                    {todayAbsences.length > 0 && (
                        <div className="bg-blue-50 border-2 border-blue-100 rounded-[2rem] p-8 space-y-4">
                            <div className="flex items-center gap-2 text-blue-800">
                                <CalendarOff className="w-5 h-5" />
                                <h3 className="font-black uppercase text-sm tracking-widest">
                                    {todayAbsences.length} Colaborador{todayAbsences.length > 1 ? 'es' : ''} con Ausencia Justificada Hoy
                                </h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {todayAbsences.map((leave: any) => (
                                    <div key={leave.id} className="bg-white rounded-2xl p-4 border border-blue-100">
                                        <p className="font-black text-sm text-foreground">{leave.InA_profiles?.full_name || 'N/A'}</p>
                                        <p className="text-[10px] font-black uppercase text-blue-700 mt-1">{LEAVE_TYPE_LABELS[leave.type] || leave.type}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold mt-1">Hasta {leave.end_date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Table Section */}
                    <div className="bg-card border rounded-[2rem] shadow-sm overflow-hidden">
                        <div className="p-8 border-b flex flex-col sm:flex-row items-center justify-between gap-4">
                            <h3 className="text-xl font-black uppercase italic tracking-tighter">Registros de Tiempo</h3>
                            <div className="flex items-center gap-2">
                                <SearchInput value={searchTerm} onChange={setSearchTerm} />
                                <button onClick={handleClearRecords} className="flex items-center gap-2 px-6 py-2 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-black shadow-sm hover:bg-red-100 transition-all active:scale-95">
                                    <Trash2 className="w-4 h-4" /> LIMPIAR
                                </button>
                                <button onClick={exportToCSV} className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black shadow-sm hover:opacity-90 transition-all active:scale-95">
                                    <FileDown className="w-4 h-4" /> EXPORTAR
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-5">Colaborador</th>
                                        <th className="px-8 py-5">Tipo</th>
                                        <th className="px-8 py-5">Fecha y Hora</th>
                                        <th className="px-8 py-5">Detalles</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-sm">
                                    {loading ? (
                                        <tr><td colSpan={5} className="px-8 py-16 text-center text-muted-foreground animate-pulse text-xs font-black uppercase tracking-widest">Cargando...</td></tr>
                                    ) : filteredEntries.slice(0, 50).map((entry: any) => (
                                        <tr key={entry.id} className="hover:bg-muted/30 transition-all group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-[10px] text-primary">
                                                        {entry.InA_profiles?.full_name?.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xs">{entry.InA_profiles?.full_name}</p>
                                                        <p className="text-[9px] text-muted-foreground font-black uppercase">{entry.InA_profiles?.national_id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">{getEventBadge(entry.event_type, entry.metadata)}</td>
                                            <td className="px-8 py-5 text-xs font-medium text-muted-foreground">
                                                {new Date(entry.created_at!).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-8 py-5 text-[10px] font-bold text-muted-foreground italic">
                                                {entry.metadata?.method || 'pin-mode'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4 border-b pb-6">
                        <button onClick={() => setReportType('employees')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportType === 'employees' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}>1. Condiciones</button>
                        <button onClick={() => setReportType('hours')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportType === 'hours' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}>2. Horas Detalladas</button>
                        <button onClick={() => setReportType('alerts')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportType === 'alerts' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}>3. Alertas del Sistema</button>
                        <button onClick={() => setReportType('leaves')} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${reportType === 'leaves' ? 'bg-primary/10 text-primary border border-primary/20' : 'text-muted-foreground'}`}>4. Novedades</button>
                        <div className="ml-auto">
                            <button onClick={exportToICG} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-blue-700 transition-all active:scale-95 mr-2">
                                <FileDown className="w-4 h-4" /> EXPORTAR ICG
                            </button>
                            <button onClick={exportToExcel} className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-black shadow-lg hover:bg-green-700 transition-all active:scale-95">
                                <FileDown className="w-4 h-4" /> DESCARGAR EXCEL COMPLETO
                            </button>
                        </div>
                    </div>

                    <div className="bg-card border rounded-[2rem] shadow-sm overflow-hidden">
                        {reportType === 'employees' ? (
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-5">Empleado</th>
                                        <th className="px-8 py-5">Tasa Base</th>
                                        <th className="px-8 py-5">Extra Dia</th>
                                        <th className="px-8 py-5">Nocturna</th>
                                        <th className="px-8 py-5">Dominical</th>
                                        <th className="px-8 py-5">Horario</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs font-bold">
                                    {profiles.map(p => (
                                        <tr key={p.id} className="hover:bg-muted/30 transition-all">
                                            <td className="px-8 py-5">
                                                <p className="font-black text-sm">{p.full_name}</p>
                                                <p className="text-[9px] text-muted-foreground uppercase">{p.national_id}</p>
                                            </td>
                                            <td className="px-8 py-5 text-primary">${p.hourly_rate_base?.toLocaleString()}</td>
                                            <td className="px-8 py-5">${p.hourly_rate_extra_day?.toLocaleString()}</td>
                                            <td className="px-8 py-5">${p.hourly_rate_extra_night?.toLocaleString()}</td>
                                            <td className="px-8 py-5 text-orange-600">${p.hourly_rate_sunday_holiday?.toLocaleString()}</td>
                                            <td className="px-8 py-5 text-[9px] text-muted-foreground">{p.schedule_mode === 'custom' ? 'PERSONALIZADO' : p.schedule_mode === 'open' ? 'ABIERTO' : 'GLOBAL SEDE'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : reportType === 'hours' ? (
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-5">Colaborador</th>
                                        <th className="px-8 py-5 text-center">Tardanzas</th>
                                        <th className="px-8 py-5 text-center">Pausas (min)</th>
                                        <th className="px-8 py-5 text-center">Extras (min)</th>
                                        <th className="px-8 py-5 text-center">Total Horas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs font-bold">
                                    {profiles.map(p => {
                                        const summary = stats.userSummaries[p.id] || { minutesWork: 0, lates: 0, breakfast: 0, lunch: 0, activePause: 0, extraDay: 0, extraNight: 0, extraSunday: 0 };
                                        const totalExtras = summary.extraDay + summary.extraNight + summary.extraSunday;
                                        const totalPauses = summary.breakfast + summary.lunch + summary.activePause;
                                        
                                        return (
                                            <tr key={p.id} className="hover:bg-muted/30 transition-all">
                                                <td className="px-8 py-5">
                                                    <p className="font-black text-sm">{p.full_name}</p>
                                                    <p className="text-[9px] text-muted-foreground uppercase">{p.national_id}</p>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full ${summary.lates > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                        {summary.lates}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-5 text-center text-slate-600">
                                                    {Math.round(totalPauses)}m
                                                    <div className="text-[8px] text-muted-foreground uppercase mt-0.5">
                                                        D:{Math.round(summary.breakfast)} | A:{Math.round(summary.lunch)} | P:{Math.round(summary.activePause)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center text-orange-600">
                                                    {Math.round(totalExtras)}m
                                                    <div className="text-[8px] text-muted-foreground uppercase mt-0.5">
                                                        D:{Math.round(summary.extraDay)} | N:{Math.round(summary.extraNight)} | S:{Math.round(summary.extraSunday)}
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center text-primary text-sm font-black">
                                                    {Math.floor(summary.minutesWork / 60)}h {Math.round(summary.minutesWork % 60)}m
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : reportType === 'alerts' ? (
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-5">Colaborador</th>
                                        <th className="px-8 py-5">Tipo de Alerta</th>
                                        <th className="px-8 py-5">Hora</th>
                                        <th className="px-8 py-5">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs font-bold">
                                    {stats.alerts.length === 0 ? (
                                        <tr><td colSpan={4} className="px-8 py-16 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-30 italic">Sin alertas en el periodo</td></tr>
                                    ) : stats.alerts.map((a: any, i: number) => (
                                        <tr key={i} className="hover:bg-muted/30 transition-all">
                                            <td className="px-8 py-5">{a.name}</td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] ${a.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{a.type}</span>
                                            </td>
                                            <td className="px-8 py-5">{a.time}</td>
                                            <td className="px-8 py-5 text-muted-foreground font-black italic">{a.desc}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em]">
                                    <tr>
                                        <th className="px-8 py-5">Colaborador</th>
                                        <th className="px-8 py-5">Tipo</th>
                                        <th className="px-8 py-5">Periodo</th>
                                        <th className="px-8 py-5">Estado</th>
                                        <th className="px-8 py-5">Notas</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y text-xs font-bold">
                                    {leaveRequestsInRange.length === 0 ? (
                                        <tr><td colSpan={5} className="px-8 py-16 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-30 italic">Sin novedades en el periodo seleccionado</td></tr>
                                    ) : leaveRequestsInRange.map((l: any) => (
                                        <tr key={l.id} className="hover:bg-muted/30 transition-all">
                                            <td className="px-8 py-5">{l.InA_profiles?.full_name || 'N/A'}</td>
                                            <td className="px-8 py-5">{LEAVE_TYPE_LABELS[l.type] || l.type}</td>
                                            <td className="px-8 py-5 text-muted-foreground">{l.start_date} → {l.end_date}</td>
                                            <td className="px-8 py-5">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase ${l.status === 'pending' ? 'bg-amber-100 text-amber-700' : l.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {l.status === 'pending' ? 'Pendiente' : l.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                                </span>
                                            </td>
                                            <td className="px-8 py-5 text-muted-foreground font-black italic">{l.notes || '---'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// UI Components
const SearchInput = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
            type="text"
            placeholder="Buscar colaborador..."
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-muted/20 border-none rounded-xl text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
        />
    </div>
);

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

