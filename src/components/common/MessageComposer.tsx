// src/components/common/MessageComposer.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface MessageComposerProps {
  /**
   * Отправка. Если она вернёт обещание, которое разрешится в `false`
   * (не отправилось), текст возвращается в поле — набирать заново длинное
   * сообщение о месте и времени встречи никто не станет.
   */
  onSend: (body: string) => void | Promise<boolean | void>;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  maxLength?: number;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend, sending = false, disabled = false,
  placeholder, sendLabel, maxLength = 2000,
}) => {
  // Подписи — из словаря. До 01.10 значения по умолчанию были вшиты
  // по-французски, а единственный вызов (BookingThread) их не передавал:
  // голландец и англичанин писали в поле «Votre message» и жали «Envoyer».
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const blocked = disabled || sending;
  const canSend = value.trim().length > 0 && !blocked;

  const submit = async () => {
    if (!canSend) return;
    const body = value.trim();
    // Поле очищается сразу: страница перечитает переписку сама, а
    // оставленный текст выглядит как «не отправилось».
    setValue('');
    const sent = await onSend(body);
    // Не отправилось — возвращаем текст, если человек не начал писать новый.
    if (sent === false) setValue((now) => (now === '' ? body : now));
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <textarea
        value={value}
        maxLength={maxLength}
        placeholder={placeholder ?? t('booking.messagePlaceholder')}
        disabled={blocked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter отправляет, Shift+Enter переносит строку.
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); }
        }}
        rows={1}
        style={{
          flex: 1, padding: '8px 10px', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', resize: 'vertical', fontFamily: 'inherit', fontSize: '14px',
        }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => void submit()}
        disabled={!canSend}
      >
        {sending ? '...' : sendLabel ?? t('booking.messageSend')}
      </button>
    </div>
  );
};

export default MessageComposer;
