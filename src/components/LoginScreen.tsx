import { useState } from 'react'
import { theme } from '../theme'
import { useAuth } from '../contexts/AuthContext'

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent
  if (/Android/.test(ua) && /; wv\)/.test(ua)) return true
  if (/FBAN|FBAV|Instagram|Twitter|Line\/|LinkedIn|Snapchat|Pinterest|GSA\//.test(ua)) return true
  if (/iPhone|iPad|iPod/.test(ua) && /AppleWebKit/.test(ua) && !/Safari/.test(ua)) return true
  return false
}

function WebViewBlock() {
  const url = window.location.href
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const isAndroid = /Android/.test(navigator.userAgent)

  function openInBrowser() {
    if (isIOS) {
      window.location.href = `x-safari-${url}`
    } else {
      window.location.href = `intent://${url.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`
    }
  }

  return (
    <div style={{
      background: theme.bg, minHeight: '100dvh',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', fontFamily: "'DM Sans', sans-serif",
    }}>
      <div style={{ fontSize: 56, marginBottom: 24 }}>🔒</div>
      <div style={{
        color: theme.text, fontSize: 20, fontWeight: 700,
        fontFamily: "'Barlow Condensed', sans-serif",
        textAlign: 'center', marginBottom: 12,
      }}>
        アプリ内ブラウザではログインできません
      </div>
      <div style={{
        color: theme.textMid, fontSize: 14, textAlign: 'center',
        lineHeight: 1.7, marginBottom: 32, maxWidth: 300,
      }}>
        Googleのポリシーにより、{isIOS ? 'Safari' : 'Chrome'}などの
        ブラウザからログインする必要があります。
      </div>

      <button
        onClick={openInBrowser}
        style={{
          width: '100%', maxWidth: 300,
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          border: 'none', borderRadius: 14,
          color: '#fff', padding: '14px 0',
          fontSize: 15, fontWeight: 600,
          cursor: 'pointer', marginBottom: 16,
          fontFamily: "'Barlow Condensed', sans-serif",
        }}
      >
        {isIOS ? 'Safariで開く' : 'Chromeで開く'}
      </button>

      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 10, padding: '12px 16px',
        width: '100%', maxWidth: 300,
      }}>
        <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 6 }}>
          ボタンが効かない場合はURLをコピー
        </div>
        <div
          onClick={() => navigator.clipboard.writeText(url).catch(() => {})}
          style={{
            color: theme.textMid, fontSize: 11,
            fontFamily: 'monospace', wordBreak: 'break-all',
            cursor: 'pointer',
          }}
        >
          {url}
        </div>
      </div>

      {isAndroid && (
        <div style={{ color: theme.textDim, fontSize: 12, marginTop: 16, textAlign: 'center', maxWidth: 280 }}>
          Gmailアプリの場合：右上「⋮」→「Chromeで開く」
        </div>
      )}
      {isIOS && (
        <div style={{ color: theme.textDim, fontSize: 12, marginTop: 16, textAlign: 'center', maxWidth: 280 }}>
          右下「Safari」アイコンまたは「⋯」→「Safariで開く」
        </div>
      )}
    </div>
  )
}

export function LoginScreen() {
  const { signInWithGoogle } = useAuth()
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false)

  if (isInAppBrowser()) return <WebViewBlock />

  return (
    <div style={{
      background: theme.bg,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 32px',
      fontFamily: "'DM Sans', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=DM+Sans:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        top: -200,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 500,
        height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(109,40,217,0.35) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -100,
        right: -100,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Logo */}
      <div style={{ position: 'relative', textAlign: 'center', marginBottom: 48 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accent})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: 32,
          boxShadow: '0 8px 32px rgba(109, 40, 217, 0.5)',
        }}>⚡</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 800,
          fontSize: 36,
          color: theme.text,
          letterSpacing: '-0.02em',
        }}>RUN TRACKER</div>
        <div style={{
          color: theme.textDim,
          fontSize: 14,
          marginTop: 8,
        }}>タイムやパフォーマンスを記録・仲間にシェア</div>
      </div>

      {/* Features */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 48,
        width: '100%',
        maxWidth: 320,
      }}>
        {[
          { icon: '⚡', text: 'タイムアタック記録・管理' },
          { icon: '🏆', text: 'メンバーとのタイム比較' },
          { icon: '📊', text: 'HealthKit統計グラフ' },
        ].map(({ icon, text }) => (
          <div key={text} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 12,
            padding: '12px 16px',
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ color: theme.textMid, fontSize: 14 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Google login button */}
      <button
        onClick={signInWithGoogle}
        style={{
          width: '100%',
          maxWidth: 320,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          background: '#fff',
          border: 'none',
          borderRadius: 14,
          padding: '14px 24px',
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "'DM Sans', sans-serif",
          color: '#1a1a1a',
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
        Googleでログイン
      </button>

      <button
        onClick={() => setShowPrivacyDetails((prev) => !prev)}
        style={{
          marginTop: 16,
          background: 'transparent',
          border: 'none',
          color: theme.textMid,
          fontSize: 12,
          textDecoration: 'underline',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-expanded={showPrivacyDetails}
      >
        {showPrivacyDetails ? 'データ利用の詳細を閉じる' : 'データ利用の詳細を見る'}
      </button>

      {showPrivacyDetails && (
        <div style={{
          marginTop: 12,
          padding: 14,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 14,
          color: theme.textDim,
          fontSize: 12,
          lineHeight: 1.6,
          textAlign: 'left',
          maxWidth: 320,
          width: '100%',
        }}>
          <p style={{ margin: 0 }}>
            Googleアカウントは、ログイン認証とプロフィールの表示、
            ランキング・記録同期のためだけに使われます。
            それ以外の目的や第三者提供は行いません。
          </p>
        </div>
      )}

      <p style={{ color: theme.textDim, fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        ログインにより必要データの利用に同意したものとみなします
      </p>
    </div>
  )
}
