import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Navigation, Save, Plus, Trash2, Pencil, X, Radius } from 'lucide-react';
import type { Company } from '../types';

export const BranchManagement: React.FC = () => {
    const [branches, setBranches] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        lat_long: '',
        radius_limit: 100
    });

    const fetchBranches = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('*')
                .order('name');
            if (error) throw error;
            setBranches(data || []);
        } catch (err: any) {
            console.error('Error fetching branches:', err);
            setStatus({ type: 'error', msg: 'Error al cargar sedes: ' + err.message });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('companies')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
                setStatus({ type: 'success', msg: 'Sede actualizada con éxito.' });
            } else {
                const { error } = await supabase
                    .from('companies')
                    .insert([formData]);
                if (error) throw error;
                setStatus({ type: 'success', msg: 'Nueva sede creada con éxito.' });
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({ name: '', address: '', lat_long: '', radius_limit: 100 });
            fetchBranches();
        } catch (err: any) {
            setStatus({ type: 'error', msg: 'Error al guardar: ' + err.message });
        }
    };

    const handleEdit = (branch: Company) => {
        setFormData({
            name: branch.name,
            address: branch.address || '',
            lat_long: branch.lat_long || '',
            radius_limit: branch.radius_limit
        });
        setEditingId(branch.id);
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta sede? Esto afectará a todos los empleados asociados.')) return;
        try {
            const { error } = await supabase.from('companies').delete().eq('id', id);
            if (error) throw error;
            fetchBranches();
        } catch (err: any) {
            alert('Error al eliminar: ' + err.message);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Gestión de Sedes</h2>
                    <p className="text-muted-foreground font-bold text-sm">Administración global de ubicaciones físicas.</p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-black shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5" /> Nueva Sede
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
                                    <Building2 className="w-3 h-3" /> Nombre de la Sede
                                </label>
                                <input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold text-lg"
                                    placeholder="Ej: Sede Principal - Norte"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <MapPin className="w-3 h-3" /> Dirección Física
                                </label>
                                <input
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Navigation className="w-3 h-3" /> Coordenadas Lat, Long
                                </label>
                                <input
                                    required
                                    value={formData.lat_long}
                                    onChange={e => setFormData({ ...formData, lat_long: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background outline-none focus:border-primary rounded-2xl font-mono"
                                    placeholder="6.1234, -75.5678"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Radius className="w-3 h-3" /> Radio Geovalla (Metros): {formData.radius_limit}m
                                </label>
                                <input
                                    type="range"
                                    min="20"
                                    max="500"
                                    step="10"
                                    value={formData.radius_limit}
                                    onChange={e => setFormData({ ...formData, radius_limit: parseInt(e.target.value) })}
                                    className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="flex items-center gap-3 px-12 py-4 bg-primary text-primary-foreground rounded-2xl font-black shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                <Save className="w-5 h-5" /> {editingId ? 'GUARDAR CAMBIOS' : 'CREAR SEDE'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-card border rounded-[2.5rem] overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <tr>
                            <th className="px-10 py-6">Información de Sede</th>
                            <th className="px-10 py-6">Ubicación GPS</th>
                            <th className="px-10 py-6">Parámetros</th>
                            <th className="px-10 py-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={4} className="px-10 py-20 text-center animate-pulse font-black text-xs uppercase tracking-widest">Sincronizando Sedes...</td></tr>
                        ) : branches.length === 0 ? (
                            <tr><td colSpan={4} className="px-10 py-20 text-center text-muted-foreground italic">No hay sedes registradas.</td></tr>
                        ) : branches.map(branch => (
                            <tr key={branch.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-10 py-8">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                                            <Building2 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="font-black text-lg">{branch.name}</p>
                                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-tighter">{branch.address || 'Sin dirección registrada'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-10 py-8 font-mono text-xs text-muted-foreground font-bold">{branch.lat_long || 'N/A'}</td>
                                <td className="px-10 py-8">
                                    <span className="px-3 py-1 bg-muted rounded-lg text-[10px] font-black uppercase">Radio: {branch.radius_limit}m</span>
                                </td>
                                <td className="px-10 py-8 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                        <button onClick={() => handleEdit(branch)} className="p-3 bg-white border rounded-xl text-primary hover:bg-primary hover:text-white transition-all">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(branch.id)} className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 hover:bg-red-600 hover:text-white transition-all">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
