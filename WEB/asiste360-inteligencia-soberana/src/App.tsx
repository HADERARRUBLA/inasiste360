import { useState, useEffect } from 'react';
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

// --- Components ---

const Logo = () => {
  const [error, setError] = useState(false);
  
  return (
    <div className="relative flex items-center justify-center w-28 h-28 md:w-40 md:h-40 group">
      {/* Glow effect background */}
      <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full group-hover:bg-primary/30 transition-all duration-700 scale-125"></div>
      
      {!error ? (
        <img 
          src="https://storage.googleapis.com/m-infra.appspot.com/public/res/ais/ais-dev-ien3owbj7qu4vhzgtznj2e-563997617096.us-east1.run.app/input_file_0.png" 
          alt="ASISTE360 Logo" 
          className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(var(--primary-rgb),0.9)]"
          referrerPolicy="no-referrer"
          onError={() => setError(true)}
        />
      ) : (
        <div className="relative z-10 flex flex-col items-center justify-center text-primary">
          <div className="relative">
            <Shield className="w-16 h-16 md:w-24 md:h-24 drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.8)]" />
            <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 md:w-12 md:h-12 opacity-50" />
          </div>
          <span className="text-[10px] md:text-xs font-black tracking-[0.3em] mt-2 opacity-90 uppercase">Sovereign Intelligence</span>
        </div>
      )}
    </div>
  );
};

const Navbar = ({ currentView, setView }: { currentView: View, setView: (v: View) => void }) => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-500 px-8 h-28 flex justify-between items-center ${isScrolled ? 'bg-background/80 backdrop-blur-xl border-b border-outline-variant/15 shadow-2xl' : 'bg-transparent'}`}>
      <div className="flex items-center gap-8">
        <motion.div 
          className="flex items-center cursor-pointer"
          onClick={() => setView('landing')}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        >
          <Logo />
        </motion.div>
        <div className="hidden lg:flex items-center gap-6">
          <button 
            onClick={() => setView('landing')}
            className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.6875rem] transition-all ${currentView === 'landing' ? 'text-primary border-b-2 border-primary-container pb-1' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Inteligencia
          </button>
          <button 
            onClick={() => setView('dashboard')}
            className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.6875rem] transition-all ${currentView === 'dashboard' ? 'text-primary border-b-2 border-primary-container pb-1' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Comando
          </button>
          <button 
            onClick={() => setView('roi')}
            className={`font-sans uppercase tracking-[0.08em] font-bold text-[0.6875rem] transition-all ${currentView === 'roi' ? 'text-primary border-b-2 border-primary-container pb-1' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            Motor de ROI
          </button>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => window.open(CTA_LINK, '_blank')}
          className="hidden sm:block text-on-surface-variant font-sans uppercase tracking-[0.08em] font-bold text-[0.6875rem] px-4 py-2 hover:text-primary transition-all"
        >
          Acceso VIP
        </button>
        <button 
          onClick={() => window.open(CTA_LINK, '_blank')}
          className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-md metallic-edge font-sans uppercase tracking-[0.08em] font-bold text-[0.6875rem] hover:brightness-110 active:scale-95 transition-all"
        >
          Detener Fugas de Nómina
        </button>
      </div>
    </nav>
  );
};

const Sidebar = ({ currentView, setView }: { currentView: View, setView: (v: View) => void }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Comando', icon: Command },
    { id: 'analytics', label: 'Analítica', icon: Activity },
    { id: 'biometrics', label: 'Biometría', icon: Fingerprint },
    { id: 'vault', label: 'Bóveda', icon: Lock },
    { id: 'audit', label: 'Auditoría', icon: History },
  ];

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-64 bg-surface border-r border-outline-variant/10 flex-col z-40 pt-24 pb-8 shadow-2xl">
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          <span className="text-on-surface font-bold font-sans uppercase tracking-widest text-[10px]">Control Soberano</span>
        </div>
        <span className="text-on-surface-variant font-sans uppercase tracking-widest text-[10px]">Nodo IA Activo</span>
      </div>
      <nav className="flex-1 space-y-1 px-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => item.id === 'dashboard' && setView('dashboard')}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded transition-all group ${currentView === item.id ? 'bg-primary-container/10 text-primary border-r-2 border-primary' : 'text-on-surface-variant hover:bg-white/5 hover:text-on-surface'}`}
          >
            <item.icon className={`w-5 h-5 ${currentView === item.id ? 'text-primary' : 'text-on-surface-variant group-hover:text-primary'}`} />
            <span className="font-sans uppercase tracking-widest text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="px-4 mt-auto">
        <button className="w-full py-3 bg-primary-container text-on-primary-container rounded-md text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 hover:brightness-110 transition-all active:scale-95">
          <Shield className="w-3 h-3" />
          Escaneo de Sistema
        </button>
      </div>
    </aside>
  );
};

