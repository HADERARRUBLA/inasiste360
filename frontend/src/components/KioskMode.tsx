import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useGeofencing } from '../hooks/useGeofencing';
import { Camera, CheckCircle2, AlertCircle, RefreshCcw, ArrowLeft, UserCheck, Building2 } from 'lucide-react';
import Webcam from 'react-webcam';

interface KioskModeProps {
    companyId: string;
    targetLocation: { lat: number; lng: number } | null;
    radiusMeters?: number;
    onSuccess: (userId: string, type: 'in' | 'out') => void;
    onBack?: () => void;
    companyName?: string;
}

export const KioskMode: React.FC<KioskModeProps> = ({ companyId, companyName, targetLocation, radiusMeters = 100, onSuccess, onBack }) => {
    const { isInside, distance, error: geoError, refresh: refreshLocation } = useGeofencing(targetLocation, radiusMeters);
    const [pin, setPin] = useState('');
    const [step, setStep] = useState<'pin' | 'action' | 'face'>('pin');
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [lastEntry, setLastEntry] = useState<any>(null);
    const [selectedType, setSelectedType] = useState<any>(null);
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'loading', msg: string } | null>(null);
    const webcamRef = useRef<Webcam>(null);

    const handlePinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin) return;

        setStatus({ type: 'loading', msg: 'Verificando PIN...' });

        const { data: user, error: userError } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)
            .eq('pin_code', pin)
            .single();

        if (userError || !user) {
            setStatus({ type: 'error', msg: 'PIN incorrecto o empleado no encontrado.' });
            setPin('');
            return;
        }

        // Fetch last entry to determine state
        const { data: entry } = await supabase
            .from('time_entries')
            .select('event_type, created_at')
            .eq('profile_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        setCurrentUser(user);
        setLastEntry(entry);
        setStep('action');
        setStatus(null);
    };

    const handleActionSelect = (type: any) => {
        setSelectedType(type);
        // Only 'in' and 'out' require photo evidence
        if (type === 'in' || type === 'out') {
            setStep('face');
            setIsCameraActive(true);
        } else {
            registerEntry(type, null);
        }
    };

    const handleFaceVerify = async () => {
        if (!webcamRef.current) return;
        setStatus({ type: 'loading', msg: 'Capturando evidencia...' });
        const imageSrc = webcamRef.current.getScreenshot();

        if (imageSrc) {
            registerEntry(selectedType, imageSrc);
        } else {
            setStatus({ type: 'error', msg: 'No se pudo capturar la foto. Intenta de nuevo.' });
        }
    };

    const registerEntry = async (type: string, photoBase64?: string | null) => {
        setStatus({ type: 'loading', msg: 'Registrando...' });

        const now = new Date();
        const nowISO = now.toISOString();
        // Generar fecha local YYYY-MM-DD sin desfase UTC
        const localDate = now.toLocaleDateString('en-CA');

        const isReturn = ['breakfast', 'lunch', 'active_pause', 'other'].includes(lastEntry?.event_type);
        const eventLabel = isReturn
            ? `Regreso de ${getEventLabel(lastEntry.event_type)}`
            : getEventLabel(type);

        const insertData = {
            profile_id: currentUser.id,
            company_id: companyId,
            event_type: type,
            date: localDate, // Usar fecha local
            clock_in: nowISO,
            clock_out: type === 'out' ? nowISO : null,
            is_verified: true,
            metadata: {
                method: photoBase64 ? 'photo-evidence' : 'pin-only',
                photo_evidence: photoBase64 || null, // Guardar evidencia completa
                full_evidence: !!photoBase64,
                event_label: eventLabel,
                is_return: isReturn
            }
        };

        const { error } = await supabase.from('time_entries').insert([insertData]);

        if (error) {
            setStatus({ type: 'error', msg: 'Error: ' + error.message });
        } else {
            const label = getEventLabel(type);
            setStatus({ type: 'success', msg: `¡Hola ${currentUser.full_name}! ${label} registrado.` });
            onSuccess(currentUser.id, type as any);
            setTimeout(() => resetKiosk(), 3000);
        }
    };

    const getEventLabel = (type: string) => {
        const labels: Record<string, string> = {
            'in': 'Inicio de Día',
            'out': 'Fin de Día',
            'breakfast': 'Pausa Desayuno',
            'lunch': 'Pausa Almuerzo',
            'active_pause': 'Pausa Activa',
            'other': 'Otra Pausa'
        };
        return labels[type] || type;
    };

    const resetKiosk = () => {
        setPin('');
        setStep('pin');
        setIsCameraActive(false);
        setCurrentUser(null);
        setLastEntry(null);
        setSelectedType(null);
        setStatus(null);
    };

    if (isInside === null && step === 'pin') {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-muted-foreground animate-pulse space-y-6 max-w-2xl mx-auto">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                    <p className="font-bold uppercase tracking-widest text-xs">Validando ubicación GPS...</p>
                    <p className="text-[10px] mt-2 opacity-60">Asegúrate de permitir el acceso a la ubicación.</p>
                </div>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 px-6 py-3 bg-muted text-muted-foreground rounded-xl font-bold text-xs uppercase hover:bg-muted/80 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" /> Cancelar / Volver
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto relative animate-in zoom-in-95 duration-500">
            {(isInside === false || geoError) && step === 'pin' && (
                <div className="mb-6 p-6 bg-destructive text-destructive-foreground rounded-3xl flex flex-col items-center gap-4 font-bold shadow-xl border-2 border-white/20">
                    <div className="flex items-center gap-3">
                        <AlertCircle className="w-6 h-6 shrink-0" />
                        <span className="text-center">{geoError ? 'Error de GPS' : 'Fuera de área autorizada'}</span>
                    </div>
                    <div className="text-[10px] opacity-90 uppercase tracking-[0.2em] font-black bg-white/10 px-4 py-2 rounded-full">
                        {geoError ? geoError : `Distancia: ${Math.round(distance || 0)}m / Máx: ${radiusMeters}m`}
                    </div>
                    <button
                        onClick={refreshLocation}
                        className="flex items-center gap-2 px-6 py-2 bg-white text-destructive rounded-xl text-xs font-black hover:bg-white/90 transition-all active:scale-95"
                    >
                        <RefreshCcw className="w-3 h-3" /> RE-ESCANEAR UBICACIÓN
                    </button>
                </div>
            )}

            <div className={`bg-card border rounded-[2.5rem] p-10 shadow-2xl space-y-8 transition-all duration-500 ${isInside === false && step === 'pin' ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <div className="text-center space-y-4">
                    <div className="inline-flex mb-2 mx-auto hover:scale-105 transition-transform duration-500">
                        <img src="/logo_square.png" alt="Logo" className="w-48 h-auto object-contain drop-shadow-xl" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-muted-foreground text-[10px] font-black tracking-[0.3em] uppercase opacity-70 leading-none">Terminal de Acceso Biométrico</p>
                    </div>
                    {companyName && (
                        <div className="inline-flex items-center gap-2 px-5 py-2 bg-primary/5 text-primary rounded-full text-[11px] font-black uppercase tracking-widest border border-primary/10 mt-2">
                            <Building2 className="w-3.5 h-3.5" /> {companyName}
                        </div>
                    )}
                </div>

                {status && (
                    <div className={`p-4 rounded-xl text-center font-bold text-sm ${status.type === 'loading' ? 'bg-primary/10 text-primary animate-pulse' :
                        status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        {status.msg}
                    </div>
                )}

                {step === 'pin' ? (
                    <form onSubmit={handlePinSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest block text-center">Ingresa tu Código PIN</label>
                            <input
                                required
                                type="password"
                                maxLength={6}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                className="w-full text-center py-6 text-4xl font-black bg-muted/20 border-2 border-transparent focus:border-primary rounded-[2rem] outline-none transition-all tracking-[0.5em] font-mono"
                                placeholder="••••"
                                autoFocus
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'clear', 0, 'ok'].map((key, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => {
                                        if (key === 'clear') setPin('');
                                        else if (key === 'ok') handlePinSubmit(new Event('submit') as any);
                                        else if (typeof key === 'number') setPin(prev => prev.length < 6 ? prev + key : prev);
                                    }}
                                    className={`py-4 text-xl font-black rounded-2xl transition-all active:scale-90 ${key === 'ok' ? 'bg-primary text-primary-foreground col-span-1 shadow-lg' :
                                        key === 'clear' ? 'bg-muted text-muted-foreground' : 'bg-muted/10 hover:bg-muted/20 border'
                                        }`}
                                >
                                    {key === 'ok' ? <UserCheck className="mx-auto" /> : key === 'clear' ? <RefreshCcw className="mx-auto w-5 h-5" /> : key}
                                </button>
                            ))}
                        </div>
                    </form>
                ) : step === 'action' ? (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-500">
                        <div className="flex items-center justify-between">
                            <button onClick={resetKiosk} className="p-2 hover:bg-muted rounded-full transition-all text-muted-foreground">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none">Colaborador</p>
                                <p className="font-black text-primary text-lg">{currentUser.full_name}</p>
                            </div>
                            <div className="w-9" />
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {(!lastEntry || lastEntry.event_type === 'out') ? (
                                <button
                                    onClick={() => handleActionSelect('in')}
                                    className="p-6 bg-primary text-primary-foreground rounded-2xl font-black text-xl shadow-lg hover:shadow-primary/30 transition-all active:scale-95 flex items-center justify-between"
                                >
                                    <span>INICIAR JORNADA</span>
                                    <CheckCircle2 className="w-8 h-8 opacity-20" />
                                </button>
                            ) : ['breakfast', 'lunch', 'active_pause', 'other'].includes(lastEntry.event_type) ? (
                                <button
                                    onClick={() => handleActionSelect('in')}
                                    className="p-8 bg-green-500 text-white rounded-2xl font-black text-2xl shadow-lg hover:bg-green-600 transition-all active:scale-95 flex flex-col items-center gap-2"
                                >
                                    <RefreshCcw className="w-10 h-10 animate-spin-slow" />
                                    <span>REANUDAR JORNADA</span>
                                    <p className="text-[10px] opacity-80 uppercase tracking-widest font-bold">Regresando de {getEventLabel(lastEntry.event_type)}</p>
                                </button>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => handleActionSelect('breakfast')}
                                            className="p-4 bg-orange-500 text-white rounded-2xl font-black text-sm shadow-md hover:bg-orange-600 transition-all"
                                        >
                                            DESAYUNO
                                        </button>
                                        <button
                                            onClick={() => handleActionSelect('lunch')}
                                            className="p-4 bg-amber-500 text-white rounded-2xl font-black text-sm shadow-md hover:bg-amber-600 transition-all"
                                        >
                                            ALMUERZO
                                        </button>
                                        <button
                                            onClick={() => handleActionSelect('active_pause')}
                                            className="p-4 bg-blue-500 text-white rounded-2xl font-black text-sm shadow-md hover:bg-blue-600 transition-all"
                                        >
                                            PAUSA ACTIVA
                                        </button>
                                        <button
                                            onClick={() => handleActionSelect('other')}
                                            className="p-4 bg-muted text-muted-foreground rounded-2xl font-black text-sm shadow-md hover:bg-muted/80 transition-all border"
                                        >
                                            OTRA PAUSA
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => handleActionSelect('out')}
                                        className="p-6 bg-destructive text-destructive-foreground rounded-2xl font-black text-xl shadow-lg hover:shadow-destructive/30 transition-all active:scale-95 flex items-center justify-between mt-4"
                                    >
                                        <span>FINALIZAR JORNADA</span>
                                        <ArrowLeft className="w-8 h-8 opacity-20 rotate-180" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-500">
                        <div className="flex items-center justify-between">
                            <button onClick={() => setStep('action')} className="p-2 hover:bg-muted rounded-full transition-all text-muted-foreground">
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div className="text-center">
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Evidencia Fotográfica</p>
                                <p className="font-black text-primary">{getEventLabel(selectedType)}</p>
                            </div>
                            <div className="w-9" />
                        </div>

                        <div className="relative rounded-[2rem] overflow-hidden border-4 border-primary/20 aspect-video bg-black shadow-inner">
                            {isCameraActive && (
                                <Webcam
                                    audio={false}
                                    ref={webcamRef}
                                    screenshotFormat="image/jpeg"
                                    className="w-full h-full object-cover"
                                />
                            )}
                            <div className="absolute inset-0 border-[40px] border-black/30 pointer-events-none flex items-center justify-center">
                                <div className="w-full h-full border-2 border-white/50 border-dashed rounded-3xl" />
                            </div>
                        </div>

                        <p className="text-center text-[10px] text-muted-foreground font-bold italic px-4">Esta toma será guardada como registro oficial de {selectedType === 'in' ? 'entrada' : 'salida'}.</p>

                        <button
                            onClick={handleFaceVerify}
                            disabled={status?.type === 'loading'}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-primary to-primary/80 text-white rounded-[1.5rem] font-black text-lg shadow-xl hover:shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
                        >
                            <Camera className="w-6 h-6" /> CONFIRMAR CON FOTO
                        </button>
                    </div>
                )}

                <div className="flex flex-col items-center gap-4 pt-4 border-t border-dashed grayscale opacity-40">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter">
                            <CheckCircle2 className="w-3 h-3 text-green-500" /> BIO-ID: ACTIVO
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter">
                            <div className={`w-2 h-2 rounded-full ${isInside ? 'bg-green-500' : (geoError ? 'bg-amber-500' : 'bg-red-500')}`} />
                            ZONA: {geoError ? 'ERROR GPS' : (isInside ? 'DENTRO DE RANGO' : (isInside === null ? 'VALIDANDO...' : `FUERA DE RANGO (${Math.round(distance || 0)}m)`))}
                        </div>
                    </div>
                </div>

                {onBack && step === 'pin' && (
                    <button
                        onClick={onBack}
                        className="absolute -top-16 left-0 flex items-center gap-2 text-white/60 hover:text-white transition-colors font-black uppercase text-[10px] tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4" /> Volver al Inicio
                    </button>
                )}
            </div>
        </div>
    );
};
