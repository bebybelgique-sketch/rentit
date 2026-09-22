import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  updateUser: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: mocks.signInWithPassword, updateUser: mocks.updateUser } },
}));
vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: vi.fn() },
}));

import ChangeEmail from '../ChangeEmail';

const { signInWithPassword, updateUser, toastSuccess } = mocks;
const CURRENT = 'tim@example.be';

const renderForm = () => render(<ChangeEmail currentEmail={CURRENT} />);

const fill = (email: string, password: string) => {
  fireEvent.change(screen.getByLabelText('Nouvelle adresse'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: password } });
};
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Changer l’adresse' }));

describe('смена почтового адреса', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInWithPassword.mockResolvedValue({ error: null });
    updateUser.mockResolvedValue({ data: { user: { email: CURRENT } }, error: null });
  });

  // Адрес — это ЛОГИН. Подменить его значит увести учётку насовсем:
  // следом запрашивается восстановление пароля на новый адрес. Поэтому
  // личность подтверждается ровно так же, как при смене пароля.
  it('сначала подтверждает личность текущим паролем', async () => {
    renderForm();
    fill('novy@example.be', 'старый-пароль');
    submit();

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ email: 'novy@example.be' }));
    expect(signInWithPassword).toHaveBeenCalledWith({ email: CURRENT, password: 'старый-пароль' });
  });

  it('при неверном пароле адрес не меняется', async () => {
    signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderForm();
    fill('novy@example.be', 'не-тот');
    submit();

    await screen.findByText('Mot de passe actuel incorrect.');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('тот же адрес сменой не считается', async () => {
    renderForm();
    fill(CURRENT.toUpperCase(), 'старый-пароль');
    submit();

    await screen.findByText(/déjà votre adresse actuelle/);
    expect(signInWithPassword).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  // ГЛАВНОЕ. Нужно ли подтверждение нового адреса, решает НАСТРОЙКА
  // ПРОЕКТА Supabase, а не мы. Сказать «готово», когда на деле ушло
  // письмо, — соврать; сказать «проверьте почту», когда письма не будет,
  // — соврать тоже. Исход читается по ФАКТУ: какой адрес вернулся.
  it('адрес применён сразу — говорим «готово»', async () => {
    updateUser.mockResolvedValue({ data: { user: { email: 'novy@example.be' } }, error: null });
    renderForm();
    fill('novy@example.be', 'старый-пароль');
    submit();

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Adresse e-mail changée'));
    expect(screen.queryByText(/lien de confirmation/)).not.toBeInTheDocument();
  });

  it('вернулся прежний адрес — значит ушло письмо, и мы это говорим', async () => {
    updateUser.mockResolvedValue({ data: { user: { email: CURRENT } }, error: null });
    renderForm();
    fill('novy@example.be', 'старый-пароль');
    submit();

    // Адрес НАЗВАН: опечатка в нём иначе выглядит как «письмо не приходит».
    expect(await screen.findByText(/novy@example\.be/)).toBeInTheDocument();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('отказ сервера называет причину — на языке человека', async () => {
    updateUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_address_invalid', message: 'Email address is invalid' } });
    renderForm();
    fill('novy@example.be', 'старый-пароль');
    submit();

    await screen.findByText("Cette adresse e-mail n'est pas valide.");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('текущий адрес показан — человек должен видеть, что меняет', () => {
    renderForm();
    expect(screen.getByText(new RegExp(CURRENT))).toBeInTheDocument();
  });
});
