export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
    id: number;
    message: string;
    type: ToastType;
}

let toasts: ToastItem[] = [];
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let nextId = 1;

function emit() {
    listeners.forEach(listener => listener(toasts));
}

export function subscribeToasts(listener: (toasts: ToastItem[]) => void) {
    listeners.push(listener);
    listener(toasts);
    return () => {
        listeners = listeners.filter(l => l !== listener);
    };
}

export function showToast(message: string, type: ToastType = 'info', durationMs: number = 5000) {
    const id = nextId++;
    toasts = [...toasts, { id, message, type }];
    emit();
    setTimeout(() => {
        toasts = toasts.filter(t => t.id !== id);
        emit();
    }, durationMs);
}

export function dismissToast(id: number) {
    toasts = toasts.filter(t => t.id !== id);
    emit();
}
