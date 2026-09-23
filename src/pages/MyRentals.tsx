// src/pages/MyRentals.tsx
import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRentals } from '../hooks/useRentals';
import BookingStatusBadge from '../components/common/BookingStatusBadge';
import EmptyState from '../components/common/EmptyState';
import BookingThread from '../components/booking/BookingThread';
import BookingOwnerActions from '../components/booking/BookingOwnerActions';
import CancellationNotice from '../components/common/CancellationNotice';
import UserRatingBadge from '../components/common/UserRatingBadge';
import { useRentalsAsOwner } from '../hooks/useRentalsAsOwner';
import PushBlockedBanner from '../components/push/PushBlockedBanner';
import { useMarkActivityRead, useUnreadActivity } from '../hooks/useActivity';
import { useCatalogHasItems } from '../hooks/useCatalogHasItems';
import { useTransitionBooking } from '../hooks/mutations/useTransitionBooking';
import { serverErrorKey } from '../domain/serverErrors';
import type { Rental } from '../types';
// Импортируем toast
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle'
import { renterUpdates, liveRenterCount } from '../domain/renterUpdates'
import { ownerTasks } from '../domain/ownerTasks'
import { errorText } from '../lib/errorText'

const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' });
const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
};

// Отменить можно, пока вещь не уехала. После передачи отменять нечего:
// инструмент физически в чужих руках, и закрывается это возвратом.
// Две стороны одной сделки. Человек здесь всегда обе сразу, поэтому
// страница обязана говорить, КОТОРУЮ показывает.
type RentalRole = 'renter' | 'owner';

const CANCELLABLE_BY_RENTER = ['pending_approval', 'confirmed'];

