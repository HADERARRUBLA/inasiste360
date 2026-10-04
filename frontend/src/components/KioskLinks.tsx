import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, ExternalLink, Download, Tablet, Smartphone } from 'lucide-react';
import { buildKioskLink, buildMobileKioskLink } from '../utils/kioskLink';
import { showToast } from '../lib/toastStore';

interface KioskLinksProps {
    companyId: string;
    companyName?: string;
}

interface LinkCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    url: string;
    fileName: string;
}

const LinkCard: React.FC<LinkCardProps> = ({ icon, title, description, url, fileName }) => {
    const qrRef = useRef<HTMLDivElement>(null);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            showToast('Enlace copiado.', 'success');
        } catch {
            showToast('No se pudo copiar. Selecciona el enlace y cópialo manualmente.', 'error');
        }
    };

    const downloadQr = () => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `${fileName}.png`;
        a.click();
    };

    return (
        <div className="bg-card border rounded-[2.5rem] p-8 shadow-xl space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">{icon}</div>
                <div>
                    <h3 className="font-black uppercase tracking-tight text-foreground">{title}</h3>
                    <p className="text-xs text-muted-foreground font-bold">{description}</p>
                </div>
            </div>

            <input
                readOnly
                value={url}
                onFocus={e => e.currentTarget.select()}
                className="w-full px-4 py-3 bg-muted/30 border-2 border-muted rounded-2xl text-xs font-mono outline-none"
            />

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={copy}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                    <Copy className="w-4 h-4" /> Copiar enlace
                </button>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 border-2 border-muted rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                >
                    <ExternalLink className="w-4 h-4" /> Abrir
                </a>
            </div>

            <div className="flex items-center gap-5">
                <div ref={qrRef} className="p-3 bg-white rounded-2xl border shadow-sm">
                    <QRCodeCanvas value={url} size={132} marginSize={1} />
                </div>
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-bold">
                        Escanea el código con la cámara del celular para abrirlo directo.
                    </p>
                    <button
                        type="button"
                        onClick={downloadQr}
                        className="flex items-center gap-2 px-4 py-2.5 border-2 border-muted rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-all"
                    >
                        <Download className="w-4 h-4" /> Descargar QR
                    </button>
                </div>
            </div>
        </div>
    );
};

export const KioskLinks: React.FC<KioskLinksProps> = ({ companyId, companyName }) => {
    const origin = window.location.origin;
    const slug = (companyName || 'sede').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    return (
        <section className="space-y-4">
            <div>
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight italic">Enlaces de Kiosko</h3>
                <p className="text-muted-foreground font-bold text-sm">
                    Abre el Kiosko directo, sin entrar como administrador. Ideal para dejar un celular o tablet listo en la sede.
                </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LinkCard
                    icon={<Tablet className="w-5 h-5" />}
                    title={`Kiosko de ${companyName || 'esta sede'}`}
                    description="Equipo fijo de la sede: queda siempre en esta sede."
                    url={buildKioskLink(origin, companyId)}
                    fileName={`kiosko-${slug}`}
                />
                <LinkCard
                    icon={<Smartphone className="w-5 h-5" />}
                    title="Marcar desde mi celular"
                    description="Para empleados con varias sedes: se identifican con cédula y PIN y eligen su sede."
                    url={buildMobileKioskLink(origin)}
                    fileName="kiosko-celular"
                />
            </div>
        </section>
    );
};
