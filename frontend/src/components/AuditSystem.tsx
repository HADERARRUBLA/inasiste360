import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Search, UserCheck, AlertCircle, Calendar, Building2, Eye, CheckCircle2 } from 'lucide-react';
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
                .from('time_entries')
                .select('*, profiles(*)')
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
        <div className="space-y-6">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* List of Entries */}
                <div className="lg:col-span-1 bg-card border rounded-[2rem] overflow-hidden shadow-xl flex flex-col max-h-[700px]">
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
                                onClick={() => setSelectedEntry(entry)}
                                className={`w-full p-4 rounded-2xl border text-left transition-all hover:shadow-md flex items-center gap-4 ${selectedEntry?.id === entry.id ? 'bg-primary/10 border-primary ring-1 ring-primary' : 'bg-background hover:border-primary/30'
                                    }`}
                            >
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                                    {entry.profiles?.profile_photo ? (
                                        <img src={entry.profiles.profile_photo} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-primary font-black text-xs uppercase">
                                            {entry.profiles?.full_name?.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="font-black text-sm truncate uppercase tracking-tighter leading-none mb-1">{entry.profiles?.full_name}</p>
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

                {/* Audit View */}
                <div className="lg:col-span-2 bg-card border rounded-[2rem] overflow-hidden shadow-xl min-h-[500px] flex flex-col">
                    {selectedEntry ? (
                        <>
                            <div className="p-8 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight italic">{selectedEntry.profiles?.full_name}</h3>
                                    <div className="flex items-center gap-4 mt-1">
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground">
                                            <Building2 className="w-3 h-3" /> {selectedEntry.profiles?.national_id}
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary italic">
                                            <Calendar className="w-3 h-3" /> {selectedEntry.clock_in ? format(new Date(selectedEntry.clock_in), "EEEE, d 'de' MMMM", { locale: es }) + ' a las ' + format(new Date(selectedEntry.clock_in), 'HH:mm') : 'Sin fecha'}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={`inline-flex items-center gap-2 px-6 py-2 rounded-full font-black text-xs uppercase shadow-sm border-2 ${selectedEntry.is_verified ? 'bg-green-50 text-green-700 border-green-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                        }`}>
                                        {selectedEntry.is_verified ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {selectedEntry.is_verified ? 'Verificado' : 'Sin Verificar'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full">
                                    {/* Reference Photo */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Foto de Referencia (Perfil)</label>
                                            <span className="text-[10px] font-bold text-primary italic uppercase bg-primary/10 px-2 py-0.5 rounded-full">Base Oficial</span>
                                        </div>
                                        <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-muted/30 bg-muted/10 relative shadow-inner">
                                            {selectedEntry.profiles?.profile_photo ? (
                                                <img src={selectedEntry.profiles.profile_photo} className="w-full h-full object-cover" alt="Referencia" />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                                    <Camera className="w-20 h-20 opacity-20" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">Sin foto de referencia</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Entry Photo */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between px-2">
                                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Evidencia de Marcación</label>
                                            <span className="text-[10px] font-bold text-destructive italic uppercase bg-destructive/10 px-2 py-0.5 rounded-full">Captura en Terminal</span>
                                        </div>
                                        <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-primary/20 bg-black relative shadow-2xl">
                                            {selectedEntry.metadata?.photo_evidence ? (
                                                <img src={selectedEntry.metadata.photo_evidence} className="w-full h-full object-cover" alt="Evidencia" />
                                            ) : selectedEntry.metadata?.photo_preview ? (
                                                <div className="absolute inset-0 bg-muted/80 flex flex-col items-center justify-center text-center p-6 gap-4">
                                                    <img src={selectedEntry.metadata.photo_preview} className="w-48 h-32 object-cover opacity-50 grayscale blur-sm" alt="" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Evidencia Incompleta (Legacy)</p>
                                                </div>
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                                                    <AlertCircle className="w-20 h-20 opacity-20" />
                                                    <p className="text-[10px] font-black uppercase tracking-widest">No se capturó evidencia</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 p-6 bg-primary/5 rounded-[1.5rem] border-2 border-primary/10 border-dashed">
                                    <h4 className="text-xs font-black uppercase text-primary tracking-widest flex items-center gap-2 mb-2">
                                        <UserCheck className="w-4 h-4" /> Veredicto de Auditoría
                                    </h4>
                                    <p className="text-sm text-foreground/70 font-medium">
                                        Compara cuidadosamente los rasgos faciales de ambas imágenes. Si encuentras discrepancias, puedes marcar este registro para revisión manual del administrador de sede.
                                    </p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-30">
                            <div className="w-32 h-32 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                                <Search className="w-16 h-16 text-primary" />
                            </div>
                            <h3 className="text-xl font-black uppercase italic tracking-widest">Selecciona una marcación</h3>
                            <p className="text-xs font-bold uppercase tracking-tighter mt-2">Para iniciar el proceso de verificación visual cara a cara.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
