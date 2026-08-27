import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parseLatLng } from '../utils/geoUtils';
import { KioskMode } from './KioskMode';
import { ArrowLeft, Building2, MapPinned, AlertCircle, UserCheck } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

interface MobileKioskEntryProps {
    onBack: () => void;
}

interface SedeOption {
    company_id: string;
    company_name: string;
    lat_long: string | null;
    radius_limit: number | null;
    biometric_verification: boolean;
    is_primary: boolean;
}

// Modo celular para empleados flotantes (varias sedes en un mismo día) —
// ver migración 0013_kiosk_mobile_branches.sql. A diferencia del Kiosko de
// tablet fija (companyId fijo por dispositivo), aquí la persona se
// identifica con cédula+PIN y el sistema le muestra SOLO las sedes donde
// ella está autorizada (nunca la lista completa de la organización).
export const MobileKioskEntry: React.FC<MobileKioskEntryProps> = ({ onBack }) => {
    const [step, setStep] = useState<'identify' | 'select-sede' | 'kiosk'>('identify');
    const [nationalId, setNationalId] = useState('');
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sedes, setSedes] = useState<SedeOption[]>([]);
    const [selectedSede, setSelectedSede] = useState<SedeOption | null>(null);

    const handleIdentify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nationalId || !pin) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: rpcError } = await supabase.rpc('kiosk_find_profile_branches', {
                p_national_id: nationalId.trim(), p_pin_code: pin
            });
            if (rpcError) throw rpcError;
            if (!data || data.length === 0) {
                setError('Cédula o PIN incorrectos.');
                return;
            }
            setSedes(data);
            setStep('select-sede');
        } catch (err: any) {
            setError(err.message || 'Error al verificar. Intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    const resetToIdentify = () => {
        setStep('identify');
        setNationalId('');
        setPin('');
        setSedes([]);
        setSelectedSede(null);
        setError(null);
    };

    if (step === 'kiosk' && selectedSede) {
        return (
            <KioskMode
                companyId={selectedSede.company_id}
                companyName={selectedSede.company_name}
                targetLocation={parseLatLng(selectedSede.lat_long)}
                radiusMeters={selectedSede.radius_limit || 100}
                biometricEnabled={selectedSede.biometric_verification}
                autoPin={pin}
                onSuccess={() => { /* Registro exitoso */ }}
                onBack={() => { setSelectedSede(null); setStep('select-sede'); }}
            />
        );
    }

    return (
        <div className="max-w-md mx-auto relative animate-in zoom-in-95 duration-500">
            <div className="absolute -top-16 right-0 z-[60]">
                <ThemeToggle />
            </div>
            <button
                onClick={step === 'identify' ? onBack : resetToIdentify}
                className="absolute -top-16 left-0 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-black uppercase text-[10px] tracking-widest"
            >
                <ArrowLeft className="w-4 h-4" /> {step === 'identify' ? 'Volver al Inicio' : 'Cambiar Identidad'}
            </button>

            <div className="bg-card border rounded-[2.5rem] p-10 shadow-2xl space-y-8">
                <div className="text-center space-y-4">
                    <div className="inline-flex mb-2 mx-auto">
                        <img src="/logo_square.png" alt="Logo" className="w-48 h-auto object-contain drop-shadow-xl" />
                    </div>
                    <p className="text-muted-foreground text-[10px] font-black tracking-[0.3em] uppercase opacity-70 leading-none">
                        {step === 'identify' ? 'Marcación desde tu Celular' : 'Elige tu Sede'}
                    </p>
                </div>

                {step === 'identify' ? (
                    <form onSubmit={handleIdentify} className="space-y-6">
                        <p className="text-center text-xs text-muted-foreground font-bold px-2">
                            Para empleados que visitan varias sedes en el día. Ingresa tu cédula y tu PIN para ver las sedes donde puedes marcar.
                        </p>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest block text-center">Cédula</label>
                            <input
                                required
                                type="text"
                                value={nationalId}
                                onChange={e => setNationalId(e.target.value)}
                                className="w-full text-center py-4 text-xl font-black bg-muted/20 border-2 border-transparent focus:border-primary rounded-2xl outline-none transition-all font-mono"
                                placeholder="Tu número de cédula"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest block text-center">PIN</label>
                            <input
                                required
                                type="password"
                                maxLength={6}
                                value={pin}
                                onChange={e => setPin(e.target.value)}
                                className="w-full text-center py-6 text-4xl font-black bg-muted/20 border-2 border-transparent focus:border-primary rounded-[2rem] outline-none transition-all tracking-[0.5em] font-mono"
                                placeholder="••••"
                            />
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 justify-center text-sm font-bold text-red-600 bg-red-50 p-3 rounded-xl">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full flex items-center justify-center gap-3 py-5 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                        >
                            <UserCheck className="w-5 h-5" /> {loading ? 'Verificando...' : 'Continuar'}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-3">
                        {sedes.map(s => (
                            <button
                                key={s.company_id}
                                onClick={() => { setSelectedSede(s); setStep('kiosk'); }}
                                className="w-full flex items-center justify-between gap-3 p-5 bg-muted/10 border-2 rounded-2xl hover:border-primary hover:bg-primary/5 transition-all active:scale-95 text-left"
                            >
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-primary shrink-0" />
                                    <div>
                                        <p className="font-black text-foreground">{s.company_name}</p>
                                        {s.is_primary && <p className="text-[9px] font-black uppercase text-primary tracking-widest">Sede Principal</p>}
                                    </div>
                                </div>
                                <MapPinned className="w-4 h-4 text-muted-foreground shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
