import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import CookieBanner from '../CookieBanner';

const STORAGE_KEY = 'rentit_cookie_consent';

const renderBanner = () =>
  render(<MemoryRouter><CookieBanner /></MemoryRouter>);

const accept = () => screen.getByRole('button', { name: 'Accepter tous les cookies' });
const refuse = () => screen.getByRole('button', { name: 'Refuser les optionnels' });
const manage = () => screen.getByRole('button', { name: 'Gérer les préférences' });

describe('баннер согласия: отказ должен быть так же заметен, как согласие', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ГЛАВНЫЙ ИНВАРИАНТ, и он не про вкус.
  //
  // «Refuser les optionnels» проигрывала «Accepter tous les cookies» по
  // КАЖДОЙ оси сразу: заливка против прозрачного, #F5F4F0 против #555 на
  // белом, рамки не было против самой бледной, 14px против 13px, отступ 14
  // против 11, жирность 700 против неустановленной, вся ширина против
  // половины второго ряда. Отказ был самым незаметным органом на экране —
  // слабее даже «Gérer les préférences».
  //
  // Неравная заметность согласия и отказа — оформление, за которое CNIL в
  // январе 2022 оштрафовала Google и Facebook (150 и 60 млн евро) и которое
  // EDPB разбирает в руководстве 03/2022. В шапке того же баннера написано
  // «CONFORME RGPD».
  //
  // Сверяется атрибут style ЦЕЛИКОМ, а не отдельные свойства: перевес по
  // любому не перечисленному свойству — такой же перевес.
  it('согласие и отказ нарисованы совершенно одинаково', () => {
    renderBanner();
    expect(refuse().getAttribute('style')).toBe(accept().getAttribute('style'));
  });

  it('они стоят одним рядом, а не один над половиной другого', () => {
    renderBanner();
    expect(refuse().parentElement).toBe(accept().parentElement);
  });

  // «Настройки» — не выбор по существу, а обход, и должны читаться третьими.
  // Раньше эта кнопка была заметнее отказа.
  it('«настройки» не заметнее отказа', () => {
    renderBanner();
    // Замеряется ЖИРНОСТЬ, а не расположение: раньше «Gérer les préférences»
    // стояла на 600, а у отказа насыщенность не была задана вовсе — то есть
    // 400. Обход выглядел весомее самого отказа. Сравнение контейнеров этого
    // не ловило: кнопки и тогда лежали в разных блоках.
    const weight = (el: HTMLElement) => Number(el.style.fontWeight || 400);
    expect(weight(refuse())).toBeGreaterThanOrEqual(weight(manage()));
    expect(manage().parentElement).not.toBe(accept().parentElement);
  });

  // Заметность правили, а НЕ смысл: отказ обязан по-прежнему отказывать.
  it('отказ по-прежнему снимает всё необязательное', () => {
    renderBanner();
    fireEvent.click(refuse());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!))
      .toEqual({ necessary: true, functional: false, analytics: false });
  });

  it('согласие по-прежнему включает всё', () => {
    renderBanner();
    fireEvent.click(accept());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!))
      .toEqual({ necessary: true, functional: true, analytics: true });
  });

  // Выбор спрашивают ОДИН раз: повторный показ уже решившему человеку —
  // это давление, а не согласие.
  it('сделавшему выбор баннер больше не показывают', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ necessary: true, functional: false, analytics: false }));
    renderBanner();
    expect(screen.queryByRole('button', { name: 'Accepter tous les cookies' })).not.toBeInTheDocument();
  });
});
