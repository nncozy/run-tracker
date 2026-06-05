import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { theme } from '../theme'
import { formatTime, formatRecordedAt } from '../utils/time'
import type { HealthActivity, UserDistance } from '../types/database'

interface Props {
  userId: string
  distances: UserDistance[]
  onSaved: () => void
}

function distanceLabel(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`
}

function suggestDistances(distances: UserDistance[], distanceM: number | null): UserDistance[] {
  if (!distanceM) return distances.slice(0, 6)
  return [...distances]
    .sort((a, b) =>
      Math.abs(a.distance_km * 1000 - distanceM) -
      Math.abs(b.distance_km * 1000 - distanceM),
    )
    .slice(0, 6)
}

export function WorkoutInbox({ userId, distances, onSaved }: Props) {
  const [pending, setPending] = useState<HealthActivity[]>([])
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [selectedDistanceId, setSelectedDistanceId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPending()
  }, [userId])

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
  const suggested = current ? suggestDistances(distances, current.distance_meters) : []
  const isTopSuggestion = (id: string) => suggested.some(d => d.id === id)

  // 距離が近いコースを自動選択
  useEffect(() => {
    if (!current) return
    const top = suggestDistances(distances, current.distance_meters)[0]
    setSelectedDistanceId(top?.id ?? distances[0]?.id ?? '')
  }, [idx, current?.id])

  async function handleSave() {
    if (!current) return
    setSaving(true)

    const time_ms = (current.duration_seconds ?? 0) * 1000
    const custom_fields: Record<string, unknown> = {}
    if (current.avg_heart_rate != null) custom_fields.avg_heart_rate = current.avg_heart_rate
    if (current.max_heart_rate != null) custom_fields.max_heart_rate = current.max_heart_rate

    const { data: rec, error: recErr } = await supabase
      .from('records')
      .insert({
        user_id: userId,
        distance_id: selectedDistanceId || null,
        time_ms,
        run_date: current.workout_date,
        custom_fields,
      })
      .select('id')
      .single()

    if (!recErr && rec) {
      await supabase
        .from('health_activities')
        .update({ status: 'done', record_id: rec.id })
        .eq('id', current.id)

      // Update usage stats on selected distance
      if (selectedDistanceId) {
        const dist = distances.find(d => d.id === selectedDistanceId)
        await supabase.from('user_distances').update({
          usage_count: (dist?.usage_count ?? 0) + 1,
          last_used_at: new Date().toISOString(),
        }).eq('id', selectedDistanceId)
      }
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

            {/* コース選択 */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                color: theme.textDim, fontSize: 12, marginBottom: 8,
                fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
              }}>
                コース（距離が近い順）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {suggested.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDistanceId(d.id)}
                    style={{
                      background: selectedDistanceId === d.id ? theme.accentDeep : theme.surface,
                      border: `1px solid ${selectedDistanceId === d.id ? theme.accent : theme.border}`,
                      color: selectedDistanceId === d.id ? '#fff' : theme.textMid,
                      borderRadius: 20, padding: '6px 14px',
                      fontSize: 13, cursor: 'pointer',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    }}
                  >
                    {d.name}
                    <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
                      {d.distance_km}km
                    </span>
                  </button>
                ))}
              </div>
              {/* その他のコース */}
              {distances.filter(d => !isTopSuggestion(d.id)).length > 0 && (
                <select
                  value={isTopSuggestion(selectedDistanceId) ? '' : selectedDistanceId}
                  onChange={e => { if (e.target.value) setSelectedDistanceId(e.target.value) }}
                  style={{
                    background: theme.surface,
                    border: `1px solid ${isTopSuggestion(selectedDistanceId) ? theme.border : theme.accent}`,
                    color: isTopSuggestion(selectedDistanceId) ? theme.textDim : theme.accentBright,
                    borderRadius: 20, padding: '6px 14px',
                    fontSize: 13, cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    outline: 'none',
                  }}
                >
                  <option value="">その他のコース...</option>
                  {distances.filter(d => !isTopSuggestion(d.id)).map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.distance_km}km)</option>
                  ))}
                </select>
              )}
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
                disabled={saving || !selectedDistanceId}
                style={{
                  flex: 2,
                  background: saving || !selectedDistanceId
                    ? theme.surfaceMid
                    : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
                  border: 'none', borderRadius: 12,
                  color: '#fff', padding: '13px 0',
                  fontSize: 15, fontWeight: 700,
                  cursor: saving || !selectedDistanceId ? 'not-allowed' : 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  boxShadow: saving || !selectedDistanceId ? 'none' : '0 4px 20px rgba(109,40,217,0.4)',
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
