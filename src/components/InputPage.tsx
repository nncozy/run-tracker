import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import { formatTime } from '../utils/time'

// ── Local types ──────────────────────────────────────────────────────────────

interface UserDistance {
  id: string
  name: string
  distance_km: number
  usage_count: number
  last_used_at: string
}

interface InputRecord {
  id: string
  user_id: string
  distance_id: string | null
  time_ms: number
  run_date: string
  custom_fields: { weather?: string; memo?: string }
  created_at: string
  user_distances?: UserDistance | null
}

// ── Constants ────────────────────────────────────────────────────────────────

const WEATHER_OPTIONS = ['☀️ 晴れ', '🌤 晴れ時々曇り', '☁️ 曇り', '🌧 雨', '🌬 風強め']
const PAGE_SIZE = 10

// ── WheelPicker ──────────────────────────────────────────────────────────────

const WHEEL_ITEM_H = 44
const WHEEL_SIDE = 1

function WheelPicker({
  value,
  onChange,
  count,
  label,
}: {
  value: number
  onChange: (v: number) => void
  count: number
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [displayVal, setDisplayVal] = useState(value)
  const isScrollingUser = useRef(false)
  const snapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const silentJump = useRef(false)

  useEffect(() => {
    if (!ref.current || isScrollingUser.current) return
    ref.current.scrollTop = (value + count) * WHEEL_ITEM_H
    setDisplayVal(value)
  }, [value, count])

  function handleScroll() {
    if (silentJump.current || !ref.current) return
    isScrollingUser.current = true

    const liveRaw = Math.round(ref.current.scrollTop / WHEEL_ITEM_H)
    setDisplayVal(((liveRaw % count) + count) % count)

    clearTimeout(snapTimer.current)
    snapTimer.current = setTimeout(() => {
      if (!ref.current) return
      const rawIdx = Math.round(ref.current.scrollTop / WHEEL_ITEM_H)
      const val = ((rawIdx % count) + count) % count
      const canonicalTop = (val + count) * WHEEL_ITEM_H

      if (rawIdx < count || rawIdx >= 2 * count) {
        silentJump.current = true
        ref.current.scrollTop = canonicalTop
        silentJump.current = false
      } else {
        ref.current.scrollTo({ top: canonicalTop, behavior: 'smooth' })
      }

      onChange(val)
      setDisplayVal(val)
      setTimeout(() => { isScrollingUser.current = false }, 200)
    }, 80)
  }

  const totalH = (WHEEL_SIDE * 2 + 1) * WHEEL_ITEM_H

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`.wph::-webkit-scrollbar{display:none}`}</style>
      <div style={{
        color: theme.textDim, fontSize: 11,
        fontFamily: "'Barlow Condensed', sans-serif",
        letterSpacing: '0.05em', marginBottom: 4,
      }}>{label}</div>
      <div style={{ position: 'relative', height: totalH, width: '100%' }}>
        <div style={{
          position: 'absolute',
          top: WHEEL_SIDE * WHEEL_ITEM_H, left: 4, right: 4,
          height: WHEEL_ITEM_H,
          background: 'rgba(139,92,246,0.15)',
          border: `1px solid ${theme.borderBright}`,
          borderRadius: 10,
          pointerEvents: 'none', zIndex: 1,
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: WHEEL_SIDE * WHEEL_ITEM_H,
          background: 'linear-gradient(to bottom, #fff 20%, rgba(255,255,255,0))',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: WHEEL_SIDE * WHEEL_ITEM_H,
          background: 'linear-gradient(to top, #fff 20%, rgba(255,255,255,0))',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div
          className="wph"
          ref={ref}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'scroll', scrollbarWidth: 'none', overscrollBehavior: 'contain', touchAction: 'pan-y' } as React.CSSProperties}
        >
          {Array.from({ length: WHEEL_SIDE }, (_, i) => (
            <div key={`t${i}`} style={{ height: WHEEL_ITEM_H }} />
          ))}
          {[0, 1, 2].flatMap(copy =>
            Array.from({ length: count }, (_, i) => {
              const sel = i === displayVal
              return (
                <div
                  key={`${copy}-${i}`}
                  style={{
                    height: WHEEL_ITEM_H,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: sel ? theme.accentBright : theme.textDim,
                    fontSize: sel ? 28 : 20,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: sel ? 700 : 400,
                    userSelect: 'none',
                  } as React.CSSProperties}
                >
                  {String(i).padStart(2, '0')}
                </div>
              )
            })
          )}
          {Array.from({ length: WHEEL_SIDE }, (_, i) => (
            <div key={`b${i}`} style={{ height: WHEEL_ITEM_H }} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── RecordCard ───────────────────────────────────────────────────────────────

function RecordCard({
  record,
  isPB,
  onEdit,
  onDelete,
}: {
  record: InputRecord
  isPB: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const dist = record.user_distances
  const weather = record.custom_fields?.weather
  const memo = record.custom_fields?.memo
  const d = new Date(record.run_date)
  const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${isPB ? theme.borderBright : theme.border}`,
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      position: 'relative', overflow: 'visible',
    }}>
      {isPB && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: `linear-gradient(135deg, ${theme.emphasis}, #F59E0B)`,
          padding: '3px 10px', borderBottomLeftRadius: 10,
          fontSize: 10, color: '#fff', fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
        }}>PB</div>
      )}

      {/* Distance badge */}
      <div style={{
        background: theme.surfaceMid, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: '8px 10px',
        minWidth: 60, textAlign: 'center', flexShrink: 0,
      }}>
        <div style={{
          color: theme.accentBright, fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 13, lineHeight: 1.2,
        }}>{dist?.name ?? '—'}</div>
        {dist && (
          <div style={{ color: theme.textDim, fontSize: 11 }}>{dist.distance_km}km</div>
        )}
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: theme.text, fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em',
        }}>{formatTime(record.time_ms)}</div>
        <div style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}>
          {dateStr}
          {weather && <span style={{ marginLeft: 8 }}>{weather}</span>}
        </div>
        {memo && (
          <div style={{ color: theme.textMid, fontSize: 12, marginTop: 2 }}>{memo}</div>
        )}
      </div>

      {/* Menu */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'transparent', border: 'none',
            color: theme.textDim, cursor: 'pointer',
            fontSize: 20, padding: '4px 8px', lineHeight: 1,
          }}
        >⋮</button>
        {menuOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50 }} onClick={() => setMenuOpen(false)} />
            <div style={{
              position: 'absolute', right: 0, top: 32,
              background: theme.dropdown, border: `1px solid ${theme.borderBright}`,
              borderRadius: 10, overflow: 'hidden', zIndex: 51, minWidth: 100,
            }}>
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', color: theme.text, padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >編集</button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{ display: 'block', width: '100%', background: 'transparent', border: 'none', color: '#F87171', padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}
              >削除</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── RecordModal ──────────────────────────────────────────────────────────────

