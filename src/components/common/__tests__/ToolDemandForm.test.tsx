import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToolDemandForm from '../ToolDemandForm';

const mutate = vi.fn();
let pending = false;
let failed = false;

vi.mock('../../../hooks/mutations/useRecordToolDemand', () => ({
  useRecordToolDemand: () => ({ mutate, isPending: pending, isError: failed }),
}));

beforeEach(() => {
  mutate.mockReset();
  // По умолчанию мутация удаётся: колбэк успеха зовётся сразу.
  mutate.mockImplementation((_vars, opts) => opts?.onSuccess?.());
  pending = false;
  failed = false;
});

describe('ToolDemandForm', () => {
  it('подставляет то, что человек уже набрал в поиске', () => {
    render(<ToolDemandForm initialTool="perceuse" />);
    expect(screen.getByLabelText('Quel outil cherchiez-vous ?')).toHaveValue('perceuse');
  });

  // Запись без инструмента ничего не измеряет, поэтому отказ называет
  // причину, а не подсвечивает поле красным.
  it('пустое поле — отказ с причиной, и в базу ничего не уходит', () => {
    render(<ToolDemandForm initialTool="   " />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByText(/Nommez l’outil d’abord/)).toBeInTheDocument();
  });

  it('отправляет названное, поисковую строку и язык', () => {
    render(<ToolDemandForm initialTool="perfo bosch" />);
    fireEvent.change(screen.getByLabelText('Quel outil cherchiez-vous ?'), {
      target: { value: '  perforateur  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(mutate).toHaveBeenCalledWith(
      { tool: 'perforateur', searchedQuery: 'perfo bosch', locale: expect.any(String) },
      expect.anything(),
    );
  });

  it('подтверждение называет инструмент, а не отделывается «спасибо»', () => {
    render(<ToolDemandForm initialTool="scie" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(screen.getByText('Noté : scie')).toBeInTheDocument();
  });

  // ИНВАРИАНТ ЧЕСТНОСТИ. Поля почты здесь нет, потому что канал письма не
  // подтверждён. Значит человек не должен уйти ждать ответа: подтверждение
  // обязано сказать это прямо. Если поле почты когда-нибудь появится, этот
  // тест упадёт — и заставит переписать текст вместе с ним, а не после.
  it('подтверждение прямо говорит, что письма не будет', () => {
    render(<ToolDemandForm initialTool="scie" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(screen.getByText(/Nous ne vous écrirons pas/)).toBeInTheDocument();
    expect(screen.queryByText(/@/)).not.toBeInTheDocument();
  });

  it('форма исчезает после отправки: повтор того же запроса засорил бы счёт', () => {
    render(<ToolDemandForm initialTool="scie" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument();
  });

  it('отказ базы виден человеку, а не только в консоли', () => {
    failed = true;
    mutate.mockImplementation(() => {});
    render(<ToolDemandForm initialTool="scie" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(screen.getByText(/n’est pas partie/)).toBeInTheDocument();
  });
});
