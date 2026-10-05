import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
}

// Evita la pantalla en blanco: si un componente lanza un error al renderizar,
// se muestra un mensaje con opción de recargar en vez de tumbar toda la app.
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
    state: ErrorBoundaryState = { hasError: false };

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
                <div className="w-full max-w-md bg-card border-2 rounded-[2rem] p-10 text-center space-y-6 shadow-2xl">
                    <p className="text-primary font-black text-xs uppercase tracking-[0.4em]">Asiste360</p>
                    <h1 className="text-2xl font-black">Algo salió mal</h1>
                    <p className="text-sm text-muted-foreground">
                        Ocurrió un error inesperado al mostrar esta pantalla. Tus datos no se perdieron.
                        Recarga la página para continuar.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest"
                    >
                        Recargar
                    </button>
                </div>
            </div>
        );
    }
}
