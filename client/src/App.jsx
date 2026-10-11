import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
          <LoginPage onLoginSuccess={handleLoginSuccess} />
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
