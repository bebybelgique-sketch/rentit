import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import MessageComposer from '../MessageComposer';

describe('MessageComposer', () => {
  it('не отправляет пустое и не отправляет одни пробелы', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const button = screen.getByRole('button', { name: 'Envoyer' });

    expect(button).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText('Votre message'), { target: { value: '   ' } });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('отправляет обрезанный текст и очищает поле', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText('Votre message') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: '  Bonjour  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    expect(onSend).toHaveBeenCalledWith('Bonjour');
    expect(field.value).toBe('');
  });

  it('Enter отправляет, Shift+Enter — нет', () => {
    const onSend = vi.fn();
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText('Votre message');

    fireEvent.change(field, { target: { value: 'A' } });
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('A');
  });

  it('закрытая бронь запрещает писать', () => {
    render(<MessageComposer onSend={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText('Votre message')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeDisabled();
  });

  // Поле очищается сразу, но если сообщение не ушло, текст возвращается:
  // до 01.10 он пропадал, и длинное «où et à quelle heure» набирали заново.
  it('не отправилось — текст возвращается в поле', async () => {
    const onSend = vi.fn().mockResolvedValue(false);
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText('Votre message') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: 'Samedi 10h devant chez moi ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(field.value).toBe('Samedi 10h devant chez moi ?'));
  });

  it('ушло — поле остаётся пустым', async () => {
    const onSend = vi.fn().mockResolvedValue(true);
    render(<MessageComposer onSend={onSend} />);
    const field = screen.getByPlaceholderText('Votre message') as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: 'Merci !' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Merci !'));
    expect(field.value).toBe('');
  });
});
