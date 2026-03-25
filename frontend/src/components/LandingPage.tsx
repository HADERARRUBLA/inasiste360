import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Zap, 
  Command, 
  Activity, 
  Lock, 
  History, 
  Bell, 
  Settings, 
  User, 
  TrendingUp, 
  Clock, 
  BarChart3, 
  Wallet, 
  ArrowRight, 
  CheckCircle2, 
  Fingerprint, 
  MapPin, 
  Calculator,
  Gavel,
  Verified,
  Cpu,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
type View = 'landing' | 'roi' | 'dashboard';

// --- Constants ---
const CTA_LINK = "https://crm.asiste360.com/v2/preview/6YoBukYdjXiIKKireSwI";

interface LandingPageProps { onLoginClick: () => void; }

const Logo = ({ size = "base" }: { size?: "base" | "large" }) => {
  const [error, setError] = useState(false);
  
  return (
    <div className={`relative flex flex-col items-center justify-center transition-all duration-700 ${size === 'large' ? 'w-80 h-80' : 'w-40 h-40 md:w-48 md:h-48'}`}>
      {/* Translucent white background for contrast */}
      <div className="absolute inset-4 bg-white/10 backdrop-blur-md rounded-full z-0 border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.08)]"></div>
      
      {/* Dynamic Halo - The 360 Rotation Ring */}
      <motion.div 
        className="absolute inset-0 border-t-2 border-primary/40 rounded-full z-10 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      
      {!error ? (
        <img 
          src="/logo_intelligence.png" 
          alt="ASISTE360 Logo" 
          className="w-full h-full object-contain relative z-20 p-4 drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
          onError={() => setError(true)}
        />
      ) : (
        <div className="relative z-20 flex flex-col items-center justify-center text-primary">
          <Shield className="w-24 h-24" />
        </div>
      )}
    </div>
  );
};

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const [view, setView] = useState<View>('landing');

  const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
      const handleScroll = () => setIsScrolled(window.scrollY > 20);
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-8 h-32 flex justify-between items-center ${isScrolled ? 'bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 shadow-2xl' : 'bg-transparent'}`}>
        <div className="flex items-center gap-10">
          <motion.div 
            className="flex items-center cursor-pointer"
            onClick={() => setView('landing')}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="relative w-28 h-28">
              <div className="absolute inset-2 bg-white/15 backdrop-blur-sm rounded-full z-0 border border-white/20 shadow-xl"></div>
               <motion.div 
                className="absolute inset-[-5%] border-t-2 border-primary/40 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <img src="/logo_intelligence.png" alt="Logo" className="w-full h-full object-contain relative z-10 p-4" />
            </div>
          </motion.div>
          <div className="hidden lg:flex items-center gap-10 ml-4">
            <button onClick={() => setView('landing')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'landing' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant/50 hover:text-on-surface'}`}>Inteligencia</button>
            <button onClick={() => setView('dashboard')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'dashboard' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant/50 hover:text-on-surface'}`}>Comando</button>
            <button onClick={() => setView('roi')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'roi' ? 'text-primary border-b-2 border-primary pb-1' : 'text-on-surface-variant/50 hover:text-on-surface'}`}>Motor de ROI</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onLoginClick} className="hidden sm:block text-on-surface-variant/60 font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] px-4 py-2 hover:text-primary transition-all">Acceso VIP</button>
          <button onClick={() => window.open(CTA_LINK, '_blank')} className="bg-[#0047ab] text-white px-8 py-3 rounded-md metallic-edge font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] hover:brightness-110 active:scale-95 transition-all shadow-xl">Detener Fugas de Nómina</button>
        </div>
      </nav>
    );
  };

  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'Comando', icon: Command },
      { id: 'analytics', label: 'Analítica', icon: Activity },
      { id: 'biometrics', label: 'Biometría', icon: Fingerprint },
      { id: 'vault', label: 'Bóveda', icon: Lock },
      { id: 'audit', label: 'Auditoría', icon: History },
    ];
    return (
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-72 bg-surface border-r border-outline-variant/10 flex-col z-40 pt-32 pb-8 shadow-2xl">
        <div className="px-8 mb-12 flex flex-col items-center gap-6">
          <div className="relative w-40 h-40">
            <div className="absolute inset-4 bg-white/10 backdrop-blur-sm rounded-full z-0 border border-white/20 shadow-2xl"></div>
            <motion.div 
               className="absolute inset-[-10%] border-t-2 border-primary/40 rounded-full"
               animate={{ rotate: 360 }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
            <img src="/logo_intelligence.png" alt="Logo" className="w-full h-full object-contain relative z-10 p-6" />
          </div>
          <div className="text-center">
            <div className="flex items-center gap-2 mb-1 justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
              <span className="text-on-surface font-bold font-sans uppercase tracking-widest text-[10px]">Control Soberano</span>
            </div>
            <span className="text-on-surface-variant/40 font-bold font-sans uppercase tracking-widest text-[9px]">Nodo IA Activo</span>
          </div>
        </div>
        <nav className="flex-1 space-y-2 px-6">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => item.id === 'dashboard' && setView('dashboard')} className={`w-full flex items-center gap-4 px-6 py-4 rounded transition-all group ${view === item.id ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-on-surface-variant/50 hover:bg-white/5 hover:text-on-surface'}`}>
              <item.icon className={`w-6 h-6 ${view === item.id ? 'text-primary' : 'text-on-surface-variant/50 group-hover:text-primary'}`} />
              <span className="font-sans uppercase tracking-widest text-[11px] font-bold">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="px-6 mt-auto">
          <button className="w-full py-5 bg-[#0047ab] text-white rounded-lg text-[11px] font-bold tracking-widest uppercase flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-95 shadow-xl shadow-blue-900/40">
            <Shield className="w-4 h-4" />
            Escaneo de Sistema
          </button>
        </div>
      </aside>
    );
  };

  const LandingView = () => (
    <div className="relative min-h-screen pt-20 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 point-cloud-overlay opacity-20 pointer-events-none"></div>
      <div className="container mx-auto px-8 relative z-10 flex flex-col lg:flex-row items-center gap-20 py-24">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="flex-1 space-y-10 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-primary">Nodo Soberano v4.0</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] text-on-surface">
            Mientras lees esto, el <span className="text-primary">5%</span> de tu nómina podría ser <span className="text-primary/60 italic">tiempo no laborado.</span>
          </h1>
          <p className="text-xl md:text-2xl text-on-surface-variant font-medium max-w-2xl leading-relaxed">Detén las fugas de nómina hoy con IA Biométrica y Geocercas de precisión quirúrgica.</p>
          <div className="flex flex-col sm:flex-row items-center gap-8 pt-4 justify-center lg:justify-start">
            <button onClick={() => window.open(CTA_LINK, '_blank')} className="w-full sm:w-auto px-12 py-6 bg-primary-container text-white rounded-md metallic-edge font-bold uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_15px_40px_rgba(0,71,171,0.4)]">Detener fugas de nómina hoy</button>
            <button onClick={onLoginClick} className="w-full sm:w-auto px-12 py-6 bg-surface-container-high border border-outline-variant/30 text-primary rounded-md font-bold uppercase tracking-widest text-sm hover:bg-surface-container-highest transition-all backdrop-blur-md">Acceso VIP</button>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="flex-1 relative w-full aspect-square max-w-[600px] flex items-center justify-center">
          <div className="relative w-full h-full rounded-2xl border border-primary/10 bg-surface-container-low/40 backdrop-blur-2xl overflow-hidden shadow-2xl p-4">
            <div className="absolute inset-0 point-cloud-overlay opacity-30"></div>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbGFzxPZ2YxNE9zcMX8VEfOQUAjlmrAgDcGT7Pk_hDxqVFQHlTteZE1rdwi7TpJXm__-oP5LyCA9uONh9ebiLmS50peQckcXezZui0990AAquwfhOInKbtDlftJmBu2PBUnnvica_FQizjZ6kYj1hlXVE2ECwXZy6mgudsuv2BfY9Zj6W_gzsxlnF8wlIiwAKkoMIXEnJS4lWTsAQXjYCTIuEKXTLTWmGuvaxOAZr581DHB7A2DJ831-0o4kJ7ZY3SmU69wo1ODhMs" alt="AI Face Scan" className="w-full h-full object-contain mix-blend-screen opacity-80" />
            <div className="absolute top-8 right-8 p-4 bg-surface-bright/60 backdrop-blur-xl border border-white/10 rounded-lg metallic-edge w-48 shadow-xl">
               <div className="flex justify-between items-start mb-4"><span className="text-[10px] uppercase tracking-tighter text-primary font-bold">Precisión del Nodo</span><span className="text-[10px] text-green-400 font-mono">99.9%</span></div>
               <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-primary" /></div>
            </div>
            <div className="absolute bottom-12 left-8 p-4 bg-surface-bright/60 backdrop-blur-xl border border-white/10 rounded-lg metallic-edge shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-md flex items-center justify-center"><Fingerprint className="w-6 h-6 text-primary" /></div>
              <div><p className="text-[10px] uppercase font-bold text-white/40 leading-none mb-1">Sujeto Identificado</p><p className="text-xs font-mono font-bold text-primary">ID: EJECUTIVO_774</p></div>
            </div>
            <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent z-20" />
          </div>
        </motion.div>
      </div>
      <section className="w-full py-24 bg-surface-container-lowest relative overflow-hidden">
        <div className="container mx-auto px-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-8 bg-surface-container-low border border-outline-variant/15 rounded-md hover:bg-surface-container transition-all group">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4 block">Recuperación de Nómina</span>
            <div className="text-5xl font-black text-on-surface mb-2 group-hover:text-primary transition-colors">-18.4%</div>
            <p className="text-on-surface-variant text-sm font-medium">Reducción inmediata en costos operativos de nómina tras la implementación de IA.</p>
          </div>
          <div className="p-8 bg-surface-container-low border border-outline-variant/15 rounded-md hover:bg-surface-container transition-all group">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4 block">Velocidad de Verificación</span>
            <div className="text-5xl font-black text-on-surface mb-2 group-hover:text-primary transition-colors">&lt;0.5s</div>
            <p className="text-on-surface-variant text-sm font-medium">Escaneo biométrico instantáneo que elimina el "buddy punching" sin fricción.</p>
          </div>
          <div className="p-8 bg-surface-container-low border border-outline-variant/15 rounded-md hover:bg-surface-container transition-all group">
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-on-surface-variant/40 mb-4 block">Tiempo de Despliegue</span>
            <div className="text-5xl font-black text-on-surface mb-2 group-hover:text-primary transition-colors">24 HRS</div>
            <p className="text-on-surface-variant text-sm font-medium">Integración total con tus sistemas actuales de recursos humanos y finanzas.</p>
          </div>
        </div>
      </section>
    </div>
  );

  const ROIView = () => {
    const [personnel, setPersonnel] = useState(1250);
    const [fraudRate, setFraudRate] = useState(4.5);
    const annualSavings = personnel * (fraudRate / 100) * 12 * 2500000;
    return (
      <div className="min-h-screen pt-32 pb-12 px-8 point-cloud-overlay">
        <div className="max-w-6xl mx-auto">
          <header className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded mb-4"><Shield className="w-4 h-4 text-primary" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Protocolo Activo</span></div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-tight">Calculadora de <br/><span className="text-primary">ROI de Confianza</span></h1>
            <p className="text-xl text-on-surface-variant max-w-2xl font-light">Calcula cuánto dinero está perdiendo tu empresa por el fraude de asistencia y la ineficiencia operativa.</p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 space-y-8">
              <div className="glass-panel p-8 rounded-lg">
                <div className="mb-10 flex justify-between items-end mb-4"><label className="text-[10px] font-bold uppercase tracking-[0.15em]">Colaboradores</label><span className="text-2xl font-black text-primary">{personnel.toLocaleString()}</span></div>
                <input type="range" min="5" max="10000" value={personnel} onChange={(e) => setPersonnel(parseInt(e.target.value))} className="w-full h-1 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-primary" />
                <div className="mb-10 flex justify-between items-end mb-4 pt-10"><label className="text-[10px] font-bold uppercase tracking-[0.15em]">% de Fraude</label><span className="text-2xl font-black text-primary">{fraudRate}%</span></div>
                <input type="range" min="1" max="15" step="0.5" value={fraudRate} onChange={(e) => setFraudRate(parseFloat(e.target.value))} className="w-full h-1 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-primary" />
              </div>
              <div className="glass-panel p-8 rounded-lg">
                 <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-4">Protocolo de Optimización</h3>
                 <div className="space-y-4">{['Eliminación de marcajes manuales', 'Verificación biométrica en tiempo real', 'Auditoría de IA distribuida'].map((text, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm text-on-surface-variant">
                      <CheckCircle2 className="w-5 h-5 text-primary" />
                      <span>{text}</span>
                    </div>
                 ))}</div>
              </div>
            </div>
            <div className="lg:col-span-7 space-y-8">
              <motion.div key={annualSavings} initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-primary-container p-12 rounded-lg shadow-2xl border-t border-white/20">
                <div className="absolute top-0 right-0 p-8 opacity-10"><Wallet className="w-32 h-32 text-white" /></div>
                <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/60 block mb-6">Ahorro Anual Estimado (COP)</label>
                <div className="flex items-baseline gap-4"><span className="text-2xl font-bold text-white/50">COP $</span><span className="text-5xl md:text-7xl font-black tracking-tighter text-white">{Math.round(annualSavings).toLocaleString('es-CO')}</span></div>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Horas Recuperadas', value: (personnel * 14.5).toLocaleString(), icon: Clock },
                  { label: 'Reducción Costo', value: '7.2%', icon: BarChart3 },
                  { label: 'ROI Estimado', value: '340%', icon: Calculator },
                ].map((stat, i) => (
                  <div key={i} className="bg-surface-container-high p-6 rounded border border-white/5 hover:border-primary/20 transition-all group">
                    <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-4 block">{stat.label}</label>
                    <div className="flex justify-between items-center"><span className="text-2xl font-black text-white group-hover:text-primary transition-colors">{stat.value}</span><stat.icon className="w-5 h-5 text-slate-700 group-hover:text-primary/50 transition-colors" /></div>
                  </div>
                ))}
              </div>
              <button onClick={() => window.open(CTA_LINK, '_blank')} className="w-full bg-primary-container text-white py-6 rounded-lg font-bold uppercase tracking-[0.2em] shadow-lg hover:brightness-110 flex items-center justify-center gap-4 group">
                <span>Detén las fugas de nómina hoy</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="pl-72 pt-20 h-screen w-full bg-surface overflow-hidden relative">
      <div className="point-cloud-overlay absolute inset-0 pointer-events-none"></div>
      <div className="h-full w-full p-8 flex flex-col gap-6 relative z-10">
        <div><h1 className="text-[3.5rem] font-bold tracking-[-0.04em] leading-none text-on-surface">Centro de Comando</h1><p className="text-[0.6875rem] uppercase tracking-[0.08em] text-primary mt-2">Nodo Operativo Global</p></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
            <User className="absolute top-0 right-0 p-4 opacity-20 w-10 h-10 text-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Personal Activo</div>
            <div className="flex items-baseline gap-3"><span className="text-4xl font-bold tracking-tighter text-on-surface">12,540</span><div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded"><span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span><span className="text-[0.6rem] font-bold text-primary uppercase">Validando</span></div></div>
          </div>
          <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
            <Wallet className="absolute top-0 right-0 p-4 opacity-20 w-10 h-10 text-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Recuperación Nómina (YTD)</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-bold tracking-tighter text-on-surface">$1.2M</span><span className="text-[0.6875rem] font-bold text-emerald-400 flex items-center"><TrendingUp className="w-3 h-3" /> 14%</span></div>
          </div>
          <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
            <Shield className="absolute top-0 right-0 p-4 opacity-20 w-10 h-10 text-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Integridad Sistema</div>
            <div className="flex items-baseline gap-2"><span className="text-4xl font-bold tracking-tighter text-on-surface">99.98%</span><Activity className="w-5 h-5 text-primary animate-pulse" /></div>
          </div>
        </div>
        <div className="flex-1 flex gap-6 min-h-0">
          <div className="flex-[3] glass-panel rounded-lg overflow-hidden relative bg-surface-container-lowest">
            <div className="absolute top-6 left-6 z-20"><div className="bg-background/80 backdrop-blur px-3 py-1.5 rounded border border-outline-variant/20 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary animate-ping"></span><span className="text-[0.6875rem] font-bold tracking-widest uppercase text-on-surface">Malla de Nodos en Vivo</span></div></div>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbu8u1qYtQ2yeT7AII9U9jgH1a_gNQYYWON6UJlgHEzIpU2aMC_2Y7HPgviSwnGoD9O5VZqYBDuamEc-7qznhT1nQWUmWWF_eYpQjZHSgF_QkiWJRev6vYAXM5hwfYr0XuSutlz06GwDOK1QRKwNmDq8pw8rpFXH9JXqjJYrs1NAw18-m8ysj0h05SfEBPohOx2WN34i7Moo7N6KrncV8escbJ3ZF_XREan4R3kz8gXUayhTesqjba2IH_CFWglxtwB8JE6FrX9kY3" alt="Map" className="w-full h-full object-cover opacity-30 grayscale" />
          </div>
          <div className="flex-1 glass-panel rounded-lg p-5 flex flex-col"><h3 className="text-[0.6875rem] font-bold uppercase text-slate-400 border-b border-white/5 pb-2 mb-4">Feed Inteligencia</h3><div className="flex-1 overflow-y-auto space-y-4"><div className="flex gap-3"><div className="w-8 h-8 rounded bg-slate-800" /><div className="flex-1 text-xs text-white">CONEXIÓN ACTIVA</div></div></div></div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      {view === 'dashboard' && <Sidebar />}
      <main>
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            {view === 'landing' && <LandingView />}
            {view === 'roi' && <ROIView />}
            {view === 'dashboard' && <DashboardView />}
          </motion.div>
        </AnimatePresence>
      </main>
      {view !== 'dashboard' && <Footer />}
    </div>
  );
};

const Footer = () => (
    <footer className="w-full py-16 px-10 border-t border-white/5 bg-background">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-10">
        <div className="space-y-4"><span className="text-2xl font-black text-white tracking-tighter uppercase">ASISTE 360</span><p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] leading-loose max-w-sm">© 2024 ASISTE360.<br/>INTELIGENCIA SOBERANA.</p></div>
        <div className="flex gap-10">{['Protocolo', 'Privacidad', 'Términos'].map((item) => (<a key={item} href="#" className="text-[10px] font-bold text-white/20 hover:text-primary transition-colors">{item}</a>))}</div>
      </div>
    </footer>
);
