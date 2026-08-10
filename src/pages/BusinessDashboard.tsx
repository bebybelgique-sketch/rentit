import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'

const PLAN_LIMITS: Record<string, number | null> = {
  starter: 20,
  growth: 100,
  enterprise: null,
}

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter — €49/mo',
  growth: 'Growth — €99/mo',
  enterprise: 'Enterprise — €149/mo',
}

interface BizItem {
  id: string
  title: string
  category: string
  price_per_day: number
  available: boolean
  created_at: string
  photos: string[]
}

interface Earning {
  month: string
  total: number
  count: number
}

export default function BusinessDashboard() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const success = searchParams.get('success') === '1'

  const [profile, setProfile] = useState<any>(null)
  const [items, setItems] = useState<BizItem[]>([])
  const [earnings, setEarnings] = useState<Earning[]>([])
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalBookings, setTotalBookings] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'items' | 'upload'>('overview')

  // CSV upload state
  const [csvText, setCsvText] = useState('')
  const [csvError, setCsvError] = useState('')
  const [csvSuccess, setCsvSuccess] = useState(0)
  const [csvLoading, setCsvLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    fetchAll()
  }, [user])

  const fetchAll = async () => {
    if (!user) return
    const [
      { data: prof },
      { data: itemData },
      { data: bookData },
    ] = await Promise.all([
      supabase.from('users').select('business_name, business_plan, business_plan_expires_at').eq('id', user.id).single(),
      supabase.from('items').select('id, title, category, price_per_day, available, created_at, photos').eq('owner_id', user.id).order('created_at', { ascending: false }),
      supabase.from('bookings').select('total_price, created_at, status').eq('status', 'completed').in(
        'item_id',
        (await supabase.from('items').select('id').eq('owner_id', user.id)).data?.map((i: any) => i.id) || []
      ),
    ])

    setProfile(prof)
    setItems(itemData || [])

    // Aggregate earnings by month
    const byMonth: Record<string, { total: number; count: number }> = {}
    let total = 0
    for (const b of (bookData || [])) {
      const m = b.created_at.slice(0, 7)  // "2026-03"
      if (!byMonth[m]) byMonth[m] = { total: 0, count: 0 }
      byMonth[m].total += parseFloat(b.total_price) || 0
      byMonth[m].count += 1
      total += parseFloat(b.total_price) || 0
    }
    setTotalEarnings(total)
    setTotalBookings((bookData || []).length)
    setEarnings(
      Object.entries(byMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 6)
        .map(([month, v]) => ({ month, ...v }))
    )
    setLoading(false)
  }

  const toggleItem = async (id: string, available: boolean) => {
    await supabase.from('items').update({ available: !available }).eq('id', id)
    setItems(p => p.map(i => i.id === id ? { ...i, available: !available } : i))
  }

  // CSV bulk upload: title,category,price_per_day,deposit,description
  const handleCsvUpload = async () => {
    if (!user || !csvText.trim()) return
    setCsvError('')
    setCsvLoading(true)
    setCsvSuccess(0)

    const lines = csvText.trim().split('\n').filter(Boolean)
    const header = lines[0].toLowerCase().replace(/\s/g, '')
    if (!header.includes('title') || !header.includes('category') || !header.includes('price')) {
      setCsvError('CSV must have columns: title, category, price_per_day, deposit, description')
      setCsvLoading(false)
      return
    }

    const rows = lines.slice(1)
    const inserts: any[] = []

    for (const row of rows) {
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
      const [title, category, price_per_day, deposit, description] = cols
      if (!title || !category || !price_per_day) continue
      const price = parseFloat(price_per_day)
      if (isNaN(price) || price <= 0) continue
      inserts.push({
        owner_id: user.id,
        title,
        category,
        price_per_day: price,
        deposit: parseFloat(deposit) || 0,
        description: description || null,
        available: true,
        is_business: true,
        photos: [],
      })
    }

    if (inserts.length === 0) {
      setCsvError('No valid rows found in CSV')
      setCsvLoading(false)
      return
    }

    const limit = PLAN_LIMITS[profile?.business_plan]
    if (limit !== null && items.length + inserts.length > limit) {
      setCsvError(`Plan limit: you can have max ${limit} items. Currently ${items.length}, trying to add ${inserts.length}.`)
      setCsvLoading(false)
      return
    }

    const { error } = await supabase.from('items').insert(inserts)
    if (error) {
      setCsvError(error.message)
    } else {
      setCsvSuccess(inserts.length)
      setCsvText('')
      fetchAll()
    }
    setCsvLoading(false)
  }

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>

  if (!profile?.business_plan) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: '480px', margin: '40px auto', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏗️</div>
          <h2 style={{ marginBottom: '8px' }}>No active business plan</h2>
          <p style={{ color: '#888', marginBottom: '20px' }}>Choose a plan to access your business dashboard.</p>
          <Link to="/business" className="btn btn-primary">View plans</Link>
        </div>
      </div>
    )
  }

  const limit = PLAN_LIMITS[profile.business_plan]
  const canUpload = profile.business_plan === 'growth' || profile.business_plan === 'enterprise'

  return (
    <div className="page">
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {success && (
          <div className="success-msg" style={{ marginBottom: '24px', fontSize: '16px' }}>
            🏗️ Business plan activated! Welcome to RentIt for Business.
          </div>
        )}

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
              {profile.business_name || 'Business Dashboard'}
            </h1>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)', background: '#ede9ff', borderRadius: '4px', padding: '2px 8px' }}>
              🏗️ {PLAN_LABEL[profile.business_plan]}
            </span>
          </div>
          <Link to="/list-item" className="btn btn-primary btn-sm">+ Add item</Link>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr) repeat(2, 1fr)', gap: '16px', marginBottom: '28px' }}>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Active listings</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>
              {items.filter(i => i.available).length}
              {limit && <span style={{ fontSize: '14px', color: '#aaa', fontWeight: '400' }}> / {limit}</span>}
            </div>
          </div>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Total items</div>
            <div style={{ fontSize: '28px', fontWeight: '800' }}>{items.length}</div>
          </div>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Total bookings</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--primary)' }}>{totalBookings}</div>
          </div>
          <div className="card" style={{ padding: '18px' }}>
            <div style={{ fontSize: '12px', color: '#888', fontWeight: '600', marginBottom: '4px' }}>Total earned</div>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#28a745' }}>€{totalEarnings.toFixed(0)}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
          {(['overview', 'items', ...(canUpload ? ['upload'] : [])] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t as any)}
              style={{
                padding: '10px 20px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '14px',
                background: 'none', borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : '#888', marginBottom: '-2px',
              }}
            >
              {t === 'overview' ? 'Overview' : t === 'items' ? `Items (${items.length})` : 'Bulk Upload'}
            </button>
          ))}
        </div>

        {/* Tab: Overview */}
        {tab === 'overview' && (
          <div>
            {earnings.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📊</div>
                <p style={{ color: '#888' }}>No completed rentals yet. Add items to start earning.</p>
              </div>
            ) : (
              <div className="card">
                <h3 style={{ marginBottom: '16px', fontSize: '16px', fontWeight: '700' }}>Monthly earnings</h3>
                <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 0', color: '#888', fontWeight: '600' }}>Month</th>
                      <th style={{ textAlign: 'right', padding: '8px', color: '#888', fontWeight: '600' }}>Bookings</th>
                      <th style={{ textAlign: 'right', padding: '8px 0', color: '#888', fontWeight: '600' }}>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map(e => (
                      <tr key={e.month} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '10px 0' }}>{e.month}</td>
                        <td style={{ textAlign: 'right', padding: '10px 8px', color: '#666' }}>{e.count}</td>
                        <td style={{ textAlign: 'right', padding: '10px 0', fontWeight: '700', color: '#28a745' }}>€{e.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="card" style={{ marginTop: '16px', background: '#f9f8ff' }}>
              <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.7' }}>
                <strong>Plan:</strong> {PLAN_LABEL[profile.business_plan]}<br />
                <strong>Commission:</strong> 0% (included in plan)<br />
                <strong>Renews:</strong> {profile.business_plan_expires_at ? new Date(profile.business_plan_expires_at).toLocaleDateString('en-BE', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}<br />
                <strong>Upgrade / cancel:</strong> <a href="/business" style={{ color: 'var(--primary)' }}>Manage plan →</a>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Items */}
        {tab === 'items' && (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📦</div>
                <p style={{ color: '#888', marginBottom: '16px' }}>No items yet.</p>
                <Link to="/list-item" className="btn btn-primary">Add first item</Link>
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f8f9ff' }}>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px 16px', color: '#888', fontWeight: '600' }}>Item</th>
                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Category</th>
                    <th style={{ textAlign: 'right', padding: '12px 8px', color: '#888', fontWeight: '600' }}>€/day</th>
                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#888', fontWeight: '600' }}>Status</th>
                    <th style={{ padding: '12px 16px' }}></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {item.photos?.[0] ? (
                            <img src={item.photos[0]} style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} alt="" />
                          ) : (
                            <div style={{ width: '36px', height: '36px', borderRadius: '6px', background: '#ede9ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>🔧</div>
                          )}
                          <span style={{ fontWeight: '600' }}>{item.title}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', color: '#666' }}>{item.category.replace('_', ' ')}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '700' }}>€{item.price_per_day}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center' }}>
                        <span className={`tag ${item.available ? 'tag-green' : 'tag-gray'}`} style={{ fontSize: '11px' }}>
                          {item.available ? 'Active' : 'Hidden'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => toggleItem(item.id, item.available)}
                          className="btn btn-secondary btn-sm"
                        >
                          {item.available ? 'Hide' : 'Show'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Bulk Upload (Growth+) */}
        {tab === 'upload' && canUpload && (
          <div className="card">
            <h3 style={{ marginBottom: '8px' }}>CSV Bulk Upload</h3>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>
              Paste CSV with columns: <code>title, category, price_per_day, deposit, description</code>
              <br />Category values: <code>power_tools | hand_tools | garden | construction | cleaning | measuring</code>
            </p>

            <div className="form-group">
              <label>CSV data</label>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={`title,category,price_per_day,deposit,description\nBosch Drill,power_tools,12.00,25,Professional 18V drill\nPressure Washer,cleaning,18.00,50,Kärcher 2000W`}
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
            </div>

            {csvError && <div className="error-msg">{csvError}</div>}
            {csvSuccess > 0 && (
              <div className="success-msg">✓ {csvSuccess} items added successfully!</div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={handleCsvUpload}
                disabled={csvLoading || !csvText.trim()}
                className="btn btn-primary"
              >
                {csvLoading ? 'Uploading...' : 'Upload items'}
              </button>
              {limit && (
                <span style={{ fontSize: '13px', color: '#888', alignSelf: 'center' }}>
                  {items.length} / {limit} items used
                </span>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
