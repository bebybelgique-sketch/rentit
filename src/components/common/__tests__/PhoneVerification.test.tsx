import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// `vi.hoisted`: фабрики `vi.mock` поднимаются выше обычных объявлений.
const mocks = vi.hoisted(() => ({ invokeEdge: vi.fn() }));

vi.mock('../../../lib/edgeInvoke', async () => {
  // EdgeError берётся НАСТОЯЩИЙ: проверка «код отказа доехал до текста»
  // и есть предмет этих тестов, подменять её нечем.
  const actual = await vi.importActual<typeof import('../../../lib/edgeInvoke')>('../../../lib/edgeInvoke');
  return { ...actual, invokeEdge: mocks.invokeEdge };
});

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import PhoneVerification from '../PhoneVerification';
import { EdgeError } from '../../../lib/edgeInvoke';

const { invokeEdge } = mocks;

const statusOf = (phone: string | null, verified: boolean) =>
  invokeEdge.mockImplementation((_name: string, body: { action: string }) =>
    body.action === 'status' ? Promise.resolve({ phone, verified }) : Promise.resolve({ ok: true }));

describe('телефон: ввод и подтверждение', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('без номера предлагает его добавить', async () => {
    statusOf(null, false);
    render(<PhoneVerification />);
    await screen.findByLabelText('Votre numéro');
    expect(screen.getByRole('button', { name: 'Recevoir un code' })).toBeInTheDocument();
  });

  // Номер показывается ЗАМАСКИРОВАННЫМ, и маскирует его сервер: колонка
  // `phone` клиенту не читается вовсе (PostgREST отвечает 401 даже на свою
  // строку). Компонент обязан показать то, что пришло, и не пытаться
  // достать полный номер сам.
  it('показывает номер так, как его отдал сервер', async () => {
    statusOf('+32••••••89', true);
    render(<PhoneVerification />);
    expect(await screen.findByText(/\+32••••••89/)).toBeInTheDocument();
    expect(screen.getByText('vérifié')).toBeInTheDocument();
  });

  // «Номер есть, но не подтверждён» — отдельное состояние от «номера нет».
  // В первом случае человек уже что-то сделал.
  it('различает «не подтверждён» и «нет номера»', async () => {
    statusOf('+32••••••89', false);
    render(<PhoneVerification />);
    expect(await screen.findByText('non vérifié')).toBeInTheDocument();
    expect(screen.getByLabelText('Nouveau numéro')).toBeInTheDocument();
  });

  it('после отправки кода спрашивает код', async () => {
    statusOf(null, false);
    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Votre numéro'), { target: { value: '+32470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));

    await screen.findByLabelText('Code reçu par SMS');
    expect(invokeEdge).toHaveBeenCalledWith('verify-phone', { action: 'send', phone: '+32470123456' });
  });

  // ГЛАВНОЕ ПРО КАНАЛ, КОТОРОГО ЕЩЁ НЕТ. Пока Twilio не настроен, функция
  // отвечает отдельным кодом. Человек должен прочесть «канал не открыт», а
  // не «что-то пошло не так»: первое — состояние продукта, второе —
  // обвинение в его адрес.
  it('ненастроенный SMS-канал назван состоянием, а не ошибкой человека', async () => {
    invokeEdge.mockImplementation((_n: string, body: { action: string }) =>
      body.action === 'status'
        ? Promise.resolve({ phone: null, verified: false })
        : Promise.reject(new EdgeError('sms_not_configured', 503)));

    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Votre numéro'), { target: { value: '+32470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));

    expect(await screen.findByText(/pas encore active/)).toBeInTheDocument();
    // И шаг кода НЕ открывается: кода не будет, ждать его нечего.
    expect(screen.queryByLabelText('Code reçu par SMS')).not.toBeInTheDocument();
  });

  it('неверный формат номера объяснён форматом, а не общим отказом', async () => {
    invokeEdge.mockImplementation((_n: string, body: { action: string }) =>
      body.action === 'status'
        ? Promise.resolve({ phone: null, verified: false })
        : Promise.reject(new EdgeError('phone_invalid', 400)));

    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Votre numéro'), { target: { value: '0470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));

    expect(await screen.findByText(/Format international attendu/)).toBeInTheDocument();
  });

  // Человек, ошибшийся номером, без этой кнопки застревает: код не придёт
  // никогда, а вернуться некуда.
  it('с шага кода можно вернуться и исправить номер', async () => {
    statusOf(null, false);
    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Votre numéro'), { target: { value: '+32470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));
    await screen.findByLabelText('Code reçu par SMS');

    fireEvent.click(screen.getByRole('button', { name: 'Changer de numéro' }));
    expect(await screen.findByLabelText('Votre numéro')).toBeInTheDocument();
  });

  // Поле кода принимает только цифры: буквы в нём не значат ничего, а
  // подсказка обещает «шесть цифр».
  it('в поле кода не попадают буквы', async () => {
    statusOf(null, false);
    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Votre numéro'), { target: { value: '+32470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));

    const field = await screen.findByLabelText('Code reçu par SMS') as HTMLInputElement;
    fireEvent.change(field, { target: { value: '12a3b4' } });
    expect(field.value).toBe('1234');
  });

  it('подтверждение перечитывает статус, а не верит себе на слово', async () => {
    let verified = false;
    invokeEdge.mockImplementation((_n: string, body: { action: string }) => {
      if (body.action === 'status') return Promise.resolve({ phone: '+32••••••56', verified });
      if (body.action === 'verify') { verified = true; return Promise.resolve({ ok: true }); }
      return Promise.resolve({ ok: true });
    });

    render(<PhoneVerification />);
    fireEvent.change(await screen.findByLabelText('Nouveau numéro'), { target: { value: '+32470123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recevoir un code' }));
    const field = await screen.findByLabelText('Code reçu par SMS');
    fireEvent.change(field, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));

    await waitFor(() => expect(screen.getByText('vérifié')).toBeInTheDocument());
  });
});
