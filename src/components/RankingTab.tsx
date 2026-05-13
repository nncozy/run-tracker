import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme, memberColorPalette } from '../theme'
import { formatTime } from '../utils/time'
import type { Room, RunEvent, RunRecord, RoomMember } from '../types/database'

interface Props {
  currentRoom: Room | null
}

function Avatar({ letter, size = 32 }: { letter: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.4,
      fontFamily: "'Barlow Condensed', sans-serif",
      flexShrink: 0,
    }}>{letter}</div>
  )
}

export function RankingTab({ currentRoom }: Props) {
  const { user } = useAuth()
  const [events, setEvents] = useState<RunEvent[]>([])
  const [members, setMembers] = useState<RoomMember[]>([])
  const [records, setRecords] = useState<RunRecord[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [sortBy, setSortBy] = useState<'time' | 'best'>('best')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentRoom && !user) return
    setLoading(true)

    if (currentRoom) {
      // Fetch room members with profiles
      const { data: membersData } = await supabase
        .from('room_members')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('room_id', currentRoom.id)
      setMembers(membersData ?? [])

      // Fetch events available in this room
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .or(`is_preset.eq.true,room_id.eq.${currentRoom.id}`)
        .order('distance_meters', { ascending: true })
      const evs = eventsData ?? []
      setEvents(evs)
      if (evs.length > 0 && !selectedEventId) setSelectedEventId(evs[2]?.id ?? evs[0].id)
    } else {
      // Solo mode: just the current user
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        setMembers([{
          room_id: '',
          user_id: user.id,
          role: 'member',
          joined_at: '',
          profiles: profileData ?? undefined,
        }])
        const { data: eventsData } = await supabase
          .from('events')
          .select('*')
          .eq('is_preset', true)
          .order('distance_meters', { ascending: true })
        const evs = eventsData ?? []
        setEvents(evs)
        if (evs.length > 0 && !selectedEventId) setSelectedEventId(evs[2]?.id ?? evs[0].id)
      }
    }
    setLoading(false)
  }, [currentRoom, user])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!selectedEventId) return

    async function fetchRecords() {
      let query = supabase
        .from('records')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('event_id', selectedEventId)

      if (currentRoom) {
        query = query.eq('room_id', currentRoom.id)
      } else if (user) {
        query = query.eq('user_id', user.id).is('room_id', null)
      }

      query = sortBy === 'best'
        ? query.order('time_ms', { ascending: true })
        : query.order('recorded_at', { ascending: false })

      const { data } = await query
      setRecords(data ?? [])
    }
    fetchRecords()
  }, [selectedEventId, sortBy, currentRoom, user])

  if (!currentRoom) {
    return (
      <div style={{ padding: '0 16px 100px' }}>
        <div style={{ padding: '20px 0 16px' }}>
          <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
            グループ比較
          </div>
          <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
            メンバー対戦
          </div>
        </div>
        <div style={{
          background: theme.surface, border: `1px solid ${theme.border}`,
          borderRadius: 14, padding: '32px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <div style={{ color: theme.textMid, fontSize: 14, marginBottom: 8 }}>ルームに参加しましょう</div>
          <div style={{ color: theme.textDim, fontSize: 12 }}>
            ルームに参加またはルームを作成すると<br />メンバーとタイムを比較できます
          </div>
        </div>
      </div>
    )
  }

  // Group records by member
  const memberRecordsMap: Record<string, RunRecord[]> = {}
  records.forEach(r => {
    if (!memberRecordsMap[r.user_id]) memberRecordsMap[r.user_id] = []
    memberRecordsMap[r.user_id].push(r)
  })

  // Build member data with best times
  const memberData = members
    .map((m, colorIdx) => {
      const recs = memberRecordsMap[m.user_id] ?? []
      const best = recs.length ? Math.min(...recs.map(r => r.time_ms)) : null
      const sorted = [...recs].sort(
        sortBy === 'best'
          ? (a, b) => a.time_ms - b.time_ms
          : (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
      )
      return {
        member: m,
        records: sorted,
        best,
        color: memberColorPalette[colorIdx % memberColorPalette.length],
        displayName: m.profiles?.display_name ?? 'Unknown',
        letter: (m.profiles?.display_name ?? 'U')[0].toUpperCase(),
      }
    })
    .filter(m => m.records.length > 0)

  // Rank by best time
  const ranked = [...memberData].sort((a, b) => (a.best ?? Infinity) - (b.best ?? Infinity))
  const rankMap: Record<string, number> = {}
  ranked.forEach((m, i) => { rankMap[m.member.user_id] = i + 1 })

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ padding: '20px 0 12px' }}>
        <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
          グループ比較
        </div>
        <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
          メンバー対戦
        </div>
      </div>

      {/* Event filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
        {events.map(ev => (
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

      {/* Sort toggle */}
      <div style={{ display: 'flex', gap: 8, margin: '10px 0 16px' }}>
        {(['time', 'best'] as const).map(s => (
          <button key={s} onClick={() => setSortBy(s)} style={{
            background: sortBy === s ? theme.surfaceHigh : theme.surface,
            border: `1px solid ${sortBy === s ? theme.borderBright : theme.border}`,
            color: sortBy === s ? theme.accentBright : theme.textDim,
            borderRadius: 8, padding: '6px 14px',
            fontSize: 13, cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
          }}>{s === 'time' ? '時系列' : 'ベスト順'}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '40px 0' }}>読み込み中...</div>
      ) : memberData.length === 0 ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
          この種目の記録はまだありません
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {memberData.map(md => {
            const { color } = md
            const rank = rankMap[md.member.user_id]
            const isMe = md.member.user_id === user?.id

            return (
              <div key={md.member.user_id} style={{
                background: color.bg,
                border: `1px solid ${color.border}`,
                borderRadius: 16, overflow: 'hidden',
              }}>
                {/* Member header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 16px 10px',
                  borderBottom: `1px solid ${color.border}`,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: rank === 1
                      ? 'linear-gradient(135deg,#F59E0B,#FCD34D)'
                      : 'rgba(255,255,255,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: rank === 1 ? '#000' : theme.textDim,
                    fontWeight: 700, fontSize: 12,
                    fontFamily: "'Barlow Condensed', sans-serif", flexShrink: 0,
                  }}>{rank}</div>
                  <Avatar letter={md.letter} size={34} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      color: theme.text, fontWeight: 700, fontSize: 16,
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}>
                      {md.displayName}
                      {isMe && (
                        <span style={{
                          fontSize: 10, color: theme.accentBright,
                          border: `1px solid ${theme.borderBright}`,
                          borderRadius: 4, padding: '1px 5px',
                          fontFamily: "'Barlow Condensed', sans-serif",
                        }}>YOU</span>
                      )}
                    </div>
                    <div style={{
                      color: color.accent, fontSize: 12,
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    }}>
                      ベスト {md.best ? formatTime(md.best) : '—'}
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.06)', borderRadius: 8,
                    padding: '4px 10px', color: theme.textDim, fontSize: 12,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>{md.records.length}件</div>
                </div>

                {/* Records rows */}
                <div style={{ padding: '8px 0' }}>
                  {md.records.map((rec, idx) => {
                    const isBest = rec.time_ms === md.best
                    return (
                      <div key={rec.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '8px 16px',
                        borderBottom: idx < md.records.length - 1
                          ? '1px solid rgba(255,255,255,0.05)'
                          : 'none',
                      }}>
                        <div style={{
                          color: theme.textDim, fontSize: 11,
                          width: 54, flexShrink: 0,
                        }}>
                          {rec.recorded_at.slice(5)}
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            color: isBest ? color.accent : theme.text,
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 700, fontSize: 20,
                          }}>{formatTime(rec.time_ms)}</span>
                          {isBest && (
                            <span style={{
                              background: color.border, color: color.accent,
                              borderRadius: 4, padding: '1px 6px',
                              fontSize: 10, fontWeight: 700,
                              fontFamily: "'Barlow Condensed', sans-serif",
                            }}>PB</span>
                          )}
                          {rec.comment && (
                            <span style={{ color: theme.textDim, fontSize: 11 }}>{rec.comment}</span>
                          )}
                        </div>
                        {rec.avg_heart_rate != null && (
                          <div style={{ color: theme.textDim, fontSize: 11, textAlign: 'right', flexShrink: 0 }}>
                            ♥ {rec.avg_heart_rate}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