const LandingView = ({ setView }: { setView: (v: View) => void }) => {
  return (
    <div className="relative min-h-screen pt-20 flex flex-col items-center justify-center overflow-hidden">
      <div className="absolute inset-0 point-cloud-overlay opacity-20 pointer-events-none"></div>
      
      <div className="container mx-auto px-8 relative z-10 flex flex-col lg:flex-row items-center gap-16 py-20">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="flex-1 space-y-8 text-center lg:text-left"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/20 border border-primary/20 rounded-sm">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[0.6875rem] font-bold uppercase tracking-[0.2em] text-primary">Nodo Soberano v4.0</span>
          </div>
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.9] text-on-surface">
            Mientras lees esto, el <span className="text-primary">5%</span> de tu nómina podría ser <span className="text-primary/60 italic">tiempo no laborado.</span>
          </h1>
          <p className="text-xl md:text-2xl text-on-surface-variant font-medium max-w-2xl leading-relaxed">
            Detén las fugas de nómina hoy con IA Biométrica y Geocercas de precisión quirúrgica.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6 pt-4 justify-center lg:justify-start">
            <button 
              onClick={() => window.open(CTA_LINK, '_blank')}
              className="w-full sm:w-auto px-10 py-5 bg-primary-container text-on-primary-container rounded-md metallic-edge font-bold uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_10px_30px_rgba(0,71,171,0.3)]"
            >
              Detén las fugas de nómina hoy
            </button>
            <button 
              onClick={() => window.open(CTA_LINK, '_blank')}
              className="w-full sm:w-auto px-10 py-5 bg-surface-container-high border border-outline-variant/30 text-primary rounded-md font-bold uppercase tracking-widest text-sm hover:bg-surface-container-highest transition-all backdrop-blur-md"
            >
              Acceso VIP
            </button>
          </div>
          
          <div className="pt-8 flex items-center gap-4 justify-center lg:justify-start opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="flex -space-x-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border border-surface bg-surface-container-high flex items-center justify-center overflow-hidden">
                  <img 
                    src={`https://picsum.photos/seed/exec${i}/100/100`} 
                    alt="Executive" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              ))}
            </div>
            <p className="text-[0.6875rem] font-bold tracking-[0.1em] uppercase">Confiado por empresas Fortune 500 para control total.</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="flex-1 relative w-full aspect-square max-w-[600px] flex items-center justify-center"
        >
          <div className="relative w-full h-full rounded-2xl border border-primary/10 bg-surface-container-low/40 backdrop-blur-2xl overflow-hidden shadow-2xl p-4">
            <div className="absolute inset-0 point-cloud-overlay opacity-30"></div>
            <div className="w-full h-full relative flex items-center justify-center overflow-hidden">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbGFzxPZ2YxNE9zcMX8VEfOQUAjlmrAgDcGT7Pk_hDxqVFQHlTteZE1rdwi7TpJXm__-oP5LyCA9uONh9ebiLmS50peQckcXezZui0990AAquwfhOInKbtDlftJmBu2PBUnnvica_FQizjZ6kYj1hlXVE2ECwXZy6mgudsuv2BfY9Zj6W_gzsxlnF8wlIiwAKkoMIXEnJS4lWTsAQXjYCTIuEKXTLTWmGuvaxOAZr581DHB7A2DJ831-0o4kJ7ZY3SmU69wo1ODhMs" 
                alt="AI Face Scan" 
                className="w-full h-full object-contain mix-blend-screen opacity-80"
                referrerPolicy="no-referrer"
              />
              
              <div className="absolute top-8 right-8 p-4 bg-surface-bright/60 backdrop-blur-xl border border-white/10 rounded-lg metallic-edge w-48 shadow-xl">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[10px] uppercase tracking-tighter text-primary font-bold">Precisión del Nodo</span>
                  <span className="text-[10px] text-green-400 font-mono">99.9%</span>
                </div>
                <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '99.9%' }}
                    transition={{ duration: 2, delay: 0.5 }}
                    className="h-full bg-primary"
                  ></motion.div>
                </div>
              </div>

              <div className="absolute bottom-12 left-8 p-4 bg-surface-bright/60 backdrop-blur-xl border border-white/10 rounded-lg metallic-edge shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-container/30 rounded-md flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-white/40 leading-none mb-1">Sujeto Identificado</p>
                    <p className="text-xs font-mono font-bold text-primary">ID: EJECUTIVO_774</p>
                  </div>
                </div>
              </div>

              <motion.div 
                animate={{ top: ['0%', '100%', '0%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent z-20"
              ></motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      <section className="w-full py-24 bg-surface-container-lowest relative overflow-hidden">
        <div className="container mx-auto px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>
      </section>
    </div>
  );
};

const ROIView = ({ setView }: { setView: (v: View) => void }) => {
  const [personnel, setPersonnel] = useState(1250);
  const [fraudRate, setFraudRate] = useState(4.5);
  
  // Cálculo basado en salario promedio en Colombia (~2,500,000 COP)
  const averageSalaryCOP = 2500000;
  const annualSavings = personnel * (fraudRate / 100) * 12 * averageSalaryCOP;

  return (
    <div className="min-h-screen pt-32 pb-12 px-8 point-cloud-overlay">
      <div className="max-w-6xl mx-auto">
        <header className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-container/20 border border-primary/20 rounded mb-4">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Protocolo de Seguridad Activo</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-tight">
            Calculadora de <br/><span className="text-primary">ROI de Confianza</span>
          </h1>
          <p className="text-xl text-on-surface-variant max-w-2xl font-light">
            Calcula cuánto dinero está perdiendo tu empresa por el fraude de asistencia y la ineficiencia operativa. Masteriza tus activos con inteligencia soberana.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-8">
            <div className="glass-panel p-8 rounded-lg">
              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">Número de Colaboradores</label>
                  <span className="text-2xl font-black text-primary tracking-tighter">{personnel.toLocaleString()}</span>
                </div>
                <input 
                  type="range" 
                  min="5" 
                  max="10000" 
                  value={personnel}
                  onChange={(e) => setPersonnel(parseInt(e.target.value))}
                  className="w-full h-1 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                  <span>5</span>
                  <span>10,000</span>
                </div>
              </div>

              <div className="mb-10">
                <div className="flex justify-between items-end mb-4">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">% de Fraude Estimado</label>
                  <span className="text-2xl font-black text-primary tracking-tighter">{fraudRate}%</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="15" 
                  step="0.5"
                  value={fraudRate}
                  onChange={(e) => setFraudRate(parseFloat(e.target.value))}
                  className="w-full h-1 bg-surface-container-lowest rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-2 text-[9px] text-slate-600 font-bold uppercase tracking-widest">
                  <span>1%</span>
                  <span>15%</span>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5">
                <p className="text-[11px] text-slate-500 italic leading-relaxed">
                  *Basado en un salario promedio de $2.5M COP y promedios de la industria para el sector logístico y de manufactura.
                </p>
              </div>
            </div>

            <div className="bg-surface-container-low p-8 rounded-lg border border-primary/5">
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white mb-4">Protocolo de Optimización</h3>
              <div className="space-y-4">
                {[
                  'Eliminación de marcajes manuales',
                  'Verificación biométrica en tiempo real',
                  'Auditoría de IA distribuida'
                ].map((text, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm text-on-surface-variant">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-8">
            <motion.div 
              key={annualSavings}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative overflow-hidden bg-primary-container p-12 rounded-lg shadow-[0_40px_80px_rgba(0,0,0,0.5)] border-t border-white/20"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Wallet className="w-32 h-32 text-white" />
              </div>
              <div className="relative z-10">
                <label className="text-[11px] font-bold uppercase tracking-[0.3em] text-primary/60 block mb-6">Ahorro Anual Estimado (COP)</label>
                <div className="flex items-baseline gap-4">
                  <span className="text-2xl font-bold text-white/50">COP $</span>
                  <span className="text-5xl md:text-7xl font-black tracking-tighter text-white">
                    {Math.round(annualSavings).toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="mt-8 flex items-center gap-2 text-white/80 font-bold text-xs uppercase tracking-widest">
                  <TrendingUp className="w-4 h-4" />
                  <span>Potencial de escalabilidad: +12.4%</span>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Horas Recuperadas', value: (personnel * 14.5).toLocaleString(), icon: Clock },
                { label: 'Reducción de Costo', value: '7.2%', icon: BarChart3 },
                { label: 'ROI Estimado', value: '340%', icon: Calculator },
              ].map((stat, i) => (
                <div key={i} className="bg-surface-container-high p-6 rounded border border-white/5 hover:border-primary/20 transition-all group">
                  <label className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-4 block">{stat.label}</label>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-white group-hover:text-primary transition-colors">{stat.value}</span>
                    <stat.icon className="w-5 h-5 text-slate-700 group-hover:text-primary/50 transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            <button 
              onClick={() => window.open(CTA_LINK, '_blank')}
              className="w-full bg-primary-container text-white py-6 rounded-lg font-bold uppercase tracking-[0.2em] shadow-lg hover:brightness-110 hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-4 group"
            >
              <span>Detén las fugas de nómina hoy</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const DashboardView = () => {
  return (
    <div className="pl-64 pt-20 h-screen w-full bg-surface overflow-hidden relative">
      <div className="point-cloud-overlay absolute inset-0 pointer-events-none"></div>
      <div className="h-full w-full p-8 flex flex-col gap-6 relative z-10">
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-[3.5rem] font-bold tracking-[-0.04em] leading-none text-on-surface">Centro de Comando</h1>
            <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-primary mt-2">Nodo Operativo: Global-Alpha-9</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <User className="w-10 h-10 text-primary" />
              </div>
              <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Personal Activo</div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-bold tracking-tighter text-on-surface">12,540</span>
                <div className="flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
                  <span className="text-[0.6rem] font-bold text-primary uppercase">Validando</span>
                </div>
              </div>
              <div className="mt-4 h-1 bg-surface-container-lowest w-full rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '66%' }}
                  className="h-full bg-primary shadow-[0_0_8px_#b1c5ff]"
                ></motion.div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-primary">
                <Wallet className="w-10 h-10" />
              </div>
              <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Recuperación de Nómina (YTD)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tighter text-on-surface">$1.2M</span>
                <span className="text-[0.6875rem] font-bold text-emerald-400 flex items-center">
                  <TrendingUp className="w-3 h-3" /> 14%
                </span>
              </div>
              <div className="mt-4 flex items-end gap-1 h-8">
                {[2, 4, 3, 6, 5, 8].map((h, i) => (
                  <motion.div 
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${h * 10}%` }}
                    transition={{ delay: i * 0.1 }}
                    className="flex-1 bg-primary/40 rounded-t-sm"
                  ></motion.div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-6 rounded-lg relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-20 text-primary">
                <Shield className="w-10 h-10" />
              </div>
              <div className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400 mb-1">Integridad del Sistema</div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold tracking-tighter text-on-surface">99.98%</span>
                <Activity className="w-5 h-5 text-primary animate-pulse" />
              </div>
              <div className="mt-4 text-[0.6875rem] text-slate-500 font-medium">Tiempo de Actividad: 4,520 Horas Continuas</div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex gap-6 min-h-0">
          <div className="flex-[3] glass-panel rounded-lg overflow-hidden relative bg-surface-container-lowest">
            <div className="absolute top-6 left-6 z-20">
              <div className="bg-background/80 backdrop-blur px-3 py-1.5 rounded border border-outline-variant/20 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-ping"></span>
                <span className="text-[0.6875rem] font-bold tracking-widest uppercase text-on-surface">Malla de Nodos en Vivo</span>
              </div>
            </div>
            
            <div className="absolute inset-0 grayscale opacity-40 mix-blend-screen">
              <img 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbu8u1qYtQ2yeT7AII9U9jgH1a_gNQYYWON6UJlgHEzIpU2aMC_2Y7HPgviSwnGoD9O5VZqYBDuamEc-7qznhT1nQWUmWWF_eYpQjZHSgF_QkiWJRev6vYAXM5hwfYr0XuSutlz06GwDOK1QRKwNmDq8pw8rpFXH9JXqjJYrs1NAw18-m8ysj0h05SfEBPohOx2WN34i7Moo7N6KrncV8escbJ3ZF_XREan4R3kz8gXUayhTesqjba2IH_CFWglxtwB8JE6FrX9kY3" 
                alt="Map" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-primary/40 rounded-full animate-ping"></div>
              <div className="absolute top-1/4 left-1/3 w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_15px_#b1c5ff]"></div>
              <div className="absolute bottom-1/3 right-1/4 w-6 h-6 bg-primary/30 rounded-full animate-ping" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-1/3 right-1/4 w-2 h-2 bg-primary rounded-full shadow-[0_0_15px_#b1c5ff]"></div>
            </div>

            <div className="absolute bottom-6 left-6 right-6 z-20 flex justify-between items-end">
              <div className="glass-panel p-4 rounded-md border-l-2 border-primary">
                <div className="text-[0.6rem] font-black uppercase tracking-widest text-primary mb-1">Nodo de Enfoque</div>
                <div className="text-lg font-bold">Centro Ciudad de México</div>
                <div className="text-xs text-slate-400">1,204 Turnos Activos • 0 Anomalías</div>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-6 min-w-[320px]">
            <div className="flex-1 glass-panel rounded-lg flex flex-col min-h-0">
              <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center">
                <h3 className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-300">Feed de Inteligencia</h3>
                <span className="text-[0.6rem] text-primary bg-primary/10 px-2 py-0.5 rounded">Tiempo Real</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {[
                  { name: 'Marcus Thorne', time: '12:44:02', loc: 'Centro Logístico A' },
                  { name: 'Elena Rodriguez', time: '12:43:58', loc: 'Sede Central - Piso 12' },
                  { name: 'Julian Chen', time: '12:43:15', loc: 'Nodo Remoto - VPN 04' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start p-2 hover:bg-white/5 transition-colors cursor-pointer group">
                    <div className="w-8 h-8 rounded-sm bg-surface-container-high overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/user${i}/50/50`} 
                        alt="User" 
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-on-surface">{item.name}</span>
                        <span className="text-[0.6rem] text-slate-500">{item.time}</span>
                      </div>
                      <div className="text-[0.65rem] text-slate-400">{item.loc}</div>
                      <div className="mt-1 inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 text-[0.6rem] font-bold px-1.5 py-0.5 rounded">
                        <Verified className="w-2.5 h-2.5" />
                        &lt;0.5s COINCIDENCIA BIOMÉTRICA
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-48 glass-panel rounded-lg flex flex-col border border-red-500/20 bg-red-500/5 relative overflow-hidden">
              <div className="p-3 border-b border-red-500/20 flex items-center justify-between">
                <h3 className="text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-red-400">Anomalías Detectadas</h3>
                <span className="animate-pulse w-2 h-2 rounded-full bg-red-500"></span>
              </div>
              <div className="flex-1 p-4 space-y-3">
                <div className="p-2 bg-red-500/10 border-l-2 border-red-500 rounded-sm">
                  <div className="flex justify-between text-[0.65rem] font-bold text-on-surface">
                    <span>Desviación de Geocerca</span>
                    <span className="text-red-400">CRÍTICO</span>
                  </div>
                  <div className="text-[0.6rem] text-slate-400">ID Trabajador: #88219 - Intento de autenticación fuera del perímetro.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Footer = () => (
  <footer className="w-full py-12 px-8 border-t border-outline-variant/10 bg-surface">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-lg font-black text-slate-200 tracking-tighter uppercase">ASISTE 360</span>
        <p className="font-sans text-[11px] uppercase tracking-[0.08em] font-bold text-slate-500">
          © 2024 ASISTE360 INTELIGENCIA SOBERANA. TODOS LOS DERECHOS RESERVADOS.
        </p>
      </div>
      <div className="flex gap-8">
        {['Protocolo', 'Privacidad', 'Hardware', 'Términos'].map((item) => (
          <a key={item} href="#" className="font-sans text-[11px] uppercase tracking-[0.08em] font-bold text-slate-500 hover:text-primary transition-colors">
            {item}
          </a>
        ))}
      </div>
    </div>
  </footer>
);

export default function App() {
  const [view, setView] = useState<View>('landing');

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar currentView={view} setView={setView} />
      
      {view === 'dashboard' && <Sidebar currentView={view} setView={setView} />}

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            {view === 'landing' && <LandingView setView={setView} />}
            {view === 'roi' && <ROIView setView={setView} />}
            {view === 'dashboard' && <DashboardView />}
          </motion.div>
        </AnimatePresence>
      </main>

      {view !== 'dashboard' && <Footer />}
    </div>
  );
}
