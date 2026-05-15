import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import { formatTime, formatRecordedAt, todayString } from '../utils/time'
import type { RunRecord, RunEvent, Room } from '../types/database'

interface Props {
  currentRoom: Room | null
}

const PAGE_SIZE = 10

function RecordCard({
  record,
  isPB,
  onEdit,
  onDelete,
}: {
  record: RunRecord
  isPB: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${isPB ? theme.borderBright : theme.border}`,
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      position: 'relative',
      overflow: 'visible',
    }}>
      {isPB && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          padding: '3px 10px',
          borderBottomLeftRadius: 10,
          fontSize: 10, color: '#fff', fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          letterSpacing: '0.05em',
        }}>PB</div>
      )}

      <div style={{
        background: theme.surfaceMid,
        border: `1px solid ${theme.border}`,
        borderRadius: 10,
        padding: '8px 12px',
        minWidth: 52,
        textAlign: 'center',
        flexShrink: 0,
      }}>
        <div style={{
          color: theme.accentBright,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 14,
        }}>{record.events?.name ?? '?'}</div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          color: theme.text,
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700, fontSize: 22,
          letterSpacing: '-0.02em',
        }}>{formatTime(record.time_ms)}</div>
        <div style={{ color: theme.textDim, fontSize: 12, marginTop: 2 }}>
          {formatRecordedAt(record.recorded_at, record.recorded_at_time)}
          {record.avg_heart_rate != null && (
            <span style={{ marginLeft: 10, color: theme.textMid }}>
              ♥ {record.avg_heart_rate} avg
              {record.max_heart_rate != null && ` / ${record.max_heart_rate} max`}
            </span>
          )}
        </div>
        {record.comment && (
          <div style={{ color: theme.textMid, fontSize: 12, marginTop: 3 }}>{record.comment}</div>
        )}
      </div>

      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setMenuOpen(v => !v)}
          style={{
            background: 'transparent', border: 'none',
            color: theme.textDim, cursor: 'pointer',
            fontSize: 20, padding: '4px 8px',
            lineHeight: 1,
          }}
        >⋮</button>
        {menuOpen && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 50 }}
              onClick={() => setMenuOpen(false)}
            />
            <div style={{
              position: 'absolute', right: 0, top: 32,
              background: '#1a0840',
              border: `1px solid ${theme.borderBright}`,
              borderRadius: 10, overflow: 'hidden',
              zIndex: 51, minWidth: 100,
            }}>
              <button
                onClick={() => { setMenuOpen(false); onEdit() }}
                style={{
                  display: 'block', width: '100%',
                  background: 'transparent', border: 'none',
                  color: theme.text, padding: '10px 16px',
                  fontSize: 14, cursor: 'pointer', textAlign: 'left',
                }}
              >編集</button>
              <button
                onClick={() => { setMenuOpen(false); onDelete() }}
                style={{
                  display: 'block', width: '100%',
                  background: 'transparent', border: 'none',
                  color: '#F87171', padding: '10px 16px',
                  fontSize: 14, cursor: 'pointer', textAlign: 'left',
                }}
              >削除</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

interface FormState {
  eventId: string
  recordedAt: string
  avgHR: string
  maxHR: string
  comment: string
}

const CUSTOM_SENTINEL = '__custom__'

function CustomEventForm({
  roomId,
  userId,
  onCreated,
  onCancel,
  inputStyle,
  labelStyle,
}: {
  roomId: string | null
  userId: string
  onCreated: (event: RunEvent) => void
  onCancel: () => void
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
}) {
  const [name, setName] = useState('')
  const [distance, setDistance] = useState('')
  const [scope, setScope] = useState<'personal' | 'room'>('personal')
  const [creating, setCreating] = useState(false)
  const [err, setErr] = useState('')

  async function handleCreate() {
    if (!name.trim()) { setErr('種目名を入力してください'); return }
    setCreating(true)
    setErr('')

    const { data, error } = await supabase
      .from('events')
      .insert({
        name: name.trim(),
        distance_meters: distance ? parseInt(distance) : null,
        is_preset: false,
        created_by: userId,
        room_id: scope === 'room' && roomId ? roomId : null,
      })
      .select()
      .single()

    setCreating(false)
    if (error || !data) { setErr(error?.message ?? '作成に失敗しました'); return }
    onCreated(data as RunEvent)
  }

  const chipBase: React.CSSProperties = {
    flex: 1, border: 'none', borderRadius: 8,
    padding: '8px 0', fontSize: 13, cursor: 'pointer',
    fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
    transition: 'background 0.15s',
  }

  return (
    <div style={{
      background: theme.surfaceMid,
      border: `1px solid ${theme.borderBright}`,
      borderRadius: 12, padding: '14px',
      marginTop: 8, marginBottom: 14,
    }}>
      <div style={{ color: theme.accentBright, fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em', marginBottom: 12 }}>
        ＋ カスタム種目を作成
      </div>

      {/* 種目名 */}
      <div style={{ marginBottom: 10 }}>
        <div style={labelStyle}>種目名</div>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="例: My ランニングコース"
          style={inputStyle}
          autoFocus
        />
      </div>

      {/* 距離 */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>距離（m）任意</div>
        <input
          type="number"
          value={distance}
          onChange={e => setDistance(e.target.value)}
          placeholder="例: 1800"
          style={inputStyle}
        />
      </div>

      {/* スコープ */}
      <div style={{ marginBottom: 12 }}>
        <div style={labelStyle}>公開範囲</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setScope('personal')}
            style={{
              ...chipBase,
              background: scope === 'personal' ? theme.surfaceHigh : 'transparent',
              border: `1px solid ${scope === 'personal' ? theme.borderBright : theme.border}`,
              color: scope === 'personal' ? theme.accentBright : theme.textDim,
            }}
          >自分だけ</button>
          <button
            onClick={() => setScope('room')}
            disabled={!roomId}
            style={{
              ...chipBase,
              background: scope === 'room' ? theme.surfaceHigh : 'transparent',
              border: `1px solid ${scope === 'room' ? theme.borderBright : theme.border}`,
              color: !roomId ? theme.textDim : scope === 'room' ? theme.accentBright : theme.textDim,
              opacity: roomId ? 1 : 0.4,
              cursor: roomId ? 'pointer' : 'not-allowed',
            }}
          >ルームで共有</button>
        </div>
        {!roomId && (
          <div style={{ color: theme.textDim, fontSize: 11, marginTop: 4 }}>
            ルームを選択中のときのみ共有できます
          </div>
        )}
      </div>

      {err && <div style={{ color: '#F87171', fontSize: 12, marginBottom: 8 }}>{err}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, background: 'transparent',
            border: `1px solid ${theme.border}`,
            color: theme.textDim, borderRadius: 8,
            padding: '9px 0', fontSize: 13, cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >キャンセル</button>
        <button
          onClick={handleCreate}
          disabled={creating || !name.trim()}
          style={{
            flex: 2,
            background: creating || !name.trim()
              ? theme.surfaceMid
              : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
            border: 'none', borderRadius: 8,
            color: '#fff', padding: '9px 0',
            fontSize: 13, cursor: creating ? 'not-allowed' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
          }}
        >{creating ? '作成中...' : '追加する'}</button>
      </div>
    </div>
  )
}

const WHEEL_ITEM_H = 44
const WHEEL_SIDE = 2

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

  // Place in middle copy; skip if user is actively scrolling
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
        // Silently teleport to middle copy, then no animation needed
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
          background: 'linear-gradient(to bottom, #150830 20%, rgba(21,8,48,0))',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: WHEEL_SIDE * WHEEL_ITEM_H,
          background: 'linear-gradient(to top, #150830 20%, rgba(21,8,48,0))',
          pointerEvents: 'none', zIndex: 2,
        }} />
        <div
          className="wph"
          ref={ref}
          onScroll={handleScroll}
          style={{ height: '100%', overflowY: 'scroll', scrollbarWidth: 'none' } as React.CSSProperties}
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

function RecordModal({
  events: initialEvents,
  initial,
  roomId,
  userId,
  onClose,
  onSaved,
}: {
  events: RunEvent[]
  initial?: RunRecord
  roomId: string | null
  userId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [events, setEvents] = useState<RunEvent[]>(initialEvents)
  const [form, setForm] = useState<FormState>({
    eventId: initial?.event_id ?? initialEvents[0]?.id ?? '',
    recordedAt: initial?.recorded_at ?? todayString(),
    avgHR: initial?.avg_heart_rate?.toString() ?? '',
    maxHR: initial?.max_heart_rate?.toString() ?? '',
    comment: initial?.comment ?? '',
  })
  const [timeHours, setTimeHours] = useState(initial ? Math.floor(initial.time_ms / 3600000) : 0)
  const [timeMinutes, setTimeMinutes] = useState(initial ? Math.floor((initial.time_ms % 3600000) / 60000) : 0)
  const [timeSeconds, setTimeSeconds] = useState(initial ? Math.floor(initial.time_ms / 1000) % 60 : 0)
  const [timeCs, setTimeCs] = useState(initial ? Math.floor((initial.time_ms % 1000) / 10) : 0)
  const [recordHour, setRecordHour] = useState(() => {
    if (initial?.recorded_at_time) return parseInt(initial.recorded_at_time.split(':')[0])
    return new Date().getHours()
  })
  const [recordMin, setRecordMin] = useState(() => {
    if (initial?.recorded_at_time) return parseInt(initial.recorded_at_time.split(':')[1])
    return new Date().getMinutes()
  })
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function handleEventChange(value: string) {
    if (value === CUSTOM_SENTINEL) {
      setShowCustomForm(true)
    } else {
      setShowCustomForm(false)
      set('eventId', value)
    }
  }

  function handleCustomCreated(newEvent: RunEvent) {
    setEvents(prev => [...prev, newEvent])
    set('eventId', newEvent.id)
    setShowCustomForm(false)
  }

  async function handleSave() {
    const ms = timeHours * 3600000 + timeMinutes * 60000 + timeSeconds * 1000 + timeCs * 10
    if (ms <= 0) { setError('タイムを正しく入力してください'); return }
    if (!form.eventId) { setError('種目を選択してください'); return }
    if (!form.recordedAt) { setError('日付を入力してください'); return }

    setSaving(true)
    setError('')

    const recordedAtTime = `${String(recordHour).padStart(2, '0')}:${String(recordMin).padStart(2, '0')}`

    const payload = {
      user_id: userId,
      room_id: roomId,
      event_id: form.eventId,
      time_ms: ms,
      recorded_at: form.recordedAt,
      recorded_at_time: recordedAtTime,
      avg_heart_rate: form.avgHR ? parseInt(form.avgHR) : null,
      max_heart_rate: form.maxHR ? parseInt(form.maxHR) : null,
      comment: form.comment || null,
    }

    let err
    if (initial) {
      ;({ error: err } = await supabase.from('records').update(payload).eq('id', initial.id))
    } else {
      ;({ error: err } = await supabase.from('records').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 15,
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
  }

  const labelStyle: React.CSSProperties = {
    color: theme.textDim,
    fontSize: 12,
    marginBottom: 6,
    fontFamily: "'Barlow Condensed', sans-serif",
    letterSpacing: '0.05em',
  }

  // Display name for currently selected event
  const selectedEvent = events.find(e => e.id === form.eventId)

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#150830',
          border: `1px solid ${theme.border}`,
          borderRadius: '20px 20px 0 0',
          padding: '24px 20px 40px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
        }}>
          <div style={{
            color: theme.text, fontSize: 18, fontWeight: 700,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>
            {initial ? '記録を編集' : '記録を追加'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', color: theme.textDim,
              fontSize: 22, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
            }}
          >✕</button>
        </div>

        {/* Event */}
        <div style={{ marginBottom: showCustomForm ? 0 : 14 }}>
          <div style={labelStyle}>種目</div>
          <select
            value={showCustomForm ? CUSTOM_SENTINEL : form.eventId}
            onChange={e => handleEventChange(e.target.value)}
            style={{ ...inputStyle, appearance: 'none' }}
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>
                {ev.name}{ev.is_preset ? '' : ' ★'}
              </option>
            ))}
            <option value={CUSTOM_SENTINEL}>＋ カスタム種目を追加...</option>
          </select>
          {selectedEvent && !selectedEvent.is_preset && !showCustomForm && (
            <div style={{ color: theme.textDim, fontSize: 11, marginTop: 4 }}>
              ★ カスタム種目
              {selectedEvent.distance_meters ? `  ${selectedEvent.distance_meters}m` : ''}
            </div>
          )}
        </div>

        {/* Inline custom event form */}
        {showCustomForm && (
          <CustomEventForm
            roomId={roomId}
            userId={userId}
            onCreated={handleCustomCreated}
            onCancel={() => {
              setShowCustomForm(false)
              if (!form.eventId) set('eventId', events[0]?.id ?? '')
            }}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />
        )}

        {/* Time */}
        <div style={{ marginBottom: 14 }}>
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

        {/* Date + Time */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>日時</div>
          <input
            type="date"
            value={form.recordedAt}
            onChange={e => set('recordedAt', e.target.value)}
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WheelPicker value={recordHour} onChange={setRecordHour} count={24} label="時（h）" />
            <div style={{ color: theme.textDim, fontSize: 20, fontWeight: 700, flexShrink: 0, paddingTop: 18, lineHeight: 1 }}>:</div>
            <WheelPicker value={recordMin} onChange={setRecordMin} count={60} label="分（min）" />
          </div>
        </div>

        {/* Heart rate row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>平均心拍（任意）</div>
            <input
              type="number"
              value={form.avgHR}
              onChange={e => set('avgHR', e.target.value)}
              placeholder="例: 168"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>最高心拍（任意）</div>
            <input
              type="number"
              value={form.maxHR}
              onChange={e => set('maxHR', e.target.value)}
              placeholder="例: 195"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Comment */}
        <div style={{ marginBottom: 20 }}>
          <div style={labelStyle}>コメント（任意）</div>
          <input
            type="text"
            value={form.comment}
            onChange={e => set('comment', e.target.value)}
            placeholder="天気や体調など"
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{
            color: '#F87171', fontSize: 13, marginBottom: 12,
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: 8, padding: '8px 12px',
          }}>{error}</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            background: saving
              ? theme.surfaceMid
              : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
            border: 'none', borderRadius: 12,
            color: '#fff', padding: '14px 0',
            fontSize: 16, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
            boxShadow: saving ? 'none' : '0 4px 20px rgba(109, 40, 217, 0.4)',
          }}
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

export function TimeAttackTab({ currentRoom }: Props) {
  const { user } = useAuth()
  const [records, setRecords] = useState<RunRecord[]>([])
  const [events, setEvents] = useState<RunEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'time' | 'best'>('time')
  const [showAdd, setShowAdd] = useState(false)
  const [editRecord, setEditRecord] = useState<RunRecord | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!user) return

    const [eventsRes, usageRes] = await Promise.all([
      supabase
        .from('events')
        .select('*')
        .or(
          currentRoom
            ? `is_preset.eq.true,room_id.eq.${currentRoom.id}`
            : `is_preset.eq.true,created_by.eq.${user.id}`
        ),
      supabase
        .from('records')
        .select('event_id, recorded_at')
        .eq('user_id', user.id),
    ])

    const usageMap: Record<string, { count: number; lastUsed: string }> = {}
    for (const r of usageRes.data ?? []) {
      const curr = usageMap[r.event_id]
      if (!curr) {
        usageMap[r.event_id] = { count: 1, lastUsed: r.recorded_at }
      } else {
        curr.count++
        if (r.recorded_at > curr.lastUsed) curr.lastUsed = r.recorded_at
      }
    }

    const sorted = (eventsRes.data ?? []).sort((a, b) => {
      const ua = usageMap[a.id] ?? { count: 0, lastUsed: '' }
      const ub = usageMap[b.id] ?? { count: 0, lastUsed: '' }
      if (ub.count !== ua.count) return ub.count - ua.count
      if (ua.lastUsed !== ub.lastUsed) return ub.lastUsed > ua.lastUsed ? 1 : -1
      return (a.distance_meters ?? 99999) - (b.distance_meters ?? 99999)
    })

    setEvents(sorted)
  }, [currentRoom, user])

  const fetchRecords = useCallback(async (reset = false) => {
    if (!user) return
    setLoading(true)
    const currentPage = reset ? 0 : page
    if (reset) setPage(0)

    let query = supabase
      .from('records')
      .select('*, events(id, name, distance_meters)')

    if (currentRoom) {
      query = query.eq('room_id', currentRoom.id)
    } else {
      query = query.eq('user_id', user.id).is('room_id', null)
    }

    if (selectedEventId !== 'all') {
      query = query.eq('event_id', selectedEventId)
    }

    if (sortBy === 'best') {
      query = query.order('time_ms', { ascending: true })
    } else {
      query = query.order('recorded_at', { ascending: false })
    }

    const { data } = await query.range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
    const fetched = data ?? []

    if (reset) {
      setRecords(fetched.slice(0, PAGE_SIZE))
    } else {
      setRecords(prev => [...prev, ...fetched.slice(0, PAGE_SIZE)])
    }
    setHasMore(fetched.length > PAGE_SIZE)
    setLoading(false)
  }, [user, currentRoom, selectedEventId, sortBy, page])

  useEffect(() => { fetchEvents() }, [fetchEvents])
  useEffect(() => { fetchRecords(true) }, [selectedEventId, sortBy, currentRoom])

  async function handleDelete(id: string) {
    if (!confirm('この記録を削除しますか？')) return
    await supabase.from('records').delete().eq('id', id)
    fetchRecords(true)
  }

  // PB detection: best time per event for current user
  const pbMap: Record<string, number> = {}
  records.forEach(r => {
    const key = r.event_id
    if (r.user_id === user?.id) {
      if (pbMap[key] === undefined || r.time_ms < pbMap[key]) pbMap[key] = r.time_ms
    }
  })

  const eventOptions = [{ id: 'all', name: 'すべて' }, ...events]

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0 16px' }}>
        <div>
          <div style={{
            color: theme.textDim, fontSize: 12,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em',
          }}>
            {currentRoom?.name ?? 'パーソナル'}
          </div>
          <div style={{
            color: theme.text, fontSize: 22, fontWeight: 700,
            fontFamily: "'Barlow Condensed', sans-serif",
          }}>ラン記録</div>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
            border: 'none', borderRadius: 12,
            color: '#fff', fontSize: 14, padding: '10px 16px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(109, 40, 217, 0.4)',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}
        >記録を追加</button>
      </div>

      {/* Sort toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {(['time', 'best'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            background: sortBy === s ? theme.surfaceHigh : theme.surface,
            border: `1px solid ${sortBy === s ? theme.borderBright : theme.border}`,
            color: sortBy === s ? theme.accentBright : theme.textDim,
            borderRadius: 8, padding: '6px 14px',
            fontSize: 13, cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}>
            {s === 'time' ? '時系列' : 'ベスト順'}
          </button>
        ))}
      </div>

      {/* Event filter chips */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12, marginBottom: 4 }}>
        {eventOptions.map(ev => (
          <button key={ev.id} onClick={() => setSelectedEventId(ev.id)} style={{
            background: selectedEventId === ev.id ? theme.accentDeep : theme.surface,
            border: `1px solid ${selectedEventId === ev.id ? theme.accent : theme.border}`,
            color: selectedEventId === ev.id ? '#fff' : theme.textMid,
            borderRadius: 20, padding: '5px 14px',
            fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}>{ev.name}</button>
        ))}
      </div>

      {/* Records */}
      {loading && records.length === 0 ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '40px 0' }}>読み込み中...</div>
      ) : records.length === 0 ? (
        <div style={{
          color: theme.textDim, textAlign: 'center', padding: '60px 0',
          fontSize: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏃</div>
          まだ記録がありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
          {records.map(r => (
            <RecordCard
              key={r.id}
              record={r}
              isPB={r.user_id === user?.id && pbMap[r.event_id] === r.time_ms && sortBy === 'best'}
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

      {/* Add/Edit modal */}
      {(showAdd || editRecord) && (
        <RecordModal
          events={events}
          initial={editRecord ?? undefined}
          roomId={currentRoom?.id ?? null}
          userId={user?.id ?? ''}
          onClose={() => { setShowAdd(false); setEditRecord(null) }}
          onSaved={() => { setShowAdd(false); setEditRecord(null); fetchRecords(true) }}
        />
      )}
    </div>
  )
}
