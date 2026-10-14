import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import SearchableSelect from '../components/SearchableSelect';
import { 
  User, 
  Lock, 
  Mail, 
  Phone, 
  CreditCard, 
  ArrowRight, 
  HeartPulse,
  Eye,
  EyeOff,
  Stethoscope,
  Award,
  DollarSign,
  HelpCircle,
  X
} from 'lucide-react';

export default function LoginPage({ onLoginSuccess, initialRole = 'paciente' }) {
  const { login, register } = useAuth();
  const [userType, setUserType] = useState(initialRole || 'paciente');
  const [showSolicitarModal, setShowSolicitarModal] = useState(false);
  const [isRegister, setIsRegister] = useState(() => {
    if (typeof window === 'undefined') return false;
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('registro') === '1' || 
           searchParams.get('registro') === 'true' || 
           window.location.pathname.includes('registro');
  });
  const [showPassword, setShowPassword] = useState(false);

  // Formulario Login
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulario Register Paciente
  const [regForm, setRegForm] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    password: '',
    telefono: '',
    tiene_whatsapp: true,
    obra_social_id: '',
    plan_id: ''
  });

  const [obrasSociales, setObrasSociales] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [especialidades, setEspecialidades] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialRole) {
      setUserType(initialRole);
    }
  }, [initialRole]);

  useEffect(() => {
    api.get('/public/obras-sociales')
      .then((res) => {
        if (res.data) setObrasSociales(res.data);
      })
      .catch(console.error);

    api.get('/public/especialidades')
      .then((res) => {
        if (res.data) setEspecialidades(res.data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (regForm.obra_social_id) {
      api.get(`/public/planes?obra_social_id=${regForm.obra_social_id}`)
        .then((res) => {
          if (res.data) setPlanes(res.data);
        })
        .catch(() => setPlanes([]));
    } else {
      setPlanes([]);
    }
  }, [regForm.obra_social_id]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const loggedUser = await login(loginId, loginPassword);
      onLoginSuccess(loggedUser);
    } catch (err) {
      setErrorMsg(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPaciente = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const newUser = await register({ ...regForm, rol: 'paciente' });
      onLoginSuccess(newUser);
    } catch (err) {
      setErrorMsg(err.message || 'Error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '40px 24px 100px' }}>
      <div className="glass-panel" style={{ maxWidth: '520px', margin: '0 auto', padding: '36px 32px' }}>
        
        {/* Selector de Tipo de Usuario: Paciente vs Médico */}
        <div style={{
          display: 'flex',
          background: 'var(--color-bg)',
          padding: '4px',
          borderRadius: '14px',
          marginBottom: '24px',
          border: '1px solid var(--color-border)'
        }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              borderRadius: '10px',
              border: 'none',
              fontWeight: userType === 'paciente' ? 700 : 500,
              background: userType === 'paciente' ? 'var(--color-surface)' : 'transparent',
              boxShadow: userType === 'paciente' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              color: userType === 'paciente' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onClick={() => { setUserType('paciente'); setErrorMsg(''); }}
          >
            <User size={16} /> Soy Paciente
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              borderRadius: '10px',
              border: 'none',
              fontWeight: userType === 'medico' ? 700 : 500,
              background: userType === 'medico' ? 'var(--color-surface)' : 'transparent',
              boxShadow: userType === 'medico' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              color: userType === 'medico' ? 'var(--color-primary)' : 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onClick={() => { setUserType('medico'); setErrorMsg(''); }}
          >
            <Stethoscope size={16} /> Soy Médico / Profesional
          </button>
        </div>

        {/* Header del Formulario */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: userType === 'medico' 
              ? 'linear-gradient(135deg, #059669, #0284c7)' 
              : 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.25)'
          }}>
            {userType === 'medico' ? <Stethoscope size={28} /> : <HeartPulse size={28} />}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {userType === 'medico' 
              ? 'Portal Exclusivo Médicos'
              : (isRegister ? 'Crear Cuenta de Paciente' : 'Iniciar Sesión')}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {userType === 'medico'
              ? 'Ingresá con tu Usuario, Correo o DNI y la contraseña asignada por el Administrador'
              : (isRegister 
                  ? 'Completa tus datos para gestionar y reservar citas' 
                  : 'Ingresá con tu DNI o Correo Electrónico')}
          </p>
        </div>

        {/* Notificación para Médicos o Toggle para Pacientes */}
        {userType === 'medico' ? (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            lineHeight: 1.4
          }}>
            <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: '2px' }}>
              Acceso asignado por Administración:
            </strong>
            El nombre de usuario simple, correo y la contraseña de los profesionales son adjudicados desde el panel de administración. Podés identificarte con cualquiera de ellos o tu DNI.
          </div>
        ) : (
          <div className="flex" style={{ background: 'var(--color-bg)', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                flex: 1,
                background: !isRegister ? 'var(--color-surface)' : 'transparent',
                boxShadow: !isRegister ? 'var(--shadow-sm)' : 'none',
                color: !isRegister ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                fontWeight: !isRegister ? 700 : 500
              }}
              onClick={() => { setIsRegister(false); setErrorMsg(''); }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              className="btn btn-sm"
              style={{
                flex: 1,
                background: isRegister ? 'var(--color-surface)' : 'transparent',
                boxShadow: isRegister ? 'var(--shadow-sm)' : 'none',
                color: isRegister ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                fontWeight: isRegister ? 700 : 500
              }}
              onClick={() => { setIsRegister(true); setErrorMsg(''); }}
            >
              Registrarme
            </button>
          </div>
        )}

        {errorMsg && (
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: '10px',
            fontSize: '0.875rem',
            marginBottom: '20px'
          }}>
            {errorMsg}
          </div>
        )}

        {(!isRegister || userType === 'medico') ? (
          /* FORMULARIO LOGIN (Común para Paciente y Médico) */
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">{userType === 'medico' ? 'Usuario, Correo o DNI' : 'DNI o Correo Electrónico'}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder={userType === 'medico' ? 'Usuario simple, correo o DNI del profesional' : 'Ej: 38123456 o paciente@email.com'}
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  required
                  placeholder="Tu contraseña asignada"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{ paddingRight: '42px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? 'Ingresando...' : (userType === 'medico' ? 'Ingresar a mi Panel Médico' : 'Ingresar a mi cuenta')} <ArrowRight size={16} />
            </button>

            {userType === 'medico' && (
              <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <button
                  type="button"
                  onClick={() => setShowSolicitarModal(true)}
                  className="btn btn-sm"
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--color-primary)',
                    color: 'var(--color-primary)',
                    fontWeight: 600,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '10px'
                  }}
                >
                  <HelpCircle size={16} /> Solicitar login al administrador
                </button>
              </div>
            )}

          </form>
        ) : (
          /* FORMULARIO REGISTRO PACIENTE */
          <form onSubmit={handleRegisterPaciente}>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Nombre <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={regForm.nombre}
                  onChange={(e) => setRegForm({ ...regForm, nombre: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={regForm.apellido}
                  onChange={(e) => setRegForm({ ...regForm, apellido: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">DNI <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Sin puntos"
                  value={regForm.dni}
                  onChange={(e) => setRegForm({ ...regForm, dni: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono / WhatsApp <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <input
                  type="tel"
                  className="form-input"
                  required
                  placeholder="Ej: 2944123456"
                  value={regForm.telefono}
                  onChange={(e) => setRegForm({ ...regForm, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="email"
                className="form-input"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña <span style={{ color: 'var(--color-danger)' }}>*</span></label>
              <input
                type="password"
                className="form-input"
                required
                placeholder="Mínimo 6 caracteres"
                value={regForm.password}
                onChange={(e) => setRegForm({ ...regForm, password: e.target.value })}
              />
            </div>

            {/* Select2 para Obra Social */}
            <div className="form-group">
              <label className="form-label">Obra Social / Prepaga (Opcional)</label>
              <SearchableSelect
                options={obrasSociales.map(os => ({ id: os.id, label: os.nombre }))}
                value={regForm.obra_social_id}
                onChange={(val) => setRegForm({ ...regForm, obra_social_id: val, plan_id: '' })}
                placeholder="Particular / Sin Cobertura"
                searchPlaceholder="Buscar obra social..."
              />
            </div>

            {/* Select2 para Plan */}
            {planes.length > 0 && (
              <div className="form-group">
                <label className="form-label">Plan de Cobertura</label>
                <SearchableSelect
                  options={planes.map(p => ({ id: p.id, label: p.nombre }))}
                  value={regForm.plan_id}
                  onChange={(val) => setRegForm({ ...regForm, plan_id: val })}
                  placeholder="Selecciona tu plan..."
                  searchPlaceholder="Buscar plan..."
                />
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px' }}
            >
              {loading ? 'Creando cuenta...' : 'Crear mi cuenta'} <ArrowRight size={16} />
            </button>
          </form>
        )}

      </div>

      {/* Modal: Solicitar login al administrador */}
      {showSolicitarModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowSolicitarModal(false)}
        >
          <div 
            className="glass-panel"
            style={{
              maxWidth: '460px',
              width: '100%',
              padding: '28px',
              background: 'var(--color-surface)',
              borderRadius: '16px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
              <div className="flex items-center gap-2">
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Stethoscope size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Solicitud de Acceso Profesional
                </h3>
              </div>
              <button 
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowSolicitarModal(false)}
                style={{ padding: '6px', borderRadius: '50%' }}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: '18px' }}>
              Para obtener tu usuario y contraseña de acceso al portal de médicos, o restablecer tus credenciales, por favor comunícate directamente con la Dirección y Administración del Sanatorio.
            </p>

            <div style={{
              background: 'var(--color-bg)',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '20px',
              border: '1px solid var(--color-border)',
              fontSize: '0.875rem'
            }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--color-text-main)' }}>
                🏥 Administración & Sistemas Sanatorio San Carlos
              </div>
              <div style={{ color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>📧 Correo: <strong style={{ color: 'var(--color-text-main)' }}>administracion@sancarlos.com</strong></div>
                <div>📞 Teléfono: <strong style={{ color: 'var(--color-text-main)' }}>(0294) 442-5555</strong></div>
                <div>💬 WhatsApp: <strong style={{ color: 'var(--color-text-main)' }}>+54 9 2944 000000</strong></div>
              </div>
            </div>

            <button 
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setShowSolicitarModal(false)}
            >
              Entendido, volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
