import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Navigation, Save, ShieldCheck, Radius, RefreshCcw } from 'lucide-react';

interface CompanySetupProps {
    companyId: string | null;
    onSave?: () => void;
}

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

export const CompanySetup: React.FC<CompanySetupProps> = ({ companyId, onSave }) => {
    const [company, setCompany] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

    const fetchCompany = async () => {
        if (!companyId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchErr } = await supabase
                .from('InA_companies')
                .select('*')
                .eq('id', companyId)
                .single();
            if (fetchErr) throw fetchErr;
            setCompany({
                ...data,
                work_schedule: data.work_schedule && Object.keys(data.work_schedule).length > 0
                    ? { ...DEFAULT_SCHEDULE, ...data.work_schedule }
                    : { ...DEFAULT_SCHEDULE }
            });
        } catch (err: any) {
            console.error('Error fetching company:', err);
            setError(err.message || 'Error al conectar con el servidor.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompany();
    }, [companyId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        setSaving(true);
        setStatus(null);

        try {
            const { error: saveErr } = await supabase
                .from('InA_companies')
                .update({
                    name: company.name,
                    address: company.address,
                    lat_long: company.lat_long,
                    radius_limit: company.radius_limit,
                    night_shift_start_time: company.night_shift_start_time,
                    extra_day_start_time: company.extra_day_start_time,
                    work_schedule: company.work_schedule
                })
                .eq('id', company.id);

            if (saveErr) throw saveErr;
            setStatus({ type: 'success', msg: 'Configuración de la sede guardada con éxito.' });
            if (onSave) onSave();
        } catch (err: any) {
            setStatus({ type: 'error', msg: 'Error al guardar: ' + err.message });
        } finally {
            setSaving(false);
        }
    };

    const detectLocation = () => {
        if (!navigator.geolocation) return alert('Geolocalización no soportada');

        setStatus({ type: 'success', msg: 'Detectando ubicación GPS...' });
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setCompany({
                    ...company,
                    lat_long: `${pos.coords.latitude},${pos.coords.longitude}`
                });
                setStatus({ type: 'success', msg: 'Ubicación GPS capturada correctamente.' });
            },
            () => setStatus({ type: 'error', msg: 'Error de GPS. Verifica permisos.' })
        );
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sincronizando datos de sede...</p>
        </div>
    );

    if (error || !company) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-6 max-w-md mx-auto">
            <div className="p-8 bg-red-50 text-red-700 rounded-3xl border border-red-100 text-center font-bold">
                {error || 'No se encontró configuración de empresa.'}
            </div>
            <button
                onClick={fetchCompany}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold shadow-lg transition-all active:scale-95"
            >
                <RefreshCcw className="w-4 h-4" /> Reintentar Carga
            </button>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight italic">Configuración de Sede</h2>
                    <p className="text-muted-foreground font-bold text-sm">Define la ubicación física y los límites de marcación.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-100 shadow-sm">
                    <ShieldCheck className="w-3 h-3" /> Sistema Cifrado
                </div>
            </div>

            {status && (
                <div className={`p-5 rounded-3xl border-2 animate-in zoom-in-95 duration-300 font-bold ${status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                    {status.msg}
                </div>
            )}

            <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-card border rounded-[2.5rem] p-10 shadow-xl space-y-6 md:col-span-1">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                            <Building2 className="w-3 h-3" /> Nombre de la Sede
                        </label>
                        <input
                            required
                            value={company.name}
                            onChange={e => setCompany({ ...company, name: e.target.value })}
                            className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold text-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                            <MapPin className="w-3 h-3" /> Dirección Física
                        </label>
                        <input
                            value={company.address || ''}
                            onChange={e => setCompany({ ...company, address: e.target.value })}
                            className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-bold"
                            placeholder="Ej: Calle 10 # 43 - 50, Medellín"
                        />
                    </div>
                </div>

                {/* Global Weekly Schedule Matrix */}
                <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-8 shadow-xl space-y-6 md:col-span-2">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                <Save className="w-4 h-4" /> Horario Semanal Estándar
                            </h4>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight italic mt-1">Este horario se aplicará a todos los empleados que no tengan un horario personalizado activo.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest pl-1 text-center block italic">Ext. Diurna</label>
                                <input
                                    type="time"
                                    value={company.extra_day_start_time || '06:00'}
                                    onChange={e => setCompany({ ...company, extra_day_start_time: e.target.value })}
                                    className="px-3 py-2 border-2 border-muted bg-background rounded-xl focus:border-primary outline-none transition-all font-black text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[8px] font-black uppercase text-muted-foreground tracking-widest pl-1 text-center block italic">Rec. Nocturno</label>
                                <input
                                    type="time"
                                    value={company.night_shift_start_time || '21:00'}
                                    onChange={e => setCompany({ ...company, night_shift_start_time: e.target.value })}
                                    className="px-3 py-2 border-2 border-muted bg-background rounded-xl focus:border-primary outline-none transition-all font-black text-xs"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[8px] font-black uppercase text-muted-foreground tracking-widest border-b border-primary/5">
                            <div className="col-span-3">Día de la Semana</div>
                            <div className="col-span-1 text-center">Laboral</div>
                            <div className="col-span-4 text-center">Entrada General</div>
                            <div className="col-span-4 text-center">Salida General</div>
                        </div>
                        {Object.keys(DEFAULT_SCHEDULE).map((day) => {
                            const dayData = company.work_schedule?.[day] || (DEFAULT_SCHEDULE as any)[day];
                            return (
                                <div key={day} className={`grid grid-cols-12 gap-4 items-center p-3 border rounded-2xl transition-all ${dayData?.active ? 'bg-background border-primary/10' : 'opacity-40 bg-muted/5 border-transparent'}`}>
                                    <div className="col-span-3 font-black text-[11px] uppercase tracking-tight">{dayNames[day]}</div>
                                    <div className="col-span-1 flex justify-center">
                                        <input
                                            type="checkbox"
                                            checked={dayData?.active || false}
                                            onChange={e => {
                                                const newSched = {
                                                    ...company.work_schedule,
                                                    [day]: { ...(dayData || {}), active: e.target.checked }
                                                };
                                                setCompany({ ...company, work_schedule: newSched });
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
                                                    ...company.work_schedule,
                                                    [day]: { ...(dayData || {}), start: e.target.value }
                                                };
                                                setCompany({ ...company, work_schedule: newSched });
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
                                                    ...company.work_schedule,
                                                    [day]: { ...(dayData || {}), end: e.target.value }
                                                };
                                                setCompany({ ...company, work_schedule: newSched });
                                            }}
                                            className="w-full px-3 py-2 border rounded-xl bg-background font-bold text-sm outline-none focus:border-primary"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-card border rounded-[2.5rem] p-10 shadow-xl space-y-8 md:col-span-1 border-primary/10">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2 ml-1">
                                <Navigation className="w-3 h-3" /> Coordenadas GPS (Lat, Long)
                            </label>
                            <button
                                type="button"
                                onClick={detectLocation}
                                className="text-[10px] font-black uppercase text-primary hover:underline"
                            >
                                Detectar GPS Actual
                            </button>
                        </div>
                        <input
                            value={company.lat_long || ''}
                            onChange={e => setCompany({ ...company, lat_long: e.target.value })}
                            className="w-full px-5 py-4 border-2 border-muted bg-background rounded-2xl focus:border-primary outline-none transition-all font-mono font-bold text-primary"
                            placeholder="6.2442,-75.5812"
                        />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">
                            <span className="flex items-center gap-2"><Radius className="w-3 h-3" /> Radio de Tolerancia</span>
                            <span className="text-primary bg-primary/10 px-2 py-1 rounded-lg">{company.radius_limit} Metros</span>
                        </div>
                        <input
                            type="range"
                            min="20"
                            max="500"
                            step="10"
                            value={company.radius_limit}
                            onChange={e => setCompany({ ...company, radius_limit: parseInt(e.target.value) })}
                            className="w-full accent-primary h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[8px] font-black text-muted-foreground uppercase tracking-tighter">
                            <span>20m (Muy Estricto)</span>
                            <span>500m (Flexible)</span>
                        </div>
                    </div>
                </div>

                <div className="md:col-span-2 flex justify-end">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex items-center gap-3 px-16 py-5 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                    >
                        {saving ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : <Save className="w-6 h-6" />}
                        {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                </div>
            </form>
        </div>
    );
};
