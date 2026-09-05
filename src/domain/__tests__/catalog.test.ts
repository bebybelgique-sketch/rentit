import { describe, it, expect } from 'vitest';
import { BOOKING_STATUSES, isBookingStatus, statusLabelKey, statusTone } from '../catalog';

// Список статусов брони — один на продукт: подписи, цвета бейджей и тип
// Rental['status'] берутся отсюда. Проверки ниже держат это свойство.

describe('isBookingStatus', () => {
  it('признаёт каждое значение enum booking_status', () => {
    for (const s of BOOKING_STATUSES) {
      expect(isBookingStatus(s.value)).toBe(true);
    }
  });

  it('отвергает чужое, пустое и отсутствующее', () => {
    // Статус приходит строкой из колбэков и ответов сервера. Опечатка
    // ('aprroved') или статус из другого продукта не должны попасть в
    // список броней: страница показала бы значение, которого в базе нет.
    expect(isBookingStatus('approved')).toBe(false);
    expect(isBookingStatus('PENDING_APPROVAL')).toBe(false);
    expect(isBookingStatus('')).toBe(false);
    expect(isBookingStatus(null)).toBe(false);
    expect(isBookingStatus(undefined)).toBe(false);
  });

  it('согласован с подписями и цветами', () => {
    // Если значение признано статусом, у него обязаны быть и подпись, и
    // тон бейджа — иначе на экране появится сырое имя из базы.
    for (const s of BOOKING_STATUSES) {
      expect(statusLabelKey(s.value)).toBeTruthy();
      expect(statusTone(s.value)).toBeTruthy();
    }
    expect(statusLabelKey('approved')).toBeNull();
    expect(statusTone('approved')).toBeNull();
  });
});
