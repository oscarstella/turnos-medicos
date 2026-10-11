import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { obtenerAvatarDefault } from '../utils/avatar';
import SearchableSelect from '../components/SearchableSelect';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Phone, 
  Mail, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function AgendarPage({ doctor, onBack, onBookingSuccess }) {
  const { user } = useAuth();
  const [doctorDetail, setDoctorDetail] = useState(null);
  const [loadingDoctor, setLoadingDoctor] = useState(true);

  // Fecha seleccionada (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotMessage, setSlotMessage] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Modal de confirmación
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Formulario de paciente
  const [patientForm, setPatientForm] = useState({
    nombre: user ? user.nombre : '',
    apellido: user ? user.apellido || '' : '',
    dni: user ? user.dni || '' : '',
    email: user ? user.email || '' : '',
    telefono: user ? user.telefono || '' : '',
    tiene_whatsapp: user ? !!user.tiene_whatsapp : true,
    obra_social_id: user ? user.obra_social_id || '' : '',
    plan_id: user ? user.plan_id || '' : '',
    notas: ''
  });

  const [obrasSociales, setObrasSociales] = useState([]);
  const [planes, setPlanes] = useState([]);

  useEffect(() => {
    if (!doctor || !doctor.id) return;
    setLoadingDoctor(true);
    api.get(`/public/medicos/${doctor.id}`)
      .then((res) => {
        if (res.data) setDoctorDetail(res.data);
      })
      .catch(console.error)
      .finally(() => setLoadingDoctor(false));

    api.get('/public/obras-sociales')
      .then((res) => {
        if (res.data) setObrasSociales(res.data);
      })
      .catch(console.error);
  }, [doctor]);

  useEffect(() => {
    if (patientForm.obra_social_id) {
      api.get(`/public/planes?obra_social_id=${patientForm.obra_social_id}`)
        .then((res) => {
          if (res.data) setPlanes(res.data);
        })
        .catch(() => setPlanes([]));
    } else {
      setPlanes([]);
    }
  }, [patientForm.obra_social_id]);

  const [systemConfig, setSystemConfig] = useState({ meses_agenda: 3 });
  const [activeMonthKey, setActiveMonthKey] = useState(null);
  const [agendaCerradaAviso, setAgendaCerradaAviso] = useState(null);

  useEffect(() => {
    api.get('/public/config')
      .then(res => {
        if (res.data) setSystemConfig(res.data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!doctor || !doctor.id || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setSlotMessage('');

    api.get(`/public/disponibilidad?medico_id=${doctor.id}&fecha=${selectedDate}`)
      .then((res) => {
        if (res.agenda_cerrada) {
          setAgendaCerradaAviso(res.dia_apertura);
          setSlots([]);
        } else if (res.slots) {
          setAgendaCerradaAviso(null);
          setSlots(res.slots);
          setSlotMessage(res.message || '');
        }
      })
      .catch((err) => {
        setSlots([]);
        setSlotMessage(err.message || 'No se pudo consultar la disponibilidad.');
      })
      .finally(() => setLoadingSlots(false));
  }, [doctor, selectedDate]);

  const MESES_COMPLETOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DIAS_NORM = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

  const mesesConfig = parseInt(systemConfig?.meses_agenda || 3, 10);
  let totalDias = mesesConfig * 30;
  if (doctorDetail?.dias_antelacion_agenda && Number(doctorDetail.dias_antelacion_agenda) > 0) {
    totalDias = Number(doctorDetail.dias_antelacion_agenda);
  }

  const hoy = new Date();
  const diaActualMes = hoy.getDate();
  const diaApertura = doctorDetail?.dia_apertura_agenda ? Number(doctorDetail.dia_apertura_agenda) : null;
  const isAgendaCerrada = diaApertura && diaApertura > 0 && diaActualMes < diaApertura;

  // Agrupar semanas y días por mes según el tope configurado
  const monthsMap = new Map();
  const baseDate = new Date();

  for (let i = 0; i <= totalDias; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);
    if (d.getDay() === 0) continue; // Domingo sin atención

    const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
    const monthLabel = `${MESES_COMPLETOS[d.getMonth()]} ${d.getFullYear()}`;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayOfWeek = d.getDay();
    const dayName = DIAS_SEMANA[dayOfWeek];
    const dayNorm = DIAS_NORM[dayOfWeek];
    const dayNum = d.getDate();

    const tieneAtencion = doctorDetail?.horarios && Array.isArray(doctorDetail.horarios)
      ? doctorDetail.horarios.some(h => {
          const normH = (h.dia_semana || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
          return normH === dayNorm;
        })
      : false;

    if (!monthsMap.has(monthKey)) {
      monthsMap.set(monthKey, {
        monthKey,
        monthLabel,
        days: []
      });
    }

    monthsMap.get(monthKey).days.push({
      dateStr,
      dayName,
      dayNum,
      dayOfWeek,
      monthName: MESES[d.getMonth()],
      tieneAtencion
    });
  }

  const monthsList = Array.from(monthsMap.values());
  const currentMonthKey = activeMonthKey || monthsList[0]?.monthKey;
  const currentMonthObj = monthsList.find(m => m.monthKey === currentMonthKey) || monthsList[0];

  useEffect(() => {
    if ((!selectedDate || !currentMonthObj?.days?.some(d => d.dateStr === selectedDate)) && currentMonthObj?.days) {
      const firstAvailable = currentMonthObj.days.find(d => d.tieneAtencion);
      if (firstAvailable) setSelectedDate(firstAvailable.dateStr);
    }
  }, [currentMonthKey, doctorDetail]);

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setErrorMsg('');
    setSubmitting(true);

    try {
      const payload = {
        medico_id: doctor.id,
        especialidad_id: doctorDetail?.especialidades?.[0]?.id || null,
        obra_social_id: patientForm.obra_social_id || null,
        plan_id: patientForm.plan_id || null,
        unidad_id: selectedSlot.unidad_id || null,
        fecha: selectedDate,
        hora_inicio: selectedSlot.hora_inicio,
        hora_fin: selectedSlot.hora_fin,
        notas: patientForm.notas || null,
        paciente: !user ? {
          nombre: patientForm.nombre,
          apellido: patientForm.apellido,
          dni: patientForm.dni,
          email: patientForm.email,
          telefono: patientForm.telefono,
          tiene_whatsapp: patientForm.tiene_whatsapp
        } : null
      };

      const res = await api.post('/public/agendar', payload);
      setBookingConfirmed(res.turno);
      setShowModal(false);
    } catch (err) {
      setErrorMsg(err.message || 'No se pudo reservar el turno.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!doctor) return null;
  const avatarSrc = doctor.foto_perfil || obtenerAvatarDefault(doctor.nombre, doctor.apellido);

  return (
    <div className="container" style={{ padding: '32px 24px 80px' }}>
      
      {/* Botón Volver */}
      <button 
        className="btn btn-secondary btn-sm"
        onClick={onBack}
        style={{ marginBottom: '24px' }}
      >
        <ArrowLeft size={16} /> Volver a la búsqueda
      </button>

      {/* Pantalla de Éxito */}
      {bookingConfirmed ? (
        <div className="glass-panel animate-fade-in" style={{ padding: '48px 32px', maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <CheckCircle size={44} />
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '12px' }}>
            ¡Tu Turno está Confirmado!
          </h2>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: '32px' }}>
            Te enviamos los detalles a tu correo electrónico y registro de citas.
          </p>

          <div className="card" style={{ textAlign: 'left', marginBottom: '32px', background: 'var(--color-bg)' }}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-bottom pb-2">
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Profesional:</span>
                <span style={{ fontWeight: 700 }}>Dr. {bookingConfirmed.medico_nombre} {bookingConfirmed.medico_apellido}</span>
              </div>
              <div className="flex items-center justify-between border-bottom pb-2">
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Fecha:</span>
                <span style={{ fontWeight: 700 }}>{bookingConfirmed.fecha}</span>
              </div>
              <div className="flex items-center justify-between border-bottom pb-2">
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Horario:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{bookingConfirmed.hora_inicio.substring(0, 5)} hs</span>
              </div>
              <div className="flex items-center justify-between border-bottom pb-2">
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Paciente:</span>
                <span style={{ fontWeight: 600 }}>{bookingConfirmed.paciente_nombre} {bookingConfirmed.paciente_apellido} (DNI {bookingConfirmed.paciente_dni})</span>
              </div>
              {bookingConfirmed.unidad_nombre && (
                <div className="flex items-center justify-between">
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Sede de Atención:</span>
                  <span style={{ fontWeight: 600 }}>{bookingConfirmed.unidad_nombre} ({bookingConfirmed.calle} {bookingConfirmed.numero})</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center gap-3">
            <button className="btn btn-secondary" onClick={onBack}>
              Volver al inicio
            </button>
            <button className="btn btn-primary" onClick={onBookingSuccess}>
              Ver mis turnos agendados
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-8">
          
          {/* Columna Izquierda: Perfil del Médico con Foto Circular */}
          <div className="card" style={{ height: 'fit-content', textAlign: 'center', padding: '32px 24px' }}>
            <img 
              src={avatarSrc} 
              alt={`Dr. ${doctor.nombre} ${doctor.apellido}`}
              style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '4px solid white',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                margin: '0 auto 16px'
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/turnos/assets/img/avatar_doctor.jpg';
              }}
            />
            
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '4px' }}>
              Dr. {doctor.nombre} {doctor.apellido}
            </h2>
            {doctor.matricula && (
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-subtle)', marginBottom: '12px' }}>
                M.N. / M.P. {doctor.matricula}
              </div>
            )}

            {/* Especialidades */}
            <div className="flex flex-wrap justify-center gap-1" style={{ marginBottom: '20px' }}>
              {(doctorDetail?.especialidades || doctor.especialidades || []).map((e) => (
                <span key={e.id} className="badge badge-primary">
                  {e.nombre}
                </span>
              ))}
            </div>

            {/* Horarios Habituales */}
            {doctorDetail?.horarios && doctorDetail.horarios.length > 0 && (
              <div style={{ textAlign: 'left', borderTop: '1px solid var(--color-border)', paddingTop: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                  Atención Semanal
                </div>
                <div className="flex flex-col gap-2" style={{ fontSize: '0.8125rem' }}>
                  {doctorDetail.horarios.map((h) => (
                    <div key={h.id} className="flex items-center justify-between" style={{ padding: '6px 10px', background: 'var(--color-bg)', borderRadius: '8px' }}>
                      <span style={{ fontWeight: 600 }}>{h.dia_semana}</span>
                      <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                        {h.hora_inicio.substring(0, 5)} - {h.hora_fin.substring(0, 5)} hs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Biografía */}
            {doctor.biografia && (
              <div style={{ textAlign: 'left', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  {doctor.biografia}
                </p>
              </div>
            )}
          </div>

          {/* Columna Derecha: Selector de Fecha y Slots */}
          <div style={{ gridColumn: 'span 2' }}>
            
            {/* Aviso si la agenda del mes está bloqueada por día de apertura */}
            {(isAgendaCerrada || agendaCerradaAviso) && (
              <div className="card" style={{ marginBottom: '24px', padding: '24px', borderLeft: '4px solid var(--color-warning)', background: '#fffbeb' }}>
                <div className="flex items-start gap-3">
                  <AlertCircle size={24} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h4 style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>
                      Agenda mensual aún no habilitada
                    </h4>
                    <p style={{ fontSize: '0.875rem', color: '#b45309', margin: 0, lineHeight: 1.5 }}>
                      La agenda de turnos para este profesional se abre a partir del <strong>día {diaApertura || agendaCerradaAviso} de cada mes</strong>. Por favor, vuelve a ingresar en esa fecha para seleccionar tu turno.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Selector de Meses y Días / Semanas */}
            <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CalendarIcon size={18} style={{ color: 'var(--color-primary)' }} /> Elige el día de tu turno
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                  Tope de agenda: {mesesConfig} {mesesConfig === 1 ? 'mes' : 'meses'} ({totalDias} días)
                </span>
              </div>

              {/* Pestañas de Meses configurados en el tope */}
              {monthsList.length > 1 && (
                <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '12px', marginBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                  {monthsList.map((m) => {
                    const isCurrent = currentMonthKey === m.monthKey;
                    return (
                      <button
                        key={m.monthKey}
                        type="button"
                        onClick={() => setActiveMonthKey(m.monthKey)}
                        className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-outline'}`}
                        style={{
                          borderRadius: '999px',
                          fontWeight: 700,
                          fontSize: '0.8125rem',
                          padding: '6px 14px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        {m.monthLabel}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grilla de Días del Mes Activo */}
              {currentMonthObj ? (
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {currentMonthObj.monthLabel}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '8px' }}>
                    {currentMonthObj.days.map((d) => {
                      const isSelected = selectedDate === d.dateStr;
                      const hasAttendance = d.tieneAtencion;

                      return (
                        <div
                          key={d.dateStr}
                          onClick={() => {
                            if (hasAttendance) setSelectedDate(d.dateStr);
                          }}
                          style={{
                            padding: '12px 6px',
                            borderRadius: '14px',
                            border: `2px solid ${isSelected ? 'var(--color-primary)' : hasAttendance ? 'var(--color-border)' : 'transparent'}`,
                            background: isSelected 
                              ? 'var(--color-primary-light)' 
                              : hasAttendance 
                                ? 'var(--color-surface)' 
                                : 'var(--color-bg)',
                            color: isSelected ? 'var(--color-primary-dark)' : hasAttendance ? 'var(--color-text-main)' : 'var(--color-text-muted)',
                            opacity: hasAttendance ? 1 : 0.45,
                            textAlign: 'center',
                            cursor: hasAttendance ? 'pointer' : 'not-allowed',
                            transition: 'all 0.2s',
                            userSelect: 'none',
                            boxShadow: isSelected ? '0 4px 12px rgba(14, 165, 233, 0.15)' : 'none'
                          }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: isSelected ? 'var(--color-primary-dark)' : 'var(--color-text-muted)' }}>
                            {d.dayName}
                          </div>
                          <div style={{ fontSize: '1.375rem', fontWeight: 800, margin: '2px 0' }}>
                            {d.dayNum}
                          </div>
                          <div style={{ fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            {hasAttendance ? (
                              <span style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-success)' }}>Disponible</span>
                            ) : (
                              <span>Sin atención</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--color-text-muted)' }}>
                  No hay días configurados dentro del tope actual.
                </div>
              )}
            </div>

            {/* Grilla de Horarios Disponibles */}
            <div className="card" style={{ padding: '24px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} style={{ color: 'var(--color-primary)' }} /> Horarios para el {selectedDate}
                </h3>
                {selectedSlot && (
                  <span className="badge badge-success">
                    Seleccionado: {selectedSlot.hora_inicio} hs
                  </span>
                )}
              </div>

              {loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                  Consultando turnos disponibles...
                </div>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                  <AlertCircle size={36} style={{ margin: '0 auto 12px', color: 'var(--color-warning)' }} />
                  <p style={{ fontWeight: 600 }}>{slotMessage || 'No hay turnos disponibles para esta fecha.'}</p>
                  <p style={{ fontSize: '0.875rem' }}>Prueba seleccionando otro día en el calendario arriba.</p>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-4 gap-3" style={{ marginBottom: '24px' }}>
                    {slots.map((s, idx) => {
                      const isSelected = selectedSlot?.hora_inicio === s.hora_inicio;
                      return (
                        <div
                          key={idx}
                          className={`slot-badge ${!s.disponible ? 'taken' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => s.disponible && setSelectedSlot(s)}
                        >
                          <div>{s.hora_inicio} hs</div>
                          {s.unidad_nombre && (
                            <div style={{ fontSize: '0.6875rem', opacity: 0.8, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.unidad_nombre}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {selectedSlot && (
                    <div className="glass-panel animate-fade-in flex items-center justify-between" style={{ padding: '16px 20px', borderColor: 'var(--color-primary)' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-primary-dark)' }}>
                          Turno elegido: {selectedDate} a las {selectedSlot.hora_inicio} hs
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {selectedSlot.unidad_nombre || 'Consultorio principal'}
                        </div>
                      </div>
                      <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        Continuar con la reserva
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* Modal de Confirmación de Datos del Paciente (con Select2) */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '8px' }}>
              Completar Reserva del Turno
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '20px' }}>
              Turno con <strong>Dr. {doctor.nombre} {doctor.apellido}</strong> el {selectedDate} a las {selectedSlot?.hora_inicio} hs.
            </p>

            {errorMsg && (
              <div style={{ padding: '12px', background: 'var(--color-danger-light)', color: 'var(--color-danger)', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleConfirmBooking}>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Nombre</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={patientForm.nombre}
                    onChange={(e) => setPatientForm({ ...patientForm, nombre: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={patientForm.apellido}
                    onChange={(e) => setPatientForm({ ...patientForm, apellido: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">DNI / Documento</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    placeholder="Sin puntos"
                    value={patientForm.dni}
                    onChange={(e) => setPatientForm({ ...patientForm, dni: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    required 
                    value={patientForm.email}
                    onChange={(e) => setPatientForm({ ...patientForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Teléfono / WhatsApp</label>
                  <input 
                    type="tel" 
                    className="form-input" 
                    placeholder="Ej: 2944123456"
                    value={patientForm.telefono}
                    onChange={(e) => setPatientForm({ ...patientForm, telefono: e.target.value })}
                  />
                </div>

                {/* Obra Social con Select2 Buscable */}
                <div className="form-group">
                  <label className="form-label">Obra Social / Prepaga</label>
                  <SearchableSelect
                    options={obrasSociales.map(os => ({ id: os.id, label: os.nombre }))}
                    value={patientForm.obra_social_id}
                    onChange={(val) => setPatientForm({ ...patientForm, obra_social_id: val, plan_id: '' })}
                    placeholder="Particular / Ninguna"
                    searchPlaceholder="Buscar mutual u obra social..."
                  />
                </div>
              </div>

              {/* Plan con Select2 Buscable */}
              {planes.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Plan de Cobertura</label>
                  <SearchableSelect
                    options={planes.map(p => ({ id: p.id, label: p.nombre }))}
                    value={patientForm.plan_id}
                    onChange={(val) => setPatientForm({ ...patientForm, plan_id: val })}
                    placeholder="Selecciona tu plan..."
                    searchPlaceholder="Buscar plan..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Motivo de Consulta / Notas (Opcional)</label>
                <textarea 
                  className="form-textarea" 
                  rows="2"
                  placeholder="Describe brevemente el motivo de tu consulta médica..."
                  value={patientForm.notas}
                  onChange={(e) => setPatientForm({ ...patientForm, notas: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-3" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Confirmando...' : 'Confirmar Reserva de Turno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
