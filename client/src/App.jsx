import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { api } from './api';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import AgendarPage from './pages/AgendarPage';
import LoginPage from './pages/LoginPage';
import MisTurnosPage from './pages/MisTurnosPage';
import DashboardPage from './pages/DashboardPage';

function MainApp() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  // Detección automática de médico por URL (ej: /turnos/bocianjorge, /bocianjorge o ?medico=bocianjorge)
  useEffect(() => {
    const path = window.location.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    const searchParams = new URLSearchParams(window.location.search);

    let slug = searchParams.get('medico');
    if (!slug) {
      if (segments.includes('login') || segments.includes('registro') || searchParams.get('view') === 'login' || searchParams.get('registro') === '1') {
        setCurrentView('login');
        return;
      }
      if (segments.includes('mis-turnos') || searchParams.get('view') === 'mis-turnos') {
        setCurrentView('mis-turnos');
        return;
      }
      if (segments.includes('dashboard') || searchParams.get('view') === 'dashboard') {
        setCurrentView('dashboard');
        return;
      }
      if (segments.length === 1 && !['turnos', 'login', 'dashboard', 'mis-turnos', 'registro'].includes(segments[0])) {
        slug = segments[0];
      } else if (segments.length >= 2 && segments[0] === 'turnos' && !['login', 'dashboard', 'mis-turnos', 'registro'].includes(segments[1])) {
        slug = segments[1];
      }
    }

    if (slug) {
      api.get(`/public/medicos/${slug}`)
        .then(res => {
          if (res.data) {
            setSelectedDoctor(res.data);
            setCurrentView('agendar');
          }
        })
        .catch(err => {
          console.warn('No se encontró médico con slug:', slug, err.message);
        });
    }
  }, []);

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setCurrentView('agendar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBookingSuccess = () => {
    setCurrentView('mis-turnos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (loggedUser) => {
    const isExplicitAdmin = loggedUser?.email && ['oscarns@gmail.com', 'admin@oscarsoft.com.ar'].includes(loggedUser.email.toLowerCase());
    if (['superadmin', 'admin', 'recepcionista', 'medico'].includes(loggedUser.rol) || isExplicitAdmin) {
      setCurrentView('dashboard');
    } else {
      setCurrentView('mis-turnos');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      <main style={{ flex: 1 }}>
        {currentView === 'home' && (
          <HomePage onSelectDoctor={handleSelectDoctor} />
        )}

        {currentView === 'agendar' && (
          <AgendarPage 
            doctor={selectedDoctor} 
            onBack={() => setCurrentView('home')}
            onBookingSuccess={handleBookingSuccess}
          />
        )}

        {currentView === 'login' && (
          <LoginPage initialRole="paciente" onLoginSuccess={handleLoginSuccess} />
        )}

        {currentView === 'login-medico' && (
          <LoginPage initialRole="medico" onLoginSuccess={handleLoginSuccess} />
        )}

        {currentView === 'mis-turnos' && (
          <MisTurnosPage onNewBooking={() => setCurrentView('home')} />
        )}

        {currentView === 'dashboard' && (
          <DashboardPage />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
