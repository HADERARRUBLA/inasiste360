import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types';
import { UserPlus, Pencil, Trash2, X, Save, Camera, CheckCircle2, FileUp, FileDown, Search } from 'lucide-react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import * as XLSX from 'xlsx';

interface EmployeeManagementProps {
    companyId: string | null;
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

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ companyId }) => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [faceCaptures, setFaceCaptures] = useState<number[][]>([]);
    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

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
        work_schedule: { ...DEFAULT_SCHEDULE } as any,
        face_vector: null as number[] | null,
        profile_photo: null as string | null,
        company_id: '',
        organization_id: null as string | null
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
        
        // Fetch company details to get organization_id
        const { data: comp } = await supabase
            .from('InA_companies')
            .select('organization_id')
            .eq('id', companyId)
            .single();
            
        setFormData(prev => ({ 
            ...prev, 
            company_id: companyId,
            organization_id: comp?.organization_id || null
        }));
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
            const { data, error } = await supabase
                .from('InA_profiles')
                .select('*')
                .eq('company_id', targetId as string)
                .order('full_name');
            if (error) throw error;
            setProfiles(data || []);
        } catch (err: any) {
            console.error('Error fetching profiles:', err);
            alert('Error cargando empleados: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredProfiles = profiles.filter(p => 
        p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.national_id?.includes(searchTerm) ||
        p.phone_number?.includes(searchTerm)
    );

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
            work_schedule: { ...DEFAULT_SCHEDULE, ...(profile.work_schedule || {}) },
            face_vector: profile.face_vector || null,
            profile_photo: profile.profile_photo || null,
            company_id: profile.company_id || '',
            organization_id: profile.organization_id || null
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

                    // Also save the photo on the first capture if not already set
                    if (newCaptures.length === 1) {
                        setFormData(prev => ({ ...prev, profile_photo: imageSrc }));
                    }

                    if (newCaptures.length >= 3) {
                        // Average the vectors
                        const avgVector = newCaptures[0].map((_, i) =>
                            newCaptures.reduce((acc, cap) => acc + cap[i], 0) / newCaptures.length
                        );
                        setFormData(prev => ({ ...prev, face_vector: avgVector }));
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

        if (!formData.company_id) {
            alert('Error: No hay sede seleccionada.');
            return;
        }

        let error;
        // Clean data - ensure we don't send any derived or nested objects if they accidentally got in
        const payload = { ...formData };
        
        console.log('Guardando empleado con:', { ...payload, profile_photo: payload.profile_photo ? 'BASE64_IMAGE' : null });

        if (editingId) {
            const { error: err } = await supabase
                .from('InA_profiles')
                .update(payload)
                .eq('id', editingId);
            error = err;
        } else {
            const { error: err } = await supabase.from('InA_profiles').insert([payload]);
            error = err;
        }

        if (!error) {
            console.log('Empleado guardado exitosamente');
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
                work_schedule: { ...DEFAULT_SCHEDULE },
                face_vector: null,
                profile_photo: null
            }));
            fetchProfiles();
        } else {
            console.error('Error de Supabase al guardar:', error);
            alert('Error crítico al guardar: ' + error.message + '\nDetalles: ' + (error.details || 'Ver consola'));
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('¿Estás seguro de eliminar este empleado?')) {
            const { error } = await supabase.from('InA_profiles').delete().eq('id', id);
            if (!error) fetchProfiles();
        }
    };

    const handleExportExcel = () => {
        const dataToExport = profiles.map(p => ({
            'Nombre Completo': p.full_name,
            'Identificacion': p.national_id,
            'PIN de Acceso': p.pin_code,
            'Telefono': p.phone_number,
            'Tarifa Base': p.hourly_rate_base,
            'Extra Diurna': p.hourly_rate_extra_day || 0,
            'Extra Nocturna': p.hourly_rate_extra_night || 0,
            'Dominical': p.hourly_rate_sunday_holiday || 0,
            'Extra Dom Diurna': p.hourly_rate_sunday_holiday_extra_day || 0,
            'Extra Dom Nocturna': p.hourly_rate_sunday_holiday_extra_night || 0
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Empleados');
        XLSX.writeFile(wb, `Empleados_Asiste360_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !companyId || !formData.organization_id) {
            alert('Por favor asegúrate de tener una sede activa y seleccionar un archivo válido.');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                if (data.length === 0) {
                    alert('El archivo está vacío.');
                    return;
                }

                // Map and Validate
                const profilesToImport = data.map(item => ({
                    full_name: item['Nombre Completo'] || item['Nombre'] || item['full_name'],
                    national_id: String(item['Identificacion'] || item['ID'] || item['national_id']),
                    pin_code: String(item['PIN de Acceso'] || item['PIN'] || item['pin_code']),
                    phone_number: String(item['Telefono'] || item['phone_number'] || ''),
                    hourly_rate_base: parseFloat(item['Tarifa Base'] || item['hourly_rate_base'] || 0),
                    hourly_rate_extra_day: parseFloat(item['Extra Diurna'] || item['hourly_rate_extra_day'] || 0),
                    hourly_rate_extra_night: parseFloat(item['Extra Nocturna'] || item['hourly_rate_extra_night'] || 0),
                    hourly_rate_sunday_holiday: parseFloat(item['Dominical'] || item['hourly_rate_sunday_holiday'] || 0),
                    hourly_rate_sunday_holiday_extra_day: parseFloat(item['Extra Dom Diurna'] || item['hourly_rate_sunday_holiday_extra_day'] || 0),
                    hourly_rate_sunday_holiday_extra_night: parseFloat(item['Extra Dom Nocturna'] || item['hourly_rate_sunday_holiday_extra_night'] || 0),
                    company_id: companyId,
                    organization_id: formData.organization_id,
                    role: 'employee',
                    is_active: true
                }));

                // Basic validation for required fields
                const invalid = profilesToImport.find(p => !p.full_name || !p.national_id || !p.pin_code);
                if (invalid) {
                    alert('Hay registros incompletos (Nombre, ID o PIN faltantes). Por favor verifica el Excel.');
                    return;
                }

                if (confirm(`¿Deseas importar ${profilesToImport.length} colaboradores? Los IDs existentes se actualizarán.`)) {
                    setLoading(true);
                    const { error } = await supabase
                        .from('InA_profiles')
                        .upsert(profilesToImport, { onConflict: 'national_id' });

                    if (error) throw error;
                    
                    alert('Importación completada con éxito.');
                    fetchProfiles();
                }
            } catch (err: any) {
                console.error('Error importing:', err);
                alert('Error al procesar el Excel: ' + err.message);
            } finally {
                setLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Directorio de Colaboradores</h2>
                <div className="flex items-center gap-4">
                    <SearchInput value={searchTerm} onChange={setSearchTerm} />
                    <div className="flex items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                        accept=".xlsx, .xls"
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-green-50 text-green-700 border border-green-100 rounded-xl font-bold hover:bg-green-100 transition-all active:scale-95"
                    >
                        <FileUp className="w-4 h-4" /> Importar Excel
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl font-bold hover:bg-blue-100 transition-all active:scale-95"
                    >
                        <FileDown className="w-4 h-4" /> Exportar Lista
                    </button>
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
            </div>
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
                                <div className="space-y-3 animate-in fade-in zoom-in duration-300">
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
                        ) : filteredProfiles.length === 0 ? (
                            <tr><td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-black uppercase text-xs tracking-widest opacity-20 italic">
                                {searchTerm ? `No se encontró: "${searchTerm}"` : 'Zona vacía: No hay colaboradores registrados.'}
                            </td></tr>
                        ) : filteredProfiles.map(profile => (
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

const SearchInput = ({ value, onChange }: { value: string, onChange: (v: string) => void }) => (
    <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        </div>
        <input
            type="text"
            className="block w-64 pl-11 pr-4 py-2.5 bg-muted/30 border border-transparent focus:bg-background focus:border-primary/20 focus:ring-4 focus:ring-primary/10 rounded-xl text-xs font-bold transition-all placeholder:font-black placeholder:uppercase placeholder:tracking-widest"
            placeholder="Buscar por nombre, ID..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);
