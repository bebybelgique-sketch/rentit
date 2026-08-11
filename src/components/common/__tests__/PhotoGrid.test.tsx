import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhotoGrid from '../PhotoGrid';

const photos = [
  { id: 'p1', url: 'https://x/1.jpg', phase: 'return' as const, uploadedAt: '2026-08-12T10:00:00Z' },
  { id: 'p2', url: 'https://x/2.jpg', phase: 'handover' as const, uploadedAt: '2026-08-11T10:00:00Z' },
];

describe('PhotoGrid', () => {
  it('пустой список объясняет отсутствие фото', () => {
    render(<PhotoGrid photos={[]} emptyLabel="Aucune photo" />);
    expect(screen.getByText('Aucune photo')).toBeInTheDocument();
  });

  it('группирует по этапу: сначала remise, потом retour', () => {
    render(<PhotoGrid photos={photos} />);
    const titles = screen.getAllByText(/Remise|Retour/).map((n) => n.textContent);
    expect(titles).toEqual(['Remise', 'Retour']);
  });

  it('у каждой фотографии осмысленный alt', () => {
    render(<PhotoGrid photos={photos} />);
    expect(screen.getByAltText("État de l'outil à la remise")).toBeInTheDocument();
    expect(screen.getByAltText("État de l'outil au retour")).toBeInTheDocument();
  });

  it('кнопки удаления нет, пока фото не помечено как удаляемое', () => {
    render(<PhotoGrid photos={photos} onRemove={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Supprimer la photo' })).not.toBeInTheDocument();
  });

  it('удаляет только по идентификатору своей фотографии', () => {
    const onRemove = vi.fn();
    render(<PhotoGrid photos={[{ ...photos[1], canRemove: true }]} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer la photo' }));
    expect(onRemove).toHaveBeenCalledWith('p2');
  });
});