const MyRentals: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  usePageTitle(t('myRentalsTitle'))

  // Ссылка вида /my-rentals?booking=<id> ведёт К КОНКРЕТНОЙ брони.
  // Без этого ссылка из /my-items была декоративной: человек попадал на
  // страницу с двумя списками и искал свою сделку глазами — а на десятке
  // броней это уже поиск, а не переход.
  const [searchParams, setSearchParams] = useSearchParams();
  const focusId = searchParams.get('booking');

  // Какая вкладка открыта — в АДРЕСЕ, а не в useState. Тогда ссылка на
  // конкретную сторону сделки пересылается целиком, работает кнопка
  // «назад», и перезагрузка не сбрасывает человека на чужой список.
  const roleParam = searchParams.get('role');
  const explicitRole: RentalRole | null =
    roleParam === 'owner' ? 'owner' : roleParam === 'renter' ? 'renter' : null;

  // Получаем аренды, где пользователь - арендатор
  const { data: userRentals, isLoading: userRentalsLoading, error: userRentalsError } = useRentals(user?.id);

  // Получаем аренды, где пользователь - владелец
  const { data: ownerRentals, isLoading: ownerRentalsLoading, error: ownerRentalsError } = useRentalsAsOwner(user?.id);

  // Отмена арендатором — единственное действие, которое эта страница
  // делает сама. Всё, что доступно ВЛАДЕЛЬЦУ (одобрить, отклонить,
  // передать, вернуть, отменить), собрано в BookingOwnerActions и живёт
  // одинаково здесь и в /my-items.
  // Ссылка /my-rentals?booking=<id> обязана привести к ВИДИМОЙ брони.
  // Часть таких ссылок указывает на сделку, где человек владелец, — и,
  // открыв вкладку арендатора по умолчанию, страница показала бы «ничего
  // нет» поверх существующей брони. Поэтому без явного ?role сторону
  // выбирает та, в чьём списке бронь действительно лежит.
  const ownerHasFocus = !!focusId && !!ownerRentals?.some(r => r.id === focusId);

  // НЕПРОЧИТАННОЕ У БРОНИ (лента событий, миграция 42).
  //
  // До 23.09 у сообщений не было «непрочитано» нигде: сообщение от
  // собеседника оставалось невидимым, пока человек не откроет именно эту
  // бронь. Теперь у такой брони — метка «Nouveau».
  //
  // Пришёл по ссылке на бронь (из ленты или из push) — значит смотрит на
  // неё: её непрочитанное гаснет само. Метка у остальных гаснет по нажатию.
  const unread = useUnreadActivity(user?.id);
  const markRead = useMarkActivityRead(user?.id);
  const unreadBookings = unread.data?.bookingIds;
  const focusUnread = !!focusId && !!unreadBookings?.has(focusId);
  React.useEffect(() => {
    if (focusId && focusUnread) markRead.mutate({ bookingId: focusId });
    // markRead — стабильный объект мутации.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, focusUnread]);

  const newMark = (bookingId: string) =>
    unreadBookings?.has(bookingId) ? (
      <button
        type="button"
        className="tag tag-red booking-new"
        title={t('activity.markRead')}
        onClick={() => markRead.mutate({ bookingId })}
      >
        {t('activity.newBadge')}
      </button>
    ) : null;
  const role: RentalRole = explicitRole ?? (ownerHasFocus ? 'owner' : 'renter');

  // Счётчик на НЕактивной вкладке — единственное, что сообщает о заявке,
  // пришедшей на твой инструмент, пока открыта другая сторона. Без него
  // владелец видит «Aucune location en cours» и уходит, а заявка лежит
  // через одно нажатие.
  // СЧЁТЧИКИ ПОКАЗЫВАЮТ ЖИВОЕ, а не «сколько строк за всё время».
  //
  // Раньше здесь стояло `userRentals.length`: число всех броней,
  // включая отменённые и завершённые. Закрыв десять сделок, человек
  // видел «10» и не понимал, чего от него хотят. Счётчик, который не
  // уменьшается никогда, не значит ничего — к нему привыкают, как к
  // красному кружку, который горит всегда.
  //
  // Момент округляется до минуты: иначе новый `new Date()` на каждом
  // рендере пересчитывал бы список без причины.
  const minute = Math.floor(Date.now() / 60_000);
  const now = React.useMemo(() => new Date(minute * 60_000), [minute]);

  const nextUp = React.useMemo(
    () => renterUpdates(userRentals ?? [], now),
    [userRentals, now],
  );
  const renterCount = liveRenterCount(userRentals ?? [], now);

  // У владельца на вкладке — число ДЕЛ, а не строк: то же правило,
  // что у значка в навигации (src/domain/ownerTasks.ts).
  //
  // Считается ФУНКЦИЕЙ по данным, которые у страницы уже есть, а не
  // хуком useOwnerTasks. Хук ходит в react-query за своим запросом, и
  // первая версия так и делала — пока не выяснилось, что она ломает
  // набор страницы: тесты подменяют хуки данных поимённо, и новый
  // запрос остался без клиента. Заглушить его моком значило бы
  // оторвать счётчик от данных теста и проверять собственную заглушку.
  //
  // Расхождения с кружком это не создаёт: правило одно, разные у них
  // только источники одних и тех же строк, и мутации гасят оба ключа
  // разом (invalidateBookingCaches).
  const ownerCount = React.useMemo(
    () => ownerTasks(ownerRentals ?? [], now).length,
    [ownerRentals, now],
  );

  const selectRole = (next: RentalRole) => {
    const params = new URLSearchParams(searchParams);
    params.set('role', next);
    setSearchParams(params);
  };

  // ПУСТО С ОБЕИХ СТОРОН — это ОДНО состояние, а не два.
  //
  // Вкладки чинили настоящую беду (две секции стопкой и переключатель,
  // который не переключал), но на пустом экране они её создали заново:
  // человек открывает вкладку — «Aucune location en cours», жмёт вторую —
  // «Aucune demande». Две пустоты вместо одной, и ни одна не говорит,
  // ПОЧЕМУ пусто и что с этим делать.
  //
  // В канве этого экрана вкладок нет вовсе: пока сделок нет ни в одну
  // сторону, там одна честная строка и одно действие, которое разблокирует
  // обе стороны сразу. Полоса вкладок появляется вместе с содержимым.
  // ВНИМАНИЕ: «пусто» и «нечего делать» — РАЗНЫЕ ВОПРОСЫ, и здесь
  // считаются СТРОКИ, а не живое.
  //
  // Когда счётчики вкладок перевели на живое, это условие поехало
  // следом за ними, и человек с тремя завершёнными арендами увидел бы
  // «сделок нет вовсе, идите на витрину», а его история пропала бы с
  // экрана. Поймал это набор: вкладок в разметке просто не оказалось.
  //
  // Пустой экран — про то, ЕСТЬ ЛИ ХОТЬ ЧТО-НИБУДЬ. Счётчик — про то,
  // требуется ли внимание. Совпадают они только в самом начале.
  const bothEmpty =
    !userRentalsLoading && !ownerRentalsLoading &&
    !userRentalsError && !ownerRentalsError &&
    (userRentals?.length ?? 0) === 0 && (ownerRentals?.length ?? 0) === 0;

  // Довод «арендовать нечего, каталог пуст» — УТВЕРЖДЕНИЕ О СОСТОЯНИИ, и
  // зашивать его нельзя: сегодня верно, завтра врёт. Тот же класс, что
  // зашитый ноль на лендинге. Каталог спрашивается тем же запросом.
  const { catalogIsEmpty } = useCatalogHasItems();

  const transitionMutation = useTransitionBooking();

  const handleCancel = async (rentalId: string) => {
    const reason = prompt(t('rental.cancelPrompt'));
    if (reason === null) return;
    try {
      await transitionMutation.mutateAsync({ bookingId: rentalId, action: 'cancel', reason });
      toast.success(t('rental.cancelSuccess'));
    } catch (error: unknown) {
      // 409 от сервера означает, что вторая сторона уже изменила бронь.
      // Показываем причину, а не «успешно»: тихий успех здесь был бы враньём.
      toast.error(t(serverErrorKey(error instanceof Error ? error.message : null)));
    }
  };

  // Прокрутка после того, как списки отрисованы: до этого узла с нужным
  // id на странице просто нет. Зависимости — длины обоих списков: бронь
  // может оказаться в любом из них.
  useEffect(() => {
    if (!focusId) return;
    const node = document.getElementById(`booking-${focusId}`);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // role в зависимостях обязателен: узла booking-<id> нет в разметке,
    // пока не открыта та вкладка, в которой лежит бронь.
  }, [focusId, role, userRentals?.length, ownerRentals?.length]);

  // Подсветка карточки: прокрутка сама по себе не отвечает на вопрос «а
  // которая из них моя», если на экране помещается несколько.
  const focusStyle = (id: string): React.CSSProperties =>
    id === focusId
      ? { outline: '2px solid var(--primary)', outlineOffset: '2px' }
      : {};

  if (!user) {
    return (
      <div className="page">
        <div className="loading">{t('myRentals.loginRequired')}</div>
      </div>
    );
  }

  const renderCancellation = (rental: Rental, otherPartyName: string) => {
    if (rental.status !== 'cancelled' || !rental.cancelled_at) return null;
    const byMe = rental.cancelled_by === user.id;
    return (
      <CancellationNotice
        cancelledByName={byMe ? t('rental.cancelledByYouShort') : otherPartyName}
        cancelledAt={rental.cancelled_at}
        reason={rental.cancellation_reason ?? null}
      />
    );
  };

  return (
    <div className="page">
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '32px' }}>{t('myRentalsTitle')}</h1>

        {/* Полоса C пакета Design: уведомления заблокированы в браузере,
            а ответ как раз ждут — по своей заявке или по заявке на свою
            вещь. Сама решает, показываться ли. */}
        <PushBlockedBanner
          hasPendingRequest={
            !!userRentals?.some((r) => r.status === 'pending_approval') ||
            !!ownerRentals?.some((r) => r.status === 'pending_approval')
          }
        />

        {/* Одна пустота вместо двух. Ни вкладок, ни двух пустых списков:
            пока сделок нет ни в одну сторону, переключать нечего, и
            переключатель тут только заставляет человека дважды убедиться,
            что смотреть не на что.
            Довод подбирается по ФАКТИЧЕСКОМУ состоянию каталога: «нечего
            арендовать, потому что каталог пуст» — утверждение, и зашивать
            его нельзя. Пока ответа о каталоге нет, берётся более слабая
            формулировка: она верна в обоих случаях. */}
        {bothEmpty ? (
          <EmptyState
            title={t('myRentals.bothEmptyTitle')}
            description={catalogIsEmpty
              ? t('myRentals.bothEmptyBodyNoCatalog')
              : t('myRentals.bothEmptyBody')}
            actionLabel={catalogIsEmpty ? t('myRentals.listTool') : t('myRentals.browseTools')}
            actionTo={catalogIsEmpty ? '/list-item' : '/browse'}
          />
        ) : (
        <>
        {/* Настоящие вкладки, а не две кнопки прокрутки.
            Раньше здесь стояли две одинаково серые пилюли, которые лишь
            прокручивали страницу: ни одна никогда не была подсвечена, а обе
            секции всё равно лежали стопкой одна под другой. Орган управления
            выглядел как выбор и выбором не был — на телефоне это просто
            длинная лента из двух списков.
            Вид взят готовый: .seg с залитой ЧЕРНИЛАМИ активной кнопкой — тот
            же переключатель, что на главной. Модификатор --full растягивает
            его на всю ширину только на телефоне: подписи по-французски
            длинные («En tant que locataire»), и в inline-flex они рвутся. */}
        <div className="seg seg--full" role="tablist" aria-label={t('myRentals.sectionsLabel')}>
          <button
            type="button"
            role="tab"
            id="tab-renter"
            aria-selected={role === 'renter'}
            aria-controls="as-renter"
            className={`seg-btn${role === 'renter' ? ' is-on' : ''}`}
            onClick={() => selectRole('renter')}
          >
            {t('myRentals.asRenter')}
            {renterCount > 0 && <span className="seg-count">{renterCount}</span>}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-owner"
            aria-selected={role === 'owner'}
            aria-controls="as-owner"
            className={`seg-btn${role === 'owner' ? ' is-on' : ''}`}
            onClick={() => selectRole('owner')}
          >
            {t('myRentals.requestsForMyTools')}
            {ownerCount > 0 && <span className="seg-count">{ownerCount}</span>}
          </button>
        </div>

        {/* Аренды как арендатор */}
        {/* Заголовка h2 здесь больше нет: вкладка над ним говорила «En tant
            que locataire», а он следом — «Mes locations (Locataire)». Одно и
            то же дважды подряд. Имя секции несёт сама вкладка, на неё и
            ссылается aria-labelledby. */}
        <section
          id="as-renter"
          role="tabpanel"
          aria-labelledby="tab-renter"
          hidden={role !== 'renter'}
          style={{ marginBottom: '40px' }}
        >
          {/* «ЧТО ДАЛЬШЕ» — ПЕРВЫМ. Так же, как «À faire maintenant» у
              владельца, и по той же причине: экран обязан отвечать на
              вопрос «что от меня сейчас», а не «какие у меня были
              брони». Список ниже никуда не делся — он история. */}
          {nextUp.length > 0 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <h2 style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                {t('renterNext.title')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {nextUp.map((u) => {
                  const rental = userRentals?.find((r) => r.id === u.bookingId);
                  if (!rental) return null;
                  return (
                    <a
                      key={u.bookingId}
                      href={`#booking-${u.bookingId}`}
                      style={{
                        display: 'block', padding: '12px 14px', borderRadius: '8px',
                        textDecoration: 'none', color: 'inherit',
                        background: '#fffbeb',
                        border: `1px solid ${u.urgent ? 'var(--danger)' : '#fde68a'}`,
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '15px' }}>
                        {rental.item?.title ?? t('rental.labelItem')}
                      </div>
                      <div style={{
                        fontSize: '12px', fontFamily: 'var(--font-mono)', marginTop: '4px',
                        color: u.urgent ? 'var(--danger)' : 'var(--muted)',
                        fontWeight: u.urgent ? 700 : 400,
                      }}>
                        {u.kind === 'awaiting_answer' && u.deadline && (
                          u.deadline.state === 'overdue' ? t('myItems.answerOverdue')
                            : u.deadline.state === 'minutes' ? t('myItems.answerMinutes', { count: u.deadline.minutes })
                            : t('myItems.answerHours', { count: u.deadline.hours })
                        )}
                        {u.kind === 'accepted' && t('renterNext.accepted', { date: formatDate(rental.start_date ?? '') })}
                        {u.kind === 'pickup_due' && (
                          u.overdueDays === 0 ? t('renterNext.pickupToday')
                            : t('renterNext.pickupLate', { count: u.overdueDays })
                        )}
                        {u.kind === 'in_progress' && t('renterNext.inProgress', { date: formatDate(rental.end_date ?? '') })}
                        {u.kind === 'return_due' && (
                          u.overdueDays === 0 ? t('renterNext.returnToday')
                            : t('renterNext.returnLate', { count: u.overdueDays })
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {userRentalsLoading && <p>{t('common.loading')}</p>}
          {userRentalsError && <p className="error-msg">{errorText(t, userRentalsError, 'myRentals.loadFailed')}</p>}
          {userRentals && userRentals.length === 0 && (
            <EmptyState title={t('myRentals.noRentals')} description={t('myRentals.noRentalsHint')} actionLabel={t('myRentals.browseTools')} actionTo="/browse" />
          )}
          {userRentals && userRentals.length > 0 && (
            <div>
              {userRentals.map(rental => {
                const owner = rental.item?.owner;
                return (
                  <div
                    key={rental.id}
                    id={`booking-${rental.id}`}
                    className="card"
                    style={{ padding: '16px', marginBottom: '12px', ...focusStyle(rental.id) }}
                  >
                    <p><strong>{t('rental.labelItem')}:</strong> {rental.item?.title || 'N/A'}</p>
                    <p>
                      <strong>{t('rental.labelOwner')}:</strong> {owner?.full_name || t('rental.unknownUser')}{' '}
                      <UserRatingBadge rating={owner?.rating_as_owner ?? null} role="owner" />
                    </p>
                    <p><strong>{t('rental.labelDates')}:</strong> {t('rental.datesRange', { start: formatDate(rental.start_date ?? ''), end: formatDate(rental.end_date ?? '') })}</p>
                    <p><strong>{t('rental.labelStatus')} :</strong> <BookingStatusBadge status={rental.status ?? 'pending_approval'} />{newMark(rental.id)}</p>
                    {/* Доставка показывается из СНИМКА в брони, а не из вещи:
                        владелец мог с тех пор поменять цену, но договорённость
                        была на этой. */}
                    {rental.delivery_requested && rental.delivery_fee != null && (
                      <p><strong>{t('rental.labelDelivery')}:</strong> €{Number(rental.delivery_fee).toFixed(2)} <span style={{ color: 'var(--muted)' }}>{t('rental.deliveryOnSite')}</span></p>
                    )}
                    {renderCancellation(rental, owner?.full_name || "l'autre partie")}

                    {CANCELLABLE_BY_RENTER.includes(rental.status ?? '') && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleCancel(rental.id)}
                          disabled={transitionMutation.isPending}
                        >
                          {t('rental.cancelButton')}
                        </button>
                      </div>
                    )}

                    {owner && (
                      <BookingThread
                        bookingId={rental.id}
                        itemId={rental.item_id ?? ''}
                        currentUserId={user.id}
                        counterpartyId={owner.id}
                        counterpartyName={owner.full_name || 'Utilisateur'}
                        status={rental.status ?? 'pending_approval'}
                        role="renter"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Аренды как владелец */}
        <section
          id="as-owner"
          role="tabpanel"
          aria-labelledby="tab-owner"
          hidden={role !== 'owner'}
          style={{ marginBottom: '40px' }}
        >
          {ownerRentalsLoading && <p>{t('common.loading')}</p>}
          {ownerRentalsError && <p className="error-msg">{errorText(t, ownerRentalsError, 'myRentals.loadFailed')}</p>}
          {ownerRentals && ownerRentals.length === 0 && (
            <EmptyState title={t('myRentals.noRequests')} description={t('myRentals.noRequestsHint')} actionLabel={t('myRentals.listTool')} actionTo="/list-item" />
          )}
          {ownerRentals && ownerRentals.length > 0 && (
            <div>
              {ownerRentals.map(rental => (
                <div
                  key={rental.id}
                  id={`booking-${rental.id}`}
                  className="card"
                  style={{ padding: '16px', marginBottom: '12px', ...focusStyle(rental.id) }}
                >
                  {/* Здесь стоял rental.renter_id — владелец видел сырой UUID
                      вместо человека, к которому поедет. Профиль приходит
                      вместе с бронью (useRentalsAsOwner). */}
                  <p>
                    <strong>{t('rental.labelRenter')}:</strong> {rental.renter?.full_name || t('rental.unknownUser')}{' '}
                    <UserRatingBadge rating={rental.renter?.rating_as_renter ?? null} role="renter" />
                  </p>
                  <p><strong>{t('rental.labelItem')}:</strong> {rental.item?.title || 'N/A'}</p>
                  <p><strong>{t('rental.labelDates')}:</strong> {t('rental.datesRange', { start: formatDate(rental.start_date ?? ''), end: formatDate(rental.end_date ?? '') })}</p>
                  <p><strong>{t('rental.labelStatus')} :</strong> <BookingStatusBadge status={rental.status ?? 'pending_approval'} />{newMark(rental.id)}</p>
                  {/* Поля message в bookings нет: столбец называется
                      request_message, и страница показывала пустоту. */}
                  {rental.delivery_requested && rental.delivery_fee != null && (
                    <p><strong>{t('rental.labelDelivery')}:</strong> €{Number(rental.delivery_fee).toFixed(2)} <span style={{ color: 'var(--muted)' }}>{t('rental.deliveryOnSite')}</span></p>
                  )}
                  {rental.request_message && <p><strong>{t('rental.labelMessage')}:</strong> {rental.request_message}</p>}
                  {renderCancellation(rental, rental.renter?.full_name || "l'autre partie")}

                  {/* Весь путь сделки владельца — от ответа на заявку до
                      возврата — не покидая эту страницу. Раньше здесь
                      кончалось на «Accepter/Refuser», а «передана» и
                      «возвращена» надо было искать в /my-items.
 
                      Ошибку показывает сам компонент: прежний блок ниже
                      печатал сырое error.message, то есть служебную фразу
                      supabase-js вместо причины отказа. */}
                  <div style={{ marginTop: '8px' }}>
                    <BookingOwnerActions bookingId={rental.id} status={rental.status ?? 'pending_approval'} />
                  </div>

                  {rental.renter && (
                    <BookingThread
                      bookingId={rental.id}
                      itemId={rental.item_id ?? ''}
                      currentUserId={user.id}
                      counterpartyId={rental.renter.id}
                      counterpartyName={rental.renter.full_name || 'Utilisateur'}
                      status={rental.status ?? 'pending_approval'}
                      role="owner"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
        </>
        )}
      </div>
    </div>
  );
};

export default MyRentals;
