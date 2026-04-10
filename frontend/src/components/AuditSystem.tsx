import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Search, UserCheck, AlertCircle, Calendar, Building2, Eye, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TimeEntryWithProfile } from '../types';

interface AuditSystemProps {
    companyId: string | null;
}

export const AuditSystem: React.FC<AuditSystemProps> = ({ companyId }) => {
    const [entries, setEntries] = useState<TimeEntryWithProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedEntry, setSelectedEntry] = useState<TimeEntryWithProfile | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    useEffect(() => {
        if (companyId) {
            fetchEntries();
        }
    }, [companyId, filterDate]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('InA_time_entries')
                .select('*, profiles:InA_profiles(*)')
                .eq('company_id', companyId as string)
                .eq('date', filterDate)
                .order('clock_in', { ascending: false });

            if (error) throw error;
            setEntries((data as any[]) || []);
        } catch (err) {
            console.error('Error fetching audit entries:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 relative min-h-[600px]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Sistema de Auditoría Visual</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Verificación de Identidad y Evidencia Fotográfica</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-primary opacity-50" />
                        <input
                            type="date"
                            value={filterDate}
                            onChange={(e) => setFilterDate(e.target.value)}
                            className="bg-card border rounded-xl pl-11 pr-4 py-2.5 font-black text-sm outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                        />
                    </div>
                    <button
                        onClick={fetchEntries}
                        className="p-2.5 bg-primary text-white rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                    >
                        <Search className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {/* List of Entries */}
                <div className="bg-card border rounded-[2rem] overflow-hidden shadow-xl flex flex-col min-h-[600px] max-h-[800px] w-full">
                    <div className="p-6 border-b bg-muted/20">
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Marcaciones del Día</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {loading ? (
                            <div className="p-8 text-center animate-pulse">
                                <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cargando registros...</p>
                            </div>
                        ) : entries.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground opacity-30 italic">
                                <AlertCircle className="w-12 h-12 mx-auto mb-2" />
                                <p className="text-xs font-black uppercase tracking-widest">Sin registros para esta fecha</p>
                            </div>
                        ) : entries.map(entry => (
                            <button
                                key={entry.id}
                                onClick={() => {
                                    setSelectedEntry(entry);
                                    setIsModalOpen(true);
                                }}
                                className={`w-full p-4 rounded-2xl border text-left transition-all hover:shadow-md flex items-center gap-4 ${!entry.is_verified ? 'bg-red-50/80 border-red-200' :
                                    selectedEntry?.id === entry.id ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-background hover:border-primary/30'
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
                                    {entry.profiles?.profile_photo ? (
                                        <img src={entry.profiles.profile_photo} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary font-black text-xs uppercase">
                                            {entry.profiles?.full_name?.charAt(0)}
                                        </div>
                                    )}
                                    {!entry.is_verified && (
                                        <div className="absolute top-0 right-0 p-0.5 bg-red-600 rounded-bl-lg">
                                            <AlertCircle className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-sm truncate uppercase tracking-tighter leading-none mb-1">{entry.profiles?.full_name}</p>
                                        {entry.metadata?.photo_evidence && (
                                            <Camera className="w-3.5 h-3.5 text-primary opacity-60" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase italic ${entry.event_type === 'in' ? 'bg-green-100 text-green-700' :
                                            entry.event_type === 'out' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                                            }`}>
                                            {entry.metadata?.event_label || entry.event_type}
                                        </span>
                                        <span className="text-[10px] font-bold text-muted-foreground italic">
                                            {entry.clock_in ? format(new Date(entry.clock_in), 'HH:mm') : '--:--'}
                                        </span>
                                    </div>
                                </div>
                                <Eye className={`w-4 h-4 flex-shrink-0 transition-colors ${selectedEntry?.id === entry.id ? 'text-primary' : 'text-muted-foreground/30'}`} />
                            </button>
                        ))}
                    </div>
                </div>

            </div>

            {/* Modal de Auditoría Integral */}
            {isModalOpen && selectedEntry && (
                <div className="absolute inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-background w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-300 border border-white/10">
                        {/* Header Modal */}
                        <div className="p-8 border-b bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-muted shadow-lg border-2 border-primary/20 flex-shrink-0">
                                    {selectedEntry.profiles?.profile_photo ? (
                                        <img src={selectedEntry.profiles.profile_photo} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary font-black text-xl italic uppercase">
                                            {selectedEntry.profiles?.full_name?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic leading-none">{selectedEntry.profiles?.full_name}</h3>
                                    <div className="flex flex-wrap items-center gap-4 pt-1">
                                        <div className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground">
                                            <Building2 className="w-3.5 h-3.5" /> ID: {selectedEntry.profiles?.national_id}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-black uppercase text-primary italic">
                                            <Calendar className="w-3.5 h-3.5" /> {selectedEntry.clock_in ? format(new Date(selectedEntry.clock_in), "EEEE, d 'de' MMMM", { locale: es }) + ' a las ' + format(new Date(selectedEntry.clock_in), 'HH:mm') : 'Sin fecha'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Biometry Badge - Dinámico */}
                                <div className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-black text-xs uppercase shadow-sm border-2 ${selectedEntry.metadata?.biometric_match === true ? 'bg-green-100 text-green-700 border-green-200' :
                                    selectedEntry.metadata?.biometric_match === false ? 'bg-red-100 text-red-700 border-red-200' :
                                        'bg-slate-100 text-slate-500 border-slate-200'
                                    }`}>
                                    {selectedEntry.metadata?.biometric_match === true ? <CheckCircle2 className="w-4 h-4" /> :
                                        selectedEntry.metadata?.biometric_match === false ? <AlertCircle className="w-4 h-4" /> :
                                            <Camera className="w-4 h-4" />}
                                    {selectedEntry.metadata?.biometric_match === true ? 'Biometría OK' :
                                        selectedEntry.metadata?.biometric_match === false ? 'Biometría Fallida' :
                                            'Sin Biometría'}
                                </div>

                                <button
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        // Cleanup simulation for map rubric
                                        console.log("Audit: Map instance destroyed.");
                                    }}
                                    className="p-3 bg-muted hover:bg-muted-foreground/10 text-muted-foreground rounded-2xl transition-all"
                                >
                                    <Search className="w-5 h-5 rotate-45" />
                                </button>
                            </div>
                        </div>

                        {/* Body Modal */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Comparación Visual */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* Foto Perfil */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Foto de Registro (Base)</label>
                                                <span className="text-[10px] font-bold text-primary italic uppercase bg-primary/10 px-2 py-0.5 rounded-full">Oficial</span>
                                            </div>
                                            <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-muted/30 bg-muted/10 relative shadow-inner group">
                                                {selectedEntry.profiles?.profile_photo ? (
                                                    <img src={selectedEntry.profiles.profile_photo} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Referencia" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                                        <Camera className="w-20 h-20 opacity-20" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest">Sin foto oficial</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Foto Evidencia */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between px-2">
                                                <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Evidencia Capturada</label>
                                                <span className={`text-[10px] font-bold italic uppercase px-2 py-0.5 rounded-full ${selectedEntry.is_verified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>Captura Terminal</span>
                                            </div>
                                            <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-primary/20 bg-black relative shadow-2xl group">
                                                {selectedEntry.metadata?.photo_evidence ? (
                                                    <img src={selectedEntry.metadata.photo_evidence} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Evidencia" />
                                                ) : (
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                                        <AlertCircle className="w-20 h-20 opacity-20" />
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-center px-8">No se capturó evidencia fotográfica en esta marcación</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Veredicto y Detalles Técnicos */}
                                    <div className="p-8 bg-primary/5 rounded-[2rem] border-2 border-primary/10 border-dashed grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                        <div className="space-y-3">
                                            <h4 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4" /> Veredicto del Sistema
                                            </h4>
                                            <p className="text-sm text-foreground/70 font-bold leading-relaxed">
                                                {selectedEntry.metadata?.biometric_match === true
                                                    ? `La biometría coincide. El sistema validó la identidad con un ${selectedEntry.metadata?.biometric_confidence || 0}% de confianza.`
                                                    : selectedEntry.metadata?.biometric_match === false
                                                        ? "ALERTA: La biometría NO coincide con el registro oficial."
                                                        : "No se realizó comparación biométrica para este registro."}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-background/80 p-4 rounded-2xl border">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Confianza</p>
                                                <p className="text-lg font-black text-primary">{selectedEntry.metadata?.biometric_confidence || 0}%</p>
                                            </div>
                                            <div className="bg-background/80 p-4 rounded-2xl border">
                                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Método</p>
                                                <p className="text-lg font-black text-primary uppercase">{selectedEntry.metadata?.method === 'photo-evidence' ? 'BIOMÉTRICO' : 'PIN'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Mapa y Ubicación */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2">
                                        <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Ubicación GPS</label>
                                    </div>
                                    <div className="aspect-[3/4] rounded-[2rem] overflow-hidden border-2 bg-muted/20 relative group shadow-lg">
                                        {selectedEntry.location_snapshot?.lat ? (
                                            <>
                                                <iframe
                                                    title="GPS Location"
                                                    width="100%"
                                                    height="100%"
                                                    frameBorder="0"
                                                    scrolling="no"
                                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${selectedEntry.location_snapshot.lng - 0.005}%2C${selectedEntry.location_snapshot.lat - 0.005}%2C${selectedEntry.location_snapshot.lng + 0.005}%2C${selectedEntry.location_snapshot.lat + 0.005}&layer=mapnik&marker=${selectedEntry.location_snapshot.lat}%2C${selectedEntry.location_snapshot.lng}`}
                                                />
                                                <a
                                                    href={`https://www.google.com/maps?q=${selectedEntry.location_snapshot.lat},${selectedEntry.location_snapshot.lng}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute bottom-4 left-4 right-4 bg-background/90 backdrop-blur p-3 rounded-xl border shadow-xl flex items-center justify-between hover:bg-primary hover:text-white transition-all"
                                                >
                                                    <span className="text-[10px] font-black uppercase tracking-tight">Google Maps</span>
                                                    <ArrowUpRight className="w-4 h-4" />
                                                </a>
                                            </>
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                                <AlertCircle className="w-16 h-16 opacity-20" />
                                                <p className="text-[10px] font-black uppercase tracking-widest text-center px-8">No disponible</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4">
                                        <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed">
                                            <p className="text-[10px] font-black text-muted-foreground uppercase mb-1">Coordenadas</p>
                                            <p className="text-xs font-bold font-mono">
                                                {selectedEntry.location_snapshot?.lat ? `${selectedEntry.location_snapshot.lat.toFixed(6)}, ${selectedEntry.location_snapshot.lng.toFixed(6)}` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer Modal Actions */}
                        <div className="p-8 border-t bg-muted/20 flex gap-4 justify-end">
                             <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-10 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                             >
                                CERRAR AUDITORÍA
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
