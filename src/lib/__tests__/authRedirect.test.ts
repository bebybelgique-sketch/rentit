import { describe, it, expect } from 'vitest';
import { parseAuthRedirect } from '../authRedirect';

// Адрес ссылки из письма Supabase читается ДО того, как auth-js его сотрёт.
// Разбор — как у auth-js: хеш, затем строка запроса.

describe('parseAuthRedirect', () => {
  it('ссылка восстановления — токен из хеша', () => {
    const r = parseAuthRedirect('https://rentit.example/reset-password#access_token=AT&refresh_token=RT&expires_in=3600&token_type=bearer&type=recovery');
    expect(r).toEqual({ recoveryToken: 'AT', error: null });
  });

  // Просроченная или уже открытая ссылка: Supabase возвращает с ошибкой.
  it('ссылка с ошибкой — код ошибки, токена нет', () => {
    const r = parseAuthRedirect('https://rentit.example/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
    expect(r).toEqual({ recoveryToken: null, error: 'otp_expired' });
  });

  it('ошибка в строке запроса тоже видна', () => {
    expect(parseAuthRedirect('https://rentit.example/reset-password?error_description=boom').error).toBe('unspecified_error');
  });

  // Не ссылка восстановления — токен не считается токеном восстановления.
  it('вход по ссылке без type=recovery — не восстановление', () => {
    expect(parseAuthRedirect('https://rentit.example/#access_token=AT&type=signup').recoveryToken).toBeNull();
  });

  it('обычный адрес — пусто', () => {
    expect(parseAuthRedirect('https://rentit.example/reset-password')).toEqual({ recoveryToken: null, error: null });
  });
});
