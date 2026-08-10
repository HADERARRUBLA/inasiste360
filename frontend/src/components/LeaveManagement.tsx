import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaveRequest, LeaveType } from '../types';
import { CalendarOff, Plus, X, Save, Trash2, Search, CheckCircle2, XCircle, AlertCircle, Pencil, History } from 'lucide-react';
import { showToast } from '../lib/toastStore';

interface LeaveManagementProps {
    companyId: string | null;
    currentProfileId: string | null;
    onPendingCountChange?: (count: number) => void;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
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

const daysBetween = (start: string, end: string) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
};

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ companyId, currentProfileId, onPendingCountChange }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reviewing, setReviewing] = useState<{ request: any, action: 'approved' | 'rejected' } | null>(null);
    const [decisionNotes, setDecisionNotes] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [historyFor, setHistoryFor] = useState<any | null>(null);
    const [historyEntries, setHistoryEntries] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const [formData, setFormData] = useState({
        profile_id: '',
        type: 'vacaciones' as LeaveType,
        start_date: '',
        end_date: '',
        notes: ''
    });

    useEffect(() => {
        fetchData();
    }, [companyId]);

    const fetchData = async () => {
        if (!companyId) { setLoading(false); onPendingCountChange?.(0); return; }
        setLoading(true);
        try {
            // Las 3 consultas son independientes entre sí (la de novedades no
            // depende de la lista de empleados, se filtra después en memoria)
            // — lanzarlas en paralelo evita sumar la latencia de cada una.
            const [
                { data: primaryEmps, error: empError },   // empleados con esta sede como principal...
                { data: visitingEmps, error: visitingError }, // ...+ autorizados aquí como sede adicional (multi-sede)
                { data: reqs, error: reqError }
            ] = await Promise.all([
                supabase.from('InA_profiles').select('id, full_name, national_id').eq('company_id', companyId).eq('role', 'employee').order('full_name'),
                supabase.from('InA_profiles').select('id, full_name, national_id, assigned_branches:InA_employee_branches!inner(branch_id)').eq('role', 'employee').eq('assigned_branches.branch_id', companyId),
                supabase.from('InA_leave_requests').select('*, InA_profiles!profile_id(id, full_name, national_id, company_id)').order('start_date', { ascending: false })
            ]);
            if (empError) throw empError;
            if (visitingError) throw visitingError;
            if (reqError) throw reqError;

            const mergedEmps = [...(primaryEmps || [])];
            (visitingEmps || []).forEach((v: any) => {
                if (!mergedEmps.find(e => e.id === v.id)) mergedEmps.push(v);
            });
            mergedEmps.sort((a, b) => a.full_name.localeCompare(b.full_name));
            setEmployees(mergedEmps);
            // Novedades de empleados con esta sede como principal O de visita
            // (mismo criterio que el picker de arriba, para que una novedad
            // recién creada para un empleado "de visita" no desaparezca).
            const scopedEmployeeIds = new Set(mergedEmps.map(e => e.id));
            const scoped = (reqs || []).filter((r: any) => scopedEmployeeIds.has(r.profile_id));
            setRequests(scoped);
            onPendingCountChange?.(scoped.filter((r: any) => r.status === 'pending').length);
        } catch (err: any) {
            console.error('Error cargando novedades:', err);
            showToast('Error cargando novedades: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const filteredRequests = requests.filter((r: any) =>
        r.InA_profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.InA_profiles?.national_id?.includes(searchTerm)
    );

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.profile_id || !formData.start_date || !formData.end_date) {
            showToast('Completa empleado y fechas antes de guardar.', 'error');
            return;
        }
        if (formData.end_date < formData.start_date) {
            showToast('La fecha final no puede ser anterior a la fecha de inicio.', 'error');
            return;
        }
        try {
            if (editingId) {
                // El UPDATE dispara el trigger de auditoría en el servidor —
                // queda registro de qué cambió, sin importar este código.
                const { error } = await supabase
                    .from('InA_leave_requests')
                    .update({
                        profile_id: formData.profile_id,
                        type: formData.type,
                        start_date: formData.start_date,
                        end_date: formData.end_date,
                        notes: formData.notes || null
                    })
                    .eq('id', editingId);
                if (error) throw error;
                showToast('Novedad actualizada. El cambio queda en el historial.', 'success');
            } else {
                const { error } = await supabase.from('InA_leave_requests').insert([{
                    profile_id: formData.profile_id,
                    type: formData.type,
                    start_date: formData.start_date,
                    end_date: formData.end_date,
                    status: 'approved',
                    notes: formData.notes || null,
                    requested_by: currentProfileId,
                    approved_by: currentProfileId
                }]);
                if (error) throw error;
                showToast('Novedad registrada con éxito.', 'success');
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({ profile_id: '', type: 'vacaciones', start_date: '', end_date: '', notes: '' });
            fetchData();
        } catch (err: any) {
            console.error('Error al guardar novedad:', err);
            showToast('Error al guardar: ' + err.message, 'error');
        }
    };

    const handleEdit = (req: any) => {
        setFormData({
            profile_id: req.profile_id,
            type: req.type,
            start_date: req.start_date,
            end_date: req.end_date,
            notes: req.notes || ''
        });
        setEditingId(req.id);
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const openHistory = async (req: any) => {
        setHistoryFor(req);
        setHistoryLoading(true);
        try {
            const { data, error } = await supabase
                .from('InA_leave_request_audit')
                .select('*, InA_profiles!changed_by(full_name)')
                .eq('leave_request_id', req.id)
                .order('changed_at', { ascending: false });
            if (error) throw error;
            setHistoryEntries(data || []);
        } catch (err: any) {
            showToast('Error cargando el historial: ' + err.message, 'error');
        } finally {
            setHistoryLoading(false);
        }
    };

    const AUDIT_FIELD_LABELS: Record<string, string> = {
        type: 'Tipo',
        start_date: 'Fecha de inicio',
        end_date: 'Fecha de fin',
        status: 'Estado',
        notes: 'Notas',
        decision_notes: 'Observación de decisión',
        profile_id: 'Colaborador'
    };

    const describeChanges = (entry: any) => {
        if (entry.action === 'delete') return ['Novedad eliminada.'];
        const before = entry.old_data || {};
        const after = entry.new_data || {};
        const changed = Object.keys(AUDIT_FIELD_LABELS).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
        if (changed.length === 0) return ['Sin cambios en los campos visibles.'];
        return changed.map(k => `${AUDIT_FIELD_LABELS[k]}: "${before[k] ?? '—'}" → "${after[k] ?? '—'}"`);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta novedad? Esta acción no se puede deshacer.')) return;
        const { error } = await supabase.from('InA_leave_requests').delete().eq('id', id);
        if (error) {
            showToast('Error al eliminar: ' + error.message, 'error');
            return;
        }
        fetchData();
    };

    const openReview = (request: any, action: 'approved' | 'rejected') => {
        setReviewing({ request, action });
        setDecisionNotes('');
    };

    const submitDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewing) return;
        if (reviewing.action === 'rejected' && !decisionNotes.trim()) {
            showToast('Escribe el motivo del rechazo.', 'error');
            return;
        }
        const { error } = await supabase
            .from('InA_leave_requests')
            .update({
                status: reviewing.action,
                approved_by: currentProfileId,
                decision_notes: decisionNotes.trim() || null
            })
            .eq('id', reviewing.request.id);
        if (error) {
            showToast('Error al guardar la decisión: ' + error.message, 'error');
            return;
        }
        showToast(reviewing.action === 'approved' ? 'Novedad aprobada.' : 'Novedad rechazada.', 'success');
        setReviewing(null);
        setDecisionNotes('');
        fetchData();
    };

    const pendingRequests = requests.filter((r: any) => r.status === 'pending');

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Novedades y Ausencias</h2>
                    <p className="text-muted-foreground font-bold text-sm">Vacaciones, incapacidades, permisos y licencias.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-64 pl-11 pr-4 py-2.5 bg-muted/30 border border-transparent focus:bg-background focus:border-primary/20 focus:ring-4 focus:ring-primary/10 rounded-xl text-xs font-bold transition-all placeholder:font-black placeholder:uppercase placeholder:tracking-widest"
                            placeholder="Buscar por nombre, ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <button
                        onClick={() => {
                            if (isAdding) {
                                setIsAdding(false);
                                setEditingId(null);
                                setFormData({ profile_id: '', type: 'vacaciones', start_date: '', end_date: '', notes: '' });
                            } else {
                                setIsAdding(true);
                            }
                        }}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                    >
                        {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isAdding ? 'Cancelar' : 'Registrar Novedad'}
                    </button>
                </div>
            </div>

            {pendingRequests.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2 text-amber-800">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="font-black uppercase text-sm tracking-widest">{pendingRequests.length} Solicitud{pendingRequests.length > 1 ? 'es' : ''} Pendiente{pendingRequests.length > 1 ? 's' : ''} de Aprobación</h3>
                    </div>
                    <div className="space-y-3">
                        {pendingRequests.map((req: any) => (
                            <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-amber-100">
                                <div>
                                    <p className="font-black text-foreground text-sm">{req.InA_profiles?.full_name || 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground font-bold">
                                        {LEAVE_TYPE_LABELS[req.type as LeaveType] || req.type} · {req.start_date} → {req.end_date} ({daysBetween(req.start_date, req.end_date)} días)
                                    </p>
                                    {req.notes && <p className="text-xs text-muted-foreground italic mt-1">"{req.notes}"</p>}
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => openReview(req, 'approved')}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-green-700 transition-all active:scale-95"
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Aprobar
                                    </button>
                                    <button
                                        onClick={() => openReview(req, 'rejected')}
                                        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-amber-300 text-amber-700 rounded-xl font-black text-[10px] uppercase hover:bg-amber-100 transition-all active:scale-95"
                                    >
                                        <XCircle className="w-4 h-4" /> Rechazar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {reviewing && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                    <div className="bg-card w-full max-w-md rounded-[2rem] border shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-300">
                        <div className={`p-6 border-b ${reviewing.action === 'approved' ? 'bg-green-50' : 'bg-amber-50'}`}>
                            <h3 className="text-lg font-black uppercase italic">
                                {reviewing.action === 'approved' ? 'Aprobar Novedad' : 'Rechazar Novedad'}
                            </h3>
                            <p className="text-xs text-muted-foreground font-bold mt-1">
                                {reviewing.request.InA_profiles?.full_name} · {LEAVE_TYPE_LABELS[reviewing.request.type as LeaveType]} · {reviewing.request.start_date} → {reviewing.request.end_date}
                            </p>
                        </div>
                        <form onSubmit={submitDecision} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">
                                    Observación {reviewing.action === 'rejected' ? '(obligatoria)' : '(opcional)'}
                                </label>
                                <textarea
                                    required={reviewing.action === 'rejected'}
                                    autoFocus
                                    value={decisionNotes}
                                    onChange={e => setDecisionNotes(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 border-2 rounded-2xl bg-background outline-none focus:border-primary font-bold text-sm resize-none"
                                    placeholder={reviewing.action === 'approved' ? 'Ej: Coordinado con el equipo para cubrir el turno.' : 'Ej: No hay personal disponible para cubrir esas fechas.'}
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setReviewing(null)}
                                    className="flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted transition-colors border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={`flex-1 px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all active:scale-95 ${reviewing.action === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}`}
                                >
                                    Confirmar {reviewing.action === 'approved' ? 'Aprobación' : 'Rechazo'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAdding && (
                <div className="bg-card border rounded-[2rem] p-8 shadow-xl animate-in fade-in slide-in-from-top-6 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                    {editingId && (
                        <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-4">Editando novedad existente — el cambio queda registrado en el historial</p>
                    )}
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Colaborador</label>
                            <select
                                required
                                value={formData.profile_id}
                                onChange={e => setFormData({ ...formData, profile_id: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                            >
                                <option value="">Seleccionar colaborador...</option>
                                {employees.map((emp: any) => (
                                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.national_id})</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Tipo de Novedad</label>
                            <select
                                required
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value as LeaveType })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                            >
                                {Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Fecha de Inicio</label>
                            <input
                                required
                                type="date"
                                value={formData.start_date}
                                onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Fecha de Fin</label>
                            <input
                                required
                                type="date"
                                value={formData.end_date}
                                onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                            />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Notas (opcional)</label>
                            <textarea
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                rows={3}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold resize-none"
                                placeholder="Detalle adicional de la novedad..."
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                <Save className="w-5 h-5" /> {editingId ? 'GUARDAR CAMBIOS' : 'REGISTRAR NOVEDAD'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-card border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-700">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-6">Colaborador</th>
                            <th className="px-8 py-6">Tipo</th>
                            <th className="px-8 py-6">Periodo</th>
                            <th className="px-8 py-6 text-center">Días</th>
                            <th className="px-8 py-6">Estado</th>
                            <th className="px-8 py-6">Notas</th>
                            <th className="px-8 py-6 text-right">Gestión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                        {loading ? (
                            <tr><td colSpan={7} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 animate-pulse">
                                    <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    <p className="font-black text-xs uppercase tracking-widest text-muted-foreground">Sincronizando Novedades...</p>
                                </div>
                            </td></tr>
                        ) : filteredRequests.length === 0 ? (
                            <tr><td colSpan={7} className="px-8 py-20 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-20 italic">
                                {searchTerm ? `No se encontró: "${searchTerm}"` : 'Sin novedades registradas para esta sede.'}
                            </td></tr>
                        ) : filteredRequests.map((req: any) => (
                            <tr key={req.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-8 py-6">
                                    <p className="font-black text-foreground text-base tracking-tight leading-tight">{req.InA_profiles?.full_name || 'N/A'}</p>
                                    <p className="text-xs text-muted-foreground font-bold font-mono">{req.InA_profiles?.national_id || '---'}</p>
                                </td>
                                <td className="px-8 py-6">
                                    <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase">
                                        <CalendarOff className="w-3.5 h-3.5" /> {LEAVE_TYPE_LABELS[req.type as LeaveType] || req.type}
                                    </span>
                                </td>
                                <td className="px-8 py-6 font-bold text-muted-foreground">
                                    {req.start_date} → {req.end_date}
                                </td>
                                <td className="px-8 py-6 text-center font-black">{daysBetween(req.start_date, req.end_date)}</td>
                                <td className="px-8 py-6">
                                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                                        req.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                        req.status === 'approved' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {req.status === 'pending' ? 'Pendiente' : req.status === 'approved' ? 'Aprobada' : 'Rechazada'}
                                    </span>
                                </td>
                                <td className="px-8 py-6 text-xs text-muted-foreground max-w-xs">
                                    <p className="truncate">{req.notes || '---'}</p>
                                    {req.decision_notes && (
                                        <p className="truncate italic text-[11px] mt-1 opacity-70">↳ {req.decision_notes}</p>
                                    )}
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        {req.status === 'pending' && (
                                            <>
                                                <button
                                                    onClick={() => openReview(req, 'approved')}
                                                    className="p-3 bg-green-50 border border-green-100 shadow-sm rounded-2xl text-green-600 hover:bg-green-600 hover:text-white transition-all hover:scale-110 active:scale-90"
                                                    title="Aprobar"
                                                >
                                                    <CheckCircle2 className="w-4.5 h-4.5" />
                                                </button>
                                                <button
                                                    onClick={() => openReview(req, 'rejected')}
                                                    className="p-3 bg-amber-50 border border-amber-100 shadow-sm rounded-2xl text-amber-600 hover:bg-amber-600 hover:text-white transition-all hover:scale-110 active:scale-90"
                                                    title="Rechazar"
                                                >
                                                    <XCircle className="w-4.5 h-4.5" />
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => openHistory(req)}
                                            className="p-3 bg-white/80 backdrop-blur-sm border shadow-sm rounded-2xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all hover:scale-110 active:scale-90"
                                            title="Ver historial"
                                        >
                                            <History className="w-4.5 h-4.5" />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(req)}
                                            className="p-3 bg-white/80 backdrop-blur-sm border shadow-sm rounded-2xl text-primary hover:bg-primary hover:text-white transition-all hover:scale-110 active:scale-90"
                                            title="Editar"
                                        >
                                            <Pencil className="w-4.5 h-4.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(req.id)}
                                            className="p-3 bg-red-50 border border-red-100 shadow-sm rounded-2xl text-destructive hover:bg-destructive hover:text-white transition-all hover:scale-110 active:scale-90"
                                            title="Eliminar"
                                        >
                                            <Trash2 className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
            </div>

            {historyFor && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                    <div className="bg-card w-full max-w-lg rounded-[2rem] border shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-300 max-h-[85vh] flex flex-col">
                        <div className="p-6 border-b bg-muted/20 flex items-center justify-between shrink-0">
                            <div>
                                <h3 className="text-lg font-black uppercase italic">Historial de la Novedad</h3>
                                <p className="text-xs text-muted-foreground font-bold mt-1">
                                    {historyFor.InA_profiles?.full_name} · {LEAVE_TYPE_LABELS[historyFor.type as LeaveType]}
                                </p>
                            </div>
                            <button onClick={() => setHistoryFor(null)} className="p-2 hover:bg-muted rounded-full transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto">
                            {historyLoading ? (
                                <div className="flex flex-col items-center gap-3 py-10 animate-pulse">
                                    <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cargando historial...</p>
                                </div>
                            ) : historyEntries.length === 0 ? (
                                <p className="text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-40 italic py-10">
                                    Sin cambios registrados todavía — se creó y no se ha modificado.
                                </p>
                            ) : (
                                historyEntries.map((entry: any) => (
                                    <div key={entry.id} className={`p-4 rounded-2xl border-2 ${entry.action === 'delete' ? 'border-red-100 bg-red-50' : 'border-muted bg-muted/10'}`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                                {entry.InA_profiles?.full_name || 'Administrador'} · {new Date(entry.changed_at).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                            <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-full ${entry.action === 'delete' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>
                                                {entry.action === 'delete' ? 'Eliminación' : 'Edición'}
                                            </span>
                                        </div>
                                        <ul className="space-y-1">
                                            {describeChanges(entry).map((line, i) => (
                                                <li key={i} className="text-xs font-bold text-foreground">{line}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
