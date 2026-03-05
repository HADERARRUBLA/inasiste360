import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, ShieldCheck, Mail, Building2, Trash2, X, Save, ShieldAlert, Key } from 'lucide-react';
import type { UserRole, Company } from '../types';

export const AdminManagement: React.FC = () => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [formData, setFormData] = useState({
        full_name: '',
        national_id: '', // Used as unique identifier/login in this system
        company_id: '',
        role: 'admin' as UserRole,
        pin_code: ''
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Admins (profiles with role admin or superadmin)
            const { data: adminData } = await supabase
                .from('profiles')
                .select('*, companies(name)')
                .in('role', ['admin', 'superadmin'])
                .order('full_name');

            setAdmins(adminData || []);

            // Fetch Companies for assignment
            const { data: companyData } = await supabase
                .from('companies')
                .select('*')
                .order('name');

            setCompanies(companyData || []);
        } catch (err: any) {
            console.error('Error fetching admin data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert([{
                    ...formData,
                    national_id: formData.national_id.trim()
                }]);

            if (error) throw error;

            setStatus({ type: 'success', msg: 'Administrador registrado con éxito.' });
            setIsAdding(false);
            setFormData({ full_name: '', national_id: '', company_id: '', role: 'admin', pin_code: '' });
            fetchData();
        } catch (err: any) {
            setStatus({ type: 'error', msg: 'Error al registrar administrador: ' + err.message });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este acceso administrativo?')) return;
        try {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Gestión de Administradores</h2>
                    <p className="text-muted-foreground font-bold text-sm">Control de accesos y delegación por sede.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                    >
                        <UserPlus className="w-5 h-5" /> Registrar Admin
                    </button>
                )}
            </div>

            {status && (
                <div className={`p-5 rounded-3xl border-2 font-bold ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                    {status.msg}
                </div>
            )}

            {isAdding && (
                <div className="bg-card border rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                    <button onClick={() => setIsAdding(false)} className="absolute top-6 right-6 p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <ShieldCheck className="w-3 h-3" /> Nombre Completo
                                </label>
                                <input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                    placeholder="Nombre del Administrador"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Mail className="w-3 h-3" /> Identificador (Email o Cédula)
                                </label>
                                <input
                                    required
                                    value={formData.national_id}
                                    onChange={e => setFormData({ ...formData, national_id: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                    placeholder="Usuario (Cédula/Email)"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Key className="w-3 h-3" /> Clave de Acceso (PIN)
                                </label>
                                <input
                                    required
                                    value={formData.pin_code}
                                    onChange={e => setFormData({ ...formData, pin_code: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold tracking-[0.3em]"
                                    placeholder="••••"
                                    maxLength={8}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Building2 className="w-3 h-3" /> Sede Asignada
                                </label>
                                <select
                                    required
                                    value={formData.company_id}
                                    onChange={e => setFormData({ ...formData, company_id: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                >
                                    <option value="">Seleccionar sede...</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <ShieldAlert className="w-3 h-3" /> Nivel de Privilegios
                                </label>
                                <div className="flex gap-4">
                                    {['admin', 'superadmin'].map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, role: r as UserRole })}
                                            className={`flex-1 py-4 rounded-2xl border-2 font-black text-xs uppercase transition-all ${formData.role === r ? 'bg-primary border-primary text-white' : 'bg-muted/10 border-muted text-muted-foreground'
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                <Save className="w-5 h-5" /> REGISTRAR ACCESO
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-card border rounded-[2.5rem] overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <tr>
                            <th className="px-10 py-6">Administrador</th>
                            <th className="px-10 py-6">Identificador</th>
                            <th className="px-10 py-6">Clave (PIN)</th>
                            <th className="px-10 py-6">Sede Asignada</th>
                            <th className="px-10 py-6">Rol</th>
                            <th className="px-10 py-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="px-10 py-20 text-center animate-pulse font-black text-xs uppercase tracking-widest">Sincronizando Accesos...</td></tr>
                        ) : admins.map(admin => (
                            <tr key={admin.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-10 py-6 font-black text-lg">{admin.full_name}</td>
                                <td className="px-10 py-6 font-mono text-xs font-bold text-muted-foreground">{admin.national_id}</td>
                                <td className="px-10 py-6 font-mono text-xs font-bold text-primary tracking-widest">{admin.pin_code || '---'}</td>
                                <td className="px-10 py-6">
                                    <span className="font-bold text-sm text-primary uppercase">{admin.companies?.name || 'GLOBAL / TODAS'}</span>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${admin.role === 'superadmin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {admin.role}
                                    </span>
                                </td>
                                <td className="px-10 py-6 text-right text-red-500 font-black cursor-pointer hover:underline" onClick={() => handleDelete(admin.id)}>
                                    <Trash2 className="w-4 h-4 ml-auto" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
