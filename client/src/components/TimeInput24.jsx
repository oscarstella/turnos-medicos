import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Componente TimeInput24: Selector de hora en formato estricto 24hs (00:00 a 23:59).
 * Nunca muestra AM/PM. Incluye flechas para subir y bajar horas (00-23) y minutos (en pasos de 5m).
 */
export default function TimeInput24({ value = '09:00', onChange, disabled = false }) {
  // Parsear valor actual "HH:mm" o "HH:mm:ss"
  const cleanVal = String(value || '09:00').substring(0, 5);
  const parts = cleanVal.split(':');
  let hour = parseInt(parts[0], 10);
  let minute = parseInt(parts[1], 10);

  if (isNaN(hour) || hour < 0 || hour > 23) hour = 9;
  if (isNaN(minute) || minute < 0 || minute > 59) minute = 0;

  const pad = (n) => String(n).padStart(2, '0');

  const emit = (h, m) => {
    const formatted = `${pad(h)}:${pad(m)}`;
    if (onChange) onChange(formatted);
  };

  const stepHour = (delta) => {
    let nextH = hour + delta;
    if (nextH > 23) nextH = 0;
    if (nextH < 0) nextH = 23;
    emit(nextH, minute);
  };

  const stepMinute = (delta) => {
    // Pasos de 5 minutos
    let nextM = minute + delta;
    let nextH = hour;
    if (nextM >= 60) {
      nextM = nextM % 60;
      nextH = (nextH + 1) % 24;
    } else if (nextM < 0) {
      nextM = 60 + (nextM % 60);
      nextH = nextH - 1 < 0 ? 23 : nextH - 1;
    }
    emit(nextH, nextM);
  };

  const handleHourChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    if (!raw) return emit(0, minute);
    let val = parseInt(raw, 10);
    if (val > 23) val = 23;
    emit(val, minute);
  };

  const handleMinuteChange = (e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2);
    if (!raw) return emit(hour, 0);
    let val = parseInt(raw, 10);
    if (val > 59) val = 59;
    emit(hour, val);
  };

  return (
    <div
      className="time-picker-24 flex items-center"
      style={{
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border, #cbd5e1)',
        borderRadius: '8px',
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        userSelect: 'none'
      }}
    >
      {/* Campo de Horas (00 - 23) */}
      <div className="flex items-center" style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={pad(hour)}
          onChange={handleHourChange}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); stepHour(1); }
            if (e.key === 'ArrowDown') { e.preventDefault(); stepHour(-1); }
          }}
          disabled={disabled}
          style={{
            width: '28px',
            textAlign: 'center',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9375rem',
            color: 'var(--color-text-main, #0f172a)',
            padding: '2px 0',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums'
          }}
          title="Horas (00-23 en formato 24hs)"
        />
        <div className="flex flex-col" style={{ marginLeft: '1px' }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => stepHour(1)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
              display: 'flex',
              lineHeight: 1
            }}
            title="Subir hora (+1h)"
          >
            <ChevronUp size={11} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => stepHour(-1)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
              display: 'flex',
              lineHeight: 1
            }}
            title="Bajar hora (-1h)"
          >
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* Separador ":" */}
      <span style={{ fontWeight: 800, color: 'var(--color-text-muted, #94a3b8)', margin: '0 1px' }}>:</span>

      {/* Campo de Minutos (00 - 55 en pasos de 5m) */}
      <div className="flex items-center" style={{ position: 'relative' }}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={pad(minute)}
          onChange={handleMinuteChange}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') { e.preventDefault(); stepMinute(5); }
            if (e.key === 'ArrowDown') { e.preventDefault(); stepMinute(-5); }
          }}
          disabled={disabled}
          style={{
            width: '28px',
            textAlign: 'center',
            border: 'none',
            background: 'transparent',
            fontWeight: 700,
            fontSize: '0.9375rem',
            color: 'var(--color-text-main, #0f172a)',
            padding: '2px 0',
            outline: 'none',
            fontVariantNumeric: 'tabular-nums'
          }}
          title="Minutos (cambios cada 5 min)"
        />
        <div className="flex flex-col" style={{ marginLeft: '1px' }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => stepMinute(5)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
              display: 'flex',
              lineHeight: 1
            }}
            title="Subir 5 minutos (+5m)"
          >
            <ChevronUp size={11} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => stepMinute(-5)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--color-text-muted, #64748b)',
              display: 'flex',
              lineHeight: 1
            }}
            title="Bajar 5 minutos (-5m)"
          >
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-text-muted, #94a3b8)', marginLeft: '2px', paddingRight: '2px' }}>
        hs
      </span>
    </div>
  );
}
