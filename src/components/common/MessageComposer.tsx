// src/components/common/MessageComposer.tsx
import React, { useState } from 'react';

interface MessageComposerProps {
  onSend: (body: string) => void;
  sending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  sendLabel?: string;
  maxLength?: number;
}

const MessageComposer: React.FC<MessageComposerProps> = ({
  onSend, sending = false, disabled = false,
  placeholder = 'Votre message', sendLabel = 'Envoyer', maxLength = 2000,
}) => {
  const [value, setValue] = useState('');
  const blocked = disabled || sending;
  const canSend = value.trim().length > 0 && !blocked;

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    // Поле очищается сразу: страница перечитает переписку сама, а
    // оставленный текст выглядит как «не отправилось».
    setValue('');
  };

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <textarea
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={blocked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // Enter отправляет, Shift+Enter переносит строку.
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
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
        onClick={submit}
        disabled={!canSend}
      >
        {sending ? '...' : sendLabel}
      </button>
    </div>
  );
};

export default MessageComposer;
