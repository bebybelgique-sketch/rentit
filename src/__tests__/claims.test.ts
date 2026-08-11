import { describe, it, expect } from 'vitest';
import { findClaimViolations, checkText } from '../../scripts/check-claims.mjs';

// Страж утверждений в наборе тестов, а не только в отдельной команде:
// проверка, которую надо не забыть запустить, однажды не запускается.
describe('страж утверждений', () => {
  it('в исходниках нет обещаний, которых продукт не даёт', () => {
    const violations = findClaimViolations();
    const report = violations
      .map((v) => `${v.file}:${v.line}\n  ${v.rule}\n  ${v.why}\n  ${v.text}`)
      .join('\n\n');
    expect(report).toBe('');
  });

  // Страж, который никогда не срабатывает, неотличим от сломанного.
  // Здесь проверяется, что он ловит именно то, что пропустил живой скан
  // 11.08: «Protection dommages · €500», где нет ни слова «assurance»,
  // ни «Protection incluse».
  it('ловит обещание защиты рядом с суммой', () => {
    expect(checkText('<h3>Protection dommages</h3>')).toHaveLength(0);
    expect(checkText("<p>une protection jusqu'à €500</p>")).not.toHaveLength(0);
  });

  it('ловит включённость покрытия без суммы', () => {
    expect(checkText('Chaque location inclut automatiquement une protection.')).not.toHaveLength(0);
  });

  it('ловит escrow, Stripe и ссылку с чужим номером', () => {
    expect(checkText('Fonds en escrow')).not.toHaveLength(0);
    expect(checkText('processed by Stripe')).not.toHaveLength(0);
    expect(checkText('href={`https://wa.me/${item.users.phone}`}')).not.toHaveLength(0);
  });

  it('ловит комиссию с процентом', () => {
    expect(checkText("{ plan: 'Après 50 locations', note: '8% frais plateforme' }")).not.toHaveLength(0);
  });

  it('не срабатывает на прямые отрицания', () => {
    expect(checkText('<strong>RentIt ne fournit aucune assurance.</strong>')).toHaveLength(0);
    expect(checkText('<h3>Aucun paiement en ligne</h3>')).toHaveLength(0);
    expect(checkText('RentIt ne détient aucun fonds, ne prélève aucune commission')).toHaveLength(0);
  });

  it('не срабатывает на кнопку «поделиться» без номера', () => {
    expect(checkText('href={`https://wa.me/?text=${encodeURIComponent(url)}`}')).toHaveLength(0);
  });
});
