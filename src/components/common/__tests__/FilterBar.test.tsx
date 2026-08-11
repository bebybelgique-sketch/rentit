import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterBar from '../FilterBar';

const empty = { startDate: '', endDate: '', maxPrice: '' };

describe('FilterBar', () => {
  it('только даты и цена — радиуса здесь нет', () => {
    render(<FilterBar value={empty} onChange={vi.fn()} />);
    expect(screen.getByLabelText('Du')).toBeInTheDocument();
    expect(screen.getByLabelText('Au')).toBeInTheDocument();
    expect(screen.getByLabelText('Prix max / jour (€)')).toBeInTheDocument();
    expect(screen.queryByLabelText(/rayon|distance/i)).not.toBeInTheDocument();
  });

  it('сообщает изменение цены', () => {
    const onChange = vi.fn();
    render(<FilterBar value={empty} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Prix max / jour (€)'), { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith({ ...empty, maxPrice: '25' });
  });

  // Иначе выбор начала позже конца молча даёт пустую выдачу, и человек
  // решает, что вещей нет.
  it('начало позже конца сдвигает конец, а не ломает выборку', () => {
    const onChange = vi.fn();
    render(
      <FilterBar value={{ startDate: '2026-08-01', endDate: '2026-08-05', maxPrice: '' }} onChange={onChange} />,
    );

    fireEvent.change(screen.getByLabelText('Du'), { target: { value: '2026-08-10' } });
    expect(onChange).toHaveBeenCalledWith({
      startDate: '2026-08-10', endDate: '2026-08-10', maxPrice: '',
    });
  });

  it('сброс вызывается, когда он предложен', () => {
    const onReset = vi.fn();
    render(<FilterBar value={empty} onChange={vi.fn()} onReset={onReset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    expect(onReset).toHaveBeenCalled();
  });
});
