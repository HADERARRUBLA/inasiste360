import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { UserPlus, Pencil, Trash2, X, Save, Camera, CheckCircle2 } from 'lucide-react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

interface EmployeeManagementProps {
    companyId: string | null;
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ companyId }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [faceCaptures, setFaceCaptures] = useState<number[][]>([]);
    const webcamRef = useRef<Webcam>(null);

    // Form state
    const [formData, setFormData] = useState({
        full_name: '',
        national_id: '',
        phone_number: '',
        pin_code: '',
        hourly_rate_base: 0,
        hourly_rate_extra_day: 0,
        hourly_rate_extra_night: 0,
        hourly_rate_sunday_holiday: 0,
        hourly_rate_sunday_holiday_extra_day: 0,
        hourly_rate_sunday_holiday_extra_night: 0,
        use_custom_schedule: false,
        work_start_time: '08:00',
        work_end_time: '17:00',
        face_vector: null as number[] | null,
        profile_photo: null as string | null,
        company_id: ''
    });

    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                ]);
                setIsModelLoaded(true);
            } catch (e) {
                console.error('Error cargando modelos faciales', e);
            }
        };
        loadModels();
        fetchInitialData();
    }, [companyId]);

    const fetchInitialData = async () => {
        if (!companyId) return;
        setFormData(prev => ({ ...prev, company_id: companyId }));
        await fetchProfiles(companyId);
    };

    const fetchProfiles = async (cid?: string | null) => {
        const targetId = cid || companyId || formData.company_id;
        if (!targetId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('company_id', targetId as string)
                .order('full_name');
            setProfiles(data || []);
        } catch (err) {
            console.error('Error fetching profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (profile: Profile) => {
        setFormData({
            full_name: profile.full_name,
            national_id: profile.national_id || '',
            phone_number: profile.phone_number || '',
            pin_code: profile.pin_code || '',
            hourly_rate_base: profile.hourly_rate_base || 0,
            hourly_rate_extra_day: profile.hourly_rate_extra_day || 0,
            hourly_rate_extra_night: profile.hourly_rate_extra_night || 0,
            hourly_rate_sunday_holiday: profile.hourly_rate_sunday_holiday || 0,
            hourly_rate_sunday_holiday_extra_day: profile.hourly_rate_sunday_holiday_extra_day || 0,
            hourly_rate_sunday_holiday_extra_night: profile.hourly_rate_sunday_holiday_extra_night || 0,
            use_custom_schedule: profile.use_custom_schedule || false,
            work_start_time: profile.work_start_time || '08:00',
            work_end_time: profile.work_end_time || '17:00',
            face_vector: profile.face_vector || null,
            profile_photo: profile.profile_photo || null,
            company_id: profile.company_id || ''
        });
        setEditingId(profile.id);
        setFaceCaptures([]);
        setIsAdding(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCaptureFace = async () => {
        if (webcamRef.current && isModelLoaded) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                const img = new Image();
                img.src = imageSrc;
                await new Promise(resolve => img.onload = resolve);

                const detections = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();

                if (detections) {
                    const newCaptures = [...faceCaptures, Array.from(detections.descriptor)];
                    setFaceCaptures(newCaptures);

                    if (newCaptures.length >= 3) {
                        // Average the vectors
                        const avgVector = newCaptures[0].map((_, i) =>
                            newCaptures.reduce((acc, cap) => acc + cap[i], 0) / newCaptures.length
                        );
                        setFormData({ ...formData, face_vector: avgVector });
                        setIsCameraActive(false);
                    }
                } else {
                    alert('No se detectó rostro. Intenta de nuevo.');
                }
            }
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        let error;
        const submitData = { ...formData };

        if (editingId) {
            const { error: err } = await supabase
                .from('profiles')
                .update(submitData)
                .eq('id', editingId);
            error = err;
        } else {
            const { error: err } = await supabase.from('profiles').insert([submitData]);
            error = err;
        }

        if (!error) {
            setIsAdding(false);
            setEditingId(null);
            setFaceCaptures([]);
            setFormData(prev => ({
                ...prev,
                full_name: '',
                national_id: '',
                phone_number: '',
                pin_code: '',
                hourly_rate_base: 0,
                hourly_rate_extra_day: 0,
                hourly_rate_extra_night: 0,
                hourly_rate_sunday_holiday: 0,
                hourly_rate_sunday_holiday_extra_day: 0,
                hourly_rate_sunday_holiday_extra_night: 0,
                use_custom_schedule: false,
                work_start_time: '08:00',
                work_end_time: '17:00',
                face_vector: null,
                profile_photo: null
            }));
            fetchProfiles();
        } else {
            alert('Error al guardar: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este empleado?')) {
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (!error) fetchProfiles();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Directorio de Colaboradores</h2>
                <button
                    onClick={() => {
                        setIsAdding(!isAdding);
                        setEditingId(null);
                        setFaceCaptures([]);
                        setIsCameraActive(false);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
                >
                    {isAdding ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isAdding ? 'Cancelar' : 'Agregar Colaborador'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-card border rounded-[2rem] p-8 shadow-xl animate-in fade-in slide-in-from-top-6 duration-500 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/20" />
                    <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Nombre Completo</label>
                            <input
                                required
                                value={formData.full_name}
                                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                                placeholder="Ej: Sofía Arrubla"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Identificación (Cédula)</label>
                            <input
                                required
                                value={formData.national_id}
                                onChange={e => setFormData({ ...formData, national_id: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                                placeholder="Ej: 1010123456"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Código PIN (4-6 dígitos)</label>
                            <input
                                required
                                type="password"
                                maxLength={6}
                                value={formData.pin_code}
                                onChange={e => setFormData({ ...formData, pin_code: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-2xl tracking-[0.3em] font-black"
                                placeholder="••••"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase text-muted-foreground tracking-widest pl-1">Teléfono</label>
                            <input
                                value={formData.phone_number}
                                onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                                className="w-full px-5 py-3.5 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 outline-none transition-all font-bold"
                                placeholder="Ej: 3001234567"
                            />
                        </div>

                        {/* Ficha de Nómina - Valores de Hora */}
                        <div className="md:col-span-2 p-8 bg-primary/5 border rounded-[2rem] space-y-6">
                            <div className="flex items-center justify-between border-b pb-4 border-primary/10">
                                <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Save className="w-4 h-4" /> Configuración de Valores de Nómina
                                </h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Hora Ordinaria ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_base}
                                        onChange={e => setFormData({ ...formData, hourly_rate_base: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Extra Diurna ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_extra_day}
                                        onChange={e => setFormData({ ...formData, hourly_rate_extra_day: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Extra Nocturna ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_extra_night}
                                        onChange={e => setFormData({ ...formData, hourly_rate_extra_night: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Dominical/Festivo ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_sunday_holiday}
                                        onChange={e => setFormData({ ...formData, hourly_rate_sunday_holiday: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Extra Dom. Diurna ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_sunday_holiday_extra_day}
                                        onChange={e => setFormData({ ...formData, hourly_rate_sunday_holiday_extra_day: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Extra Dom. Nocturna ($)</label>
                                    <input
                                        type="number"
                                        value={formData.hourly_rate_sunday_holiday_extra_night}
                                        onChange={e => setFormData({ ...formData, hourly_rate_sunday_holiday_extra_night: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-5 py-3 border rounded-xl bg-background outline-none focus:border-primary font-bold"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Gestión de Jornada */}
                        <div className="md:col-span-2 p-8 bg-muted/10 border-2 border-primary/5 rounded-[2rem] space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-primary" /> Definición de Jornada Laboral
                                </h4>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="customSchedule"
                                        className="w-4 h-4 accent-primary"
                                        checked={formData.use_custom_schedule}
                                        onChange={e => setFormData({ ...formData, use_custom_schedule: e.target.checked })}
                                    />
                                    <label htmlFor="customSchedule" className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer">Usar Horario Personalizado</label>
                                </div>
                            </div>

                            {formData.use_custom_schedule ? (
                                <div className="grid grid-cols-2 gap-8 animate-in fade-in zoom-in duration-300">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Hora inicio Jornada</label>
                                        <input
                                            type="time"
                                            value={formData.work_start_time}
                                            onChange={e => setFormData({ ...formData, work_start_time: e.target.value })}
                                            className="w-full px-5 py-4 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 transition-all font-black text-xl"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Hora fin Jornada</label>
                                        <input
                                            type="time"
                                            value={formData.work_end_time}
                                            onChange={e => setFormData({ ...formData, work_end_time: e.target.value })}
                                            className="w-full px-5 py-4 border rounded-2xl bg-background focus:ring-4 focus:ring-primary/10 transition-all font-black text-xl"
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="p-6 bg-white border rounded-2xl text-center border-dashed">
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest italic">Este colaborador sigue el horario estándar definido para la sede.</p>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2 p-8 bg-muted/20 border-2 border-dashed rounded-3xl flex flex-col items-center gap-6">
                            <div className="text-center">
                                <h4 className="text-sm font-black flex items-center justify-center gap-2 uppercase tracking-widest text-primary">
                                    <Camera className="w-5 h-5" /> Escaneo Biométrico de Seguridad
                                </h4>
                                <p className="text-[10px] text-muted-foreground font-bold mt-1 uppercase tracking-tighter">Captura 3 ángulos del rostro para máxima precisión (Frente, Izquierda, Derecha)</p>
                            </div>

                            {isCameraActive ? (
                                <div className="space-y-4 flex flex-col items-center">
                                    <div className="relative rounded-[2.5rem] overflow-hidden border-8 border-primary/20 aspect-square w-64 bg-black shadow-2xl">
                                        <Webcam
                                            audio={false}
                                            ref={webcamRef}
                                            screenshotFormat="image/jpeg"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 border-[20px] border-black/40 pointer-events-none">
                                            <div className="w-full h-full border border-white/30 rounded-full" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={`w-3 h-3 rounded-full ${faceCaptures.length >= i ? 'bg-green-500' : 'bg-muted'}`} />
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCaptureFace}
                                        className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-full font-black text-sm shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
                                    >
                                        Capturar Toma {faceCaptures.length + 1} de 3
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    {formData.face_vector ? (
                                        <div className="flex items-center gap-3 text-green-700 font-black bg-green-50 px-6 py-3 rounded-2xl border-2 border-green-200 uppercase text-xs tracking-widest shadow-inner">
                                            <CheckCircle2 className="w-6 h-6" /> Biometría Digitalizada con Éxito
                                        </div>
                                    ) : (
                                        <p className="text-xs text-muted-foreground text-center max-w-xs font-medium">Digitaliza tu rostro para permitir el acceso por reconocimiento facial en el terminal.</p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFaceCaptures([]);
                                            setIsCameraActive(true);
                                        }}
                                        className="flex items-center gap-2 px-6 py-2.5 border-2 border-primary/30 text-primary rounded-xl font-black text-xs uppercase hover:bg-primary hover:text-white transition-all shadow-sm"
                                    >
                                        {formData.face_vector ? 'Re-escanear Rostro' : 'Iniciar Escaneo Facial'}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                            <button
                                type="submit"
                                disabled={!formData.face_vector && !editingId}
                                className="flex items-center gap-3 px-12 py-5 bg-primary text-primary-foreground rounded-[1.5rem] font-black text-xl shadow-2xl shadow-primary/30 hover:scale-[1.05] hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-50 disabled:scale-100"
                            >
                                <Save className="w-6 h-6" /> {editingId ? 'ACTUALIZAR DATOS' : 'REGISTRAR COLABORADOR'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-card border rounded-[2.5rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-6 duration-700">
                <table className="w-full text-left">
                    <thead className="bg-muted/30 text-muted-foreground text-[10px] font-black uppercase tracking-widest">
                        <tr>
                            <th className="px-8 py-6">Colaborador</th>
                            <th className="px-8 py-6">Cédula</th>
                            <th className="px-8 py-6 text-center">Bio-Status</th>
                            <th className="px-8 py-6">PIN</th>
                            <th className="px-8 py-6 text-right">Gestión</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                        {loading ? (
                            <tr><td colSpan={5} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-4 animate-pulse">
                                    <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                                    <p className="font-black text-xs uppercase tracking-widest text-muted-foreground">Sincronizando Base de Datos...</p>
                                </div>
                            </td></tr>
                        ) : profiles.length === 0 ? (
                            <tr><td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-20 italic">Zona vacía: No hay colaboradores registrados.</td></tr>
                        ) : profiles.map(profile => (
                            <tr key={profile.id} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-8 py-6">
                                    <div className="flex items-center gap-4">
                                        {profile.profile_photo ? (
                                            <img src={profile.profile_photo} className="w-12 h-12 rounded-2xl object-cover shadow-inner border border-primary/10" alt="Avatar" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-black text-xl shadow-inner border border-primary/10">
                                                {profile.full_name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-black text-foreground text-base tracking-tight leading-tight">{profile.full_name}</p>
                                            <p className="text-xs text-muted-foreground font-bold">{profile.phone_number || 'Sin teléfono'}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-6 font-mono font-black text-muted-foreground tracking-widest">{profile.national_id || '---'}</td>
                                <td className="px-8 py-6 text-center">
                                    {profile.face_vector ? (
                                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase ring-2 ring-green-600/10 shadow-sm">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> BIO-ID ACTIVO
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-black uppercase ring-2 ring-amber-600/10 shadow-sm">
                                            <Camera className="w-3.5 h-3.5" /> FALTA ROSTRO
                                        </span>
                                    )}
                                </td>
                                <td className="px-8 py-6">
                                    <span className="bg-muted px-3 py-1.5 rounded-xl font-mono font-black tracking-[0.2em] text-xs text-muted-foreground border">••••</span>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button
                                            onClick={() => handleEdit(profile)}
                                            className="p-3 bg-white/80 backdrop-blur-sm border shadow-sm rounded-2xl text-primary hover:bg-primary hover:text-white transition-all hover:scale-110 active:scale-90"
                                        >
                                            <Pencil className="w-4.5 h-4.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(profile.id)}
                                            className="p-3 bg-red-50 border border-red-100 shadow-sm rounded-2xl text-destructive hover:bg-destructive hover:text-white transition-all hover:scale-110 active:scale-90"
                                        >
                                            <Trash2 className="w-4.5 h-4.5" />
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
