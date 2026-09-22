import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// `vi.hoisted` обязателен: фабрики `vi.mock` поднимаются ВЫШЕ обычных
// объявлений, и простой `const` к моменту их вызова ещё не создан —
// «Cannot access before initialization».
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  toastSuccess: vi.fn(),
}));
const { signInWithPassword, updateUser, toastSuccess } = mocks;

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword, updateUser: mocks.updateUser } },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: vi.fn() },
}));

import ChangePassword from '../ChangePassword';

const renderForm = () => render(<ChangePassword email="tim@example.be" />);

const fill = (current: string, next: string, repeat: string) => {
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText(/Nouveau mot de passe \(8/), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Répétez le nouveau mot de passe'), { target: { value: repeat } });
};

const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

describe('смена пароля вошедшим', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ error: null });
  });

  // ГЛАВНЫЙ ИНВАРИАНТ. `updateUser({ password })` текущего пароля НЕ
  // ТРЕБУЕТ: хватает действующей сессии. Значит любой, кто добрался до
  // незапертого браузера, сменил бы пароль и запер владельца снаружи — а
  // тот узнал бы об этом, только не сумев войти.
  it('сначала подтверждает личность текущим паролем', async () => {
    renderForm();
    fill('старый-пароль', 'новый-пароль-1', 'новый-пароль-1');
    submit();

    await waitFor(() => expect(updateUser).toHaveBeenCalled());
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'tim@example.be',
      password: 'старый-пароль',
    });
  });

  it('при неверном текущем пароле смены НЕ происходит', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderForm();
    fill('не-тот', 'новый-пароль-1', 'новый-пароль-1');
    submit();

    await screen.findByText('Mot de passe actuel incorrect.');
    expect(updateUser).not.toHaveBeenCalled();
  });

  // Опечатка в единственном поле — это потерянный доступ к учётке, и
  // замечают её не сразу, а при следующем входе. Цена подтверждения — одно
  // поле; цена ошибки — вся учётка.
  it('не меняет, если новые пароли расходятся', async () => {
    renderForm();
    fill('старый-пароль', 'новый-пароль-1', 'новый-паролъ-1');
    submit();

    await screen.findByText(/ne correspondent pas/);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('держит минимум в восемь знаков', async () => {
    renderForm();
    fill('старый-пароль', 'корот', 'корот');
    submit();

    await screen.findByText(/au moins 8 caractères/);
    expect(updateUser).not.toHaveBeenCalled();
  });

  // Новый пароль, совпавший со старым, — это не смена. Принять его молча
  // значило бы сказать «готово» там, где ничего не произошло.
  it('не выдаёт «готово» за отсутствие изменений', async () => {
    renderForm();
    fill('тот-же-пароль', 'тот-же-пароль', 'тот-же-пароль');
    submit();

    await screen.findByText(/identique à l’ancien/);
    expect(updateUser).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  // Отказ сервера показывается ДОСЛОВНО: причину «пароль слишком простой»
  // человек может исправить, только зная её. «Что-то пошло не так» —
  // это тупик.
  /**
   * ИНВАРИАНТ ТОТ ЖЕ, ЧТО БЫЛ: отказ обязан НАЗВАТЬ ПРИЧИНУ, а не
   * утонуть в общем «что-то пошло не так». Изменилось одно — причина
   * теперь на языке человека.
   *
   * Прежде тест требовал английскую фразу Supabase дословно, и она
   * дословно же показывалась на французской странице. Причина была
   * названа — на чужом языке, то есть для половины людей не названа
   * вовсе.
   */
  it('отказ сервера называет причину — на языке человека', async () => {
    updateUser.mockResolvedValue({ error: { code: 'weak_password', message: 'Password is too weak' } });
    renderForm();
    fill('старый-пароль', 'новый-пароль-1', 'новый-пароль-1');
    submit();

    await screen.findByText('Mot de passe trop court ou trop simple.');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  /**
   * А вот НЕЗНАКОМЫЙ отказ английским не показывается. Служебная фраза
   * чужой системы человеку не поможет, а доверия к продукту стоит;
   * сама фраза остаётся в объекте ошибки и в консоли.
   */
  it('незнакомый отказ не выносит английский на экран', async () => {
    updateUser.mockResolvedValue({ error: { code: 'some_new_code', message: 'Unexpected internal failure' } });
    renderForm();
    fill('старый-пароль', 'новый-пароль-1', 'новый-пароль-1');
    submit();

    await waitFor(() => expect(screen.queryByText('Unexpected internal failure')).toBeNull());
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('удачная смена подтверждается и очищает поля', async () => {
    renderForm();
    fill('старый-пароль', 'новый-пароль-1', 'новый-пароль-1');
    submit();

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Mot de passe changé'));
    expect((screen.getByLabelText('Mot de passe actuel') as HTMLInputElement).value).toBe('');
  });

  // Поля пароля обязаны быть type="password": иначе набранное видно через
  // плечо и попадает в автозаполнение как обычный текст.
  it('все три поля скрывают набранное', () => {
    renderForm();
    for (const label of ['Mot de passe actuel', 'Répétez le nouveau mot de passe']) {
      expect((screen.getByLabelText(label) as HTMLInputElement).type).toBe('password');
    }
    expect((screen.getByLabelText(/Nouveau mot de passe \(8/) as HTMLInputElement).type).toBe('password');
  });
});
