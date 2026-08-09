import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Shield,
  Activity,
  History,
  User,
  TrendingUp,
  Clock,
  BarChart3,
  Wallet,
  ArrowRight,
  CheckCircle2,
  Fingerprint,
  Calculator,
  Building2,
  FileSpreadsheet,
  MapPinned,
  ScanFace
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
          <div className="flex items-center cursor-pointer" onClick={() => setView('landing')}>
            <div className="relative w-28 h-28 md:w-36 md:h-36">
              {/* El logo (aro + glow) flota en Y; la sombra abajo NO se mueve, solo se
                  encoge/desvanece en sincronía para dar la ilusión de levitación.
                  Un punto le da la vuelta completa al aro — el "360" de la marca. */}
              <motion.div
                className="relative w-full h-full"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  className="absolute -inset-2 rounded-full bg-exec-primary/25 blur-xl"
                  animate={{ opacity: [0.3, 0.65, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <div className="absolute inset-0 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 shadow-xl overflow-hidden">
                  <img src="/logo_intelligence.png" alt="Logo" className="w-full h-full object-contain relative z-10 p-1" />
                </div>
                {/* Aro fijo */}
                <div className="absolute inset-0 rounded-full border border-exec-primary/25" />
                {/* Punto que recorre el aro en 360° */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-exec-primary shadow-[0_0_14px_5px_rgba(177,197,255,0.6)]" />
                </motion.div>
              </motion.div>
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 bottom-1 w-14 h-3 rounded-full bg-black/60 blur-md -z-10"
                animate={{ scaleX: [1, 0.55, 1], opacity: [0.5, 0.15, 0.5] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </div>
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
      { id: 'dashboard', label: 'DASHBOARD', icon: Activity },
      { id: 'empleados', label: 'EMPLEADOS', icon: User },
      { id: 'auditoria', label: 'AUDITORÍA', icon: History },
      { id: 'reportes', label: 'REPORTES', icon: BarChart3 },
      { id: 'sedes', label: 'SEDES', icon: MapPinned },
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
          <p className="text-sm md:text-base text-exec-primary/80 font-bold max-w-2xl leading-relaxed">
            Ejemplo: en una empresa de 50 colaboradores, eso representa cerca de <span className="text-exec-primary font-black">$75.000.000 COP al año</span>. Calcula el número exacto para tu empresa abajo.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-6 pt-4 justify-center lg:justify-start">
            <button onClick={() => window.open(CTA_LINK, '_blank')} className="w-full sm:w-auto px-12 py-6 bg-[#0047ab] text-white rounded-md exec-metallic-edge font-bold uppercase tracking-widest text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-xl">Agenda tu Demo Gratuita</button>
            <button onClick={() => setView('roi')} className="w-full sm:w-auto px-12 py-6 bg-exec-high border border-exec-outline/30 text-exec-on-surface rounded-md font-bold uppercase tracking-widest text-sm hover:bg-exec-highest transition-all backdrop-blur-md flex items-center justify-center gap-3">
              <Calculator className="w-4 h-4 text-exec-primary" /> Ver mi Ahorro Estimado
            </button>
          </div>
          <div className="flex items-center gap-3 pt-10">
              <div className="flex -space-x-3">
                  {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-exec-bg bg-slate-800" />)}
              </div>
              <span className="text-[10px] font-bold text-exec-on-variant/40 uppercase tracking-widest">Protegiendo la nómina de equipos en manufactura, retail y logística en Colombia.</span>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }} className="flex-1 relative w-full aspect-square max-w-[650px] flex items-center justify-center">
          <div className="relative w-full h-full rounded-2xl border border-white/5 bg-exec-low/40 backdrop-blur-2xl overflow-hidden shadow-2xl p-4">
            <div className="absolute inset-0 exec-point-cloud opacity-30"></div>

            {/* Rostro escaneado (asset propio en /public, ya no depende de una URL externa) */}
            <img src="/face_scan_hero.png" alt="Rostro escaneado por IA biométrica" className="w-full h-full object-contain mix-blend-screen opacity-80" />

            <div className="absolute top-10 right-10 p-4 bg-exec-bg/80 backdrop-blur-xl border border-white/10 rounded-lg exec-metallic-edge w-56 shadow-xl">
               <div className="flex justify-between items-start mb-4"><span className="text-[10px] uppercase tracking-tighter text-exec-primary font-bold">PRECISION DEL NODO</span><span className="text-[10px] text-green-400 font-mono">99.9%</span></div>
               <div className="h-1 bg-white/5 w-full rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: '99.9%' }} transition={{ duration: 2, delay: 0.5 }} className="h-full bg-exec-primary" /></div>
            </div>
            <div className="absolute bottom-12 left-10 p-4 bg-exec-bg/80 backdrop-blur-xl border border-white/10 rounded-lg exec-metallic-edge shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-exec-primary/10 rounded-md flex items-center justify-center"><Fingerprint className="w-6 h-6 text-exec-primary" /></div>
              <div><p className="text-[10px] uppercase font-bold text-white/40 leading-none mb-1">Sujeto Identificado</p><p className="text-xs font-mono font-bold text-exec-primary">ID: EJECUTIVO_774</p></div>
            </div>
            <div className="absolute bottom-12 right-10 p-4 bg-exec-bg/80 backdrop-blur-xl border border-white/10 rounded-lg exec-metallic-edge shadow-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-exec-primary/10 rounded-md flex items-center justify-center"><MapPinned className="w-6 h-6 text-exec-primary" /></div>
              <div><p className="text-[10px] uppercase font-bold text-white/40 leading-none mb-1">Geocerca</p><p className="text-xs font-mono font-bold text-emerald-400">VALIDADA</p></div>
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
    const [sedes, setSedes] = useState(3);
    const [minWageInput, setMinWageInput] = useState('1300000');
    const [transportSubsidyInput, setTransportSubsidyInput] = useState('200000');
    const [payrollHours, setPayrollHours] = useState(20);
    const [adminHourCostInput, setAdminHourCostInput] = useState('25000');
    const [period, setPeriod] = useState<'monthly' | 'annual'>('annual');

    // Los 3 campos de arriba se guardan como texto para que el usuario pueda
    // borrar/escribir libremente sin que el valor "salte" a 0 a mitad de edición.
    const minWage = parseInt(minWageInput) || 0;
    const transportSubsidy = parseInt(transportSubsidyInput) || 0;
    const adminHourCost = parseInt(adminHourCostInput) || 0;

    const avgMonthlyCost = minWage + transportSubsidy;
    const fraudSavingsAnnual = personnel * (fraudRate / 100) * 12 * avgMonthlyCost;
    const payrollSavingsAnnual = payrollHours * adminHourCost * 12;
    const totalAnnualSavings = fraudSavingsAnnual + payrollSavingsAnnual;
    const totalMonthlySavings = totalAnnualSavings / 12;
    const displayedSavings = period === 'annual' ? totalAnnualSavings : totalMonthlySavings;

    const avgHourlyRate = avgMonthlyCost / 230; // ~230h laborales/mes en Colombia
    const hoursRecoveredFraudAnnual = avgHourlyRate > 0 ? fraudSavingsAnnual / avgHourlyRate : 0;
    const hoursRecoveredTotalAnnual = hoursRecoveredFraudAnnual + payrollHours * 12;
    const hoursRecoveredDisplayed = period === 'annual' ? hoursRecoveredTotalAnnual : hoursRecoveredTotalAnnual / 12;

    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const baselineMonthlyCost = avgMonthlyCost * personnel;
    const monthlyChartData = useMemo(() => monthLabels.map(mes => ({
      mes,
      'Sin Asiste360': Math.round(baselineMonthlyCost + totalMonthlySavings),
      'Con Asiste360': Math.round(baselineMonthlyCost),
    })), [baselineMonthlyCost, totalMonthlySavings]);

    const breakdownData = useMemo(() => [
      { name: 'Tiempo no laborado evitado', value: Math.round(fraudSavingsAnnual) },
      { name: 'Horas de nómina automatizadas', value: Math.round(payrollSavingsAnnual) },
    ], [fraudSavingsAnnual, payrollSavingsAnnual]);
    const BREAKDOWN_COLORS = ['#b1c5ff', '#4ade80'];

    return (
      <div className="min-h-screen pt-32 pb-12 px-8 bg-exec-bg">
        <div className="max-w-7xl mx-auto">
          <header className="mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-exec-primary/10 border border-exec-primary/20 rounded mb-4"><Shield className="w-4 h-4 text-exec-primary" /><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-exec-primary">PROTOCOLO DE SEGURIDAD ACTIVO</span></div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-white mb-8 leading-tight">Calculadora de <br/><span className="text-exec-primary/80">Ahorro Real</span></h1>
            <p className="text-xl text-exec-on-variant max-w-2xl font-light">Ajusta los números a tu operación y mira cuánto dinero podría estar perdiendo tu empresa hoy por marcaciones manuales, "buddy punching" y horas dedicadas a calcular nómina a mano.</p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-8">
              <div className="exec-glass-panel p-10 rounded-lg space-y-12">
                <div>
                  <div className="mb-5 flex justify-between items-end"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">COLABORADORES</label><span className="text-2xl font-black text-white">{personnel.toLocaleString()}</span></div>
                  <input type="range" min="5" max="10000" value={personnel} onChange={(e) => setPersonnel(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                </div>
                <div>
                  <div className="mb-5 flex justify-between items-end"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">SEDES</label><span className="text-2xl font-black text-white">{sedes}</span></div>
                  <input type="range" min="1" max="50" value={sedes} onChange={(e) => setSedes(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                </div>
                <div>
                  <div className="mb-5 flex justify-between items-end"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">% DE FRAUDE / TIEMPO PERDIDO</label><span className="text-2xl font-black text-white">{fraudRate}%</span></div>
                  <input type="range" min="1" max="15" step="0.5" value={fraudRate} onChange={(e) => setFraudRate(parseFloat(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                </div>
                <div>
                  <div className="mb-5 flex justify-between items-end"><label className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">HORAS/MES CALCULANDO NÓMINA A MANO</label><span className="text-2xl font-black text-white">{payrollHours}h</span></div>
                  <input type="range" min="2" max="80" value={payrollHours} onChange={(e) => setPayrollHours(parseInt(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-exec-primary" />
                </div>
              </div>

              <div className="exec-glass-panel p-10 rounded-lg space-y-6">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">VALORES DE REFERENCIA (EDITABLES)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Salario mínimo mensual</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={minWageInput}
                      onChange={(e) => setMinWageInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-base font-bold text-white outline-none focus:border-exec-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Auxilio de transporte</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transportSubsidyInput}
                      onChange={(e) => setTransportSubsidyInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-base font-bold text-white outline-none focus:border-exec-primary/50"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">Costo hora administrativa (COP)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={adminHourCostInput}
                      onChange={(e) => setAdminHourCostInput(e.target.value.replace(/[^0-9]/g, ''))}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-4 py-3 text-base font-bold text-white outline-none focus:border-exec-primary/50"
                    />
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 italic leading-relaxed">*Ajusta el salario mínimo y el auxilio de transporte al valor vigente en tu país/año — son solo un punto de partida editable, haz clic y escribe directamente.</p>
              </div>

              <div className="space-y-6">
                 <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">PROTOCOLO DE OPTIMIZACIÓN</h3>
                 <div className="space-y-4">{['Eliminación de marcajes manuales', 'Verificación biométrica en tiempo real', 'Cálculo de nómina 100% automático'].map((text, i) => (
                    <div key={i} className="flex items-center gap-4 text-sm text-exec-on-variant">
                      <CheckCircle2 className="w-5 h-5 text-exec-primary" />
                      <span>{text}</span>
                    </div>
                 ))}</div>
              </div>
            </div>
            <div className="lg:col-span-8 space-y-8">
              <div className="flex justify-end">
                <div className="inline-flex bg-exec-high border border-white/10 rounded-lg p-1">
                  <button onClick={() => setPeriod('monthly')} className={`px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${period === 'monthly' ? 'bg-exec-primary text-exec-bg' : 'text-exec-on-variant/60'}`}>Mensual</button>
                  <button onClick={() => setPeriod('annual')} className={`px-5 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all ${period === 'annual' ? 'bg-exec-primary text-exec-bg' : 'text-exec-on-variant/60'}`}>Anual</button>
                </div>
              </div>
              <motion.div key={`${displayedSavings}-${period}`} initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#0047ab] p-16 rounded-xl shadow-2xl border-t border-white/20">
                 <div className="absolute top-0 right-0 p-10 opacity-10"><Wallet className="w-40 h-40 text-white" /></div>
                 <label className="text-[11px] font-bold uppercase tracking-[0.4em] text-white/50 block mb-8">AHORRO {period === 'annual' ? 'ANUAL' : 'MENSUAL'} ESTIMADO (COP)</label>
                 <div className="flex items-baseline gap-6"><span className="text-3xl font-bold text-white/50">COP $</span><span className="text-7xl md:text-[6.5rem] font-black tracking-tighter text-white">{Math.round(displayedSavings).toLocaleString('es-CO')}</span></div>
                 <div className="mt-10 flex items-center gap-2 text-white/60 font-bold text-[11px] uppercase tracking-widest"><TrendingUp className="w-4 h-4" /> PROYECTADO PARA {personnel.toLocaleString()} COLABORADORES EN {sedes} {sedes === 1 ? 'SEDE' : 'SEDES'}</div>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Horas Recuperadas', value: `${Math.round(hoursRecoveredDisplayed).toLocaleString()}h`, icon: Clock },
                  { label: 'Fuga Eliminada', value: `${fraudRate}%`, icon: BarChart3 },
                  { label: 'Horas Nómina Automatizadas/Año', value: `${(payrollHours * 12).toLocaleString()}h`, icon: Calculator },
                ].map((stat, i) => (
                  <div key={i} className="bg-exec-high p-8 rounded-lg border border-white/5 hover:border-exec-primary/20 transition-all group">
                    <label className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-6 block">{stat.label}</label>
                    <div className="flex justify-between items-center"><span className="text-3xl font-black text-white group-hover:text-exec-primary transition-colors">{stat.value}</span><stat.icon className="w-5 h-5 text-slate-700 group-hover:text-exec-primary/50 transition-colors" /></div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 exec-glass-panel p-8 rounded-lg">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-6">Costo mensual: sin vs. con Asiste360</h3>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#c3c6d5' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#c3c6d5' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${Math.round(v / 1000000)}M`} />
                        <Tooltip
                          contentStyle={{ background: '#171f33', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: '#dae2fd' }}
                          formatter={(v: number) => `$${v.toLocaleString('es-CO')}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="Sin Asiste360" fill="#475569" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Con Asiste360" fill="#b1c5ff" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="lg:col-span-2 exec-glass-panel p-8 rounded-lg">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-white mb-6">De dónde viene tu ahorro</h3>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={breakdownData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={4}>
                          {breakdownData.map((entry, i) => <Cell key={i} fill={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#171f33', border: '1px solid #ffffff20', borderRadius: 8, fontSize: 11 }}
                          formatter={(v: number) => `$${v.toLocaleString('es-CO')}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-2">
                    {breakdownData.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-[10px] text-exec-on-variant/70">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length] }} />
                        {d.name}
                      </div>
                    ))}
                  </div>
                </div>
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
            <p className="text-[0.6875rem] uppercase tracking-[0.2em] text-exec-primary mt-4 font-bold">ASÍ SE VE ASISTE360 POR DENTRO</p>
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
        <div className="flex-1 flex flex-col lg:flex-row gap-10 min-h-0 pb-10 overflow-y-auto">
          <div className="flex-[3] space-y-6">
            <h3 className="text-[0.6875rem] font-black uppercase text-exec-on-variant/60 tracking-[0.2em]">Todo lo que tu operación necesita, en un solo lugar</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { icon: ScanFace, title: 'Asistencia en Tiempo Real', desc: 'Marcación por PIN o rostro desde el Kiosko, con validación de ubicación.' },
                { icon: Wallet, title: 'Nómina Automática', desc: 'Horas ordinarias, extra diurna, nocturna y dominical calculadas solas.' },
                { icon: History, title: 'Auditoría con Evidencia', desc: 'Cada marcación queda con foto, GPS y veredicto biométrico.' },
                { icon: MapPinned, title: 'Geovallas por Sede', desc: 'Radio configurable: nadie marca si no está físicamente en el sitio.' },
                { icon: Building2, title: 'Multi-sede y Multi-empresa', desc: 'Una sola cuenta para administrar todas tus sedes y empresas.' },
                { icon: FileSpreadsheet, title: 'Reportes y Excel', desc: 'Exporta nómina, novedades y alertas listas para contabilidad.' },
              ].map((item, i) => (
                <div key={i} className="exec-glass-panel rounded-xl p-6 flex items-start gap-4 hover:border-exec-primary/30 transition-all group">
                  <div className="w-12 h-12 shrink-0 bg-exec-primary/10 rounded-lg flex items-center justify-center group-hover:bg-exec-primary/20 transition-all">
                    <item.icon className="w-6 h-6 text-exec-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-tight mb-1">{item.title}</p>
                    <p className="text-xs text-exec-on-variant/60 font-medium leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-8 flex flex-col min-w-[300px] lg:min-w-[340px]">
              <div className="exec-glass-panel rounded-xl p-8 flex flex-col h-[60%]">
                <div className="flex justify-between items-center mb-8"><h3 className="text-[0.6875rem] font-black uppercase text-exec-on-variant/80 tracking-[0.2em]">MARCACIONES RECIENTES</h3><span className="text-[9px] text-exec-on-variant/30 font-bold uppercase px-2 py-0.5 border border-white/5 rounded">Tiempo Real</span></div>
                <div className="flex-1 overflow-y-auto space-y-6">
                    {[
                        { title: 'Andrés Hernández', sub: 'Sede Norte · Entrada', time: '07:58:12' },
                        { title: 'Beatriz López', sub: 'Sede Centro · Regreso Almuerzo', time: '13:01:40' },
                        { title: 'Carlos Gómez', sub: 'Sede Norte · Salida', time: '17:02:05' }
                    ].map((item, i) => (
                        <div key={i} className="flex gap-4 items-start pb-4 border-b border-white/5">
                            <div className="w-10 h-10 rounded bg-slate-800 border border-white/5" />
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-1 text-[11px] font-black text-white"><span>{item.title}</span><span className="text-[9px] text-exec-on-variant/40 font-mono">{item.time}</span></div>
                                <div className="text-[9px] text-exec-on-variant/40 font-bold uppercase tracking-tighter mb-1">{item.sub}</div>
                                <div className="flex items-center gap-1.5 text-[8px] text-emerald-400 font-black"><CheckCircle2 className="w-2.5 h-2.5" /> BIOMETRÍA VERIFICADA</div>
                            </div>
                        </div>
                    ))}
                </div>
              </div>
              <div className="exec-glass-panel rounded-xl p-8 bg-red-500/5 border-red-500/20">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-[0.6875rem] font-black uppercase text-red-400 tracking-[0.2em]">ALERTAS AUTOMÁTICAS</h3><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span></div>
                  <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                      <div className="flex justify-between items-center mb-2"><span className="text-[10px] font-black text-white">Llegada Tarde</span><span className="text-[9px] font-black text-red-500">12 MIN</span></div>
                      <p className="text-[9px] font-bold text-exec-on-variant/60 leading-tight">Daniela Rojas · Sede Norte · Detectado automáticamente contra el horario configurado.</p>
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
