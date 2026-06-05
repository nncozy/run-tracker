import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme, memberColorPalette } from '../theme'
import { formatTime } from '../utils/time'
import type { Room, RunRecord, RoomMember } from '../types/database'

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
  const [members, setMembers] = useState<RoomMember[]>([])
  const [records, setRecords] = useState<RunRecord[]>([])
  const [selectedKm, setSelectedKm] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'time' | 'best'>('best')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!currentRoom || !user) return
    setLoading(true)

    // 1. Fetch room members
    const { data: membersData } = await supabase
      .from('room_members')
      .select('*, users(id, nickname)')
      .eq('room_id', currentRoom.id)
    const memberList = (membersData ?? []) as RoomMember[]
    setMembers(memberList)

    if (memberList.length === 0) {
      setRecords([])
      setLoading(false)
      return
    }

    // 2. Fetch all records from room members (RLS allows viewing room members' records)
    const memberIds = memberList.map(m => m.user_id)
    const { data: recordsData } = await supabase
      .from('records')
      .select('*, user_distances(id, name, distance_km)')
      .in('user_id', memberIds)

    const fetched = (recordsData ?? []) as RunRecord[]
    setRecords(fetched)

    // 3. Auto-select the most common km value if none selected
    const kms = [...new Set(
      fetched
        .filter(r => r.user_distances?.distance_km != null)
        .map(r => r.user_distances!.distance_km)
    )].sort((a, b) => a - b)

    if (kms.length > 0) {
      setSelectedKm(prev => prev ?? kms[0])
    }

    setLoading(false)
  }, [currentRoom, user])

  useEffect(() => {
    setSelectedKm(null)
    fetchData()
  }, [fetchData])

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

  // Derive available km options from actual records
  const availableKms = [...new Set(
    records
      .filter(r => r.user_distances?.distance_km != null)
      .map(r => r.user_distances!.distance_km)
  )].sort((a, b) => a - b)

  // Filter records by selected km
  const filteredRecords = selectedKm != null
    ? records.filter(r => r.user_distances?.distance_km === selectedKm)
    : records

  // Group by member
  const memberRecordsMap: Record<string, RunRecord[]> = {}
  filteredRecords.forEach(r => {
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
          : (a, b) => new Date(b.run_date).getTime() - new Date(a.run_date).getTime()
      )
      return {
        member: m,
        records: sorted,
        best,
        color: memberColorPalette[colorIdx % memberColorPalette.length],
        displayName: m.users?.nickname ?? 'Unknown',
        letter: (m.users?.nickname ?? 'U')[0].toUpperCase(),
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

      {/* Distance filter chips */}
      {availableKms.length > 0 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10 }}>
          <button
            onClick={() => setSelectedKm(null)}
            style={{
              background: selectedKm === null ? theme.accentDeep : theme.surface,
              border: `1px solid ${selectedKm === null ? theme.accent : theme.border}`,
              color: selectedKm === null ? '#fff' : theme.textMid,
              borderRadius: 20, padding: '5px 14px',
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
            }}
          >すべて</button>
          {availableKms.map(km => (
            <button
              key={km}
              onClick={() => setSelectedKm(km)}
              style={{
                background: selectedKm === km ? theme.accentDeep : theme.surface,
                border: `1px solid ${selectedKm === km ? theme.accent : theme.border}`,
                color: selectedKm === km ? '#fff' : theme.textMid,
                borderRadius: 20, padding: '5px 14px',
                fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              }}
            >{km}km</button>
          ))}
        </div>
      )}

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
          {availableKms.length === 0 ? 'まだ記録がありません' : 'この距離の記録はまだありません'}
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
                    const d = new Date(rec.run_date)
                    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`
                    const memo = rec.custom_fields?.memo
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
                          width: 44, flexShrink: 0,
                        }}>
                          {dateStr}
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
                          {memo && (
                            <span style={{ color: theme.textDim, fontSize: 11 }}>{memo}</span>
                          )}
                        </div>
                        {rec.user_distances?.name && selectedKm === null && (
                          <div style={{ color: theme.textDim, fontSize: 11, flexShrink: 0 }}>
                            {rec.user_distances.distance_km}km
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
