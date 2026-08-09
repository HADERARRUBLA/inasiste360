import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, DocType } from '../types';
import { X, Save, Upload, FileText, Trash2, Download, User2 } from 'lucide-react';
import { showToast } from '../lib/toastStore';

interface EmployeeHrFolderProps {
    profile: Profile;
    organizationId: string;
    currentProfileId: string | null;
    onClose: () => void;
}

const MARITAL_STATUS_OPTIONS = ['Soltero(a)', 'Casado(a)', 'Unión Libre', 'Divorciado(a)', 'Viudo(a)'];
const EDUCATION_LEVEL_OPTIONS = ['Primaria', 'Bachillerato', 'Técnico', 'Tecnólogo', 'Profesional', 'Especialización', 'Maestría', 'Doctorado'];

const DOC_TYPE_LABELS: Record<DocType, string> = {
    hoja_de_vida: 'Hoja de Vida',
    otro: 'Otro Documento'
};

export const EmployeeHrFolder: React.FC<EmployeeHrFolderProps> = ({ profile, organizationId, currentProfileId, onClose }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [documents, setDocuments] = useState<any[]>([]);
    const [uploadDocType, setUploadDocType] = useState<DocType>('otro');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [hrForm, setHrForm] = useState({
        hire_date: '',
        marital_status: '',
        children_count: '',
        education_level: '',
        eps: '',
        arl: '',
        compensation_fund: '',
        pension_fund: ''
    });

    useEffect(() => {
        fetchAll();
    }, [profile.id]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const { data: hr, error: hrError } = await supabase
                .from('InA_employee_hr_profile')
                .select('*')
                .eq('profile_id', profile.id)
                .maybeSingle();
            if (hrError) throw hrError;
            if (hr) {
                setHrForm({
                    hire_date: hr.hire_date || '',
                    marital_status: hr.marital_status || '',
                    children_count: hr.children_count?.toString() || '',
                    education_level: hr.education_level || '',
                    eps: hr.eps || '',
                    arl: hr.arl || '',
                    compensation_fund: hr.compensation_fund || '',
                    pension_fund: hr.pension_fund || ''
                });
            }

            const { data: docs, error: docsError } = await supabase
                .from('InA_employee_documents')
                .select('*')
                .eq('profile_id', profile.id)
                .order('uploaded_at', { ascending: false });
            if (docsError) throw docsError;
            setDocuments(docs || []);
        } catch (err: any) {
            console.error('Error cargando la carpeta del empleado:', err);
            showToast('Error cargando la carpeta: ' + err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveHr = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { error } = await supabase.from('InA_employee_hr_profile').upsert([{
                profile_id: profile.id,
                hire_date: hrForm.hire_date || null,
                marital_status: hrForm.marital_status || null,
                children_count: hrForm.children_count ? parseInt(hrForm.children_count) : null,
                education_level: hrForm.education_level || null,
                eps: hrForm.eps || null,
                arl: hrForm.arl || null,
                compensation_fund: hrForm.compensation_fund || null,
                pension_fund: hrForm.pension_fund || null,
                updated_at: new Date().toISOString()
            }], { onConflict: 'profile_id' });
            if (error) throw error;
            showToast('Datos guardados con éxito.', 'success');
        } catch (err: any) {
            console.error('Error guardando datos HR:', err);
            showToast('Error al guardar: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const path = `${organizationId}/${profile.id}/${Date.now()}-${file.name}`;
            const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, file);
            if (uploadError) throw uploadError;

            const { error: insertError } = await supabase.from('InA_employee_documents').insert([{
                profile_id: profile.id,
                doc_type: uploadDocType,
                file_name: file.name,
                storage_path: path,
                uploaded_by: currentProfileId
            }]);
            if (insertError) throw insertError;

            showToast('Documento subido con éxito.', 'success');
            fetchAll();
        } catch (err: any) {
            console.error('Error subiendo documento:', err);
            showToast('Error al subir el documento: ' + err.message, 'error');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleViewDocument = async (doc: any) => {
        try {
            const { data, error } = await supabase.storage.from('employee-documents').createSignedUrl(doc.storage_path, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        } catch (err: any) {
            showToast('Error generando el enlace: ' + err.message, 'error');
        }
    };

    const handleDeleteDocument = async (doc: any) => {
        if (!confirm(`¿Eliminar "${doc.file_name}"? Esta acción no se puede deshacer.`)) return;
        try {
            await supabase.storage.from('employee-documents').remove([doc.storage_path]);
            const { error } = await supabase.from('InA_employee_documents').delete().eq('id', doc.id);
            if (error) throw error;
            fetchAll();
        } catch (err: any) {
            showToast('Error al eliminar: ' + err.message, 'error');
        }
    };

    const resume = documents.find(d => d.doc_type === 'hoja_de_vida');
    const otherDocs = documents.filter(d => d.doc_type !== 'hoja_de_vida');

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-8">
            <div className="bg-card w-full max-w-3xl max-h-[90vh] rounded-[2.5rem] border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in slide-in-from-bottom-8 duration-300">
                <div className="p-8 border-b bg-muted/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border shadow-inner">
                            {profile.profile_photo ? (
                                <img src={profile.profile_photo} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <User2 className="w-6 h-6 text-muted-foreground" />
                            )}
                        </div>
                        <div>
                            <h3 className="text-xl font-black uppercase italic tracking-tight">{profile.full_name}</h3>
                            <p className="text-xs text-muted-foreground font-bold font-mono">{profile.national_id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    {loading ? (
                        <div className="flex flex-col items-center gap-4 py-16 animate-pulse">
                            <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cargando carpeta...</p>
                        </div>
                    ) : (
                        <>
                            <div>
                                <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Datos Laborales y Afiliaciones</h4>
                                <form onSubmit={handleSaveHr} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Fecha de Ingreso</label>
                                        <input type="date" value={hrForm.hire_date} onChange={e => setHrForm({ ...hrForm, hire_date: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Estado Civil</label>
                                        <select value={hrForm.marital_status} onChange={e => setHrForm({ ...hrForm, marital_status: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm">
                                            <option value="">Sin especificar</option>
                                            {MARITAL_STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Hijos</label>
                                        <input type="number" min={0} value={hrForm.children_count} onChange={e => setHrForm({ ...hrForm, children_count: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Nivel de Estudios</label>
                                        <select value={hrForm.education_level} onChange={e => setHrForm({ ...hrForm, education_level: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm">
                                            <option value="">Sin especificar</option>
                                            {EDUCATION_LEVEL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">EPS</label>
                                        <input type="text" value={hrForm.eps} onChange={e => setHrForm({ ...hrForm, eps: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" placeholder="Ej: Sura, Nueva EPS..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">ARL</label>
                                        <input type="text" value={hrForm.arl} onChange={e => setHrForm({ ...hrForm, arl: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" placeholder="Ej: Sura, Positiva..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Caja de Compensación</label>
                                        <input type="text" value={hrForm.compensation_fund} onChange={e => setHrForm({ ...hrForm, compensation_fund: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" placeholder="Ej: Comfama, Comfenalco..." />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest pl-1">Fondo de Pensión</label>
                                        <input type="text" value={hrForm.pension_fund} onChange={e => setHrForm({ ...hrForm, pension_fund: e.target.value })}
                                            className="w-full px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-sm" placeholder="Ej: Porvenir, Colpensiones..." />
                                    </div>
                                    <div className="md:col-span-2 flex justify-end">
                                        <button type="submit" disabled={saving}
                                            className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : 'Guardar Datos'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div>
                                <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-4">Documentos</h4>

                                <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/10 border-2 border-dashed rounded-2xl mb-4">
                                    <select value={uploadDocType} onChange={e => setUploadDocType(e.target.value as DocType)}
                                        className="px-4 py-2.5 border rounded-xl bg-background outline-none focus:border-primary font-bold text-xs uppercase">
                                        <option value="hoja_de_vida">Hoja de Vida</option>
                                        <option value="otro">Otro Documento</option>
                                    </select>
                                    <input ref={fileInputRef} type="file" onChange={handleUploadDocument} accept=".pdf,.doc,.docx,image/*" className="hidden" id="doc-upload-input" disabled={uploading} />
                                    <label htmlFor="doc-upload-input"
                                        className={`flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-black text-[10px] uppercase tracking-widest cursor-pointer hover:shadow-lg transition-all active:scale-95 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                        <Upload className="w-4 h-4" /> {uploading ? 'Subiendo...' : 'Subir Documento'}
                                    </label>
                                    <span className="text-[10px] text-muted-foreground font-bold uppercase">PDF, Word o imagen — máx. 15MB</span>
                                </div>

                                {resume && (
                                    <div className="flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/10 rounded-2xl mb-3">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-primary" />
                                            <div>
                                                <p className="font-black text-sm">{resume.file_name}</p>
                                                <p className="text-[9px] font-black uppercase text-primary tracking-widest">Hoja de Vida</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleViewDocument(resume)} className="p-2.5 bg-white border shadow-sm rounded-xl text-primary hover:bg-primary hover:text-white transition-all"><Download className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteDocument(resume)} className="p-2.5 bg-red-50 border border-red-100 shadow-sm rounded-xl text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                )}

                                {otherDocs.length === 0 && !resume ? (
                                    <p className="text-center text-muted-foreground text-xs font-black uppercase tracking-widest opacity-30 italic py-8">Sin documentos cargados todavía</p>
                                ) : otherDocs.map(doc => (
                                    <div key={doc.id} className="flex items-center justify-between p-4 bg-muted/10 border rounded-2xl mb-3">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-5 h-5 text-muted-foreground" />
                                            <div>
                                                <p className="font-black text-sm">{doc.file_name}</p>
                                                <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{DOC_TYPE_LABELS[doc.doc_type as DocType]}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleViewDocument(doc)} className="p-2.5 bg-white border shadow-sm rounded-xl text-primary hover:bg-primary hover:text-white transition-all"><Download className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteDocument(doc)} className="p-2.5 bg-red-50 border border-red-100 shadow-sm rounded-xl text-destructive hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
