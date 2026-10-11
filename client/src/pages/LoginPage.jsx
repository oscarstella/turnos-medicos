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
  EyeOff
} from 'lucide-react';

export default function LoginPage({ onLoginSuccess }) {
  const { login, register } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Formulario Login
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Formulario Register
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
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/public/obras-sociales')
      .then((res) => {
        if (res.data) setObrasSociales(res.data);
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const newUser = await register(regForm);
      onLoginSuccess(newUser);
    } catch (err) {
      setErrorMsg(err.message || 'Error al registrar la cuenta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '60px 24px 100px' }}>
      <div className="glass-panel" style={{ maxWidth: '480px', margin: '0 auto', padding: '36px 32px' }}>
        
        {/* Header del Formulario */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent))',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.25)'
          }}>
            <HeartPulse size={28} />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {isRegister ? 'Crear Cuenta de Paciente' : 'Iniciar Sesión'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            {isRegister ? 'Completa tus datos para gestionar y reservar citas' : 'Ingresa con tu DNI o Correo Electrónico'}
          </p>
        </div>

        {/* Toggle Login / Register */}
        <div className="flex" style={{ background: 'var(--color-bg)', padding: '4px', borderRadius: '12px', marginBottom: '24px' }}>
          <button
            type="button"
            className="btn btn-sm"
            style={{
              flex: 1,
              background: !isRegister ? 'var(--color-surface)' : 'transparent',
              boxShadow: !isRegister ? 'var(--shadow-sm)' : 'none',
              color: !isRegister ? 'var(--color-text-main)' : 'var(--color-text-muted)'
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
              color: isRegister ? 'var(--color-text-main)' : 'var(--color-text-muted)'
            }}
            onClick={() => { setIsRegister(true); setErrorMsg(''); }}
          >
            Registrarme
          </button>
        </div>

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

        {!isRegister ? (
          /* FORMULARIO LOGIN */
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">DNI o Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="Ej: 38123456 o usuario@email.com"
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
                  placeholder="Tu contraseña"
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
              {loading ? 'Ingresando...' : 'Ingresar a mi cuenta'} <ArrowRight size={16} />
            </button>

            {/* Credenciales iniciales */}
            <div style={{
              marginTop: '24px',
              padding: '12px',
              borderRadius: '10px',
              background: 'var(--color-bg)',
              fontSize: '0.75rem',
              color: 'var(--color-text-muted)',
              border: '1px dashed var(--color-border)'
            }}>
              <strong style={{ color: 'var(--color-primary)' }}>Acceso Administrador:</strong><br />
              Email: <code>admin@oscarsoft.com.ar</code> | Contraseña: <code>Admin1234!</code>
            </div>
          </form>
        ) : (
          /* FORMULARIO REGISTRO */
          <form onSubmit={handleRegister}>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={regForm.nombre}
                  onChange={(e) => setRegForm({ ...regForm, nombre: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Apellido</label>
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
                <label className="form-label">DNI</label>
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
                <label className="form-label">Teléfono</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Ej: 2944123456"
                  value={regForm.telefono}
                  onChange={(e) => setRegForm({ ...regForm, telefono: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Correo Electrónico</label>
              <input
                type="email"
                className="form-input"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
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
    </div>
  );
}
