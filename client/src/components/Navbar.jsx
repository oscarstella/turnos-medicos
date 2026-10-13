import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  HeartPulse, 
  Calendar, 
  User, 
  LogOut, 
  LayoutDashboard, 
  Moon, 
  Sun, 
  Menu, 
  X,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';

export default function Navbar({ currentView, setCurrentView }) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('turnos_theme') || 'light');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('turnos_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(t => t === 'light' ? 'dark' : 'light');
  };

  const isExplicitAdminEmail = user?.email && ['oscarns@gmail.com', 'admin@oscarsoft.com.ar'].includes(user.email.toLowerCase());
  const isAdminOrStaff = user && (['superadmin', 'admin', 'recepcionista', 'medico'].includes(user.rol) || isExplicitAdminEmail);

  const getRoleBadge = (rol) => {
    if (isExplicitAdminEmail) {
      return <span className="badge badge-primary"><ShieldCheck size={12} /> Administrador</span>;
    }
    switch (rol) {
      case 'superadmin':
      case 'admin':
        return <span className="badge badge-primary"><ShieldCheck size={12} /> Administrador</span>;
      case 'recepcionista':
        return <span className="badge badge-warning">Recepcionista / Telefonista</span>;
      case 'medico':
        return <span className="badge badge-success">Médico</span>;
      default:
        return <span className="badge badge-neutral">Paciente</span>;
    }
  };

  const handleMedicosClick = () => {
    if (user?.rol === 'medico') {
      setCurrentView('dashboard');
    } else {
      setCurrentView('login-medico');
    }
    setMobileMenuOpen(false);
  };

  return (
    <header className="glass-panel" style={{ position: 'sticky', top: 0, zIndex: 100, borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
      <div className="container flex items-center justify-between" style={{ height: '72px' }}>
        
        {/* Brand Logo */}
        <div 
          className="flex items-center gap-3 cursor-pointer" 
          onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }}
          style={{ cursor: 'pointer' }}
        >
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            padding: '10px',
            borderRadius: '12px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)'
          }}>
            <HeartPulse size={24} />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1, color: 'var(--color-text-main)' }}>
              OscarSoft <span style={{ color: 'var(--color-primary)' }}>Turnos</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
              Agenda Médica Digital
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex items-center gap-2" style={{ display: 'none' }} id="desktop-nav">
          <style>{`
            @media (min-width: 768px) {
              #desktop-nav { display: flex !important; }
              #mobile-menu-btn { display: none !important; }
            }
          `}</style>

          <button 
            className={`btn ${currentView === 'home' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setCurrentView('home')}
          >
            <Calendar size={16} /> Buscar Turno
          </button>

          <button 
            className={`btn ${currentView === 'login-medico' || (user?.rol === 'medico' && currentView === 'dashboard') ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={handleMedicosClick}
            style={{ fontWeight: 600 }}
          >
            <Stethoscope size={16} /> Médicos
          </button>

          {user && (
            <button 
              className={`btn ${currentView === 'mis-turnos' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setCurrentView('mis-turnos')}
            >
              <User size={16} /> Mis Turnos
            </button>
          )}

          {isAdminOrStaff && (
            <button 
              className={`btn ${currentView === 'dashboard' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setCurrentView('dashboard')}
            >
              <LayoutDashboard size={16} /> Panel de Control
            </button>
          )}

          {/* Theme Toggle Button */}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={toggleTheme}
            title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {/* User Section */}
          {user ? (
            <div className="flex items-center gap-3" style={{ marginLeft: '8px', paddingLeft: '12px', borderLeft: '1px solid var(--color-border)' }}>
              <div className="flex flex-col" style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user.nombre} {user.apellido}</span>
                {getRoleBadge(user.rol)}
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={logout} 
                title="Cerrar Sesión"
                style={{ padding: '8px', color: 'var(--color-danger)' }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button 
              className="btn btn-primary btn-sm"
              onClick={() => setCurrentView('login')}
              style={{ marginLeft: '8px' }}
            >
              <User size={16} /> Iniciar Sesión / Registro
            </button>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <div className="flex items-center gap-2" id="mobile-menu-btn">
          <button className="btn btn-secondary btn-sm" onClick={toggleTheme}>
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="flex flex-col gap-3">
            <button 
              className={`btn ${currentView === 'home' ? 'btn-primary' : 'btn-secondary'} justify-between`}
              onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }}
            >
              <span className="flex items-center gap-2"><Calendar size={18} /> Buscar Turno</span>
            </button>

            <button 
              className={`btn ${currentView === 'login-medico' || (user?.rol === 'medico' && currentView === 'dashboard') ? 'btn-primary' : 'btn-secondary'} justify-between`}
              onClick={handleMedicosClick}
            >
              <span className="flex items-center gap-2"><Stethoscope size={18} /> Portal Médicos</span>
            </button>

            {user && (
              <button 
                className={`btn ${currentView === 'mis-turnos' ? 'btn-primary' : 'btn-secondary'} justify-between`}
                onClick={() => { setCurrentView('mis-turnos'); setMobileMenuOpen(false); }}
              >
                <span className="flex items-center gap-2"><User size={18} /> Mis Turnos</span>
              </button>
            )}

            {isAdminOrStaff && (
              <button 
                className={`btn ${currentView === 'dashboard' ? 'btn-primary' : 'btn-secondary'} justify-between`}
                onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }}
              >
                <span className="flex items-center gap-2"><LayoutDashboard size={18} /> Panel de Control</span>
              </button>
            )}

            {user ? (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{user.nombre} {user.apellido}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{user.email}</div>
                  </div>
                  {getRoleBadge(user.rol)}
                </div>
                <button 
                  className="btn btn-danger btn-sm" 
                  onClick={() => { logout(); setMobileMenuOpen(false); }}
                  style={{ width: '100%' }}
                >
                  <LogOut size={16} /> Cerrar Sesión
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-primary"
                onClick={() => { setCurrentView('login'); setMobileMenuOpen(false); }}
                style={{ marginTop: '8px' }}
              >
                <User size={18} /> Iniciar Sesión / Registro
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
