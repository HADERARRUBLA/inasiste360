import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { subscribeToasts, dismissToast, type ToastItem } from '../lib/toastStore';

export const ToastContainer: React.FC = () => {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => subscribeToasts(setToasts), []);

    if (toasts.length === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 max-w-sm w-[calc(100%-3rem)] sm:w-full">
            {toasts.map(t => (
                <div
                    key={t.id}
                    className={`flex items-start gap-3 p-4 rounded-2xl border shadow-2xl bg-card text-foreground animate-in slide-in-from-bottom-4 fade-in duration-300 ${t.type === 'success' ? 'border-green-500/30' : t.type === 'error' ? 'border-destructive/30' : 'border-primary/30'
                        }`}
                >
                    {t.type === 'success' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    ) : t.type === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    ) : (
                        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    )}
                    <p className="text-sm font-bold flex-1">{t.message}</p>
                    <button
                        onClick={() => dismissToast(t.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Cerrar notificación"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
};
