import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { theme } from '../theme'
import { formatTime, formatRecordedAt } from '../utils/time'
import type { HealthActivity, RunEvent, Room } from '../types/database'

interface Props {
  userId: string
  events: RunEvent[]
  currentRoom: Room | null
  onSaved: () => void
}

function distanceLabel(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function suggestEvents(events: RunEvent[], distanceM: number | null): RunEvent[] {
  if (!distanceM) return events.filter(e => e.distance_meters != null).slice(0, 6)
  return [...events]
    .filter(e => e.distance_meters != null)
    .sort((a, b) =>
      Math.abs((a.distance_meters ?? 0) - distanceM) -
      Math.abs((b.distance_meters ?? 0) - distanceM),
    )
    .slice(0, 6)
}

export function WorkoutInbox({ userId, events, currentRoom, onSaved }: Props) {
  const [pending, setPending] = useState<HealthActivity[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(currentRoom?.id ?? null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPending()
    fetchRooms()
  }, [userId])

  async function fetchRooms() {
    const { data: memberRows } = await supabase
      .from('room_members').select('room_id').eq('user_id', userId)
    const ids = (memberRows ?? []).map(r => r.room_id)
    if (ids.length === 0) return
    const { data } = await supabase.from('rooms').select('*').in('id', ids)
    setRooms(data ?? [])
  }

  async function fetchPending() {
    const { data } = await supabase
      .from('health_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('workout_date', { ascending: false })
    setPending(data ?? [])
  }

  const current = pending[idx]
  const suggested = current ? suggestEvents(events, current.distance_meters) : []
  const isTopSuggestion = (id: string) => suggested.some(e => e.id === id)

  // 距離が近い種目を自動選択
  useEffect(() => {
    if (!current) return
    const top = suggestEvents(events, current.distance_meters)[0]
    setSelectedEventId(top?.id ?? events[0]?.id ?? '')
  }, [idx, current?.id])

  async function handleSave() {
    if (!current || !selectedEventId) return
    setSaving(true)

    const timeMs = (current.duration_seconds ?? 0) * 1000
    const recordedAtTime = current.start_time ?? undefined

    const { data: rec, error: recErr } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        room_id: selectedRoomId,
        event_id: selectedEventId,
        time_ms: timeMs,
        recorded_at: current.workout_date,
        recorded_at_time: recordedAtTime ?? null,
        avg_heart_rate: current.avg_heart_rate,
        max_heart_rate: current.max_heart_rate,
      })
      .select('id')
      .single()

    if (!recErr && rec) {
      await supabase
        .from('health_activities')
        .update({ status: 'done', record_id: rec.id })
        .eq('id', current.id)
    }

    setSaving(false)
    advance()
    onSaved()
  }

  async function handleSkip() {
    if (!current) return
    await supabase
      .from('health_activities')
      .update({ status: 'skipped' })
      .eq('id', current.id)
    advance()
  }

  function advance() {
    const next = pending.filter((_, i) => i !== idx)
    setPending(next)
    if (idx >= next.length) setIdx(Math.max(0, next.length - 1))
    if (next.length === 0) setOpen(false)
  }

  if (pending.length === 0) return null

  return (
    <>
      {/* バナー */}
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          border: 'none', borderRadius: 14,
          padding: '14px 18px', marginBottom: 16,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', textAlign: 'left',
          boxShadow: '0 4px 20px rgba(109,40,217,0.35)',
        }}
      >
        <div>
          <div style={{
            color: '#fff', fontSize: 15, fontWeight: 700,
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.02em',
          }}>
            ワークアウトが {pending.length} 件届いています
          </div>
          <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2 }}>
            タップして振り分け → 記録に追加
          </div>
        </div>
        <div style={{ color: '#fff', fontSize: 22, opacity: 0.8 }}>›</div>
      </button>

      {/* 振り分けモーダル */}
      {open && current && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'flex-end', zIndex: 100,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#150830',
              border: `1px solid ${theme.border}`,
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 44px',
              width: '100%',
              maxHeight: '88dvh',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{
                  color: theme.textDim, fontSize: 11,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em',
                }}>
                  {idx + 1} / {pending.length} 件
                </div>
                <div style={{
                  color: theme.text, fontSize: 18, fontWeight: 700,
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}>
                  ワークアウトを振り分け
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none',
                  color: theme.textDim, fontSize: 22, cursor: 'pointer', padding: '4px 8px',
                }}
              >✕</button>
            </div>

            {/* HealthKit データ */}
            <div style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: 16, marginBottom: 20,
            }}>
              <div style={{ color: theme.textDim, fontSize: 12, marginBottom: 10 }}>
                {formatRecordedAt(current.workout_date, current.start_time)}
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {current.distance_meters != null && (
                  <div>
                    <div style={{ color: theme.textDim, fontSize: 11 }}>距離</div>
                    <div style={{
                      color: theme.text, fontSize: 24, fontWeight: 700,
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}>
                      {distanceLabel(current.distance_meters)}
                    </div>
                  </div>
                )}
                {current.duration_seconds != null && (
                  <div>
                    <div style={{ color: theme.textDim, fontSize: 11 }}>タイム</div>
                    <div style={{
                      color: theme.text, fontSize: 24, fontWeight: 700,
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}>
                      {formatTime(current.duration_seconds * 1000)}
                    </div>
                  </div>
                )}
                {current.avg_heart_rate != null && (
                  <div>
                    <div style={{ color: theme.textDim, fontSize: 11 }}>心拍</div>
                    <div style={{
                      color: theme.accentBright, fontSize: 24, fontWeight: 700,
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}>
                      {current.avg_heart_rate}
                      {current.max_heart_rate != null && (
                        <span style={{ fontSize: 14, color: '#F87171' }}>
                          /{current.max_heart_rate}
                        </span>
                      )}
                      <span style={{ fontSize: 13, color: theme.textDim, fontWeight: 400 }}> bpm</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 種目選択 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{
                color: theme.textDim, fontSize: 12, marginBottom: 8,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
              }}>
                種目（距離が近い順）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {suggested.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{
                      background: selectedEventId === ev.id ? theme.accentDeep : theme.surface,
                      border: `1px solid ${selectedEventId === ev.id ? theme.accent : theme.border}`,
                      color: selectedEventId === ev.id ? '#fff' : theme.textMid,
                      borderRadius: 20, padding: '6px 14px',
                      fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    }}
                  >
                    {ev.name}
                    {ev.distance_meters && (
                      <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
                        {ev.distance_meters >= 1000
                          ? `${(ev.distance_meters / 1000).toFixed(1)}km`
                          : `${ev.distance_meters}m`}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* その他の種目 */}
              {events.filter(e => !isTopSuggestion(e.id)).length > 0 && (
                <select
                  value={isTopSuggestion(selectedEventId) ? '' : selectedEventId}
                  onChange={e => { if (e.target.value) setSelectedEventId(e.target.value) }}
                  style={{
                    background: theme.surface,
                    border: `1px solid ${isTopSuggestion(selectedEventId) ? theme.border : theme.accent}`,
                    color: isTopSuggestion(selectedEventId) ? theme.textDim : theme.accentBright,
                    borderRadius: 20, padding: '6px 14px',
                    fontSize: 13, cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    outline: 'none',
                  }}
                >
                  <option value="">その他の種目...</option>
                  {events.filter(e => !isTopSuggestion(e.id)).map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* ルーム選択 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                color: theme.textDim, fontSize: 12, marginBottom: 8,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
              }}>
                記録先
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {([{ id: null, name: 'パーソナル' }, ...rooms] as { id: string | null; name: string }[]).map(r => (
                  <button
                    key={r.id ?? 'personal'}
                    onClick={() => setSelectedRoomId(r.id)}
                    style={{
                      background: selectedRoomId === r.id ? theme.accentDeep : theme.surface,
                      border: `1px solid ${selectedRoomId === r.id ? theme.accent : theme.border}`,
                      color: selectedRoomId === r.id ? '#fff' : theme.textMid,
                      borderRadius: 20, padding: '6px 14px',
                      fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* アクション */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSkip}
                style={{
                  flex: 1, background: 'transparent',
                  border: `1px solid ${theme.border}`,
                  color: theme.textDim, borderRadius: 12,
                  padding: '13px 0', fontSize: 14, cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                }}
              >
                スキップ
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedEventId}
                style={{
                  flex: 2,
                  background: saving || !selectedEventId
                    ? theme.surfaceMid
                    : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
                  border: 'none', borderRadius: 12,
                  color: '#fff', padding: '13px 0',
                  fontSize: 15, fontWeight: 700,
                  cursor: saving || !selectedEventId ? 'not-allowed' : 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  boxShadow: saving || !selectedEventId ? 'none' : '0 4px 20px rgba(109,40,217,0.4)',
                }}
              >
                {saving ? '保存中...' : '記録として保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
