import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { LeaveRequest, LeaveType } from '../types';
import { CalendarOff, Plus, X, Save, Trash2, Search } from 'lucide-react';
import { showToast } from '../lib/toastStore';

interface LeaveManagementProps {
    companyId: string | null;
    currentProfileId: string | null;
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

export const LeaveManagement: React.FC<LeaveManagementProps> = ({ companyId, currentProfileId }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

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
        if (!companyId) { setLoading(false); return; }
        setLoading(true);
        try {
            const { data: emps, error: empError } = await supabase
                .from('InA_profiles')
                .select('id, full_name, national_id')
                .eq('company_id', companyId)
                .eq('role', 'employee')
                .order('full_name');
            if (empError) throw empError;
            setEmployees(emps || []);

            const { data: reqs, error: reqError } = await supabase
                .from('InA_leave_requests')
                .select('*, InA_profiles!profile_id(id, full_name, national_id, company_id)')
                .order('start_date', { ascending: false });
            if (reqError) throw reqError;
            setRequests((reqs || []).filter((r: any) => r.InA_profiles?.company_id === companyId));
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
            setIsAdding(false);
            setFormData({ profile_id: '', type: 'vacaciones', start_date: '', end_date: '', notes: '' });
            fetchData();
        } catch (err: any) {
            console.error('Error al guardar novedad:', err);
            showToast('Error al guardar: ' + err.message, 'error');
        }
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
                        onClick={() => setIsAdding(!isAdding)}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                    >
                        {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                        {isAdding ? 'Cancelar' : 'Registrar Novedad'}
                    </button>
                </div>
            </div>

            {isAdding && (
                <div className="bg-card border rounded-[2rem] p-8 shadow-xl animate-in fade-in slide-in-from-top-6 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
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
                                <Save className="w-5 h-5" /> REGISTRAR NOVEDAD
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
                            <th className="px-8 py-6">Notas</th>
                            <th className="px-8 py-6 text-right">Gestión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                        {loading ? (
                            <tr><td colSpan={6} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 animate-pulse">
                                    <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    <p className="font-black text-xs uppercase tracking-widest text-muted-foreground">Sincronizando Novedades...</p>
                                </div>
                            </td></tr>
                        ) : filteredRequests.length === 0 ? (
                            <tr><td colSpan={6} className="px-8 py-20 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-20 italic">
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
                                <td className="px-8 py-6 text-xs text-muted-foreground max-w-xs truncate">{req.notes || '---'}</td>
                                <td className="px-8 py-6 text-right">
                                    <button
                                        onClick={() => handleDelete(req.id)}
                                        className="p-3 bg-red-50 border border-red-100 shadow-sm rounded-2xl text-destructive hover:bg-destructive hover:text-white transition-all hover:scale-110 active:scale-90 opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-4.5 h-4.5" />
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
