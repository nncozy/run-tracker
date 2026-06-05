import { useState } from 'react'
import { theme } from '../theme'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'login' | 'register'

function validateNickname(nickname: string): string | null {
  if (nickname.trim().length < 2) return 'ニックネームは2文字以上にしてください'
  if (nickname.trim().length > 20) return 'ニックネームは20文字以内にしてください'
  return null
}

function validatePin(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'PINは4桁の数字にしてください'
  return null
}

export function LoginScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const nErr = validateNickname(nickname)
    if (nErr) { setError(nErr); return }
    const pErr = validatePin(pin)
    if (pErr) { setError(pErr); return }

    setLoading(true)
    try {
      if (mode === 'register') {
        await signUp(nickname, pin)
      } else {
        await signIn(nickname, pin)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Invalid login credentials')) setError('ニックネームまたはPINが違います')
      else if (msg.includes('already registered') || msg.includes('すでに使われています')) setError('このニックネームはすでに使われています')
      else setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    borderRadius: 10, padding: '12px 14px',
    color: theme.text, fontSize: 15,
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
  }

  return (
    <div style={{
      background: theme.bg, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 32px', fontFamily: "'DM Sans', sans-serif",
      position: 'relative', overflow: 'hidden',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40, position: 'relative' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 32,
          boxShadow: '0 8px 32px rgba(109, 40, 217, 0.5)',
        }}>⚡</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
          fontSize: 36, color: theme.text, letterSpacing: '-0.02em',
        }}>RUN TRACKER</div>
        <div style={{ color: theme.textDim, fontSize: 13, marginTop: 6 }}>
          タイムやパフォーマンスを記録・仲間にシェア
        </div>
      </div>

      {/* Tab toggle */}
      <div style={{
        display: 'flex', width: '100%', maxWidth: 320,
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: 4, marginBottom: 20,
      }}>
        {(['login', 'register'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError('') }}
            style={{
              flex: 1, border: 'none', borderRadius: 8, padding: '8px 0',
              background: mode === m ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})` : 'transparent',
              color: mode === m ? '#fff' : theme.textDim,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              transition: 'all 0.15s',
            }}
          >
            {m === 'login' ? 'ログイン' : '新規登録'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>
              ニックネーム
            </div>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="例: こうじ"
              autoCapitalize="none"
              autoCorrect="off"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 6, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.06em' }}>
              4桁のPIN
            </div>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, padding: '10px 14px',
              color: '#F87171', fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', border: 'none', borderRadius: 12,
              padding: '14px 0', marginTop: 4,
              background: loading
                ? theme.surfaceMid
                : `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
              color: '#fff', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
              boxShadow: loading ? 'none' : '0 4px 24px rgba(109,40,217,0.4)',
              transition: 'all 0.15s',
            }}
          >
            {loading ? '処理中...' : mode === 'login' ? 'ログイン' : 'アカウント作成'}
          </button>
        </div>
      </form>

      <p style={{ color: theme.textDim, fontSize: 11, marginTop: 24, textAlign: 'center', maxWidth: 280, lineHeight: 1.6 }}>
        メールアドレス不要。ニックネームと4桁のPINだけで使えます。
      </p>
    </div>
  )
}
