import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  XCircle, 
  AlertCircle, 
  Plus, 
  CheckCircle,
  FileText
} from 'lucide-react';

export default function MisTurnosPage({ onNewBooking }) {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelModalTurno, setCancelModalTurno] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchTurnos = () => {
    setLoading(true);
    api.get('/paciente/turnos')
      .then((res) => {
        if (res.data) setTurnos(res.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTurnos();
  }, []);

  const handleCancelTurno = async () => {
    if (!cancelModalTurno) return;
    setCancelling(true);
    try {
      await api.put(`/paciente/turnos/${cancelModalTurno.id}/cancelar`);
      setCancelModalTurno(null);
      setFeedbackMsg('El turno ha sido cancelado con éxito.');
      fetchTurnos();
    } catch (err) {
      alert(err.message || 'Error al cancelar turno.');
    } finally {
      setCancelling(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const proximos = turnos.filter(t => t.fecha >= todayStr && t.estado !== 'cancelado');
  const pasados = turnos.filter(t => t.fecha < todayStr || t.estado === 'cancelado');

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
      <div className="flex items-center justify-between" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Mis Turnos Médicos</h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9375rem' }}>
            Gestiona tus citas programadas y revisa el historial clínico
          </p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={onNewBooking}>
          <Plus size={16} /> Solicitar Nuevo Turno
        </button>
      </div>

      {feedbackMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--color-success-light)', color: '#065f46', borderRadius: '10px', marginBottom: '24px', fontWeight: 600 }}>
          {feedbackMsg}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--color-text-muted)' }}>
          Cargando tus citas...
        </div>
      ) : turnos.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <Calendar size={48} style={{ color: 'var(--color-text-subtle)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '8px' }}>
            Aún no tienes turnos registrados
          </h3>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '24px' }}>
            Encuentra un especialista y reserva una cita en menos de 2 minutos.
          </p>
          <button className="btn btn-primary" onClick={onNewBooking}>
            <Calendar size={16} /> Buscar y Agendar Turno
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          
          {/* Próximos Turnos */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={20} style={{ color: 'var(--color-primary)' }} /> Próximas Citas ({proximos.length})
            </h2>

            {proximos.length === 0 ? (
              <div className="card" style={{ padding: '24px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                No tienes turnos pendientes próximos.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {proximos.map((t) => (
                  <div key={t.id} className="card flex flex-col justify-between">
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
                          <span>{t.fecha}</span>
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
                            <span>{t.unidad_nombre} {t.calle ? `(${t.calle} ${t.numero})` : ''}</span>
                          </div>
                        )}
                        {t.obra_social_nombre && (
                          <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>
                            <strong>Cobertura:</strong> {t.obra_social_nombre} {t.plan_nombre ? `(${t.plan_nombre})` : ''}
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

          {/* Historial de Turnos */}
          {pasados.length > 0 && (
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '16px', color: 'var(--color-text-muted)' }}>
                Historial de Consultas Anteriores ({pasados.length})
              </h2>
              <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                  <thead style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Fecha</th>
                      <th style={{ padding: '12px 16px' }}>Profesional</th>
                      <th style={{ padding: '12px 16px' }}>Especialidad</th>
                      <th style={{ padding: '12px 16px' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pasados.map((t) => (
                      <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '12px 16px' }}>{t.fecha} - {t.hora_inicio.substring(0, 5)} hs</td>
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

      {/* Modal de Cancelación */}
      {cancelModalTurno && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px', color: 'var(--color-danger)' }}>
              ¿Cancelar este turno?
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Estás a punto de cancelar tu turno con <strong>Dr. {cancelModalTurno.medico_nombre} {cancelModalTurno.medico_apellido}</strong> para el <strong>{cancelModalTurno.fecha} a las {cancelModalTurno.hora_inicio.substring(0, 5)} hs</strong>.
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
