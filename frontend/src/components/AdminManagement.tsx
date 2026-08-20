import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { UserPlus, ShieldCheck, Mail, Building2, X, Save, ShieldAlert, Key, MapPin } from 'lucide-react';
import type { UserRole, Company } from '../types';
import { showToast } from '../lib/toastStore';

// Cliente aislado (sin persistir sesión) usado únicamente para crear la
// cuenta de Supabase Auth de un admin nuevo, sin pisar la sesión activa del
// superadmin que está haciendo la creación en este mismo navegador.
const adminCreationClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);

export const AdminManagement: React.FC = () => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [formData, setFormData] = useState({
        id: '',
        full_name: '',
        national_id: '',
        company_id: '',
        organization_id: '',
        role: 'admin' as UserRole,
        password: '', // solo para crear la cuenta de Auth, nunca se guarda en InA_profiles
        managed_branches: [] as string[]
    });

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Organizations
            const { data: orgData } = await supabase
                .from('InA_organizations')
                .select('*')
                .order('name');
            setOrganizations(orgData || []);

            // Fetch Admins with their organization and assigned branches
            const { data: adminData } = await supabase
                .from('InA_profiles')
                .select(`
                    *,
                    organization:InA_organizations(name),
                    assigned_branches:InA_admin_branches(branch_id)
                `)
                .in('role', ['admin', 'superadmin'])
                .order('full_name');

            setAdmins(adminData || []);

            // Fetch Companies
            const { data: companyData } = await supabase
                .from('InA_companies')
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

    const handleEdit = (admin: any) => {
        setFormData({
            id: admin.id,
            full_name: admin.full_name,
            national_id: admin.national_id,
            company_id: admin.company_id || '',
            organization_id: admin.organization_id || '',
            role: admin.role,
            password: '',
            managed_branches: admin.assigned_branches?.map((b: any) => b.branch_id) || []
        });
        setIsAdding(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        try {
            const isNewAdmin = !formData.id;
            const email = formData.national_id.trim();

            let authUserId: string | undefined;
            if (isNewAdmin) {
                if (!email.includes('@')) {
                    throw new Error('Para crear un administrador, el identificador debe ser un correo electrónico válido (se usa para iniciar sesión).');
                }
                if (formData.password.length < 6) {
                    throw new Error('La contraseña inicial debe tener al menos 6 caracteres.');
                }
                // Cuenta real de Supabase Auth (login del panel usa signInWithPassword,
                // no PIN) — se crea con un cliente aislado para no pisar la sesión
                // del superadmin que está creando este admin.
                const { data: signUpData, error: signUpError } = await adminCreationClient.auth.signUp({
                    email,
                    password: formData.password
                });
                if (signUpError) throw signUpError;
                if (!signUpData.user) throw new Error('No se pudo crear la cuenta de acceso (Auth).');
                authUserId = signUpData.user.id;
                await adminCreationClient.auth.signOut();
            }

            const { managed_branches, password: _password, ...profileData } = formData;

            const dataToSave: Record<string, any> = {
                ...profileData,
                national_id: email,
                company_id: profileData.company_id || null,
                organization_id: profileData.organization_id || null
            };
            if (authUserId) dataToSave.auth_user_id = authUserId;

            // Remove id if it's empty to allow new insert if not found by national_id
            if (!dataToSave.id) delete dataToSave.id;

            const { data: savedProfile, error } = await supabase
                .from('InA_profiles')
                .upsert([dataToSave], { onConflict: 'national_id' })
                .select()
                .single();

            if (error) {
                console.error('Error detail (Supabase):', error);
                throw error;
            }

            // Handle branch assignments
            if (savedProfile) {
                // Delete previous assignments
                await supabase.from('InA_admin_branches').delete().eq('admin_id', savedProfile.id);

                // Insert new ones
                if (managed_branches.length > 0) {
                    const branchAssignments = managed_branches.map(branchId => ({
                        admin_id: savedProfile.id,
                        branch_id: branchId
                    }));
                    const { error: branchError } = await supabase
                        .from('InA_admin_branches')
                        .insert(branchAssignments);
                    if (branchError) throw branchError;
                }
            }

            setStatus({
                type: 'success',
                msg: isNewAdmin
                    ? `Administrador creado. Comparte estas credenciales de forma segura: ${email} / ${formData.password}`
                    : 'Administrador guardado con éxito.'
            });
            setIsAdding(false);
            setFormData({
                id: '',
                full_name: '',
                national_id: '',
                company_id: '',
                organization_id: '',
                role: 'admin',
                password: '',
                managed_branches: []
            });
            fetchData();
        } catch (err: any) {
            setStatus({ type: 'error', msg: 'Error al guardar: ' + err.message });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar este acceso administrativo?')) return;
        try {
            const { error } = await supabase.from('InA_profiles').delete().eq('id', id);
            if (error) throw error;
            fetchData();
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                                    <Building2 className="w-3 h-3" /> Organización (Empresa SaaS)
                                </label>
                                <select
                                    required
                                    value={formData.organization_id}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, organization_id: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                >
                                    <option value="">Seleccionar organización...</option>
                                    {organizations.map((org: any) => (
                                        <option key={org.id} value={org.id}>{org.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <Mail className="w-3 h-3" /> Correo Electrónico (usuario de acceso)
                                </label>
                                <input
                                    required
                                    type="email"
                                    disabled={!!formData.id}
                                    value={formData.national_id}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, national_id: e.target.value })}
                                    className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold disabled:opacity-60"
                                    placeholder="admin@empresa.com"
                                />
                                {!!formData.id && (
                                    <p className="text-[10px] text-muted-foreground font-bold ml-1">El correo no se puede cambiar aquí una vez creada la cuenta.</p>
                                )}
                            </div>
                            {!formData.id && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                        <Key className="w-3 h-3" /> Contraseña Inicial
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        minLength={6}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                                        placeholder="Mínimo 6 caracteres"
                                    />
                                    <p className="text-[10px] text-muted-foreground font-bold ml-1">Se la compartes tú directamente al admin — no se envía por correo.</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <MapPin className="w-3 h-3" /> Sedes Autorizadas
                                </label>
                                <div className="grid grid-cols-1 gap-2 p-4 border-2 border-muted rounded-2xl max-h-40 overflow-y-auto bg-muted/5">
                                    {companies
                                        .filter(c => !formData.organization_id || c.organization_id === formData.organization_id)
                                        .map((company: Company) => (
                                            <label key={company.id} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.managed_branches.includes(company.id)}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                        const branches = e.target.checked
                                                            ? [...formData.managed_branches, company.id]
                                                            : formData.managed_branches.filter(id => id !== company.id);
                                                        setFormData({ ...formData, managed_branches: branches });
                                                    }}
                                                    className="w-4 h-4 rounded text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm font-bold">{company.name}</span>
                                            </label>
                                        ))}
                                    {companies.filter((c: Company) => !formData.organization_id || c.organization_id === formData.organization_id).length === 0 && (
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase p-2">No hay sedes para esta organización</p>
                                    )}
                                </div>
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
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-muted/30 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        <tr>
                            <th className="px-10 py-6">Administrador</th>
                            <th className="px-10 py-6">Organización</th>
                            <th className="px-10 py-6">Sedes Autorizadas</th>
                            <th className="px-10 py-6">Rol</th>
                            <th className="px-10 py-6 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {loading ? (
                            <tr><td colSpan={5} className="px-10 py-20 text-center animate-pulse font-black text-xs uppercase tracking-widest">Sincronizando Accesos...</td></tr>
                        ) : admins.map((admin: any) => (
                            <tr key={admin.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-10 py-6 font-black text-lg">{admin.full_name}</td>
                                <td className="px-10 py-6">
                                    <span className="font-bold text-sm text-primary uppercase">{admin.organization?.name || '---'}</span>
                                </td>
                                <td className="px-10 py-6">
                                    <div className="flex flex-wrap gap-1">
                                        {admin.assigned_branches?.length > 0 ? (
                                            <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-black uppercase">
                                                {admin.assigned_branches.length} Sedes
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase italic">Sin sedes</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-10 py-6">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${admin.role === 'superadmin' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'
                                        }`}>
                                        {admin.role}
                                    </span>
                                </td>
                                <td className="px-10 py-6 text-right space-x-4">
                                    <button onClick={() => handleEdit(admin)} className="text-primary hover:underline font-black text-[10px] uppercase">Editar</button>
                                    <button onClick={() => handleDelete(admin.id)} className="text-red-500 hover:underline font-black text-[10px] uppercase">Eliminar</button>
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
