// src/components/layout/BottomNav.tsx
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import TaskBadge from '../common/TaskBadge';

/**
 * Нижняя панель для узких экранов: четыре раздела и действие посередине.
 *
 * ЗАЧЕМ ОНА. В навбаре у «Mes outils» и «Mes locations» стоит класс
 * `hide-mobile`, а правило `@media (max-width: 640px) {
 * .navbar-link.hide-mobile { display: none } }` (index.css) убирает их на
 * КАЖДОМ телефоне. Попасть в эти разделы с телефона можно было только со
 * страницы конкретной вещи — «Mes locations» после отправленной заявки
 * (ItemDetail.tsx) и «manageIt» у своей вещи. То есть сначала найди вещь,
 * потом найдёшься сам. Из навигации входа не было ни одного.
 *
 * Аудитория приходит с телефона: сосед с дрелью, а лендинг обещает «Cinq
 * minutes» и четыре фотографии. Половина продукта без входа на главном
 * устройстве — не вопрос вкуса.
 *
 * ПОЧЕМУ ТОЛЬКО ВОШЕДШИМ. Три раздела из четырёх требуют учётки. Панель, где
 * большинство кнопок отбрасывает на экран входа, хуже, чем её отсутствие.
 * Гостю остаётся навбар: «Parcourir», «Connexion», «Inscription».
 *
 * ПОЧЕМУ «MES OUTILS» ЗДЕСЬ НЕТ. Так в канве: пятого места на панели не
 * существует, и «Mes outils» лежит строкой внутри профиля. Эта строка в
 * продукте тоже добавлена — без неё замена навбара на панель отняла бы у
 * телефона последний вход в раздел вместо того, чтобы его вернуть.
 *
 * ПОЧЕМУ КРУГЛАЯ КНОПКА КРАСНАЯ, А ТАБЫ НЕТ. Правило палитры #39: красный —
 * глагол. «Déposer un outil» — единственное действие на панели, остальные
 * четыре только переносят. Поэтому красная ровно одна, и она приподнята на
 * 16 px: её находят большим пальцем не глядя.
 *
 * Размеры, цвета и толщины обводок взяты из канвы дословно — они, в свою
 * очередь, собраны из токенов index.css.
 */
interface BottomNavProps {
  /**
   * Сколько дел ждёт владельца.
   *
   * ПРИХОДИТ СВЕРХУ, А НЕ БЕРЁТСЯ ХУКОМ ЗДЕСЬ. Первая версия звала
   * useOwnerTasks прямо в панели — и панель, деталь навигации,
   * обзавелась сетевой зависимостью: её набор сразу упал на импорте
   * клиента Supabase, которому нужен .env.
   *
   * Довод не только про тест. Число обязано быть ОДНИМ и тем же в
   * навбаре и на панели; когда его считают в двух местах, однажды
   * посчитают по-разному. App зовёт хук один раз и раздаёт результат.
   */
  taskCount?: number;
}

export default function BottomNav({ taskCount = 0 }: BottomNavProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) return null;

  const tab = ({ isActive }: { isActive: boolean }) =>
    `bottom-nav-tab${isActive ? ' is-on' : ''}`;

  return (
    <nav className="bottom-nav" aria-label={t('nav.bottomLabel')}>
      {/* «Accueil» ведёт в «Mes outils», а не на `/`. Это РЕШЕНИЕ, а не
          буквальный перенос, и вот почему. В канве под этим ярлыком нарисован
          экран владельца: «À faire maintenant» и «Vos outils». В продукте
          такого экрана нет — по `/` открывается лендинг, маркетинговая
          страница. Отправлять туда вошедшего значит сделать первый таб
          бесполезным для того единственного, кому панель вообще показывается.
          Ближайшее существующее к замыслу канвы — список своих вещей с
          заявками, он же чинит второй отнятый вход.
          Настоящий owner-first дашборд — отдельная работа; когда он появится,
          меняется один href. */}
      <NavLink to="/my-items" className={tab}>
        <span className="bottom-nav-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" />
          </svg>
          <TaskBadge count={taskCount} placement="tab" />
        </span>
        <span>{t('nav.home')}</span>
      </NavLink>

      <NavLink to="/browse" className={tab}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="6" /><path d="M16 16l4 4" />
        </svg>
        <span>{t('browse')}</span>
      </NavLink>

      {/* Действие вынесено из ряда и приподнято: оно не раздел, а глагол.
          Подпись только в aria-label — у круглой кнопки её нет и в канве. */}
      <NavLink to="/list-item" className="bottom-nav-fab" aria-label={t('nav.listItem')}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </NavLink>

      <NavLink to="/my-rentals" className={tab}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" />
        </svg>
        <span>{t('nav.bookings')}</span>
      </NavLink>

      <NavLink to="/profile" className={tab}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="8" r="4" /><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6" />
        </svg>
        <span>{t('navProfile')}</span>
      </NavLink>
    </nav>
  );
}
