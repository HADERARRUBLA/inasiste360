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
    <div className={`relative flex flex-col items-center justify-center transition-all duration-700 ${size === 'large' ? 'w-64 h-64 md:w-80 md:h-80' : 'w-24 h-24 md:w-32 md:h-32'}`}>
      {/* Translucent white background for contrast */}
      <div className="absolute inset-4 bg-white/10 backdrop-blur-md rounded-full z-0 border border-white/20 shadow-[0_0_50px_rgba(255,255,255,0.08)]"></div>
      
      {/* Dynamic Halo - The 360 Rotation Ring */}
      <motion.div 
        className="absolute inset-0 border-t-2 border-exec-primary/40 rounded-full z-10 pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      
      {!error ? (
        <img 
          src="/logo_intelligence.png" 
          alt="ASISTE360 Logo" 
          className="w-full h-full object-contain relative z-20 p-6 filter drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
          onError={() => setError(true)}
        />
      ) : (
        <div className="relative z-20 flex flex-col items-center justify-center text-exec-primary">
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
      <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-8 h-32 flex justify-between items-center ${isScrolled ? 'bg-exec-bg/80 backdrop-blur-xl border-b border-exec-outline/15 shadow-2xl' : 'bg-transparent'}`}>
        <div className="flex items-center gap-10">
          <motion.div 
            className="flex items-center cursor-pointer"
            onClick={() => setView('landing')}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="relative w-24 h-24">
              <div className="absolute inset-2 bg-white/15 backdrop-blur-sm rounded-full z-0 border border-white/20 shadow-xl"></div>
               <motion.div 
                className="absolute inset-[-5%] border-t-2 border-exec-primary/40 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              />
              <img src="/logo_intelligence.png" alt="Logo" className="w-full h-full object-contain relative z-10 p-4" />
            </div>
          </motion.div>
          <div className="hidden lg:flex items-center gap-10 ml-4">
            <button onClick={() => setView('landing')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'landing' ? 'text-exec-primary border-b-2 border-exec-primary pb-1' : 'text-exec-on-variant/50 hover:text-exec-on-surface'}`}>Inteligencia</button>
            <button onClick={() => setView('dashboard')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'dashboard' ? 'text-exec-primary border-b-2 border-exec-primary pb-1' : 'text-exec-on-variant/50 hover:text-exec-on-surface'}`}>Comando</button>
            <button onClick={() => setView('roi')} className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] transition-all ${view === 'roi' ? 'text-exec-primary border-b-2 border-exec-primary pb-1' : 'text-exec-on-variant/50 hover:text-exec-on-surface'}`}>Motor de ROI</button>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={onLoginClick} className="hidden sm:block text-exec-on-variant/60 font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] px-4 py-2 hover:text-exec-primary transition-all">Acceso VIP</button>
          <button onClick={() => window.open(CTA_LINK, '_blank')} className="bg-[#0047ab] text-white px-8 py-3 rounded-md exec-metallic-edge font-sans uppercase tracking-[0.08em] font-bold text-[0.7rem] hover:brightness-110 active:scale-95 transition-all shadow-xl">Detener Fugas de Nómina</button>
        </div>
      </nav>
    );
  };

  const Sidebar = () => {
    const menuItems = [
      { id: 'dashboard', label: 'COMANDO', icon: Command },
      { id: 'analytics', label: 'ANALÍTICA', icon: Activity },
      { id: 'biometrics', label: 'BIOMETRÍA', icon: Fingerprint },
      { id: 'vault', label: 'BÓVEDA', icon: Lock },
      { id: 'audit', label: 'AUDITORÍA', icon: History },
    ];
    return (
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-72 bg-exec-bg border-r border-exec-outline/10 flex-col z-40 pt-32 pb-8 shadow-2xl">
        <div className="px-8 mb-12 flex flex-col items-center gap-6">
            <div className="text-[10px] font-bold text-exec-primary/40 tracking-[0.2em] mb-4 w-full">NODO IA ACTIVO</div>
        </div>
        <nav className="flex-1 space-y-2 px-6">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => item.id === 'dashboard' && setView('dashboard')} className={`w-full flex items-center gap-4 px-6 py-4 rounded transition-all group ${view === item.id ? 'bg-exec-primary/10 text-exec-primary border-r-4 border-exec-primary' : 'text-exec-on-variant/50 hover:bg-white/5 hover:text-exec-on-surface'}`}>
              <item.icon className={`w-6 h-6 ${view === item.id ? 'text-exec-primary' : 'text-exec-on-variant/50 group-hover:text-exec-primary'}`} />
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
    <div className="relative min-h-screen pt-20 flex flex-col items-center justify-center overflow-hidden bg-exec-bg">
      <div className="absolute inset-0 exec-point-cloud opacity-20 pointer-events-none"></div>
      <div className="container mx-auto px-8 relative z-10 flex flex-col lg:flex-row items-center gap-20 py-24">
        <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} className="flex-1 space-y-10 text-center lg:text-left">
          <h1 className="text-5xl md:text-[5.5rem] lg:text-[6.5rem] font-black tracking-tight leading-[0.9] text-exec-on-surface">
            Mientras lees esto, el <span className="text-exec-primary">5%</span> de tu nómina podría ser <span className="text-exec-primary/60 italic">tiempo no laborado.</span>
          </h1>
          <p className="text-xl md:text-2xl text-exec-on-variant font-medium max-w-2xl leading-relaxed">Detén las fugas de nómina hoy con IA Biométrica y Geocercas de precisión quirúrgica.</p>
          <div className="flex flex-col sm:flex-row items-center gap-8 pt-4 justify-center lg:justify-start">
            <button onClick={() => window.open(CTA_LINK, '_blank')} className="w-full sm:w-auto px-12 py-6 bg-[#0047ab] text-white rounded-md exec-metallic-edge font-bold uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-xl">Detener las fugas de nómina hoy</button>
            <button onClick={onLoginClick} className="w-full sm:w-auto px-12 py-6 bg-exec-high border border-exec-outline/30 text-exec-on-surface rounded-md font-bold uppercase tracking-widest text-sm hover:bg-exec-highest transition-all backdrop-blur-md">Acceso VIP</button>
          </div>
          <div className="flex items-center gap-3 pt-10">
              <div className="flex -space-x-3">
                  {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-exec-bg bg-slate-800" />)}
              </div>
              <span className="text-[10px] font-bold text-exec-on-variant/40 uppercase tracking-widest">Confiado por empresas Fortune 500 para control total.</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="flex-1 relative w-full aspect-square max-w-[650px] flex items-center justify-center">
          <div className="relative w-full h-full rounded-2xl border border-white/5 bg-exec-low/40 backdrop-blur-2xl overflow-hidden shadow-2xl p-4">
            <div className="absolute inset-0 exec-point-cloud opacity-30"></div>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbGFzxPZ2YxNE9zcMX8VEfOQUAjlmrAgDcGT7Pk_hDxqVFQHlTteZE1rdwi7TpJXm__-oP5LyCA9uONh9ebiLmS50peQckcXezZui0990AAquwfhOInKbtDlftJmBu2PBUnnvica_FQizjZ6kYj1hlXVE2ECwXZy6mgudsuv2BfY9Zj6W_gzsxlnF8wlIiwAKkoMIXEnJS4lWTsAQXjYCTIuEKXTLTWmGuvaxOAZr581DHB7A2DJ831-0o4kJ7ZY3SmU69wo1ODhMs" alt="AI Face Scan" className="w-full h-full object-contain mix-blend-screen opacity-80" />
            <div className="absolute top-10 right-10 p-4 bg-exec-bg/80 backdrop-blur-xl border border-white/10 rounded-lg exec-metallic-edge w-56 shadow-xl">
               <div className="flex justify-between items-start mb-4"><span className="text-[10px] uppercase tracking-tighter text-exec-primary font-bold">PRECISION DEL NODO</span><span className="text-[10px] text-green-400 font-mono">99.9%</span></div>
               <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-exec-primary" /></div>
            </div>
            <div className="absolute bottom-12 left-10 p-4 bg-exec-bg/80 backdrop-blur-xl border border-white/10 rounded-lg exec-metallic-edge shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-exec-primary/10 rounded-md flex items-center justify-center"><Fingerprint className="w-6 h-6 text-exec-primary" /></div>
              <div><p className="text-[10px] uppercase font-bold text-white/40 leading-none mb-1">Sujeto Identificado</p><p className="text-xs font-mono font-bold text-exec-primary">ID: EJECUTIVO_774</p></div>
            </div>
            <motion.div animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-exec-primary/50 to-transparent z-20" />
          </div>
        </motion.div>
      </div>
    </div>
  );

  const ROIView = () => {
    const [personnel, setPersonnel] = useState(1250);
    const [fraudRate, setFraudRate] = useState(4.5);
    const annualSavings = personnel * (fraudRate / 100) * 12 * 2500000;
    return (
      <div className="min-h-screen pt-32 pb-12 px-8 bg-exec-bg">
        <div className="max-w-7xl mx-auto">
          <header className="mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-exec-primary/10 border border-exec-primary/20 rounded mb-4"><Shield className="w-4 h-4 text-exec-primary" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-exec-primary">PROTOCOLO DE SEGURIDAD ACTIVO</span></div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-tight">Calculadora de <br/><span className="text-exec-primary/80">ROI de Confianza</span></h1>
            <p className="text-xl text-exec-on-variant max-w-2xl font-light">Calcula cuánto dinero está perdiendo tu empresa por el fraude de asistencia y la ineficiencia operativa. Masteriza tus activos con inteligencia soberana.</p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-12">
              <div className="exec-glass-panel p-10 rounded-lg">
                <div className="mb-12 flex justify-between items-end"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">NÚMERO DE COLABORADORES</label><span className="text-3xl font-black text-white">{personnel.toLocaleString()}</span></div>
                <input type="range" min="5" max="10000" value={personnel} onChange={(e) => setPersonnel(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                <div className="mb-12 flex justify-between items-end pt-12"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">% DE FRAUDE ESTIMADO</label><span className="text-3xl font-black text-white">{fraudRate}%</span></div>
                <input type="range" min="1" max="15" step="0.5" value={fraudRate} onChange={(e) => setFraudRate(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                <p className="mt-12 text-[9px] text-slate-500 italic leading-relaxed">*Basado en un salario promedio de $2.5M COP y promedios de la industria para el sector logístico y de manufactura.</p>
              </div>
              <div className="space-y-6">
                 <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">PROTOCOLO DE OPTIMIZACIÓN</h3>
                 <div className="space-y-4">{['Eliminación de marcajes manuales', 'Verificación biométrica en tiempo real', 'Auditoría de IA distribuida'].map((text, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm text-exec-on-variant">
                      <CheckCircle2 className="w-5 h-5 text-exec-primary" />
                      <span>{text}</span>
                    </div>
                 ))}</div>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-12">
              <motion.div key={annualSavings} initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#0047ab] p-16 rounded-xl shadow-2xl border-t border-white/20">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><Wallet className="w-40 h-40 text-white" /></div>
                 <label className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/50 block mb-8">AHORRO ANUAL ESTIMADO (COP)</label>
                 <div className="flex items-baseline gap-6"><span className="text-3xl font-bold text-white/50">COP $</span><span className="text-7xl md:text-[6.5rem] font-black tracking-tighter text-white">{Math.round(annualSavings).toLocaleString('es-CO')}</span></div>
                 <div className="mt-10 flex items-center gap-2 text-white/60 font-bold text-[11px] uppercase tracking-widest"><TrendingUp className="w-4 h-4" /> POTENCIAL DE ESCALABILIDAD: +12.4%</div>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Horas Recuperadas', value: (personnel * 14.5).toLocaleString(), icon: Clock },
                  { label: 'Reducción de Costo', value: '7.2%', icon: BarChart3 },
                  { label: 'ROI Estimado', value: '340%', icon: Calculator },
                ].map((stat, i) => (
                  <div key={i} className="bg-exec-high p-8 rounded-lg border border-white/5 hover:border-exec-primary/20 transition-all group">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 block">{stat.label}</label>
                    <div className="flex justify-between items-center"><span className="text-3xl font-black text-white group-hover:text-exec-primary transition-colors">{stat.value}</span><stat.icon className="w-5 h-5 text-slate-700 group-hover:text-exec-primary/50 transition-colors" /></div>
                  </div>
                ))}
              </div>
              <button onClick={() => window.open(CTA_LINK, '_blank')} className="w-full bg-[#0047ab] text-white py-12 rounded-xl font-black uppercase tracking-[0.3em] text-sm shadow-lg hover:brightness-110 flex items-center justify-center gap-6 group">
                DETENER LAS FUGAS DE NÓMINA HOY <ArrowRight className="w-6 h-6 group-hover:translate-x-3 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DashboardView = () => (
    <div className="pl-0 lg:pl-72 pt-20 h-screen w-full bg-exec-bg overflow-auto relative">
      <div className="exec-point-cloud absolute inset-0 pointer-events-none"></div>
      <div className="h-full w-full p-12 flex flex-col gap-10 relative z-10">
        <div>
            <h1 className="text-[4.5rem] font-bold tracking-[-0.04em] leading-none text-exec-on-surface">Centro de Comando</h1>
            <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-exec-primary mt-4 font-bold">NODO OPERATIVO: GLOBAL-ALPHA-9</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="exec-glass-panel p-10 rounded-lg relative overflow-hidden group">
            <User className="absolute top-0 right-0 p-6 opacity-10 w-16 h-16 text-exec-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-exec-on-variant/60 mb-3">PERSONAL ACTIVO</div>
            <div className="flex items-baseline gap-5"><span className="text-5xl font-black tracking-tighter text-exec-on-surface">12,540</span><div className="flex items-center gap-2 bg-exec-primary/10 px-3 py-1 rounded-full"><span className="w-2 h-2 bg-exec-primary rounded-full animate-pulse"></span><span className="text-[0.65rem] font-bold text-exec-primary uppercase">Validando</span></div></div>
            <div className="mt-6 h-1.5 bg-white/5 w-full rounded-full overflow-hidden"><div className="h-full bg-exec-primary/40 w-[85%]"></div></div>
          </div>
          <div className="exec-glass-panel p-10 rounded-lg relative overflow-hidden group">
            <Wallet className="absolute top-0 right-0 p-6 opacity-10 w-16 h-16 text-exec-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-exec-on-variant/60 mb-3">RECUPERACIÓN DE NÓMINA (YTD)</div>
            <div className="flex items-baseline gap-3"><span className="text-5xl font-black tracking-tighter text-exec-on-surface">$1.2M</span><span className="text-[0.6875rem] font-bold text-emerald-500 font-mono tracking-tighter">~14%</span></div>
            <div className="mt-8 flex gap-2">{[1,2,3,4,5,6].map(i => <div key={i} className={`flex-1 h-3 rounded-sm ${i < 5 ? 'bg-exec-primary/30' : 'bg-white/5'}`}></div>)}</div>
          </div>
          <div className="exec-glass-panel p-10 rounded-lg relative overflow-hidden group">
            <Shield className="absolute top-0 right-0 p-6 opacity-10 w-16 h-16 text-exec-primary" />
            <div className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-exec-on-variant/60 mb-3">INTEGRIDAD DEL SISTEMA</div>
            <div className="flex items-baseline gap-4"><span className="text-5xl font-black tracking-tighter text-exec-on-surface">99.98%</span><Activity className="w-6 h-6 text-exec-primary animate-pulse" /></div>
            <div className="mt-6 text-[10px] text-exec-on-variant/40 font-bold uppercase tracking-widest">Tiempo de Actividad: 4,520 Horas Continuas</div>
          </div>
        </div>
        <div className="flex-1 flex gap-10 min-h-0 pb-10">
          <div className="flex-[3] exec-glass-panel rounded-xl overflow-hidden relative bg-exec-low">
            <div className="absolute top-10 left-10 z-20"><div className="bg-exec-bg/80 backdrop-blur px-5 py-2.5 rounded-lg border border-exec-outline/20 flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-exec-primary animate-ping"></span><span className="text-[0.75rem] font-black tracking-widest uppercase text-exec-on-surface">Malla de Nodos en Vivo</span></div></div>
            <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbu8u1qYtQ2yeT7AII9U9jgH1a_gNQYYWON6UJlgHEzIpU2aMC_2Y7HPgviSwnGoD9O5VZqYBDuamEc-7qznhT1nQWUmWWF_eYpQjZHSgF_QkiWJRev6vYAXM5hwfYr0XuSutlz06GwDOK1QRKwNmDq8pw8rpFXH9JXqjJYrs1NAw18-m8ysj0h05SfEBPohOx2WN34i7Moo7N6KrncV8escbJ3ZF_XREan4R3kz8gXUayhTesqjba2IH_CFWglxtwB8JE6FrX9kY3" alt="Map" className="w-full h-full object-cover opacity-20 grayscale" />
            <div className="absolute bottom-10 left-10 p-6 exec-glass-panel rounded-xl max-w-sm">
                <div className="text-[10px] font-bold text-exec-primary mb-2 tracking-[0.1em] uppercase">Nodo de Enfoque</div>
                <div className="text-xl font-black mb-1 text-white">Centro Ciudad de México</div>
                <div className="text-[10px] text-exec-on-variant/60">1,204 Turnos Activos • 0 Anomalías</div>
            </div>
          </div>
          <div className="flex-1 space-y-8 flex flex-col min-w-[340px]">
              <div className="exec-glass-panel rounded-xl p-8 flex flex-col h-[60%]">
                <div className="flex justify-between items-center mb-8"><h3 className="text-[0.6875rem] font-black uppercase text-exec-on-variant/80 tracking-[0.2em]">FEED DE INTELIGENCIA</h3><span className="text-[9px] text-exec-on-variant/30 font-bold uppercase px-2 py-0.5 border border-white/5 rounded">Tiempo Real</span></div>
                <div className="flex-1 overflow-y-auto space-y-6">
                    {[
                        { title: 'Marcus Thorne', sub: 'Centro Logístico A', time: '12:44:02' },
                        { title: 'Elena Rodriguez', sub: 'Sede Central - Piso 12', time: '12:43:58' },
                         { title: 'Julian Chen', sub: 'Nodo Remoto - VPN 04', time: '12:43:15' }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start pb-4 border-b border-white/5">
                            <div className="w-10 h-10 rounded bg-slate-800 border border-white/5" />
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1 text-[11px] font-black text-white"><span>{item.title}</span><span className="text-[9px] text-exec-on-variant/40 font-mono">{item.time}</span></div>
                                <div className="text-[9px] text-exec-on-variant/40 font-bold uppercase tracking-tighter mb-1">{item.sub}</div>
                                <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-black"><CheckCircle2 className="w-2.5 h-2.5" /> &lt;0.5S COINCIDENCIA BIOMÉTRICA</div>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
              <div className="exec-glass-panel rounded-xl p-8 bg-red-500/5 border-red-500/20">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-[0.6875rem] font-black uppercase text-red-400 tracking-[0.2em]">ANOMALÍAS DETECTADAS</h3><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span></div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-white">Desviación de Geocerca</span><span className="text-[9px] font-black text-red-500">CRÍTICO</span></div>
                      <p className="text-[9px] font-bold text-exec-on-variant/60 leading-tight">ID Trabajador: #98219 - Intento de autenticación fuera del perímetro.</p>
                  </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="landing-executive-theme min-h-screen">
      <Navbar />
      {view === 'dashboard' && <Sidebar />}
      <main className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div key={view} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
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
    <footer className="w-full py-24 px-12 border-t border-white/5 bg-exec-bg">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-16">
        <div className="space-y-8"><span className="text-4xl font-black text-white tracking-tighter uppercase">ASISTE 360</span><p className="text-[12px] font-black text-exec-on-variant/40 uppercase tracking-[0.3em] leading-relaxed max-w-sm">© 2024 ASISTE360.<br/>TECNOLOGÍA SOBERANA.</p></div>
        <div className="flex gap-16">{['Protocolo', 'Privacidad', 'Términos'].map((item) => (<a key={item} href="#" className="text-[12px] font-black uppercase tracking-[0.25em] text-exec-on-variant/30 hover:text-exec-primary transition-all">{item}</a>))}</div>
      </div>
    </footer>
);