function RecordModal({
  distances: initialDistances,
  initial,
  userId,
  onClose,
  onSaved,
}: {
  distances: UserDistance[]
  initial?: InputRecord
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [distances, setDistances] = useState<UserDistance[]>(initialDistances)
  const [distanceId, setDistanceId] = useState<string>(initial?.distance_id ?? initialDistances[0]?.id ?? '')
  const [timeHours, setTimeHours] = useState(initial ? Math.floor(initial.time_ms / 3600000) : 0)
  const [timeMinutes, setTimeMinutes] = useState(initial ? Math.floor((initial.time_ms % 3600000) / 60000) : 0)
  const [timeSeconds, setTimeSeconds] = useState(initial ? Math.floor((initial.time_ms % 60000) / 1000) : 0)
  const [timeCs, setTimeCs] = useState(initial ? Math.floor((initial.time_ms % 1000) / 10) : 0)
  const [dateStr, setDateStr] = useState(() => {
    if (initial) {
      const d = new Date(initial.run_date)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    return new Date().toISOString().split('T')[0]
  })
  const [hour, setHour] = useState(() => initial ? new Date(initial.run_date).getHours() : new Date().getHours())
  const [minute, setMinute] = useState(() => initial ? new Date(initial.run_date).getMinutes() : new Date().getMinutes())
  const [weather, setWeather] = useState(initial?.custom_fields?.weather ?? '')
  const [memo, setMemo] = useState(initial?.custom_fields?.memo ?? '')

  // Add distance inline form
  const [showAddDist, setShowAddDist] = useState(false)
  const [newDistName, setNewDistName] = useState('')
  const [newDistKm, setNewDistKm] = useState('')
  const [addingDist, setAddingDist] = useState(false)
  const [addDistErr, setAddDistErr] = useState('')

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: theme.surface, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 10, padding: '10px 12px',
    fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    color: theme.textDim, fontSize: 12, marginBottom: 6,
    fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
  }

  async function handleAddDistance() {
    if (!newDistName.trim()) { setAddDistErr('コース名を入力してください'); return }
    if (!newDistKm || isNaN(parseFloat(newDistKm))) { setAddDistErr('距離を入力してください'); return }
    setAddingDist(true)
    setAddDistErr('')
    const { data, error: err } = await supabase
      .from('user_distances')
      .insert({ user_id: userId, name: newDistName.trim(), distance_km: parseFloat(newDistKm) })
      .select()
      .single()
    setAddingDist(false)
    if (err || !data) { setAddDistErr(err?.message ?? '作成に失敗しました'); return }
    const created = data as UserDistance
    setDistances(prev => [...prev, created])
    setDistanceId(created.id)
    setShowAddDist(false)
    setNewDistName('')
    setNewDistKm('')
  }

  async function handleSave() {
    const ms = timeHours * 3600000 + timeMinutes * 60000 + timeSeconds * 1000 + timeCs * 10
    if (ms <= 0) { setError('タイムを入力してください'); return }
    if (!dateStr) { setError('日付を入力してください'); return }

    setSaving(true)
    setError('')

    const run_date = `${dateStr}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
    const custom_fields: Record<string, string> = {}
    if (weather) custom_fields.weather = weather
    if (memo.trim()) custom_fields.memo = memo.trim()

    const payload = {
      user_id: userId,
      distance_id: distanceId || null,
      time_ms: ms,
      run_date,
      custom_fields,
    }

    let err
    if (initial) {
      ;({ error: err } = await supabase.from('records').update(payload).eq('id', initial.id))
    } else {
      ;({ error: err } = await supabase.from('records').insert(payload))
    }

    // Update usage stats on the selected distance
    if (!err && distanceId) {
      const dist = distances.find(d => d.id === distanceId)
      await supabase.from('user_distances').update({
        usage_count: (dist?.usage_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      }).eq('id', distanceId)
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: theme.overlay, display: 'flex', alignItems: 'flex-end', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.modal, border: `1px solid ${theme.border}`,
          borderRadius: '20px 20px 0 0', padding: '24px 20px 40px',
          width: '100%', maxHeight: '92dvh', overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ color: theme.text, fontSize: 18, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
            {initial ? '記録を編集' : '記録を追加'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: theme.textDim, fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1 }}
          >✕</button>
        </div>

        {/* ── コース選択 ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>コース</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {distances.map(d => (
              <button
                key={d.id}
                onClick={() => { setDistanceId(d.id); setShowAddDist(false) }}
                style={{
                  border: `1px solid ${distanceId === d.id ? theme.accent : theme.border}`,
                  background: distanceId === d.id ? theme.accentDeep : theme.surface,
                  color: distanceId === d.id ? '#fff' : theme.textMid,
                  borderRadius: 20, padding: '6px 14px',
                  fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap',
                  fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                  transition: 'all 0.15s',
                }}
              >
                {d.name}
                <span style={{ opacity: 0.7, fontSize: 11, marginLeft: 4 }}>{d.distance_km}km</span>
              </button>
            ))}
            <button
              onClick={() => { setShowAddDist(v => !v) }}
              style={{
                border: `1px solid ${showAddDist ? theme.accent : theme.border}`,
                background: showAddDist ? 'rgba(109,40,217,0.2)' : 'transparent',
                color: showAddDist ? theme.accentBright : theme.textDim,
                borderRadius: 20, padding: '6px 14px',
                fontSize: 13, cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              }}
            >＋ 追加</button>
          </div>

          {/* Inline add distance form */}
          {showAddDist && (
            <div style={{
              background: theme.surfaceMid, border: `1px solid ${theme.borderBright}`,
              borderRadius: 12, padding: 14, marginTop: 10,
            }}>
              <div style={{ color: theme.accentBright, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', marginBottom: 10 }}>
                新しいコースを追加
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 2 }}>
                  <div style={labelStyle}>コース名</div>
                  <input
                    type="text"
                    value={newDistName}
                    onChange={e => setNewDistName(e.target.value)}
                    placeholder="例: 公園1周"
                    style={inputStyle}
                    autoFocus
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={labelStyle}>距離 (km)</div>
                  <input
                    type="number"
                    step="0.01"
                    value={newDistKm}
                    onChange={e => setNewDistKm(e.target.value)}
                    placeholder="3.00"
                    style={inputStyle}
                  />
                </div>
              </div>
              {addDistErr && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{addDistErr}</div>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setShowAddDist(false); setNewDistName(''); setNewDistKm(''); setAddDistErr('') }}
                  style={{ flex: 1, background: 'transparent', border: `1px solid ${theme.border}`, color: theme.textDim, borderRadius: 8, padding: '8px 0', fontSize: 13, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif" }}
                >キャンセル</button>
                <button
                  onClick={handleAddDistance}
                  disabled={addingDist}
                  style={{
                    flex: 2,
                    background: addingDist ? theme.surfaceMid : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
                    border: 'none', borderRadius: 8, color: '#fff',
                    padding: '8px 0', fontSize: 13, cursor: addingDist ? 'not-allowed' : 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                  }}
                >{addingDist ? '追加中...' : '追加する'}</button>
              </div>
            </div>
          )}
        </div>

        {/* ── タイム ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>タイム</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WheelPicker value={timeHours} onChange={setTimeHours} count={24} label="時間（h）" />
            <div style={{ color: theme.textDim, fontSize: 20, fontWeight: 700, flexShrink: 0, paddingTop: 18, lineHeight: 1 }}>:</div>
            <WheelPicker value={timeMinutes} onChange={setTimeMinutes} count={60} label="分（min）" />
            <div style={{ color: theme.textDim, fontSize: 20, fontWeight: 700, flexShrink: 0, paddingTop: 18, lineHeight: 1 }}>:</div>
            <WheelPicker value={timeSeconds} onChange={setTimeSeconds} count={60} label="秒（s）" />
            <div style={{ color: theme.textDim, fontSize: 20, fontWeight: 700, flexShrink: 0, paddingTop: 18, lineHeight: 1 }}>.</div>
            <WheelPicker value={timeCs} onChange={setTimeCs} count={100} label="cs" />
          </div>
        </div>

        {/* ── 日時 ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>日時</div>
          <input
            type="date"
            value={dateStr}
            onChange={e => setDateStr(e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WheelPicker value={hour} onChange={setHour} count={24} label="時（h）" />
            <div style={{ color: theme.textDim, fontSize: 20, fontWeight: 700, flexShrink: 0, paddingTop: 18, lineHeight: 1 }}>:</div>
            <WheelPicker value={minute} onChange={setMinute} count={60} label="分（min）" />
          </div>
        </div>

        {/* ── 天気 ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>天気（任意）</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEATHER_OPTIONS.map(w => (
              <button
                key={w}
                onClick={() => setWeather(prev => prev === w ? '' : w)}
                style={{
                  border: `1px solid ${weather === w ? theme.accent : theme.border}`,
                  background: weather === w ? theme.accentDeep : theme.surface,
                  color: weather === w ? '#fff' : theme.textMid,
                  borderRadius: 20, padding: '5px 12px',
                  fontSize: 13, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'all 0.15s',
                }}
              >{w}</button>
            ))}
          </div>
        </div>

        {/* ── メモ ── */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>メモ（任意）</div>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="体調、ペース感、一言など"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            color: '#F87171', fontSize: 13, marginBottom: 12,
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '8px 12px',
          }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: saving ? theme.surfaceMid : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
            border: 'none', borderRadius: 12, color: '#fff', padding: '14px 0',
            fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            boxShadow: saving ? 'none' : '0 4px 20px rgba(109, 40, 217, 0.4)',
          }}
        >{saving ? '保存中...' : '保存する'}</button>
      </div>
    </div>
  )
}

// ── InputPage ────────────────────────────────────────────────────────────────

export function InputPage() {
  const { user } = useAuth()
  const [distances, setDistances] = useState<UserDistance[]>([])
  const [records, setRecords] = useState<InputRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedDistId, setSelectedDistId] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'time' | 'best'>('time')
  const [showAdd, setShowAdd] = useState(false)
  const [editRecord, setEditRecord] = useState<InputRecord | null>(null)

  const fetchDistances = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('user_distances')
      .select('*')
      .eq('user_id', user.id)
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })
    setDistances(data ?? [])
  }, [user])

  const fetchRecords = useCallback(async (reset = false) => {
    if (!user) return
    setLoading(true)
    const currentPage = reset ? 0 : page
    if (reset) setPage(0)

    let query = supabase
      .from('records')
      .select('*, user_distances(id, name, distance_km)')
      .eq('user_id', user.id)

    if (selectedDistId !== 'all') {
      query = query.eq('distance_id', selectedDistId)
    }

    query = sortBy === 'best'
      ? query.order('time_ms', { ascending: true })
      : query.order('run_date', { ascending: false })

    const { data } = await query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    const fetched = (data ?? []) as InputRecord[]

    if (reset) {
      setRecords(fetched.slice(0, PAGE_SIZE))
    } else {
      setRecords(prev => [...prev, ...fetched.slice(0, PAGE_SIZE)])
    }
    setHasMore(fetched.length > PAGE_SIZE)
    setLoading(false)
  }, [user, selectedDistId, sortBy, page])

  useEffect(() => { fetchDistances() }, [fetchDistances])
  useEffect(() => { fetchRecords(true) }, [selectedDistId, sortBy])

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    await supabase.from('records').delete().eq('id', id)
    fetchRecords(true)
  }

  // PB: best time per distance
  const pbMap: Record<string, number> = {}
  records.forEach(r => {
    if (!r.distance_id) return
    if (pbMap[r.distance_id] === undefined || r.time_ms < pbMap[r.distance_id]) {
      pbMap[r.distance_id] = r.time_ms
    }
  })

  function handleSaved() {
    setShowAdd(false)
    setEditRecord(null)
    fetchDistances()
    fetchRecords(true)
  }

  const distanceOptions = [{ id: 'all', name: 'すべて', distance_km: 0, usage_count: 0, last_used_at: '' }, ...distances]

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 16px' }}>
        <div>
          <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
            パーソナル
          </div>
          <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
            ラン記録
          </div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
            border: 'none', borderRadius: 12, color: '#fff',
            fontSize: 14, padding: '10px 16px', cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(109, 40, 217, 0.4)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}
        >記録を追加</button>
      </div>

      {/* Sort toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['time', 'best'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            style={{
              background: sortBy === s ? theme.surfaceHigh : theme.surface,
              border: `1px solid ${sortBy === s ? theme.borderBright : theme.border}`,
              color: sortBy === s ? theme.accentBright : theme.textDim,
              borderRadius: 8, padding: '6px 14px',
              fontSize: 13, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            }}
          >{s === 'time' ? '時系列' : 'ベスト順'}</button>
        ))}
      </div>

      {/* Distance filter chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 4 }}>
        {distanceOptions.map(d => (
          <button
            key={d.id}
            onClick={() => setSelectedDistId(d.id)}
            style={{
              background: selectedDistId === d.id ? theme.accentDeep : theme.surface,
              border: `1px solid ${selectedDistId === d.id ? theme.accent : theme.border}`,
              color: selectedDistId === d.id ? '#fff' : theme.textMid,
              borderRadius: 20, padding: '5px 14px',
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            }}
          >
            {d.name}
            {d.id !== 'all' && (
              <span style={{ opacity: 0.7, fontSize: 11, marginLeft: 4 }}>{d.distance_km}km</span>
            )}
          </button>
        ))}
      </div>

      {/* Records list */}
      {loading && records.length === 0 ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '40px 0' }}>読み込み中...</div>
      ) : records.length === 0 ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '60px 0', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏃</div>
          まだ記録がありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {records.map(r => (
            <RecordCard
              key={r.id}
              record={r}
              isPB={!!r.distance_id && pbMap[r.distance_id] === r.time_ms && sortBy === 'best'}
              onEdit={() => setEditRecord(r)}
              onDelete={() => handleDelete(r.id)}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => { setPage(p => p + 1); fetchRecords() }}
          style={{
            width: '100%', marginTop: 16,
            background: theme.surface, border: `1px solid ${theme.border}`,
            color: theme.textMid, borderRadius: 12, padding: '12px 0',
            fontSize: 14, cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}
        >もっと見る</button>
      )}

      {/* Add / Edit modal */}
      {(showAdd || editRecord) && (
        <RecordModal
          distances={distances}
          initial={editRecord ?? undefined}
          userId={user?.id ?? ''}
          onClose={() => { setShowAdd(false); setEditRecord(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
