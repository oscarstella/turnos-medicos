import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../api';
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flag,
  User,
  Phone,
  Building2,
  RefreshCw,
  Sparkles,
  Search,
  Filter,
  Check,
  X,
  Ban
} from 'lucide-react';

const DIAS_SEMANA_MAP = {
  'Domingo': 0,
  'Lunes': 1,
  'Martes': 2,
  'Miercoles': 3,
  'Miércoles': 3,
  'Jueves': 4,
  'Viernes': 5,
  'Sabado': 6,
  'Sábado': 6
};

const DIAS_NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getHoyArg() {
  const ahora = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Argentina/Buenos_Aires',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(ahora);
  } catch {
    return ahora.toISOString().split('T')[0];
  }
}

function formatearFechaLegible(fechaStr) {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-').map(Number);
  const fechaObj = new Date(Date.UTC(y, m - 1, d));
  const diaSem = DIAS_NOMBRES[fechaObj.getUTCDay()];
  const diaNum = String(d).padStart(2, '0');
  const mesNom = MESES_NOMBRES[m - 1];
  return `${diaSem}, ${diaNum} de ${mesNom} ${y}`;
}

function formatearFechaArgCorta(fechaStr) {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

export default function DoctorAgendaView({ user, horariosBloques = [], sedes = [], onUpdateEstado, showToast }) {
  const hoyStr = useMemo(() => getHoyArg(), []);
  const [currentDate, setCurrentDate] = useState(hoyStr);
  const [filtroEstado, setFiltroEstado] = useState(''); // '' | 'ocupado' | 'libre'
  const [filtroSearch, setFiltroSearch] = useState('');

  // Estados de datos de los 3 días
  const [prevDayData, setPrevDayData] = useState({ loading: true, slots: [], meta: null, fecha: '' });
  const [activeDayData, setActiveDayData] = useState({ loading: true, slots: [], meta: null, fecha: '' });
  const [nextDayData, setNextDayData] = useState({ loading: true, slots: [], meta: null, fecha: '' });

  // Mensajes de WhatsApp borradores por ID de turno
  const [mensajesDraft, setMensajesDraft] = useState({});
  const [sendingWhatsAppId, setSendingWhatsAppId] = useState(null);

  // Estado del Modal de Suspensión de Atención
  const [showModalSuspension, setShowModalSuspension] = useState(false);
  const [suspensionTipo, setSuspensionTipo] = useState('dia'); // 'dia' | 'rango'
  const [suspFechaInicio, setSuspFechaInicio] = useState(currentDate);
  const [suspFechaFin, setSuspFechaFin] = useState(currentDate);
  const [suspMotivo, setSuspMotivo] = useState('Razones de fuerza mayor');
  const [afectadosPreview, setAfectadosPreview] = useState([]);
  const [loadingAfectados, setLoadingAfectados] = useState(false);
  const [procesandoSuspension, setProcesandoSuspension] = useState(false);

  // Días de la semana que atiende el médico según sus bloques
  const diasAtencionSet = useMemo(() => {
    if (horariosBloques && horariosBloques.length > 0) {
      const set = new Set();
      horariosBloques.forEach(h => {
        const diaNum = DIAS_SEMANA_MAP[h.dia_semana];
        if (diaNum !== undefined) set.add(diaNum);
      });
      if (set.size > 0) return set;
    }
    // Si no tiene bloques configurados, por defecto Lunes a Viernes
    return new Set([1, 2, 3, 4, 5]);
  }, [horariosBloques]);

  // Cálculo del día previo trabajado
  const prevWorkDate = useMemo(() => {
    if (!currentDate) return '';
    const [y, m, d] = currentDate.split('-').map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    for (let i = 1; i <= 14; i++) {
      const p = new Date(cur.getTime() - i * 86400000);
      if (diasAtencionSet.has(p.getUTCDay())) {
        return p.toISOString().split('T')[0];
      }
    }
    return new Date(cur.getTime() - 86400000).toISOString().split('T')[0];
  }, [currentDate, diasAtencionSet]);

  // Cálculo del próximo día trabajado
  const nextWorkDate = useMemo(() => {
    if (!currentDate) return '';
    const [y, m, d] = currentDate.split('-').map(Number);
    const cur = new Date(Date.UTC(y, m - 1, d));
    for (let i = 1; i <= 14; i++) {
      const n = new Date(cur.getTime() + i * 86400000);
      if (diasAtencionSet.has(n.getUTCDay())) {
        return n.toISOString().split('T')[0];
      }
    }
    return new Date(cur.getTime() + 86400000).toISOString().split('T')[0];
  }, [currentDate, diasAtencionSet]);

  // Fetch de un día específico
  const fetchDia = async (fecha) => {
    if (!fecha) return { slots: [], meta: null };
    try {
      const res = await api.get(`/medico/agenda?fecha=${fecha}&incluir_vacios=1`);
      return {
        slots: res.data?.data || res.data || [],
        meta: res.data?.meta || null
      };
    } catch (err) {
      console.error(`Error cargando agenda de ${fecha}:`, err);
      return { slots: [], meta: null };
    }
  };

  // Cargar los 3 días cada vez que cambia currentDate
  const recargarAgenda = () => {
    if (!currentDate) return;
    setActiveDayData(prev => ({ ...prev, loading: true, fecha: currentDate }));
    setPrevDayData(prev => ({ ...prev, loading: true, fecha: prevWorkDate }));
    setNextDayData(prev => ({ ...prev, loading: true, fecha: nextWorkDate }));

    Promise.all([
      fetchDia(prevWorkDate),
      fetchDia(currentDate),
      fetchDia(nextWorkDate)
    ]).then(([prevRes, activeRes, nextRes]) => {
      setPrevDayData({ loading: false, slots: prevRes.slots, meta: prevRes.meta, fecha: prevWorkDate });
      setActiveDayData({ loading: false, slots: activeRes.slots, meta: activeRes.meta, fecha: currentDate });
      setNextDayData({ loading: false, slots: nextRes.slots, meta: nextRes.meta, fecha: nextWorkDate });
    });
  };

  useEffect(() => {
    recargarAgenda();
  }, [currentDate, prevWorkDate, nextWorkDate]);

  // Abrir modal de suspensión para un día puntual
  const abrirSuspensionParaFecha = (fechaPuntual) => {
    const f = fechaPuntual || currentDate;
    setSuspensionTipo('dia');
    setSuspFechaInicio(f);
    setSuspFechaFin(f);
    setShowModalSuspension(true);
  };

  // Cargar pacientes afectados cuando cambia el rango en el modal
  useEffect(() => {
    if (!showModalSuspension) return;
    const fIni = suspFechaInicio;
    const fFin = suspensionTipo === 'dia' ? suspFechaInicio : suspFechaFin;
    if (!fIni || !fFin) return;

    setLoadingAfectados(true);
    api.get(`/medico/suspensiones/afectados?fecha_inicio=${fIni}&fecha_fin=${fFin}`)
      .then(res => {
        setAfectadosPreview(res.data?.data || res.data || []);
      })
      .catch(err => {
        console.error('Error al consultar afectados:', err);
        setAfectadosPreview([]);
      })
      .finally(() => setLoadingAfectados(false));
  }, [showModalSuspension, suspensionTipo, suspFechaInicio, suspFechaFin]);

  // Ejecutar suspensión y notificar vía WhatsApp Bot
  const handleConfirmarSuspension = async () => {
    const fIni = suspFechaInicio;
    const fFin = suspensionTipo === 'dia' ? suspFechaInicio : suspFechaFin;
    if (!fIni || !fFin) {
      alert('Por favor definí las fechas de suspensión.');
      return;
    }
    if (!suspMotivo.trim()) {
      alert('Por favor indicá el motivo de la suspensión para informar a los pacientes.');
      return;
    }

    try {
      setProcesandoSuspension(true);
      const res = await api.post('/medico/suspensiones', {
        fecha_inicio: fIni,
        fecha_fin: fFin,
        motivo: suspMotivo.trim(),
        cancelar_turnos: true
      });

      const cantNotificados = res.turnos_afectados ?? afectadosPreview.length;
      if (showToast) {
        showToast(`Atención suspendida exitosamente. ${cantNotificados} paciente(s) cancelados y notificados por WhatsApp Bot.`);
      } else {
        alert(`Atención suspendida exitosamente. ${cantNotificados} paciente(s) cancelados y notificados por WhatsApp Bot.`);
      }

      setShowModalSuspension(false);
      recargarAgenda();
    } catch (err) {
      alert(err.message || 'Error al procesar la suspensión.');
    } finally {
      setProcesandoSuspension(false);
    }
  };

  // Enviar WhatsApp al paciente a través del Bot institucional
  const handleSendWhatsApp = async (turno) => {
    const texto = mensajesDraft[turno.id]?.trim();
    if (!texto) {
      if (showToast) showToast('Escribí un mensaje antes de enviar.');
      return;
    }
    if (!turno.paciente_telefono) {
      alert('El paciente no tiene un número de teléfono registrado.');
      return;
    }

    try {
      setSendingWhatsAppId(turno.id);
      const res = await api.post(`/medico/turnos/${turno.id}/mensaje-paciente`, { mensaje: texto });
      
      // Actualizar el turno en el estado local
      setActiveDayData(prev => ({
        ...prev,
        slots: prev.slots.map(s => s.id === turno.id ? { ...s, mensaje_medico: texto } : s)
      }));

      // Limpiar borrador
      setMensajesDraft(prev => ({ ...prev, [turno.id]: '' }));
      if (showToast) {
        showToast(res.message || 'Mensaje enviado exitosamente vía WhatsApp Bot.');
      }
    } catch (err) {
      alert(err.message || 'Error al enviar mensaje por WhatsApp.');
    } finally {
      setSendingWhatsAppId(null);
    }
  };

  // Actualizar estado del turno
  const handleCambiarEstado = async (turnoId, nuevoEstado) => {
    try {
      if (onUpdateEstado) {
        await onUpdateEstado(turnoId, nuevoEstado);
      } else {
        await api.put(`/medico/turnos/${turnoId}/estado`, { estado: nuevoEstado });
      }
      recargarAgenda();
    } catch (err) {
      alert(err.message || 'Error al cambiar estado.');
    }
  };

  // Filtrado de slots en el día activo
  const activeSlotsFiltrados = useMemo(() => {
    let list = activeDayData.slots || [];
    if (filtroEstado) {
      if (filtroEstado === 'libre') {
        list = list.filter(s => s.tipo === 'vacio' || s.estado === 'libre');
      } else if (filtroEstado === 'ocupado') {
        list = list.filter(s => s.tipo === 'ocupado');
      } else {
        list = list.filter(s => s.estado === filtroEstado);
      }
    }
    if (filtroSearch.trim()) {
      const q = filtroSearch.toLowerCase().trim();
      list = list.filter(s => {
        if (s.tipo === 'vacio') return false;
        const nombreComp = `${s.paciente_nombre || ''} ${s.paciente_apellido || ''}`.toLowerCase();
        const dni = String(s.paciente_dni || '');
        const os = (s.obra_social_nombre || '').toLowerCase();
        return nombreComp.includes(q) || dni.includes(q) || os.includes(q);
      });
    }
    return list;
  }, [activeDayData.slots, filtroEstado, filtroSearch]);

  // Jornada formateada del día activo
  const jornadaActiva = useMemo(() => {
    if (!horariosBloques || horariosBloques.length === 0) return 'Jornada no configurada';
    const [y, m, d] = currentDate.split('-').map(Number);
    const diaNum = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    
    // Buscar bloques de este día
    const bloquesDelDia = horariosBloques.filter(h => {
      const mapNum = DIAS_SEMANA_MAP[h.dia_semana];
      return mapNum === diaNum;
    });

    if (bloquesDelDia.length === 0) return 'Sin atención programada';
    return bloquesDelDia.map(b => `${(b.hora_inicio || '').substring(0, 5)} - ${(b.hora_fin || '').substring(0, 5)}`).join(' | ');
  }, [currentDate, horariosBloques]);

  const esHoy = currentDate === hoyStr;

  return (
    <div className="doctor-agenda-container" style={{ width: '100%', marginBottom: '24px' }}>
      
      {/* BARRA SUPERIOR DE CONTROL Y NAVEGACIÓN */}
      <div 
        className="card"
        style={{
          padding: '16px 20px',
          marginBottom: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        {/* Lado izquierdo: Sede, Botón HOY y Botón Suspender */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: 'var(--color-text-main)'
            }}
          >
            <Building2 size={15} color="var(--color-primary)" />
            <span>{activeDayData.meta?.unidad_nombre || sedes[0]?.nombre || 'Sede Central'}</span>
          </div>

          <button
            type="button"
            className="btn"
            onClick={() => setCurrentDate(hoyStr)}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: esHoy ? 'var(--color-primary)' : 'var(--color-surface)',
              color: esHoy ? '#ffffff' : 'var(--color-primary)',
              border: '1.5px solid var(--color-primary)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <Calendar size={15} />
            <span>HOY</span>
          </button>

          {/* Botón directo de Suspender Atención (Día o Rango) */}
          <button
            type="button"
            className="btn"
            onClick={() => abrirSuspensionParaFecha(currentDate)}
            title="Suspender atención médica y notificar automáticamente a los pacientes citados por WhatsApp"
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#dc2626',
              border: '1.5px solid #ef4444',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <Ban size={15} />
            <span>Suspender Día / Rango</span>
          </button>
        </div>

        {/* Centro: Flechas de navegación y fecha seleccionada */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentDate(prevWorkDate)}
            title={`Ir al día anterior trabajado: ${formatearFechaArgCorta(prevWorkDate)}`}
            style={{
              width: '38px',
              height: '38px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <ChevronLeft size={20} />
          </button>

          <div
            style={{
              padding: '6px 16px',
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              textAlign: 'center',
              minWidth: '220px'
            }}
          >
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
              {formatearFechaLegible(currentDate)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              Jornada: <strong>{jornadaActiva}</strong>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCurrentDate(nextWorkDate)}
            title={`Ir al próximo día trabajado: ${formatearFechaArgCorta(nextWorkDate)}`}
            style={{
              width: '38px',
              height: '38px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)'
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Lado derecho: Selector de fecha libre y buscador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            className="form-input"
            value={currentDate}
            onChange={e => e.target.value && setCurrentDate(e.target.value)}
            style={{ padding: '6px 10px', height: '38px', fontSize: '0.85rem' }}
          />

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar paciente o DNI..."
              value={filtroSearch}
              onChange={e => setFiltroSearch(e.target.value)}
              style={{ paddingLeft: '30px', paddingRight: '10px', height: '38px', fontSize: '0.82rem', width: '180px' }}
            />
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={recargarAgenda}
            title="Actualizar datos"
            style={{ width: '38px', height: '38px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* PILLS DE FILTRO DE ESTADO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setFiltroEstado('')}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: filtroEstado === '' ? 'var(--color-primary)' : 'var(--color-border)',
            background: filtroEstado === '' ? 'var(--color-primary-light)' : 'var(--color-surface)',
            color: filtroEstado === '' ? 'var(--color-primary-dark)' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Todos ({activeDayData.slots.length})
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('ocupado')}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: filtroEstado === 'ocupado' ? '#0284c7' : 'var(--color-border)',
            background: filtroEstado === 'ocupado' ? 'rgba(2, 132, 199, 0.12)' : 'var(--color-surface)',
            color: filtroEstado === 'ocupado' ? '#0369a1' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Pacientes Citados ({activeDayData.slots.filter(s => s.tipo === 'ocupado').length})
        </button>
        <button
          type="button"
          onClick={() => setFiltroEstado('libre')}
          style={{
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid',
            borderColor: filtroEstado === 'libre' ? '#10b981' : 'var(--color-border)',
            background: filtroEstado === 'libre' ? 'rgba(16, 185, 129, 0.12)' : 'var(--color-surface)',
            color: filtroEstado === 'libre' ? '#059669' : 'var(--color-text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Disponibles ({activeDayData.slots.filter(s => s.tipo === 'vacio' || s.estado === 'libre').length})
        </button>
      </div>

      {/* LIENZO DE 3 COLUMNAS: DÍA ANTERIOR | DÍA ACTIVO (DESTACADO) | PRÓXIMO DÍA */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1fr) minmax(380px, 1.45fr) minmax(280px, 1fr)',
          gap: '16px',
          alignItems: 'start'
        }}
      >
        {/* ============================================================== */}
        {/* COLUMNA 1: DÍA ANTERIOR TRABAJADO */}
        {/* ============================================================== */}
        <div
          className="card"
          style={{
            padding: '16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            opacity: 0.9,
            transition: 'all 0.2s ease'
          }}
        >
          {/* Header de la columna anterior */}
          <div
            style={{
              paddingBottom: '12px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div onClick={() => setCurrentDate(prevWorkDate)} style={{ cursor: 'pointer' }} title="Click para enfocar este día">
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-subtle)', fontWeight: 800 }}>
                Día Anterior Trabajado
              </span>
              <h4 style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                {formatearFechaLegible(prevWorkDate)}
              </h4>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentDate(prevWorkDate)}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                title="Enfocar este día"
              >
                Enfocar ←
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => abrirSuspensionParaFecha(prevWorkDate)}
                title="Suspender este día"
                style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)' }}
              >
                <Ban size={12} />
              </button>
            </div>
          </div>

          {/* Lista de slots del día anterior */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '720px', overflowY: 'auto' }}>
            {prevDayData.loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Cargando agenda...
              </div>
            ) : prevDayData.slots.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Sin turnos en este día.
              </div>
            ) : (
              prevDayData.slots.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: slot.tipo === 'ocupado' ? 'var(--color-bg)' : 'transparent',
                    fontSize: '0.82rem',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: '65px',
                      padding: '8px 6px',
                      background: 'rgba(0, 0, 0, 0.03)',
                      borderRight: '1px solid var(--color-border)',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--color-text-main)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <span>{slot.hora_inicio}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>{slot.hora_fin}</span>
                  </div>
                  <div style={{ padding: '8px 10px', flex: 1 }}>
                    {slot.tipo === 'ocupado' ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                          {slot.paciente_apellido}, {slot.paciente_nombre}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          DNI: {slot.paciente_dni || 'S/D'} {slot.obra_social_nombre ? `• ${slot.obra_social_nombre}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                        Disponible
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMNA 2: DÍA ACTIVO / HOY (DESTACADA, ELEVADA Y COMPLETA) */}
        {/* ============================================================== */}
        <div
          className="card"
          style={{
            padding: '20px',
            background: 'var(--color-surface)',
            border: '2px solid var(--color-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            position: 'relative'
          }}
        >
          {/* Badge superior si es HOY */}
          {esHoy && (
            <span
              style={{
                position: 'absolute',
                top: '-12px',
                left: '20px',
                background: 'var(--color-primary)',
                color: '#ffffff',
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)'
              }}
            >
              ★ HOY
            </span>
          )}

          {/* Header del día activo */}
          <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--color-border)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-primary)', fontWeight: 800 }}>
                  Agenda Médica en Consultorio
                </span>
                <h3 style={{ margin: '2px 0 4px', fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-text-main)' }}>
                  {formatearFechaLegible(currentDate)}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>Dr/a. {user?.nombre} {user?.apellido}</span>
                  <span>•</span>
                  <span>Jornada: <strong>{jornadaActiva}</strong></span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <span className="badge badge-primary" style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
                  {activeDayData.slots.filter(s => s.tipo === 'ocupado').length} Pacientes
                </span>

                <button
                  type="button"
                  className="btn"
                  onClick={() => abrirSuspensionParaFecha(currentDate)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    border: '1px solid #ef4444',
                    borderRadius: 'var(--radius-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Suspender este día"
                >
                  <Ban size={12} />
                  <span>Suspender día</span>
                </button>
              </div>
            </div>

            {/* Alerta de Feriado Nacional si aplica */}
            {activeDayData.meta?.feriado && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid #eab308',
                  borderRadius: 'var(--radius-md)',
                  color: '#854d0e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '0.85rem'
                }}
              >
                <Flag size={18} />
                <div>
                  <strong>🇦🇷 Feriado Nacional: {activeDayData.meta.motivo_feriado}</strong>
                  <div style={{ fontSize: '0.78rem', opacity: 0.9 }}>Día no laborable oficial.</div>
                </div>
              </div>
            )}

            {/* Alerta de Suspensión médica si aplica */}
            {activeDayData.meta?.suspendido && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid var(--color-danger)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem'
                }}
              >
                <AlertTriangle size={18} />
                <span>
                  <strong>Atención suspendida:</strong> {activeDayData.meta.motivo_suspension}
                </span>
              </div>
            )}
          </div>

          {/* Grilla vertical de turnos del día activo */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {activeDayData.loading ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px', display: 'block' }} />
                <span>Cargando turnos de la jornada...</span>
              </div>
            ) : activeSlotsFiltrados.length === 0 ? (
              <div style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                No hay turnos registrados que coincidan con los filtros aplicados.
              </div>
            ) : (
              activeSlotsFiltrados.map((slot) => {
                const isOcupado = slot.tipo === 'ocupado';
                const estado = slot.estado || 'libre';

                // Configuración visual según estado
                let borderColor = 'var(--color-border)';
                let bgAccent = 'var(--color-surface)';
                let badgeClass = 'badge-secondary';
                let estadoLabel = 'Disponible';

                if (isOcupado) {
                  if (estado === 'confirmado') {
                    borderColor = '#10b981';
                    bgAccent = 'rgba(16, 185, 129, 0.04)';
                    badgeClass = 'badge-success';
                    estadoLabel = 'Confirmado';
                  } else if (estado === 'asignado') {
                    borderColor = '#f59e0b';
                    bgAccent = 'rgba(245, 158, 11, 0.04)';
                    badgeClass = 'badge-warning';
                    estadoLabel = 'Asignado';
                  } else if (estado === 'asistio') {
                    borderColor = '#0284c7';
                    bgAccent = 'rgba(2, 132, 199, 0.04)';
                    badgeClass = 'badge-primary';
                    estadoLabel = 'Asistió';
                  } else if (estado === 'ausente') {
                    borderColor = '#ef4444';
                    bgAccent = 'rgba(239, 68, 68, 0.04)';
                    badgeClass = 'badge-danger';
                    estadoLabel = 'Ausente';
                  } else if (estado === 'cancelado') {
                    borderColor = '#94a3b8';
                    bgAccent = 'rgba(148, 163, 184, 0.05)';
                    estadoLabel = 'Cancelado';
                  }
                }

                return (
                  <div
                    key={slot.id}
                    style={{
                      display: 'flex',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${borderColor}`,
                      background: bgAccent,
                      boxShadow: isOcupado ? '0 2px 6px rgba(0,0,0,0.03)' : 'none',
                      overflow: 'hidden',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                    }}
                  >
                    {/* Bloque Horario lateral */}
                    <div
                      style={{
                        width: '85px',
                        padding: '14px 8px',
                        background: 'rgba(0, 0, 0, 0.03)',
                        borderRight: `1px solid ${borderColor}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        color: 'var(--color-text-main)'
                      }}
                    >
                      <span style={{ fontSize: '1.05rem', letterSpacing: '-0.02em' }}>{slot.hora_inicio}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', fontWeight: 500 }}>
                        {slot.hora_fin || ''}
                      </span>
                    </div>

                    {/* Contenido del Slot */}
                    <div style={{ padding: '12px 16px', flex: 1, minWidth: 0 }}>
                      {isOcupado ? (
                        <div>
                          {/* Fila superior: Nombre del paciente y Estado */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                              {slot.paciente_apellido}, {slot.paciente_nombre}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                {estadoLabel}
                              </span>
                            </div>
                          </div>

                          {/* Fila intermedia: Datos clínicos y de contacto */}
                          <div
                            style={{
                              marginTop: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              flexWrap: 'wrap',
                              fontSize: '0.82rem',
                              color: 'var(--color-text-muted)'
                            }}
                          >
                            <span>DNI: <strong>{slot.paciente_dni || 'S/D'}</strong></span>
                            {slot.paciente_telefono && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Phone size={12} />
                                <span>{slot.paciente_telefono}</span>
                              </span>
                            )}
                            <span>
                              Cobertura: <strong>{slot.obra_social_nombre || 'Particular'}</strong>
                              {slot.plan_nombre ? ` (${slot.plan_nombre})` : ''}
                            </span>
                          </div>

                          {/* Notas o motivo si existen */}
                          {slot.notas && (
                            <div style={{ marginTop: '6px', fontSize: '0.78rem', color: 'var(--color-text-main)', background: 'rgba(0,0,0,0.03)', padding: '4px 8px', borderRadius: '4px' }}>
                              <em>Nota: {slot.notas}</em>
                            </div>
                          )}

                          {/* ALERTA DE RETRASO AVISADO POR EL PACIENTE */}
                          {slot.aviso_retraso && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '6px 10px',
                                background: '#fef3c7',
                                border: '1px solid #f59e0b',
                                borderRadius: 'var(--radius-sm)',
                                color: '#92400e',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              <Clock size={14} color="#d97706" />
                              <span>
                                <strong>Aviso del paciente:</strong> "{slot.aviso_retraso}"
                              </span>
                            </div>
                          )}

                          {/* MENSAJE ENVIADO PREVIAMENTE */}
                          {slot.mensaje_medico && (
                            <div
                              style={{
                                marginTop: '8px',
                                padding: '4px 8px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                border: '1px solid #10b981',
                                borderRadius: 'var(--radius-sm)',
                                color: '#065f46',
                                fontSize: '0.78rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}
                            >
                              <CheckCircle size={13} color="#10b981" />
                              <span>Último mensaje enviado: "{slot.mensaje_medico}"</span>
                            </div>
                          )}

                          {/* ACCIONES Y MENSAJE WHATSAPP VÍA BOT */}
                          <div
                            style={{
                              marginTop: '10px',
                              paddingTop: '8px',
                              borderTop: '1px dashed var(--color-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            {/* Campo de texto y botón para WhatsApp institucional */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                type="text"
                                className="form-input"
                                placeholder="Mensaje por WhatsApp vía Bot (ej: Estoy retrasado 10 min)..."
                                value={mensajesDraft[slot.id] || ''}
                                onChange={e => setMensajesDraft({ ...mensajesDraft, [slot.id]: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSendWhatsApp(slot);
                                }}
                                style={{
                                  fontSize: '0.82rem',
                                  padding: '6px 10px',
                                  height: '34px',
                                  flex: 1
                                }}
                              />
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={sendingWhatsAppId === slot.id || !mensajesDraft[slot.id]?.trim()}
                                onClick={() => handleSendWhatsApp(slot)}
                                title="Enviar mensaje al paciente a través del WhatsApp institucional"
                                style={{
                                  padding: '6px 12px',
                                  height: '34px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <Send size={13} />
                                {sendingWhatsAppId === slot.id ? 'Enviando...' : 'Enviar Bot'}
                              </button>
                            </div>

                            {/* Botones de cambio de estado rápido */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              {estado !== 'asistio' && (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => handleCambiarEstado(slot.id, 'asistio')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    background: 'rgba(2, 132, 199, 0.1)',
                                    color: '#0284c7',
                                    border: '1px solid #0284c7',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Check size={12} />
                                  <span>Asistió</span>
                                </button>
                              )}

                              {estado !== 'ausente' && (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => handleCambiarEstado(slot.id, 'ausente')}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    border: '1px solid #ef4444',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <X size={12} />
                                  <span>Ausente</span>
                                </button>
                              )}

                              {estado !== 'cancelado' && (
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => {
                                    if (window.confirm('¿Desea cancelar este turno?')) {
                                      handleCambiarEstado(slot.id, 'cancelado');
                                    }
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.75rem',
                                    background: 'transparent',
                                    color: 'var(--color-text-subtle)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-sm)'
                                  }}
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                              Disponible
                            </span>
                            <span style={{ marginLeft: '8px', fontSize: '0.75rem', color: 'var(--color-text-subtle)' }}>
                              (Franja de atención libre)
                            </span>
                          </div>
                          <span className="badge badge-secondary" style={{ fontSize: '0.72rem', opacity: 0.8 }}>
                            Libre
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ============================================================== */}
        {/* COLUMNA 3: PRÓXIMO DÍA TRABAJADO */}
        {/* ============================================================== */}
        <div
          className="card"
          style={{
            padding: '16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            opacity: 0.9,
            transition: 'all 0.2s ease'
          }}
        >
          {/* Header de la columna próxima */}
          <div
            style={{
              paddingBottom: '12px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div onClick={() => setCurrentDate(nextWorkDate)} style={{ cursor: 'pointer' }} title="Click para enfocar este día">
              <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-subtle)', fontWeight: 800 }}>
                Próximo Día de Atención
              </span>
              <h4 style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                {formatearFechaLegible(nextWorkDate)}
              </h4>
            </div>

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentDate(nextWorkDate)}
                style={{ padding: '4px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)' }}
                title="Enfocar este día"
              >
                Enfocar →
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => abrirSuspensionParaFecha(nextWorkDate)}
                title="Suspender este día"
                style={{ padding: '4px 6px', fontSize: '0.72rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 'var(--radius-sm)' }}
              >
                <Ban size={12} />
              </button>
            </div>
          </div>

          {/* Lista de slots del próximo día */}
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '720px', overflowY: 'auto' }}>
            {nextDayData.loading ? (
              <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Cargando agenda...
              </div>
            ) : nextDayData.slots.length === 0 ? (
              <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Sin turnos en este día.
              </div>
            ) : (
              nextDayData.slots.map((slot, idx) => (
                <div
                  key={slot.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    background: slot.tipo === 'ocupado' ? 'var(--color-bg)' : 'transparent',
                    fontSize: '0.82rem',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      width: '65px',
                      padding: '8px 6px',
                      background: 'rgba(0, 0, 0, 0.03)',
                      borderRight: '1px solid var(--color-border)',
                      fontWeight: 700,
                      textAlign: 'center',
                      color: 'var(--color-text-main)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <span>{slot.hora_inicio}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)', fontWeight: 400 }}>{slot.hora_fin}</span>
                  </div>
                  <div style={{ padding: '8px 10px', flex: 1 }}>
                    {slot.tipo === 'ocupado' ? (
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>
                          {slot.paciente_apellido}, {slot.paciente_nombre}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          DNI: {slot.paciente_dni || 'S/D'} {slot.obra_social_nombre ? `• ${slot.obra_social_nombre}` : ''}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color: 'var(--color-text-subtle)', fontStyle: 'italic', fontSize: '0.78rem' }}>
                        Disponible
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* MODAL INTEGRADO PARA SUSPENDER DÍA O RANGO DE ATENCIÓN */}
      {/* ============================================================== */}
      {showModalSuspension && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '560px',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-surface)',
              border: '1.5px solid var(--color-danger)',
              boxShadow: 'var(--shadow-xl)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ban size={22} color="#dc2626" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text-main)' }}>
                  Suspender Atención Médica
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModalSuspension(false)}
                style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              Al suspender la atención, se bloqueará la reserva en esos días y se <strong>notificará automáticamente por WhatsApp Bot</strong> a todos los pacientes citados con opción a reprogramar su turno.
            </p>

            {/* Selector de Tipo: Día puntual o Rango */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setSuspensionTipo('dia');
                  setSuspFechaFin(suspFechaInicio);
                }}
                className="btn"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: suspensionTipo === 'dia' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: suspensionTipo === 'dia' ? '#ffffff' : 'var(--color-text-main)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Solo Un Día
              </button>
              <button
                type="button"
                onClick={() => setSuspensionTipo('rango')}
                className="btn"
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: suspensionTipo === 'rango' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: suspensionTipo === 'rango' ? '#ffffff' : 'var(--color-text-main)',
                  border: '1px solid var(--color-border)'
                }}
              >
                Rango de Fechas (Varios días)
              </button>
            </div>

            {/* Inputs de Fecha */}
            <div style={{ display: 'grid', gridTemplateColumns: suspensionTipo === 'rango' ? '1fr 1fr' : '1fr', gap: '12px', marginBottom: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                  {suspensionTipo === 'dia' ? 'Fecha a suspender' : 'Fecha Desde'}
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={suspFechaInicio}
                  onChange={e => {
                    setSuspFechaInicio(e.target.value);
                    if (suspensionTipo === 'dia') setSuspFechaFin(e.target.value);
                  }}
                />
              </div>

              {suspensionTipo === 'rango' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Fecha Hasta</label>
                  <input
                    type="date"
                    className="form-input"
                    value={suspFechaFin}
                    min={suspFechaInicio}
                    onChange={e => setSuspFechaFin(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* Motivo de la suspensión */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Motivo de la suspensión (se incluirá en el WhatsApp al paciente)
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej: Razones de fuerza mayor / Congreso médico..."
                value={suspMotivo}
                onChange={e => setSuspMotivo(e.target.value)}
              />
            </div>

            {/* Lista y cantidad de pacientes afectados capturados */}
            <div style={{ marginBottom: '20px', padding: '12px', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Pacientes citados afectados:
                </span>
                <span className="badge badge-danger" style={{ fontSize: '0.8rem' }}>
                  {loadingAfectados ? 'Consultando...' : `${afectadosPreview.length} pacientes`}
                </span>
              </div>

              {loadingAfectados ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '10px' }}>
                  Buscando turnos agendados en esas fechas...
                </div>
              ) : afectadosPreview.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#059669', padding: '6px 0' }}>
                  ✓ No hay turnos asignados en este período. No se enviarán notificaciones de cancelación.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                  {afectadosPreview.map(t => (
                    <div
                      key={t.id}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--color-surface)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--color-border)',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div>
                        <strong>{t.paciente_apellido}, {t.paciente_nombre}</strong>
                        <span style={{ marginLeft: '6px', color: 'var(--color-text-muted)' }}>
                          ({formatearFechaArgCorta(t.fecha)} - {String(t.hora_inicio || '').substring(0, 5)} hs)
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        📞 {t.paciente_telefono || 'Sin teléfono'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botones de acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={procesandoSuspension}
                onClick={() => setShowModalSuspension(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                disabled={procesandoSuspension}
                onClick={handleConfirmarSuspension}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Ban size={16} />
                <span>{procesandoSuspension ? 'Procesando y notificando...' : 'Confirmar Suspensión'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
