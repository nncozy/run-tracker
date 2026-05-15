import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import type { Room, RoomMember } from '../types/database'

interface RoomWithMembers extends Room {
  members: RoomMember[]
}

interface Props {
  currentRoom: Room | null
  onRoomChange: (room: Room | null) => void
  onRoomsLoaded: (rooms: Room[]) => void
}

function Avatar({ letter, size = 28 }: { letter: string; size?: number }) {
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

export function RoomTab({ currentRoom, onRoomChange, onRoomsLoaded }: Props) {
  const { user } = useAuth()
  const [rooms, setRooms] = useState<RoomWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [joinToken, setJoinToken] = useState('')
  const [creating, setCreating] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const fetchRooms = useCallback(async () => {
    if (!user) return
    setLoading(true)

    const { data: memberRows } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', user.id)

    const roomIds = (memberRows ?? []).map(r => r.room_id)

    if (roomIds.length === 0) {
      setRooms([])
      onRoomsLoaded([])
      setLoading(false)
      return
    }

    const { data: roomsData } = await supabase
      .from('rooms')
      .select('*')
      .in('id', roomIds)
      .order('created_at', { ascending: true })

    const roomList = roomsData ?? []

    // Fetch members for each room
    const { data: allMembers } = await supabase
      .from('room_members')
      .select('*, profiles(id, display_name, avatar_url)')
      .in('room_id', roomIds)

    const roomsWithMembers: RoomWithMembers[] = roomList.map(room => ({
      ...room,
      members: (allMembers ?? []).filter(m => m.room_id === room.id),
    }))

    setRooms(roomsWithMembers)
    onRoomsLoaded(roomList)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  async function handleCreate() {
    if (!newRoomName.trim() || !user) return
    setCreating(true)
    setError('')

    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ name: newRoomName.trim(), created_by: user.id })
      .select()
      .single()

    if (roomErr || !room) {
      setError(roomErr?.message ?? '作成に失敗しました')
      setCreating(false)
      return
    }

    await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      role: 'admin',
    })

    setCreating(false)
    setShowCreate(false)
    setNewRoomName('')
    await fetchRooms()
    onRoomChange(room)
  }

  function extractToken(input: string): string {
    // Regex handles all URL formats (with/without protocol, hash, encoded chars)
    const match = /[?&]token=([^&\s#]+)/.exec(input)
    return match ? decodeURIComponent(match[1]) : input.trim()
  }

  async function handleJoin() {
    if (!joinToken.trim() || !user) return
    setJoining(true)
    setError('')

    const token = extractToken(joinToken)

    const { data, error } = await supabase.rpc('join_room_by_token', { p_token: token })

    setJoining(false)

    if (error) {
      setError(error.message)
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }

    const room: Room = {
      id: data.room_id,
      name: data.room_name,
      invite_token: data.invite_token,
      created_by: data.created_by,
      created_at: data.created_at,
    }

    setShowJoin(false)
    setJoinToken('')
    await fetchRooms()
    onRoomChange(room)
  }

  function copyInviteLink(room: Room) {
    const url = `${window.location.origin}?token=${room.invite_token}`
    navigator.clipboard.writeText(url).then(() => {
      alert('招待リンクをコピーしました')
    })
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

  return (
    <div style={{ padding: '0 16px 100px' }}>
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>管理</div>
        <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>ルーム</div>
      </div>

      {loading ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '40px 0' }}>読み込み中...</div>
      ) : (
        <>
          {rooms.length === 0 && (
            <div style={{
              background: theme.surface, border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: '24px 20px',
              textAlign: 'center', marginBottom: 16,
            }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
              <div style={{ color: theme.textMid, fontSize: 14, marginBottom: 6 }}>まだルームがありません</div>
              <div style={{ color: theme.textDim, fontSize: 12 }}>ルームを作成するか招待リンクで参加しましょう</div>
            </div>
          )}

          {rooms.map(room => {
            const isActive = currentRoom?.id === room.id
            return (
              <div key={room.id} style={{
                background: theme.surface,
                border: `1px solid ${isActive ? theme.borderBright : theme.border}`,
                borderRadius: 14, padding: 16, marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ color: theme.text, fontWeight: 600, fontSize: 16 }}>{room.name}</div>
                    <div style={{ color: theme.textDim, fontSize: 12, marginTop: 3 }}>
                      {room.members.length}人のメンバー
                    </div>
                  </div>
                  <button
                    onClick={() => onRoomChange(isActive ? null : room)}
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`
                        : theme.surfaceMid,
                      border: `1px solid ${isActive ? 'transparent' : theme.border}`,
                      color: isActive ? '#fff' : theme.textMid,
                      borderRadius: 8, padding: '5px 12px',
                      fontSize: 12, cursor: 'pointer',
                      fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
                    }}
                  >
                    {isActive ? 'このルームを表示中' : 'このルームに入る'}
                  </button>
                </div>

                {/* Member avatars */}
                <div style={{ display: 'flex', marginBottom: 12 }}>
                  {room.members.slice(0, 5).map((m, idx) => {
                    const letter = (m.profiles?.display_name ?? 'U')[0].toUpperCase()
                    return (
                      <div key={m.user_id} style={{ marginLeft: idx === 0 ? 0 : -8, zIndex: 5 - idx }}>
                        <Avatar letter={letter} size={28} />
                      </div>
                    )
                  })}
                  {room.members.length > 5 && (
                    <div style={{
                      marginLeft: -8, zIndex: 0,
                      width: 28, height: 28, borderRadius: '50%',
                      background: theme.surfaceMid,
                      border: `1px solid ${theme.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: theme.textDim, fontSize: 10,
                    }}>+{room.members.length - 5}</div>
                  )}
                </div>

                <button
                  onClick={() => copyInviteLink(room)}
                  style={{
                    width: '100%',
                    background: theme.surfaceMid,
                    border: `1px solid ${theme.border}`,
                    color: theme.textMid, borderRadius: 10,
                    padding: '10px 0', fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >🔗 招待リンクをコピー</button>
              </div>
            )
          })}

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
            <button
              onClick={() => { setShowCreate(true); setError('') }}
              style={{
                width: '100%',
                background: 'transparent',
                border: `1px dashed ${theme.border}`,
                color: theme.textMid, borderRadius: 14,
                padding: '16px 0', fontSize: 14,
                cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >＋ 新しいルームを作成</button>

            <button
              onClick={() => { setShowJoin(true); setError('') }}
              style={{
                width: '100%',
                background: 'transparent',
                border: `1px dashed ${theme.border}`,
                color: theme.textMid, borderRadius: 14,
                padding: '16px 0', fontSize: 14,
                cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
              }}
            >🔗 招待リンクで参加</button>
          </div>
        </>
      )}

      {/* Create room modal */}
      {showCreate && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', zIndex: 100,
          }}
          onClick={() => setShowCreate(false)}
        >
          <div
            style={{
              background: '#150830',
              border: `1px solid ${theme.border}`,
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 40px',
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              color: theme.text, fontSize: 18, fontWeight: 700,
              fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 20,
            }}>新しいルームを作成</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: theme.textDim, fontSize: 12, marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif" }}>ルーム名</div>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                placeholder="例：マラソンチーム"
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            {error && (
              <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}

            <button
              onClick={handleCreate}
              disabled={creating || !newRoomName.trim()}
              style={{
                width: '100%',
                background: creating || !newRoomName.trim()
                  ? theme.surfaceMid
                  : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
                border: 'none', borderRadius: 12,
                color: '#fff', padding: '14px 0',
                fontSize: 16, cursor: creating ? 'not-allowed' : 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                boxShadow: '0 4px 20px rgba(109, 40, 217, 0.4)',
              }}
            >{creating ? '作成中...' : '作成する'}</button>
          </div>
        </div>
      )}

      {/* Join room modal */}
      {showJoin && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end', zIndex: 100,
          }}
          onClick={() => setShowJoin(false)}
        >
          <div
            style={{
              background: '#150830',
              border: `1px solid ${theme.border}`,
              borderRadius: '20px 20px 0 0',
              padding: '24px 20px 40px',
              width: '100%',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              color: theme.text, fontSize: 18, fontWeight: 700,
              fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 20,
            }}>招待リンクで参加</div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ color: theme.textDim, fontSize: 12, marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif" }}>
                招待リンクまたはトークン
              </div>
              <input
                type="text"
                value={joinToken}
                onChange={e => setJoinToken(e.target.value)}
                placeholder="https://...?token=xxx または トークンを貼り付け"
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}

            <button
              onClick={handleJoin}
              disabled={joining || !joinToken.trim()}
              style={{
                width: '100%',
                background: joining || !joinToken.trim()
                  ? theme.surfaceMid
                  : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
                border: 'none', borderRadius: 12,
                color: '#fff', padding: '14px 0',
                fontSize: 16, cursor: joining ? 'not-allowed' : 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700,
                boxShadow: '0 4px 20px rgba(109, 40, 217, 0.4)',
              }}
            >{joining ? '参加中...' : '参加する'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
