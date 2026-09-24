import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { useMyInvite } from '../../hooks/useMyInvite'
import { withReferral } from '../../lib/referral'
import WhatsAppLink from '../common/WhatsAppLink'

/**
 * «Inviter un voisin» в профиле.
 *
 * До 24.09 у каждого человека был код приглашения (генерируется при
 * регистрации с миграции 01), а принимающая сторона его понимала
 * (/register?ref=…) — но взять свою ссылку было НЕГДЕ. Половина функции
 * жила в базе, вторая не существовала.
 *
 * Ссылка ведёт на витрину, а не на регистрацию: сосед сначала видит, что
 * рядом есть что взять, и только потом решает заводить учётку. Код
 * доедет до регистрации сам (src/lib/referral.ts).
 *
 * Имён пришедших здесь нет и не будет — только число: приглашённый не
 * соглашался, чтобы его показывали пригласившему. Так же сказано в тексте
 * под кнопками и в политике конфиденциальности.
 */
export default function InviteSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const invite = useMyInvite(user?.id)
  const [copied, setCopied] = useState<'copied' | 'failed' | null>(null)

  // Нет кода — нет раздела: кнопка без ссылки хуже, чем её отсутствие.
  if (!invite.data) return null

  const link = withReferral(`${window.location.origin}/`, invite.data.code)
  const text = t('invite.shareText')

  const share = async () => {
    if (navigator.share) {
      // Закрытое системное окно — «передумал», а не сбой.
      await navigator.share({ title: 'RentIt', text, url: link }).catch(() => {})
      return
    }
    const ok = navigator.clipboard
      ? await navigator.clipboard.writeText(link).then(() => true, () => false)
      : false
    setCopied(ok ? 'copied' : 'failed')
    setTimeout(() => setCopied(null), 2500)
  }

  return (
    <section style={{ marginTop: 'var(--space-6)' }} aria-labelledby="invite-title">
      <h2 id="invite-title" style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
        {t('invite.title')}
      </h2>
      <p style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>
        {t('invite.body')}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <button type="button" className="btn btn-secondary" onClick={share} style={{ minHeight: '44px' }}>
          {copied === 'copied' ? t('share.linkCopied')
            : copied === 'failed' ? t('invite.copyFailed')
            : t('invite.share')}
        </button>
        <WhatsAppLink
          text={`${text}\n${link}`}
          label={t('share.whatsappButton')}
          style={{ minHeight: '44px', padding: '0 16px', fontSize: '14px' }}
        />
      </div>
      {/* Ссылка видна текстом: её можно выделить и скопировать руками,
          если буфер обмена закрыт, и видно, ЧТО именно уходит соседу. */}
      <p style={{ marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '12.5px', wordBreak: 'break-all', color: 'var(--text)' }}>
        {link}
      </p>
      {invite.data.joined > 0 && (
        <p role="status" style={{ marginTop: '8px', fontSize: '14px', color: 'var(--success)' }}>
          {t('invite.joined', { count: invite.data.joined })}
        </p>
      )}
      <p style={{ marginTop: '8px', fontSize: '12.5px', color: 'var(--muted)', lineHeight: 1.5 }}>
        {t('invite.privacy')}
      </p>
    </section>
  )
}
