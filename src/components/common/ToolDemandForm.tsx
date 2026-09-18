// src/components/common/ToolDemandForm.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRecordToolDemand } from '../../hooks/mutations/useRecordToolDemand';

interface ToolDemandFormProps {
  /**
   * Что человек уже набрал в поиске. Подставляется в поле, но остаётся
   * правимым: он искал «перфоратор бош», а назвать хочет «перфоратор».
   */
  initialTool?: string;
}

/** Совпадает с ограничением базы (tool_demands_tool_len, миграция 34). */
const MAX_TOOL = 120;

/**
 * «Какой инструмент вы искали?» на пустой витрине.
 *
 * ЗАЧЕМ. Замер прода 17.09.2026: вещей ноль. Пустой экран, который только
 * извиняется, — тупик; этот спрашивает. На витрине без предложения названный
 * спрос единственный отвечает, что засевать первым.
 *
 * ПОЧЕМУ КОМПОНЕНТ ДЕРЖИТ МУТАЦИЮ САМ, В ОТЛИЧИЕ ОТ ReviewForm. Тот
 * презентационный намеренно: его зовут из двух мест с разными мутациями.
 * Здесь место одно и мутация одна, а Home.tsx и без того длинный — выносить
 * наружу три поля состояния значило бы размазать виджет по двум файлам ради
 * симметрии, которой ничто не пользуется.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Поля почты. Адрес просят, чтобы написать, когда инструмент
 * появится, — а канал письма в продукте не подтверждён. Поэтому подтверждение
 * говорит ПРЯМО, что письма не будет: человек, оставивший запрос, не должен
 * уйти ждать ответа, которого никто не пошлёт.
 */
const ToolDemandForm: React.FC<ToolDemandFormProps> = ({ initialTool = '' }) => {
  const { t, i18n } = useTranslation();
  const [tool, setTool] = useState(initialTool);
  const [emptyError, setEmptyError] = useState(false);
  const [savedTool, setSavedTool] = useState<string | null>(null);

  const { mutate, isPending, isError } = useRecordToolDemand();

  // Подтверждение занимает место формы: повторная отправка того же запроса
  // не добавляет сведения, а засоряет список, по которому потом считают.
  if (savedTool !== null) {
    return (
      <div style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
        <p style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>
          {t('toolDemand.done', { tool: savedTool })}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
          {t('toolDemand.doneNote')}
        </p>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const named = tool.trim();
    // Запись без инструмента ничего не измеряет, поэтому отказ называет
    // причину, а не просто подсвечивает поле красным.
    if (!named) { setEmptyError(true); return; }
    setEmptyError(false);
    mutate(
      { tool: named, searchedQuery: initialTool, locale: i18n.language },
      { onSuccess: () => setSavedTool(named) },
    );
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 'var(--space-6)', textAlign: 'left' }}>
      <label
        htmlFor="tool-demand"
        style={{ display: 'block', fontWeight: 700, marginBottom: 'var(--space-2)' }}
      >
        {t('toolDemand.question')}
      </label>
      <p style={{ color: 'var(--muted)', fontSize: 'var(--text-sm)', marginTop: 0, marginBottom: 'var(--space-3)' }}>
        {t('toolDemand.why')}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        <input
          id="tool-demand"
          value={tool}
          maxLength={MAX_TOOL}
          placeholder={t('toolDemand.placeholder')}
          onChange={(e) => { setTool(e.target.value); setEmptyError(false); }}
          style={{
            flex: '1 1 200px', minHeight: '44px', padding: '8px 10px',
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            fontFamily: 'inherit', fontSize: 'var(--text-base)',
          }}
        />
        <button type="submit" className="btn btn-primary" style={{ minHeight: '44px' }} disabled={isPending}>
          {isPending ? '...' : t('toolDemand.submit')}
        </button>
      </div>

      {emptyError && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', marginBottom: 0 }}>
          {t('toolDemand.empty')}
        </p>
      )}
      {isError && !emptyError && (
        <p style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)', marginBottom: 0 }}>
          {t('toolDemand.failed')}
        </p>
      )}
    </form>
  );
};

export default ToolDemandForm;
