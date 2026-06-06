import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginScreen } from './components/LoginScreen'
import { InputPage } from './components/InputPage'
import { StatsTab } from './components/StatsTab'
import { RankingTab } from './components/RankingTab'
import { RoomTab } from './components/RoomTab'
import { supabase } from './lib/supabase'
import { theme } from './theme'
import type { Room } from './types/database'

const tabs = [
  { id: 'record', label: '記録', icon: '⚡' },
  { id: 'stats', label: '統計', icon: '📊' },
  { id: 'ranking', label: '順位', icon: '🏆' },
  { id: 'room', label: 'ルーム', icon: '👥' },
] as const

type TabId = typeof tabs[number]['id']

function Avatar({ src, letter, size = 30 }: { src?: string | null; letter: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        width={size}
        height={size}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        alt=""
      />
    )
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      fontFamily: "'Barlow Condensed', sans-serif",
      flexShrink: 0,
    }}>{letter}</div>
  )
}

function LoadingScreen() {
  return (
    <div style={{
      background: theme.bg, minHeight: '100dvh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, margin: '0 auto 16px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>⚡</div>
        <div style={{ color: theme.textDim, fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
          読み込み中...
        </div>
      </div>
    </div>
  )
}

function MainApp() {
  const { profile, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<TabId>('record')
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [showRoomPicker, setShowRoomPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Handle invite token from URL
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token')
    if (token) {
      window.history.replaceState({}, '', window.location.pathname)
      handleInviteToken(token)
    }
  }, [])

  async function handleInviteToken(token: string) {
    const { data, error } = await supabase.rpc('join_room_by_token', { p_token: token })
    if (error || !data || data.error) return
    const room: Room = {
      id: data.room_id,
      name: data.room_name,
      invite_token: data.invite_token,
      created_by: data.created_by,
      created_at: data.created_at,
    }
    setCurrentRoom(room)
    setRooms(prev => prev.some(r => r.id === room.id) ? prev : [...prev, room])
    setActiveTab('room')
  }

  const displayName = profile?.nickname ?? 'ユーザー'
  const letter = displayName[0]?.toUpperCase() ?? 'U'

  return (
    <div style={{
      background: theme.bg,
      minHeight: '100dvh',
      fontFamily: "'DM Sans', sans-serif",
      color: theme.text,
      maxWidth: 430,
      margin: '0 auto',
      position: 'relative',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(109,40,217,0.12) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: theme.nav,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${theme.border}`,
        padding: '12px 16px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button
          onClick={() => setShowRoomPicker(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'transparent', border: 'none',
            cursor: 'pointer', padding: 0,
          }}
        >
          <Avatar letter={letter} size={32} />
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{displayName}</div>
            <div style={{ color: theme.textDim, fontSize: 11 }}>
              {currentRoom ? `${currentRoom.name} ▾` : 'パーソナル ▾'}
            </div>
          </div>
        </button>

        <button
          onClick={() => setShowSettings(v => !v)}
          style={{
            background: theme.surfaceMid,
            border: `1px solid ${theme.border}`,
            borderRadius: 8, padding: '4px 10px',
            color: theme.textMid, fontSize: 12,
            cursor: 'pointer',
            fontFamily: "'Barlow Condensed', sans-serif",
          }}
        >⚙️ 設定</button>
      </div>

      {/* Room picker dropdown */}
      {showRoomPicker && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 15 }}
            onClick={() => setShowRoomPicker(false)}
          />
          <div style={{
            position: 'fixed', top: 65, left: '50%', transform: 'translateX(-50%)',
            width: '100%', maxWidth: 430,
            background: theme.dropdown,
            border: `1px solid ${theme.borderBright}`,
            borderTop: 'none',
            zIndex: 16, overflow: 'hidden',
          }}>
            <button
              onClick={() => { setCurrentRoom(null); setShowRoomPicker(false) }}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                background: currentRoom === null ? theme.surfaceMid : 'transparent',
                border: 'none', borderBottom: `1px solid ${theme.border}`,
                color: theme.text, padding: '14px 16px',
                fontSize: 15, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>パーソナル</span>
              {currentRoom === null && <span style={{ color: theme.accentBright, fontSize: 12 }}>✓</span>}
            </button>
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => { setCurrentRoom(room); setShowRoomPicker(false) }}
                style={{
                  display: 'flex', alignItems: 'center', width: '100%',
                  background: currentRoom?.id === room.id ? theme.surfaceMid : 'transparent',
                  border: 'none', borderBottom: `1px solid ${theme.border}`,
                  color: theme.text, padding: '14px 16px',
                  fontSize: 15, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <span style={{ flex: 1, textAlign: 'left' }}>{room.name}</span>
                {currentRoom?.id === room.id && <span style={{ color: theme.accentBright, fontSize: 12 }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Settings dropdown */}
      {showSettings && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 15 }}
            onClick={() => setShowSettings(false)}
          />
          <div style={{
            position: 'fixed', top: 65, right: 0, left: 'auto',
            background: theme.dropdown,
            border: `1px solid ${theme.borderBright}`,
            borderRadius: '0 0 0 12px',
            zIndex: 16, overflow: 'hidden', minWidth: 200,
          }}>
            <button
              onClick={() => { signOut(); setShowSettings(false) }}
              style={{
                display: 'block', width: '100%',
                background: 'transparent', border: 'none',
                color: '#F87171', padding: '14px 20px',
                fontSize: 14, cursor: 'pointer', textAlign: 'left',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >ログアウト</button>
          </div>
        </>
      )}

      {/* Content */}
      <div>
        {activeTab === 'record' && <InputPage />}
        {activeTab === 'stats' && <StatsTab />}
        {activeTab === 'ranking' && <RankingTab currentRoom={currentRoom} />}
        {activeTab === 'room' && (
          <RoomTab
            currentRoom={currentRoom}
            onRoomChange={room => { setCurrentRoom(room); setShowRoomPicker(false) }}
            onRoomsLoaded={setRooms}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 430,
        background: theme.nav,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: `1px solid ${theme.border}`,
        display: 'flex',
        zIndex: 20,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1, background: 'transparent', border: 'none',
              padding: '12px 0', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              position: 'relative',
            }}
          >
            <div style={{
              fontSize: 20,
              filter: activeTab === tab.id ? 'none' : 'grayscale(1) opacity(0.4)',
              transition: 'filter 0.2s',
            }}>{tab.icon}</div>
            <div style={{
              fontSize: 11,
              fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600,
              color: activeTab === tab.id ? theme.accentBright : theme.textDim,
              transition: 'color 0.2s',
            }}>{tab.label}</div>
            {activeTab === tab.id && (
              <div style={{
                position: 'absolute', bottom: 0,
                width: 40, height: 2,
                background: `linear-gradient(90deg, ${theme.accentDeep}, ${theme.accent})`,
                borderRadius: 2,
              }} />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function AppContent() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <LoginScreen />
  return <MainApp />
}

export default function App() {
  return (
    <AuthProvider>
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <AppContent />
    </AuthProvider>
  )
}
