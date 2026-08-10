import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface UserProfile {
  full_name: string
  phone: string | null
  phone_verified: boolean
  village: string | null
  referral_code: string | null
  role: string
  rating_as_owner: number | null
  rating_as_renter: number | null
  avatar_url: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  // Phone verification
  const [phoneInput, setPhoneInput] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [phoneLoading, setPhoneLoading] = useState(false)
  const [phoneMsg, setPhoneMsg] = useState('')

  // Email change
  const [newEmail, setNewEmail] = useState('')
  const [emailMsg, setEmailMsg] = useState('')

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState('')

  // Referral
  const [refCopied, setRefCopied] = useState(false)

  // Account deletion
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteMsg, setDeleteMsg] = useState('')

  useEffect(() => { if (user) fetchProfile() }, [user])

  const fetchProfile = async () => {
    const { data } = await supabase.from('users').select('*').eq('id', user!.id).single()
    setProfile(data)
    setPhoneInput(data?.phone || '')
    setLoading(false)
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setSaving(true); setMsg('')
    const { error } = await supabase.from('users').update({
      full_name: profile.full_name,
      village: profile.village,
    }).eq('id', user!.id)
    setSaving(false)
    setMsg(error ? error.message : 'Enregistré !')
    setTimeout(() => setMsg(''), 3000)
  }

  const sendOtp = async () => {
    setPhoneLoading(true); setPhoneMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await supabase.functions.invoke('verify-phone', {
      body: { action: 'send', phone: phoneInput },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    setPhoneLoading(false)
    if (res.error) { setPhoneMsg(res.error.message || 'Erreur'); return }
    setOtpSent(true); setPhoneMsg('Code envoyé !')
  }

  const verifyOtp = async () => {
    setPhoneLoading(true); setPhoneMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await supabase.functions.invoke('verify-phone', {
      body: { action: 'verify', phone: phoneInput, otp },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    setPhoneLoading(false)
    if (res.error) { setPhoneMsg(res.error.message || 'Code incorrect'); return }
    setPhoneMsg('Téléphone vérifié !')
    fetchProfile()
  }

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setEmailMsg('')
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailMsg(error ? error.message : 'Vérifiez votre nouvel email pour le lien de confirmation.')
  }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwMsg(error ? error.message : 'Mot de passe mis à jour !')
    if (!error) setNewPassword('')
  }

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith('image/')) { setAvatarMsg("Ce fichier n'est pas une image."); return }
    if (file.size > 5 * 1024 * 1024) { setAvatarMsg('La photo dépasse la limite de 5 Mo.'); return }
    setAvatarUploading(true); setAvatarMsg('')
    const ext = file.name.split('.').pop()
    const path = `${user.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setAvatarMsg(upErr.message); setAvatarUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error: dbErr } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id)
    if (dbErr) { setAvatarMsg(dbErr.message); setAvatarUploading(false); return }
    setAvatarUploading(false)
    setAvatarMsg('Photo enregistrée !')
    fetchProfile()
    setTimeout(() => setAvatarMsg(''), 3000)
  }

  const deleteAccount = async () => {
    setDeleting(true); setDeleteMsg('')
    const { data: { session } } = await supabase.auth.getSession()
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const res = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setDeleteMsg(data.error || 'Erreur lors de la suppression.')
      setDeleting(false)
      return
    }
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const copyRefLink = () => {
    const link = `${window.location.origin}/register?ref=${profile?.referral_code}`
    navigator.clipboard.writeText(link).then(() => { setRefCopied(true); setTimeout(() => setRefCopied(false), 2000) })
  }

  if (loading) return <div className="page"><div className="loading">Chargement...</div></div>
  if (!profile) return null

  return (
    <div className="page">
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '28px', fontSize: '26px', fontWeight: '800' }}>Profil</h1>

        {/* Ratings */}
        {(profile.rating_as_owner || profile.rating_as_renter) && (
          <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '24px' }}>
            {profile.rating_as_owner && (
              <div style={{ textAlign: 'center' }}>
                <div className="rating" style={{ fontSize: '20px' }}>★ {Number(profile.rating_as_owner).toFixed(1)}</div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>en tant que propriétaire</div>
              </div>
            )}
            {profile.rating_as_renter && (
              <div style={{ textAlign: 'center' }}>
                <div className="rating" style={{ fontSize: '20px' }}>★ {Number(profile.rating_as_renter).toFixed(1)}</div>
                <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>en tant que locataire</div>
              </div>
            )}
          </div>
        )}

        {/* Profile photo */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Photo de profil</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', overflow: 'hidden', background: '#f0f0f0', flexShrink: 0, border: '2px solid var(--border, #e5e5e5)' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>👤</div>
              }
            </div>
            <div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', display: 'inline-block' }}>
                {avatarUploading ? 'Chargement...' : profile.avatar_url ? 'Changer la photo' : '+ Ajouter une photo'}
                <input type="file" accept="image/*" onChange={uploadAvatar} style={{ display: 'none' }} disabled={avatarUploading} />
              </label>
              {!profile.avatar_url && (
                <p style={{ fontSize: '12px', color: '#e57373', marginTop: '6px' }}>
                  ⚠ Requis pour déposer une annonce
                </p>
              )}
              {avatarMsg && <p style={{ fontSize: '13px', color: avatarMsg.includes('!') ? 'green' : 'red', marginTop: '6px' }}>{avatarMsg}</p>}
            </div>
          </div>
        </div>

        {/* Basic info */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Informations personnelles</h3>
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label>Nom complet</label>
              <input value={profile.full_name} onChange={e => setProfile(p => p ? { ...p, full_name: e.target.value } : p)} />
            </div>
            <div className="form-group">
              <label>Village / quartier</label>
              <input value={profile.village || ''} onChange={e => setProfile(p => p ? { ...p, village: e.target.value } : p)} placeholder="Votre quartier ou village" />
            </div>
            {msg && <div className={msg === 'Enregistré !' ? 'success-msg' : 'error-msg'}>{msg}</div>}
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </form>
        </div>

        {/* Phone verification */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Numéro de téléphone</h3>
            {profile.phone_verified && <span className="tag tag-green">✓ Vérifié</span>}
          </div>
          <div className="form-group">
            <label>Téléphone (avec indicatif, ex. +32...)</label>
            <input
              type="tel"
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="+32 470 000 000"
              disabled={profile.phone_verified}
            />
          </div>
          {!profile.phone_verified && (
            <>
              {!otpSent ? (
                <button onClick={sendOtp} className="btn btn-secondary" disabled={phoneLoading || !phoneInput}>
                  {phoneLoading ? 'Envoi...' : 'Envoyer le code de vérification'}
                </button>
              ) : (
                <div>
                  <div className="form-group">
                    <label>Code à 6 chiffres</label>
                    <input value={otp} onChange={e => setOtp(e.target.value)} placeholder="000000" maxLength={6} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={verifyOtp} className="btn btn-primary" disabled={phoneLoading || otp.length !== 6}>
                      {phoneLoading ? 'Vérification...' : 'Vérifier'}
                    </button>
                    <button onClick={sendOtp} className="btn btn-secondary btn-sm" disabled={phoneLoading}>Renvoyer</button>
                  </div>
                </div>
              )}
            </>
          )}
          {phoneMsg && <div className={phoneMsg === 'Code envoyé !' || phoneMsg === 'Téléphone vérifié !' ? 'success-msg' : 'error-msg'} style={{ marginTop: '12px' }}>{phoneMsg}</div>}
        </div>

        {/* Change email */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Changer l'email</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>
            Actuel : <strong>{user?.email}</strong>
          </p>
          <form onSubmit={changeEmail}>
            <div className="form-group">
              <label>Nouvel email</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
            </div>
            {emailMsg && <div className="success-msg">{emailMsg}</div>}
            <button type="submit" className="btn btn-secondary">Envoyer la confirmation</button>
          </form>
        </div>

        {/* Change password */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ marginBottom: '16px' }}>Changer le mot de passe</h3>
          <form onSubmit={changePassword}>
            <div className="form-group">
              <label>Nouveau mot de passe (min. 8 caractères)</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required />
            </div>
            {pwMsg && <div className={pwMsg === 'Mot de passe mis à jour !' ? 'success-msg' : 'error-msg'}>{pwMsg}</div>}
            <button type="submit" className="btn btn-secondary">Mettre à jour</button>
          </form>
        </div>

        {/* Referral */}
        {profile.referral_code && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <h3 style={{ marginBottom: '8px' }}>Code de parrainage</h3>
            <p style={{ color: '#666', fontSize: '14px', marginBottom: '12px' }}>Partagez votre lien et gagnez des récompenses quand vos amis s'inscrivent</p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <code style={{ background: '#f0f0f0', padding: '8px 14px', borderRadius: '8px', fontSize: '16px', fontWeight: '700', letterSpacing: '0.1em' }}>
                {profile.referral_code}
              </code>
              <button onClick={copyRefLink} className="btn btn-secondary btn-sm">
                {refCopied ? '✓ Copié !' : 'Copier le lien'}
              </button>
            </div>
          </div>
        )}

        {/* Delete account */}
        <div className="card" style={{ borderColor: '#fee2e2' }}>
          <h3 style={{ marginBottom: '8px', color: 'var(--danger, #dc2626)' }}>Supprimer mon compte</h3>
          <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
            Cette action est irréversible. Vos annonces seront supprimées. Les données financières sont conservées 7 ans conformément à la loi belge.
          </p>
          {!deleteConfirm ? (
            <button
              onClick={() => setDeleteConfirm(true)}
              className="btn btn-secondary"
              style={{ borderColor: '#dc2626', color: '#dc2626' }}
            >
              Supprimer mon compte
            </button>
          ) : (
            <div>
              <p style={{ fontWeight: '600', marginBottom: '12px', color: '#dc2626' }}>
                Êtes-vous sûr ? Cette action ne peut pas être annulée.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={deleteAccount}
                  className="btn btn-primary"
                  style={{ background: '#dc2626', borderColor: '#dc2626' }}
                  disabled={deleting}
                >
                  {deleting ? 'Suppression...' : 'Oui, supprimer définitivement'}
                </button>
                <button
                  onClick={() => { setDeleteConfirm(false); setDeleteMsg('') }}
                  className="btn btn-secondary"
                  disabled={deleting}
                >
                  Annuler
                </button>
              </div>
              {deleteMsg && <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '10px' }}>{deleteMsg}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
