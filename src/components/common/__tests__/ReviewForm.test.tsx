import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReviewForm from '../ReviewForm';

describe('ReviewForm', () => {
  it('без оценки отправить нельзя', () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} />);

    const submit = screen.getByRole('button', { name: 'Envoyer' });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('отдаёт оценку и обрезанный комментарий', () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '5 étoiles' }));
    fireEvent.change(screen.getByPlaceholderText('Votre commentaire (facultatif)'), {
      target: { value: '  Parfait  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 5, comment: 'Parfait' });
  });

  it('комментарий необязателен', () => {
    const onSubmit = vi.fn();
    render(<ReviewForm onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '3 étoiles' }));
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, comment: '' });
  });

  it('показывает ошибку сервера, а не глотает её', () => {
    render(<ReviewForm onSubmit={vi.fn()} error="Vous avez déjà laissé cet avis" />);
    expect(screen.getByText('Vous avez déjà laissé cet avis')).toBeInTheDocument();
  });
});
