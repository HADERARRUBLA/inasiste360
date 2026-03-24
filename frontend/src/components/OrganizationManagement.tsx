import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Plus, Search, Trash2, Edit2, CheckCircle, XCircle } from 'lucide-react';
import type { Organization } from '../types';

export const OrganizationManagement: React.FC = () => {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        nit: '',
        is_active: true
    });
    const [editingId, setEditingId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        const { data } = await supabase
            .from('InA_organizations')
            .select('*')
            .order('name');
        setOrganizations(data || []);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingId) {
                const { error } = await supabase
                    .from('InA_organizations')
                    .update(formData)
                    .eq('id', editingId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('InA_organizations')
                    .insert([formData]);
                if (error) throw error;
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({ name: '', nit: '', is_active: true });
            fetchOrganizations();
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const filteredOrgs = organizations.filter(o =>
        o.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.nit?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Gestión de Empresas (SaaS)</h2>
                    <p className="text-muted-foreground font-bold text-sm text-[#00E5FF]">Administración de inquilinos y clientes corporativos.</p>
                </div>
                <button
                    onClick={() => { setIsAdding(true); setEditingId(null); }}
                    className="bg-primary text-white px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
                >
                    <Plus className="w-5 h-5" /> Nueva Empresa
                </button>
            </div>

            <div className="flex items-center gap-4 bg-card/30 p-2 rounded-2xl border backdrop-blur-sm">
                <Search className="w-5 h-5 ml-4 text-muted-foreground" />
                <input
                    type="text"
                    placeholder="Buscar por nombre o NIT..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 text-sm font-bold"
                />
            </div>

            {isAdding && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                    <div className="bg-card w-full max-w-xl rounded-[2.5rem] border shadow-2xl overflow-hidden animate-in zoom-in slide-in-from-bottom-8 duration-500">
                        <div className="bg-primary/5 p-8 border-b">
                            <h3 className="text-2xl font-black uppercase italic">{editingId ? 'Editar Empresa' : 'Configurar Nueva Empresa'}</h3>
                            <p className="text-muted-foreground text-sm font-bold">Define los datos principales de la organización.</p>
                        </div>
                        <form onSubmit={handleSave} className="p-10 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 col-span-2">
                                    <label className="text-xs font-black uppercase text-muted-foreground border-l-2 border-primary pl-2 ml-1">Nombre Comercial</label>
                                    <input
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-muted/50 border-muted rounded-2xl px-5 py-4 text-sm font-bold focus:ring-2 ring-primary/20"
                                        placeholder="Ej: Alimentos FoodPer S.A.S"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-muted-foreground border-l-2 border-primary pl-2 ml-1">NIT / Tax ID</label>
                                    <input
                                        type="text"
                                        value={formData.nit}
                                        onChange={(e) => setFormData({ ...formData, nit: e.target.value })}
                                        className="w-full bg-muted/50 border-muted rounded-2xl px-5 py-4 text-sm font-bold"
                                        placeholder="Ej: 900.123.456-1"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase text-muted-foreground border-l-2 border-primary pl-2 ml-1">Estado</label>
                                    <select
                                        value={formData.is_active ? 'true' : 'false'}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                                        className="w-full bg-muted/50 border-muted rounded-2xl px-5 py-4 text-sm font-bold"
                                    >
                                        <option value="true">Activa</option>
                                        <option value="false">Inactiva</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-muted transition-colors border"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-primary text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-all"
                                >
                                    <CheckCircle className="w-4 h-4" /> Finalizar Registro
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOrgs.map(org => (
                    <div key={org.id} className="group hover:scale-[1.02] transition-all duration-500">
                        <div className="bg-card rounded-[2.5rem] border p-8 space-y-6 relative overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-primary/5">
                            <div className={`absolute top-0 right-0 w-32 h-32 opacity-5 -mr-8 -mt-8 ${org.is_active ? 'text-primary' : 'text-muted-foreground'}`}>
                                <Building2 size={128} />
                            </div>
                            
                            <div className="flex justify-between items-start relative z-10">
                                <div className="bg-primary/10 p-4 rounded-2xl border border-primary/20">
                                    <Building2 className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setFormData({ name: org.name, nit: org.nit || '', is_active: org.is_active });
                                            setEditingId(org.id);
                                            setIsAdding(true);
                                        }}
                                        className="p-2.5 rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors border border-transparent hover:border-primary/20"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 relative z-10">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black uppercase italic tracking-tighter">{org.name}</h3>
                                    {!org.is_active && <XCircle className="w-4 h-4 text-red-500" />}
                                </div>
                                <p className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                    <span className="opacity-50">NIT:</span> {org.nit || 'Pentiente'}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-dashed flex items-center justify-between relative z-10">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">Estado</span>
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${org.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {org.is_active ? 'Operacional' : 'Suspendida'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mb-1">ID</span>
                                    <p className="text-[9px] font-mono text-muted-foreground opacity-50">{org.id.slice(0, 8)}...</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
