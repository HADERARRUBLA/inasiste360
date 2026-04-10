import { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Users, Building2, LogOut, MapPin, ShieldCheck, LogIn, FileDown, Settings, ArrowRight } from 'lucide-react';
import { KioskMode } from './components/KioskMode';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeeManagement } from './components/EmployeeManagement';
import { CompanySetup } from './components/CompanySetup';
import { BranchManagement } from './components/BranchManagement';
import { AdminManagement } from './components/AdminManagement';
import { AuditSystem } from './components/AuditSystem';

import { OrganizationManagement } from './components/OrganizationManagement';
import { LandingPage } from './components/LandingPage';
import { parseLatLng } from './utils/geoUtils';

function App() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'audit' | 'config' | 'branches' | 'admins' | 'reports' | 'organizations'>('dashboard');
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loginData, setLoginData] = useState({ id: '', pin: '' });
  const [loginError, setLoginError] = useState<string | null>(null);

  const currentCompany = useMemo(() =>
    companies.find(c => c.id === selectedCompanyId) || null
    , [companies, selectedCompanyId]);

  const fetchData = async (identifier: string) => {
    try {
      const { data: profile } = await supabase
        .from('InA_profiles')
        .select('*')
        .eq('national_id', identifier)
        .maybeSingle();

      if (!profile) {
        setIsAuthenticated(false);
        return;
      }

      setUserProfile(profile);

      let query = supabase.from('InA_companies').select('*').order('name');
      if (profile.role !== 'superadmin' && profile.company_id) {
        query = query.eq('id', profile.company_id);
      }

      const { data: companiesData, error: companiesError } = await query;
      if (companiesError) throw companiesError;

      if (companiesData && companiesData.length > 0) {
        setCompanies(companiesData);

        // Priority: Current selection (if valid) > Profile company > LocalStorage pinned > First available
        const savedId = localStorage.getItem('asiste360_pinned_company');
        
        let finalId = selectedCompanyId;
        
        // If current selection is no longer in the list or is null, recalculate
        if (!finalId || !companiesData.find(c => c.id === finalId)) {
          finalId = profile.company_id || (savedId && companiesData.find(c => c.id === savedId) ? savedId : companiesData[0].id);
        }

        setSelectedCompanyId(finalId);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const { data: profile, error } = await supabase
        .from('InA_profiles')
        .select('*')
        .eq('national_id', loginData.id)
        .eq('pin_code', loginData.pin)
        .maybeSingle();

      if (error) throw error;
      if (profile && (profile.role === 'admin' || profile.role === 'superadmin')) {
        setIsAuthenticated(true);
        fetchData(profile.national_id);
      } else {
        setLoginError('Credenciales inválidas o sin acceso administrativo.');
      }
    } catch (err: any) {
      setLoginError('Error de autenticación.');
    }
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        const { data } = await supabase.from('InA_companies').select('*').order('name');
        if (data && data.length > 0) {
          setCompanies(data);

          // Persistence logic: prioritize pinned company for this device
          const savedId = localStorage.getItem('asiste360_pinned_company');
          const savedKioskId = localStorage.getItem('asiste360_kiosk_company');

          if (savedKioskId && data.find(c => c.id === savedKioskId)) {
            setSelectedCompanyId(savedKioskId);
          } else if (savedId && data.find(c => c.id === savedId)) {
            setSelectedCompanyId(savedId);
          } else {
            setSelectedCompanyId(data[0].id);
          }
        }
      } catch (err) {
        console.error('Error initializing app:', err);
      }
    };
    initApp();
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('asiste360_pinned_company', id);
  };

  const targetLocation = useMemo(() => {
    if (!currentCompany?.lat_long) return null;
    return parseLatLng(currentCompany.lat_long);
  }, [currentCompany?.lat_long]);

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setUserProfile(null);
    setLoginData({ id: '', pin: '' });
  };

  const enterKioskMode = () => {
    localStorage.setItem('asiste360_kiosk_company', selectedCompanyId ?? '');
    setIsKiosk(true);
  };

  if (isKiosk) {
    return (
      <KioskMode
        companyId={selectedCompanyId || ''}
        companyName={currentCompany?.name}
        targetLocation={targetLocation}
        radiusMeters={currentCompany?.radius_limit || 100}
        onSuccess={(uid, type) => { /* Registro exitoso */ }}
        onBack={() => setIsKiosk(false)}
      />
    );
  }

  if (!isAuthenticated && !showLogin) {
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  if (!isAuthenticated && showLogin) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />
        
        <button 
          onClick={() => setShowLogin(false)}
          className="absolute top-10 left-10 text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4 rotate-180" /> Volver
        </button>

        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <div className="inline-flex mb-2 hover:scale-105 transition-transform duration-500">
              <img src="/logo_square.png" alt="Asiste360 Logo" className="w-[300px] h-auto object-contain drop-shadow-2xl" />
            </div>
            <div className="space-y-1">
              <p className="text-primary font-black text-xs uppercase tracking-[0.5em] animate-pulse">Control de Asistencia Biométrico</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="bg-card border-2 p-10 rounded-[3rem] shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Identificador</label>
              <input
                required
                value={loginData.id}
                onChange={e => setLoginData({ ...loginData, id: e.target.value })}
                className="w-full px-6 py-4 bg-background border-2 border-muted rounded-2xl focus:border-primary outline-none font-bold transition-all"
                placeholder="ID de Administrador"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Clave de Acceso</label>
              <input
                required
                type="password"
                value={loginData.pin}
                onChange={e => setLoginData({ ...loginData, pin: e.target.value })}
                className="w-full px-6 py-4 bg-background border-2 border-muted rounded-2xl focus:border-primary outline-none font-bold transition-all text-2xl tracking-[0.5em]"
                placeholder="••••"
              />
            </div>

            {loginError && (
              <p className="text-red-500 text-xs font-black uppercase bg-red-50 p-4 rounded-xl border border-red-100">{loginError}</p>
            )}

            <button type="submit" className="w-full py-5 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              Ingresar al Panel
            </button>

            <button
              onClick={enterKioskMode}
              className="w-full flex items-center justify-center gap-2 text-xs font-black text-primary uppercase tracking-widest pt-4 border-t border-muted/50"
            >
              <LogIn className="w-4 h-4" /> Ir a Quiosco Biométrico
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-primary/20">
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50 h-28 flex items-center px-10 justify-between">
        <div className="flex items-center gap-10">
          <div className="hover:opacity-90 transition-opacity">
            <img src="/logo_horizontal.png" alt="Logo" className="h-[110px] w-auto object-contain -ml-8" />
          </div>
          <div className="h-10 w-[2px] bg-primary/20 rounded-full" />
          <div className="hidden md:block">
            <p className="text-[10px] text-muted-foreground font-black tracking-[0.4em] uppercase opacity-40">Software de Gestión</p>
            <p className="text-sm font-bold text-primary italic uppercase tracking-tighter">SaaS Enterprise Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {userProfile?.role === 'superadmin' && companies.length > 1 && (
            <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-xl border">
              <Building2 className="w-4 h-4 ml-2 text-muted-foreground" />
              <select
                value={selectedCompanyId || ''}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer pr-8"
              >
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={enterKioskMode}
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white px-6 py-2.5 text-sm font-bold rounded-xl border transition-all active:scale-95"
          >
            Modo Quiosco
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" /> Salir
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 border-r bg-card/20 flex flex-col pt-8 px-6 transition-all duration-300">
          <div className="p-5 bg-muted/20 border border-muted rounded-[2rem] space-y-2 shadow-inner">
            <p className="px-4 py-2 text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Navegación</p>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('employees')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'employees' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
            >
              <Users className="w-4 h-4" /> Empleados
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'audit' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Auditoría
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'reports' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
            >
              <FileDown className="w-4 h-4" /> Reportes
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'config' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
            >
              <Settings className="w-4 h-4" /> Configuración
            </button>

            {userProfile?.role === 'superadmin' && (
              <>
                <button
                  onClick={() => setActiveTab('organizations')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'organizations' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
                >
                  <Building2 className="w-4 h-4" /> Empresas (SaaS)
                </button>
                <button
                  onClick={() => setActiveTab('branches')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'branches' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
                >
                  <MapPin className="w-4 h-4" /> Sedes Globales
                </button>
                <button
                  onClick={() => setActiveTab('admins')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'admins' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-white/50'}`}
                >
                  <ShieldCheck className="w-4 h-4" /> Administradores
                </button>
              </>
            )}
          </div>

          <div className="mt-auto mb-8 p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-[2rem] border border-primary/10">
            <h4 className="text-xs font-black uppercase text-primary tracking-tighter">Sede Activa</h4>
            <p className="text-sm font-bold mt-1">{currentCompany?.name || 'Cargando sede...'}</p>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-bold text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              SISTEMA ONLINE
            </div>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto">
          <section className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {activeTab === 'dashboard' ? (
              <AdminDashboard companyId={selectedCompanyId} view="analytics" />
            ) : activeTab === 'reports' ? (
              <AdminDashboard companyId={selectedCompanyId} view="reports" />
            ) : activeTab === 'employees' ? (
              <EmployeeManagement companyId={selectedCompanyId} />
            ) : activeTab === 'audit' ? (
              <AuditSystem companyId={selectedCompanyId} />
            ) : activeTab === 'config' ? (
              <CompanySetup
                companyId={selectedCompanyId}
                onSave={() => userProfile?.national_id && fetchData(userProfile.national_id)}
              />
            ) : activeTab === 'branches' && userProfile?.role === 'superadmin' ? (
              <BranchManagement onSave={() => userProfile?.national_id && fetchData(userProfile.national_id)} />
            ) : activeTab === 'admins' && userProfile?.role === 'superadmin' ? (
              <AdminManagement />
            ) : activeTab === 'organizations' && userProfile?.role === 'superadmin' ? (
              <OrganizationManagement />
            ) : (
              <div className="p-20 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-muted-foreground bg-card animate-pulse">
                <LayoutDashboard className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo en Desarrollo</p>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
