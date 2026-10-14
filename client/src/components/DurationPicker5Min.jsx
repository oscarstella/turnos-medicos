import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Componente DurationPicker5Min: Selector de duración de turnos en incrementos de 5 minutos.
 * Permite seleccionar desde un dropdown con opciones cada 5 minutos o usar flechitas para subir/bajar de a 5 min.
 */
export default function DurationPicker5Min({ value = 30, onChange, disabled = false }) {
  const currentVal = parseInt(value, 10) || 30;

  const stepDuration = (delta) => {
    let next = currentVal + delta;
    if (next < 5) next = 5;
    if (next > 180) next = 180;
    if (onChange) onChange(next);
  };

  const options = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 75, 90, 120];
  if (!options.includes(currentVal)) {
    options.push(currentVal);
    options.sort((a, b) => a - b);
  }

  return (
    <div
      className="duration-picker-5min flex items-center"
      style={{
        background: 'var(--color-surface, #ffffff)',
        border: '1px solid var(--color-border, #cbd5e1)',
        borderRadius: '8px',
        padding: '2px 6px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        userSelect: 'none'
      }}
    >
      <select
        value={currentVal}
        disabled={disabled}
        onChange={(e) => onChange && onChange(parseInt(e.target.value, 10))}
        style={{
          border: 'none',
          background: 'transparent',
          fontWeight: 700,
          fontSize: '0.875rem',
          color: 'var(--color-text-main, #0f172a)',
          padding: '2px 4px',
          outline: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer'
        }}
        title="Duración del turno (en minutos)"
      >
        {options.map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>

      <div className="flex flex-col" style={{ marginLeft: '1px' }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => stepDuration(5)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--color-text-muted, #64748b)',
            display: 'flex',
            lineHeight: 1
          }}
          title="Aumentar duración (+5 min)"
        >
          <ChevronUp size={11} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => stepDuration(-5)}
          style={{
            border: 'none',
            background: 'transparent',
            padding: 0,
            cursor: 'pointer',
            color: 'var(--color-text-muted, #64748b)',
            display: 'flex',
            lineHeight: 1
          }}
          title="Disminuir duración (-5 min)"
        >
          <ChevronDown size={11} />
        </button>
      </div>
    </div>
  );
}
