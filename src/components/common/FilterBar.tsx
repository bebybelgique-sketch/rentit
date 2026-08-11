// src/components/common/FilterBar.tsx
import React from 'react';

export interface FilterBarValue {
  startDate: string;
  endDate: string;
  maxPrice: string;
}

interface FilterBarProps {
  value: FilterBarValue;
  onChange: (value: FilterBarValue) => void;
  onReset?: () => void;
  resetLabel?: string;
}

const fieldStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  fontSize: '14px',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#888',
  marginBottom: '4px',
  display: 'block',
};

// Только даты и цена. Радиуса и расстояния здесь намеренно нет: геопоиск —
// следующий этап, а поле, которое ничего не фильтрует, обманывает.
const FilterBar: React.FC<FilterBarProps> = ({
  value, onChange, onReset, resetLabel = 'Réinitialiser',
}) => {
  const set = (patch: Partial<FilterBarValue>) => onChange({ ...value, ...patch });

  const handleStart = (startDate: string) => {
    // Конец раньше начала — не выбор пользователя, а следствие порядка
    // ввода. Молча сдвигаем конец, а не показываем пустой список.
    const endDate = value.endDate && value.endDate < startDate ? startDate : value.endDate;
    set({ startDate, endDate });
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div>
        <label htmlFor="filter-start" style={labelStyle}>Du</label>
        <input
          id="filter-start"
          type="date"
          value={value.startDate}
          onChange={(e) => handleStart(e.target.value)}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor="filter-end" style={labelStyle}>Au</label>
        <input
          id="filter-end"
          type="date"
          value={value.endDate}
          min={value.startDate || undefined}
          onChange={(e) => set({ endDate: e.target.value })}
          style={fieldStyle}
        />
      </div>

      <div>
        <label htmlFor="filter-price" style={labelStyle}>Prix max / jour (€)</label>
        <input
          id="filter-price"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          value={value.maxPrice}
          onChange={(e) => set({ maxPrice: e.target.value })}
          style={{ ...fieldStyle, width: '120px' }}
        />
      </div>

      {onReset && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onReset}>
          {resetLabel}
        </button>
      )}
    </div>
  );
};

export default FilterBar;
