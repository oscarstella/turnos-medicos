import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  XCircle, 
  Plus, 
  CheckCircle,
  Search,
  User,
  ShieldCheck,
  Phone
} from 'lucide-react';

/**
 * Formatea fechas al formato oficial de Argentina: DD/MM/AAAA (xx/xx/xxxx)
 */
export function formatFechaArgentina(fechaStr) {
  if (!fechaStr) return '';
  const clean = String(fechaStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  return fechaStr;
}

export default function MisTurnosPage({ onNewBooking }) {
  const { user } = useAuth();
  const [dniInput, setDniInput] = useState(() => user?.dni || '');
  const [activeDni, setActiveDni] = useState(() => user?.dni || '');
  const [pacienteInfo, setPacienteInfo] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  // Modal Cancelación
  const [cancelModalTurno, setCancelModalTurno] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchTurnosPorDni = async (dniToSearch) => {
    if (!dniToSearch || !dniToSearch.trim()) {
      setSearchError('Por favor ingresa un número de DNI.');
      return;
    }

    const cleanDni = dniToSearch.trim().replace(/\D/g, '');
    if (cleanDni.length < 6) {
      setSearchError('El DNI debe contener al menos 6 números.');
      return;
    }

    setLoading(true);
    setSearchError('');
    setFeedbackMsg('');

    try {
      // Intentar primero endpoint público por DNI
      const res = await api.get(`/public/turnos-por-dni?dni=${cleanDni}`);
      if (res.data) {
        setPacienteInfo(res.data.paciente || null);
        setTurnos(res.data.turnos || []);
        setActiveDni(cleanDni);
        setHasSearched(true);
      }
    } catch (err) {
      // Si el paciente está logueado pero falló el público, intentar paciente/turnos
      if (user) {
        try {
          const authRes = await api.get('/paciente/turnos');
          setPacienteInfo(user);
          setTurnos(authRes.data || []);
          setActiveDni(user.dni || cleanDni);
          setHasSearched(true);
          return;
        } catch (e2) {
          // continuar con el error
        }
      }
      setTurnos([]);
      setPacienteInfo(null);
      setSearchError(err.message || `No encontramos turnos registrados para el DNI ${cleanDni}.`);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  // Cargar automáticamente si el usuario ya está logueado
  useEffect(() => {
    if (user?.dni) {
      fetchTurnosPorDni(user.dni);
    }
  }, [user]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchTurnosPorDni(dniInput);
  };

  const handleCancelTurno = async () => {
    if (!cancelModalTurno) return;
    setCancelling(true);
    try {
      const dniParaCancelar = activeDni || cancelModalTurno.paciente_dni || user?.dni;
      await api.put(`/public/turnos/${cancelModalTurno.id}/cancelar`, { dni: dniParaCancelar });
      
      setCancelModalTurno(null);
      setFeedbackMsg('El turno ha sido cancelado exitosamente y el horario fue liberado.');
      fetchTurnosPorDni(activeDni);
    } catch (err) {
      // Si falla públicamente e intentamos logueados
      if (user) {
        try {
          await api.put(`/paciente/turnos/${cancelModalTurno.id}/cancelar`);
          setCancelModalTurno(null);
          setFeedbackMsg('El turno ha sido cancelado con éxito.');
          fetchTurnosPorDni(activeDni);
          return;
        } catch (e2) {
          alert(e2.message || 'Error al cancelar turno.');
        }
      } else {
        alert(err.message || 'Error al cancelar turno.');
      }
    } finally {
      setCancelling(false);
    }
  };

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const proximos = turnos.filter(t => String(t.fecha).split('T')[0] >= todayStr && t.estado !== 'cancelado');
  const pasados = turnos.filter(t => String(t.fecha).split('T')[0] < todayStr || t.estado === 'cancelado');

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'confirmado':
      case 'asignado':
        return <span className="badge badge-primary"><CheckCircle size={12} /> Confirmado</span>;
      case 'asistio':
        return <span className="badge badge-success">Asistió</span>;
      case 'ausente':
        return <span className="badge badge-warning">Ausente</span>;
      case 'cancelado':
        return <span className="badge badge-danger"><XCircle size={12} /> Cancelado</span>;
      default:
        return <span className="badge badge-neutral">{estado}</span>;
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '40px 24px 80px' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Mis Turnos Médicos</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            Consultá y gestioná tus citas médicas programadas ingresando tu número de DNI
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onNewBooking}>
          <Plus size={16} /> Solicitar Nuevo Turno
        </button>
      </div>

      {/* Buscador de DNI */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px', background: 'var(--color-surface)' }}>
        <form onSubmit={handleSearchSubmit} className="flex items-end gap-3" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '240px' }}>
            <label className="form-label" style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} style={{ color: 'var(--color-primary)' }} />
              DNI del Paciente <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ingresá tu DNI sin puntos (ej: 35123456)"
              value={dniInput}
              onChange={(e) => setDniInput(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '42px' }}>
            <Search size={16} /> {loading ? 'Consultando...' : 'Consultar Mis Turnos'}
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '0.875rem' }}>
            {searchError}
          </div>
        )}

        {pacienteInfo && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.9375rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>
              {pacienteInfo.nombre?.[0]?.toUpperCase() || 'P'}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                {pacienteInfo.nombre} {pacienteInfo.apellido}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                DNI: <strong>{pacienteInfo.dni}</strong> {pacienteInfo.email ? `• ${pacienteInfo.email}` : ''}
              </div>
            </div>
          </div>
        )}
      </div>

      {feedbackMsg && (
        <div style={{ padding: '14px 18px', background: 'var(--color-success-light)', color: '#065f46', borderRadius: '10px', marginBottom: '24px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} /> {feedbackMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          Cargando citas médicas...
        </div>
      ) : !hasSearched ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Calendar size={48} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Consultá tus turnos agendados
          </h3>
          <p style={{ color: 'var(--color-text-muted)', maxWidth: '420px', margin: '0 auto 24px' }}>
            Ingresá tu número de DNI en el buscador superior para ver tus citas activas y el historial de consultas.
          </p>
        </div>
      ) : turnos.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Calendar size={48} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            No registramos turnos para este DNI
          </h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            Podés reservar una nueva consulta médica ahora mismo en sencillos pasos.
          </p>
          <button className="btn btn-primary" onClick={onNewBooking}>
            <Calendar size={16} /> Buscar y Agendar Turno
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Próximas Citas */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} style={{ color: 'var(--color-primary)' }} /> Próximas Citas ({proximos.length})
            </h2>

            {proximos.length === 0 ? (
              <div className="card" style={{ padding: '24px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No tenés turnos pendientes próximos.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {proximos.map((t) => (
                  <div key={t.id} className="card flex flex-col justify-between" style={{ borderLeft: '4px solid var(--color-primary)' }}>
                    <div>
                      <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase' }}>
                          {t.especialidad_nombre || 'Consulta Médica'}
                        </span>
                        {getStatusBadge(t.estado)}
                      </div>

                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '8px' }}>
                        Dr. {t.medico_nombre} {t.medico_apellido}
                      </h3>

                      <div className="flex flex-col gap-2" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
                        <div className="flex items-center gap-2">
                          <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                          <span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                            {formatFechaArgentina(t.fecha)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} style={{ color: 'var(--color-primary)' }} />
                          <span style={{ fontWeight: 600, color: 'var(--color-text-main)' }}>
                            {t.hora_inicio.substring(0, 5)} hs
                          </span>
                        </div>
                        {t.unidad_nombre && (
                          <div className="flex items-center gap-2">
                            <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
                            <span>{t.unidad_nombre} {t.calle ? `(${t.calle} ${t.numero || ''})` : ''}</span>
                          </div>
                        )}
                        {t.obra_social_nombre && (
                          <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                            <strong>Cobertura:</strong> {t.obra_social_nombre} {t.plan_nombre ? `(${t.plan_nombre})` : ''}
                          </div>
                        )}
                        {t.notas && (
                          <div style={{ fontSize: '0.8125rem', fontStyle: 'italic', color: 'var(--color-text-subtle)' }}>
                            Motivo: "{t.notas}"
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCancelModalTurno(t)}
                        style={{ color: 'var(--color-danger)' }}
                      >
                        <XCircle size={14} /> Cancelar Cita
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Historial de Turnos Pasados */}
          {pasados.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: 'var(--color-text-muted)' }}>
                Historial de Consultas Anteriores ({pasados.length})
              </h2>
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Fecha (DD/MM/AAAA)</th>
                      <th style={{ padding: '12px 16px' }}>Profesional</th>
                      <th style={{ padding: '12px 16px' }}>Especialidad</th>
                      <th style={{ padding: '12px 16px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasados.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {formatFechaArgentina(t.fecha)} - {t.hora_inicio.substring(0, 5)} hs
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>Dr. {t.medico_nombre} {t.medico_apellido}</td>
                        <td style={{ padding: '12px 16px' }}>{t.especialidad_nombre || '-'}</td>
                        <td style={{ padding: '12px 16px' }}>{getStatusBadge(t.estado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* Modal de Cancelación de Turno */}
      {cancelModalTurno && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--color-danger)' }}>
              ¿Cancelar este turno?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Estás a punto de cancelar tu turno con <strong>Dr. {cancelModalTurno.medico_nombre} {cancelModalTurno.medico_apellido}</strong> para el <strong>{formatFechaArgentina(cancelModalTurno.fecha)} a las {cancelModalTurno.hora_inicio.substring(0, 5)} hs</strong>.
            </p>
            <div className="flex justify-end gap-3">
              <button className="btn btn-secondary" onClick={() => setCancelModalTurno(null)} disabled={cancelling}>
                Conservar Turno
              </button>
              <button className="btn btn-danger" onClick={handleCancelTurno} disabled={cancelling}>
                {cancelling ? 'Cancelando...' : 'Sí, Cancelar Turno'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
