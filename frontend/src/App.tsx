import { useState, useEffect, useMemo } from 'react';
import { supabase } from './lib/supabase';
import { LayoutDashboard, Users, Building2, LogOut, MapPin, ShieldCheck, LogIn, FileDown, Settings, ArrowRight, Menu, X, CalendarOff, FlaskConical } from 'lucide-react';
import { KioskMode } from './components/KioskMode';
import { AdminDashboard } from './components/AdminDashboard';
import { EmployeeManagement } from './components/EmployeeManagement';
import { LeaveManagement } from './components/LeaveManagement';
import { CompanySetup } from './components/CompanySetup';
import { BranchManagement } from './components/BranchManagement';
import { AdminManagement } from './components/AdminManagement';
import { AuditSystem } from './components/AuditSystem';

import { OrganizationManagement } from './components/OrganizationManagement';
import { LandingPage } from './components/LandingPage';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastContainer } from './components/ToastContainer';
import { PayrollRpcShadowPanel } from './components/PayrollRpcShadowPanel';
import { parseLatLng } from './utils/geoUtils';

type ActiveTab = 'dashboard' | 'employees' | 'leaves' | 'audit' | 'config' | 'branches' | 'admins' | 'reports' | 'organizations' | 'rpc-shadow';

function App() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [isKiosk, setIsKiosk] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [recoveryStatus, setRecoveryStatus] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [pendingLeaveCount, setPendingLeaveCount] = useState(0);

  const currentCompany = useMemo(() =>
    companies.find(c => c.id === selectedCompanyId) || null
    , [companies, selectedCompanyId]);

  // Contador de novedades pendientes para el badge del menú — se refresca al
  // cambiar de sede y en vivo mientras el admin está en la pestaña Novedades
  // (LeaveManagement llama a onPendingCountChange después de cada acción).
  useEffect(() => {
    if (!selectedCompanyId) { setPendingLeaveCount(0); return; }
    const loadPendingCount = async () => {
      const { data } = await supabase
        .from('InA_leave_requests')
        .select('id, status, InA_profiles!profile_id(company_id)')
        .eq('status', 'pending');
      const count = (data || []).filter((r: any) => r.InA_profiles?.company_id === selectedCompanyId).length;
      setPendingLeaveCount(count);
    };
    loadPendingCount();
  }, [selectedCompanyId]);

  // Carga las sedes visibles para el perfil autenticado (RLS filtra automáticamente
  // por organización si el rol no es superadmin) y fija la sede activa.
  const loadCompaniesForProfile = async (profile: any) => {
    try {
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

  // Busca el perfil InA_profiles enlazado a la sesión de Supabase Auth activa
  // (columna auth_user_id, ver migración 0001_secure_rls_and_kiosk_rpc.sql).
  const loadOwnProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsAuthenticated(false);
      return;
    }

    const { data: profile, error } = await supabase
      .from('InA_profiles')
      .select('*')
      .eq('auth_user_id', session.user.id)
      .maybeSingle();

    if (error || !profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
      setIsAuthenticated(false);
      await supabase.auth.signOut();
      return;
    }

    setIsAuthenticated(true);
    await loadCompaniesForProfile(profile);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password
      });

      if (error) {
        setLoginError('Credenciales inválidas.');
        return;
      }

      await loadOwnProfile();
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
      } finally {
        // Restaura sesión de Supabase Auth si existe (recarga de página, etc.)
        await loadOwnProfile();
        setAuthLoading(false);
      }
    };
    initApp();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }
      if (!session) {
        setIsAuthenticated(false);
        setUserProfile(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    localStorage.setItem('asiste360_pinned_company', id);
  };

  const targetLocation = useMemo(() => {
    if (!currentCompany?.lat_long) return null;
    return parseLatLng(currentCompany.lat_long);
  }, [currentCompany?.lat_long]);

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryStatus(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setRecoveryStatus({ type: 'error', msg: error.message });
      return;
    }
    setRecoveryStatus({ type: 'success', msg: 'Contraseña actualizada. Ingresando...' });
    setNewPassword('');
    setTimeout(async () => {
      setIsPasswordRecovery(false);
      setShowLogin(false);
      await loadOwnProfile();
    }, 1200);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setIsAuthenticated(false);
    setUserProfile(null);
    setLoginData({ email: '', password: '' });
  };

  const enterKioskMode = () => {
    localStorage.setItem('asiste360_kiosk_company', selectedCompanyId ?? '');
    setIsKiosk(true);
  };

  const selectTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    setIsSidebarOpen(false);
  };

  if (isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 -z-10" />
        <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="text-center space-y-2">
            <p className="text-primary font-black text-xs uppercase tracking-[0.5em]">Define tu nueva contraseña</p>
          </div>
          <form onSubmit={handleSetNewPassword} className="bg-card border-2 p-10 rounded-[3rem] shadow-2xl space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Nueva contraseña</label>
              <input
                required
                minLength={6}
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-6 py-4 bg-background border-2 border-muted rounded-2xl focus:border-primary outline-none font-bold transition-all"
                placeholder="••••••••"
                autoFocus
              />
            </div>
            {recoveryStatus && (
              <p className={`text-xs font-black uppercase p-4 rounded-xl ${recoveryStatus.type === 'success' ? 'text-green-700 bg-green-50' : 'text-red-500 bg-red-50'}`}>
                {recoveryStatus.msg}
              </p>
            )}
            <button type="submit" className="w-full py-5 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
              Guardar contraseña
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (isKiosk) {
    let parsedSettings: any = {};
    try {
      parsedSettings = typeof currentCompany?.settings === 'string'
        ? JSON.parse(currentCompany.settings)
        : currentCompany?.settings ?? {};
    } catch (e) {
      console.error('[BIOMETRIA] Error parsing settings:', e);
      parsedSettings = {};
    }
      
    const biometricEnabled = parsedSettings?.features?.biometric_verification === true;



    return (
      <KioskMode
        companyId={selectedCompanyId || ''}
        companyName={currentCompany?.name}
        targetLocation={targetLocation}
        radiusMeters={currentCompany?.radius_limit || 100}
        biometricEnabled={biometricEnabled}
        onSuccess={(uid, type) => { /* Registro exitoso */ }}
        onBack={() => setIsKiosk(false)}
      />
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
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
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Correo electrónico</label>
              <input
                required
                type="email"
                value={loginData.email}
                onChange={e => setLoginData({ ...loginData, email: e.target.value })}
                className="w-full px-6 py-4 bg-background border-2 border-muted rounded-2xl focus:border-primary outline-none font-bold transition-all"
                placeholder="admin@tuempresa.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-muted-foreground ml-2 tracking-widest">Contraseña</label>
              <input
                required
                type="password"
                value={loginData.password}
                onChange={e => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full px-6 py-4 bg-background border-2 border-muted rounded-2xl focus:border-primary outline-none font-bold transition-all"
                placeholder="••••••••"
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
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50 h-20 lg:h-28 flex items-center px-4 lg:px-10 justify-between gap-2">
        <div className="flex items-center gap-3 lg:gap-10 min-w-0">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl text-muted-foreground hover:text-primary hover:bg-muted/50 transition-all shrink-0"
            aria-label="Abrir menú"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="hover:opacity-90 transition-opacity shrink-0">
            <img src="/logo_horizontal.png" alt="Logo" className="h-[56px] lg:h-[110px] w-auto object-contain scale-[1.4] lg:-ml-2" />
          </div>
          <div className="h-10 w-[2px] bg-primary/20 rounded-full hidden md:block" />
          <div className="hidden md:block">
            <p className="text-[10px] text-muted-foreground font-black tracking-[0.4em] uppercase opacity-40">Software de Gestión</p>
            <p className="text-sm font-bold text-primary italic uppercase tracking-tighter">SaaS Enterprise Edition</p>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4 shrink-0">
          {userProfile?.role === 'superadmin' && companies.length > 1 && (
            <div className="hidden sm:flex items-center gap-2 bg-muted/50 p-1 rounded-xl border">
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
          <ThemeToggle />
          <button
            onClick={enterKioskMode}
            className="bg-primary/10 text-primary border-primary/20 hover:bg-primary hover:text-white px-3 lg:px-6 py-2.5 text-xs lg:text-sm font-bold rounded-xl border transition-all active:scale-95 whitespace-nowrap"
          >
            <span className="hidden sm:inline">Modo </span>Quiosco
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 lg:px-5 py-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          />
        )}

        <aside
          className={`${isSidebarOpen ? 'flex animate-in slide-in-from-left duration-300' : 'hidden'} lg:flex fixed lg:static inset-y-0 left-0 z-50 lg:z-auto w-72 bg-card border-r flex-col pt-8 px-6`}
        >
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden self-end mb-4 p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-all"
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="p-5 bg-muted/20 border border-muted rounded-[2rem] space-y-2 shadow-inner">
            <p className="px-4 py-2 text-[10px] font-black text-muted-foreground tracking-[0.2em] uppercase">Navegación</p>
            <button
              onClick={() => selectTab('dashboard')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button
              onClick={() => selectTab('employees')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'employees' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <Users className="w-4 h-4" /> Empleados
            </button>
            <button
              onClick={() => selectTab('leaves')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all relative ${activeTab === 'leaves' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <CalendarOff className="w-4 h-4" /> Novedades
              {pendingLeaveCount > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 bg-amber-500 text-white text-[10px] font-black rounded-full">
                  {pendingLeaveCount}
                </span>
              )}
            </button>
            <button
              onClick={() => selectTab('audit')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'audit' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Auditoría
            </button>
            <button
              onClick={() => selectTab('reports')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'reports' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <FileDown className="w-4 h-4" /> Reportes
            </button>
            <button
              onClick={() => selectTab('config')}
              className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'config' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              <Settings className="w-4 h-4" /> Configuración
            </button>

            {userProfile?.role === 'superadmin' && (
              <>
                <button
                  onClick={() => selectTab('organizations')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'organizations' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                  <Building2 className="w-4 h-4" /> Empresas (SaaS)
                </button>
                <button
                  onClick={() => selectTab('branches')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'branches' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                  <MapPin className="w-4 h-4" /> Sedes Globales
                </button>
                <button
                  onClick={() => selectTab('admins')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'admins' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                  <ShieldCheck className="w-4 h-4" /> Administradores
                </button>
                <button
                  onClick={() => selectTab('rpc-shadow')}
                  className={`w-full flex items-center gap-4 px-4 py-3 text-sm font-black rounded-2xl transition-all ${activeTab === 'rpc-shadow' ? 'bg-background border shadow-md text-primary scale-105' : 'text-muted-foreground hover:bg-muted/50'}`}
                >
                  <FlaskConical className="w-4 h-4" /> Nómina (Servidor) — Beta
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

        <main className="flex-1 p-4 lg:p-8 overflow-y-auto overflow-x-hidden min-w-0">
          <section className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {activeTab === 'dashboard' ? (
              <AdminDashboard companyId={selectedCompanyId} view="analytics" />
            ) : activeTab === 'reports' ? (
              <AdminDashboard companyId={selectedCompanyId} view="reports" />
            ) : activeTab === 'employees' ? (
              <EmployeeManagement companyId={selectedCompanyId} currentProfileId={userProfile?.id || null} />
            ) : activeTab === 'leaves' ? (
              <LeaveManagement companyId={selectedCompanyId} currentProfileId={userProfile?.id || null} onPendingCountChange={setPendingLeaveCount} />
            ) : activeTab === 'audit' ? (
              <AuditSystem companyId={selectedCompanyId} />
            ) : activeTab === 'config' ? (
              <CompanySetup
                companyId={selectedCompanyId}
                onSave={() => userProfile && loadCompaniesForProfile(userProfile)}
              />
            ) : activeTab === 'branches' && userProfile?.role === 'superadmin' ? (
              <BranchManagement onSave={() => userProfile && loadCompaniesForProfile(userProfile)} />
            ) : activeTab === 'admins' && userProfile?.role === 'superadmin' ? (
              <AdminManagement />
            ) : activeTab === 'organizations' && userProfile?.role === 'superadmin' ? (
              <OrganizationManagement />
            ) : activeTab === 'rpc-shadow' && userProfile?.role === 'superadmin' ? (
              <PayrollRpcShadowPanel companyId={selectedCompanyId} />
            ) : (
              <div className="p-20 border-2 border-dashed rounded-[3rem] flex flex-col items-center justify-center text-muted-foreground bg-card animate-pulse">
                <LayoutDashboard className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-bold uppercase tracking-widest text-xs">Módulo en Desarrollo</p>
              </div>
            )}
          </section>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
