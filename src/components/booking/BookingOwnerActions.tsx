// src/components/booking/BookingOwnerActions.tsx
//
// Кнопки владельца над одной бронью — в одном месте.
//
// ЗАЧЕМ КОМПОНЕНТ. Те же четыре действия жили в двух страницах разными
// копиями: /my-items звала edge-функции напрямую и держала два своих
// индикатора загрузки, /my-rentals — три хука и три обработчика, причём
// «передать» и «вернуть» там не было вовсе. Владелец, ответивший на
// заявку в /my-rentals, доводил сделку до конца уже на другой странице.
//
// ЧТО ЗДЕСЬ НЕ РЕШАЕТСЯ. Машина состояний остаётся на сервере
// (transition-booking) — здесь только вопрос «какие кнопки показать»,
// и ответ на него сознательно повторяет серверную таблицу переходов:
//
//   pending_approval → одобрить / отклонить      (respond-to-request)
//   confirmed        → передана / отменить       (transition-booking)
//   active           → возвращена                (transition-booking)
//
// Расхождение с сервером не опасно: лишняя кнопка получит 409
// 'transition_not_allowed' и человек увидит внятный отказ, а не тихую
// смену статуса.

import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useApproveRental } from '../../hooks/mutations/useApproveRental';
import { useRejectRental } from '../../hooks/mutations/useRejectRental';
import { useTransitionBooking } from '../../hooks/mutations/useTransitionBooking';
import { serverErrorKey } from '../../domain/serverErrors';

interface Props {
  bookingId: string;
  status: string;
  /**
   * Страница, которая держит брони в своём состоянии, а не в react-query
   * (сейчас это /my-items), получает новый статус и обновляет строку сама.
   * Хуки инвалидируют ключи ['rentals'] и ['rentalsAsOwner'] в любом случае.
   */
  onDone?: (newStatus: string) => void;
}

const BookingOwnerActions: React.FC<Props> = ({ bookingId, status, onDone }) => {
  const { t } = useTranslation();
  const approve = useApproveRental();
  const reject = useRejectRental();
  const transition = useTransitionBooking();

  // Одна блокировка на все кнопки строки: пока идёт любое действие,
  // второе по той же брони всё равно проиграет гонку и вернёт 409.
  const busy = approve.isPending || reject.isPending || transition.isPending;

  // Код сервера → фраза на языке человека. Незнакомый код даёт общий
  // текст, а не своё имя на экране (src/domain/serverErrors.ts).
  const showError = (err: unknown) => {
    const code = err instanceof Error ? err.message : null;
    toast.error(t(serverErrorKey(code)));
  };

  const runApprove = async () => {
    try {
      await approve.mutateAsync({ bookingId });
      toast.success(t('myRentals.approvalSuccess'));
      onDone?.('confirmed');
    } catch (err) {
      showError(err);
    }
  };

  const runReject = async () => {
    try {
      await reject.mutateAsync({ bookingId });
      toast.success(t('myRentals.rejectionSuccess'));
      onDone?.('rejected');
    } catch (err) {
      showError(err);
    }
  };

  // Текст успеха приходит СЮДА уже переведённым, а не ключом: страж
  // словарей (scripts/check-i18n-keys.mjs) видит только литеральные
  // вызовы перевода, и ключ, переданный переменной, для него не существует —
  // непереведённая строка доехала бы до экрана без единого возражения.
  const runTransition = async (
    action: 'handover' | 'complete' | 'cancel',
    successMessage: string,
    reason?: string | null,
  ) => {
    try {
      // Статус берём ИЗ ОТВЕТА, а не из своей таблицы переходов: если
      // сервер однажды поведёт бронь иначе, страница покажет его правду.
      const newStatus = await transition.mutateAsync({ bookingId, action, reason });
      toast.success(successMessage);
      onDone?.(newStatus);
    } catch (err) {
      showError(err);
    }
  };

  const runCancel = () => {
    const reason = prompt(t('rental.cancelPromptOwner'));
    if (reason === null) return;
    void runTransition('cancel', t('rental.cancelSuccess'), reason);
  };

  switch (status) {
    case 'pending_approval':
      return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={runApprove} disabled={busy}>
            {approve.isPending ? t('common.loading') : t('rental.approve')}
          </button>
          <button
            className="btn btn-sm"
            style={{ color: 'var(--danger)', border: '1.5px solid var(--danger)', background: 'transparent' }}
            onClick={runReject}
            disabled={busy}
          >
            {reject.isPending ? t('common.loading') : t('rental.reject')}
          </button>
        </div>
      );

    case 'confirmed':
      return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void runTransition('handover', t('rental.handoverSuccess'))}
            disabled={busy}
          >
            {busy ? t('common.loading') : t('rental.markHandedOver')}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={runCancel} disabled={busy}>
            {t('rental.cancelButtonShort')}
          </button>
        </div>
      );

    // Статус после передачи называется 'active' — не 'in_progress'.
    // Список значений enum booking_status закрыт, см. AGENTS.md, раздел 3.
    case 'active':
      return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void runTransition('complete', t('rental.completeSuccess'))}
            disabled={busy}
          >
            {busy ? t('common.loading') : t('rental.markReturned')}
          </button>
        </div>
      );

    // completed, cancelled, rejected, expired и прочее: действий у
    // владельца нет. Возвращаем null, а не пустой блок, чтобы у карточки
    // не оставалось поля от несуществующих кнопок.
    default:
      return null;
  }
};

export default BookingOwnerActions;
