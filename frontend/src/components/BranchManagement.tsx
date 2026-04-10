import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Navigation, Save, Plus, Trash2, Pencil, X, Radius, CheckCircle2, Search, MapPinOff } from 'lucide-react';
import type { Company } from '../types';
import { formatLatLng, validateLatLng, parseLatLng } from '../utils/geoUtils';
import { GeoPickerMap } from './GeoPickerMap';

const DEFAULT_SCHEDULE = {
    mon: { start: '08:00', end: '17:00', active: true },
    tue: { start: '08:00', end: '17:00', active: true },
    wed: { start: '08:00', end: '17:00', active: true },
    thu: { start: '08:00', end: '17:00', active: true },
    fri: { start: '08:00', end: '17:00', active: true },
    sat: { start: '08:00', end: '13:00', active: true },
    sun: { start: '08:00', end: '13:00', active: false },
};

const dayNames: { [key: string]: string } = {
    mon: 'Lunes',
    tue: 'Martes',
    wed: 'Miércoles',
    thu: 'Jueves',
    fri: 'Viernes',
    sat: 'Sábado',
    sun: 'Domingo',
};

interface BranchManagementProps {
    onSave?: () => void;
}

export const BranchManagement: React.FC<BranchManagementProps> = ({ onSave }) => {
    const [branches, setBranches] = useState<any[]>([]);
    const [organizations, setOrganizations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        lat_long: '',
        radius_limit: 100,
        organization_id: '',
        work_schedule: { ...DEFAULT_SCHEDULE } as any
    });

    const [isGettingLocation, setIsGettingLocation] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearchAddress = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        setStatus(null);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=3&countrycodes=co`,
                { headers: { 'User-Agent': 'InAsiste360/1.0' } }
            );
            const data = await res.json();
            if (data && data.length > 0) {
                setSearchResults(data);
            } else {
                setSearchResults([]);
                setStatus({ type: 'error', msg: 'No se encontró la dirección. Intenta ser más específico.' });
            }
        } catch (err) {
            console.error('Search error:', err);
            setStatus({ type: 'error', msg: 'Error al buscar dirección.' });
        } finally {
            setIsSearching(false);
        }
    };

    const getGeolocation = () => {
        setIsGettingLocation(true);
        if (!navigator.geolocation) {
            alert('Tu navegador no soporta geolocalización.');
            setIsGettingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                const formatted = formatLatLng(latitude, longitude);
                setFormData(prev => ({ ...prev, lat_long: formatted }));
                // Mostrar la precisión obtenida en el estado de status:
                setStatus({ type: 'success', msg: `GPS capturado. Precisión: ±${Math.round(position.coords.accuracy)}m` });
                setIsGettingLocation(false);
            },
            (error) => {
                console.error('Error getting location:', error);
                let errorMsg = 'No se pudo obtener la ubicación.';
                if (error.code === 1) errorMsg = 'Permiso de ubicación denegado. Por favor, habilita el GPS en tu navegador.';
                else if (error.code === 2) errorMsg = 'Ubicación no disponible.';
                else if (error.code === 3) errorMsg = 'Tiempo de espera agotado.';

                alert(errorMsg);
                setIsGettingLocation(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const fetchBranches = async () => {
        setLoading(true);
        try {
            // Fetch Orgs
            const { data: orgs } = await supabase.from('InA_organizations').select('*').order('name');
            setOrganizations(orgs || []);

            const { data, error } = await supabase
                .from('InA_companies')
                .select('*, organization:InA_organizations(name)')
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

    // Sincronización de lat_long (input) -> Mapa con debounce de 500ms
    const [mapValue, setMapValue] = useState<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
        const timer = setTimeout(() => {
            const parsed = parseLatLng(formData.lat_long);
            if (parsed) {
                setMapValue(parsed);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [formData.lat_long]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);

        if (formData.lat_long && !validateLatLng(formData.lat_long)) {
            setStatus({ type: 'error', msg: 'Coordenadas inválidas. Usa el botón GPS o ingresa formato: latitud,longitud' });
            return;
        }

        const dataToSave = {
            ...formData,
            organization_id: formData.organization_id || null
        };

        try {
            if (editingId) {
                const { error } = await supabase
                    .from('InA_companies')
                    .update(dataToSave)
                    .eq('id', editingId);
                if (error) throw error;
                setStatus({ type: 'success', msg: 'Sede actualizada con éxito.' });
            } else {
                const { error } = await supabase
                    .from('InA_companies')
                    .insert([dataToSave]);
                if (error) throw error;
                setStatus({ type: 'success', msg: 'Nueva sede creada con éxito.' });
            }
            setIsAdding(false);
            setEditingId(null);
            setFormData({ name: '', address: '', lat_long: '', radius_limit: 100, organization_id: '', work_schedule: { ...DEFAULT_SCHEDULE } as any });
            fetchBranches();
            if (onSave) onSave();

        } catch (err: any) {
            setStatus({ type: 'error', msg: 'Error al guardar: ' + err.message });
        }
    };

    const handleEdit = (branch: any) => {
        setFormData({
            name: branch.name,
            address: branch.address || '',
            lat_long: branch.lat_long || '',
            radius_limit: branch.radius_limit,
            organization_id: branch.organization_id || '',
            work_schedule: branch.work_schedule || { ...DEFAULT_SCHEDULE }
        });
        setEditingId(branch.id);
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Seguro que deseas eliminar esta sede? Esto afectará a todos los empleados asociados.')) return;
        try {
            const { error } = await supabase.from('InA_companies').delete().eq('id', id);
            if (error) throw error;
            fetchBranches();
            if (onSave) onSave();

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
                                <div className="relative group">
                                    <input
                                        required
                                        value={formData.lat_long}
                                        onChange={e => setFormData({ ...formData, lat_long: e.target.value })}
                                        className="w-full px-5 py-4 border-2 border-muted bg-background outline-none focus:border-primary rounded-2xl font-mono text-sm pr-16"
                                        placeholder="6.1234, -75.5678"
                                    />
                                    <button
                                        type="button"
                                        onClick={getGeolocation}
                                        disabled={isGettingLocation}
                                        className={`absolute right-2 top-2 p-3 rounded-xl transition-all ${isGettingLocation ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary hover:bg-primary hover:text-white'
                                            }`}
                                        title="Obtener ubicación actual"
                                    >
                                        <Navigation className={`w-4 h-4 ${isGettingLocation ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 mt-4">
                                <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                    <MapPin className="w-3 h-3" /> Selección Visual en Mapa
                                </label>
                                <GeoPickerMap
                                    value={mapValue}
                                    radius={formData.radius_limit}
                                    onChange={(pos) => setFormData(prev => ({ ...prev, lat_long: formatLatLng(pos.lat, pos.lng) }))}
                                    height={280}
                                />
                                
                                {/* Nominatim Search UI */}
                                <div className="mt-4 space-y-2">
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearchAddress())}
                                                placeholder="Buscar por dirección (ej: Carrera 7 # 12-34 Medellín)"
                                                className="w-full px-4 py-2 text-sm border-2 border-muted rounded-xl focus:border-primary outline-none"
                                            />
                                            {isSearching && <div className="absolute right-3 top-2.5 animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleSearchAddress}
                                            className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-xl transition-all"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                    
                                    {searchResults.length > 0 && (
                                        <div className="bg-background border-2 border-primary/20 rounded-xl overflow-hidden shadow-lg animate-in fade-in slide-in-from-top-2">
                                            {searchResults.map((res: any, idx: number) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => {
                                                        const lat = parseFloat(res.lat);
                                                        const lon = parseFloat(res.lon);
                                                        setFormData(prev => ({ ...prev, lat_long: formatLatLng(lat, lon) }));
                                                        setSearchResults([]);
                                                        setSearchQuery('');
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-[11px] font-bold border-b last:border-0 hover:bg-primary/10 transition-colors flex items-start gap-2"
                                                >
                                                    <MapPin className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                                                    <span>{res.display_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
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

                            {/* Gestión de Jornada (NUEVO) */}
                            <div className="md:col-span-2 p-8 bg-muted/10 border-2 border-primary/5 rounded-[2rem] space-y-6 mt-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-primary" /> Horario de Atención de Sede (Predefinido)
                                    </h4>
                                    <p className="text-[9px] font-black text-muted-foreground uppercase opacity-70">Define los límites para las alertas de puntualidad</p>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[8px] font-black uppercase text-muted-foreground tracking-widest border-b border-primary/5">
                                        <div className="col-span-3">Día</div>
                                        <div className="col-span-1 text-center">Activo</div>
                                        <div className="col-span-4 text-center">Entrada</div>
                                        <div className="col-span-4 text-center">Salida</div>
                                    </div>
                                    {Object.keys(DEFAULT_SCHEDULE).map((day) => {
                                        const dayData = formData.work_schedule?.[day] || (DEFAULT_SCHEDULE as any)[day];
                                        return (
                                            <div key={day} className={`grid grid-cols-12 gap-4 items-center p-3 border rounded-2xl transition-all ${dayData?.active ? 'bg-primary/5 border-primary/10' : 'opacity-40 bg-muted/5 border-transparent'}`}>
                                                <div className="col-span-3 font-black text-[11px] uppercase tracking-tight">{dayNames[day]}</div>
                                                <div className="col-span-1 flex justify-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={dayData?.active || false}
                                                        onChange={e => {
                                                            const newSched = {
                                                                ...formData.work_schedule,
                                                                [day]: { ...(dayData || {}), active: e.target.checked }
                                                            };
                                                            setFormData({ ...formData, work_schedule: newSched });
                                                        }}
                                                        className="w-4 h-4 accent-primary"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <input
                                                        type="time"
                                                        disabled={!dayData?.active}
                                                        value={dayData?.start || '08:00'}
                                                        onChange={e => {
                                                            const newSched = {
                                                                ...formData.work_schedule,
                                                                [day]: { ...(dayData || {}), start: e.target.value }
                                                            };
                                                            setFormData({ ...formData, work_schedule: newSched });
                                                        }}
                                                        className="w-full px-3 py-2 border rounded-xl bg-background font-bold text-sm outline-none focus:border-primary"
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <input
                                                        type="time"
                                                        disabled={!dayData?.active}
                                                        value={dayData?.end || '17:00'}
                                                        onChange={e => {
                                                            const newSched = {
                                                                ...formData.work_schedule,
                                                                [day]: { ...(dayData || {}), end: e.target.value }
                                                            };
                                                            setFormData({ ...formData, work_schedule: newSched });
                                                        }}
                                                        className="w-full px-3 py-2 border rounded-xl bg-background font-bold text-sm outline-none focus:border-primary"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
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
                            <th className="px-10 py-6">Organización</th>
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
                                <td className="px-10 py-8">
                                    <span className="font-bold text-sm text-primary uppercase">{branch.organization?.name || 'GLOBAL'}</span>
                                </td>
                                <td className="px-10 py-8">
                                    <div className="space-y-2 max-w-[150px]">
                                        <span className="block px-3 py-1 bg-muted rounded-lg text-[10px] font-black uppercase text-center">Radio: {branch.radius_limit}m</span>
                                        {branch.lat_long ? (
                                            <div className="rounded-xl overflow-hidden border border-primary/10 shadow-sm transition-transform hover:scale-105">
                                                <GeoPickerMap 
                                                    value={parseLatLng(branch.lat_long)} 
                                                    radius={branch.radius_limit} 
                                                    readonly={true}
                                                    height={100}
                                                />
                                            </div>
                                        ) : (
                                            <div className="h-[100px] flex flex-col items-center justify-center bg-muted/20 border border-dashed rounded-xl gap-1">
                                                <MapPinOff className="w-5 h-5 text-muted-foreground/50" />
                                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Sin GPS</span>
                                            </div>
                                        )}
                                        <span className="block font-mono text-[9px] text-muted-foreground text-center truncate" title={branch.lat_long || 'N/A'}>
                                            {branch.lat_long || 'N/A'}
                                        </span>
                                    </div>
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
