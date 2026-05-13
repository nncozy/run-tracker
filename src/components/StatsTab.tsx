import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import { formatPace, formatDuration } from '../utils/time'
import type { HealthActivity } from '../types/database'

const tooltipStyle = {
  background: '#150830',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.text,
  fontSize: 12,
}

function buildMonthlyData(activities: HealthActivity[]) {
  const map: Record<string, number> = {}
  activities.forEach(a => {
    const month = a.workout_date.slice(0, 7)
    map[month] = (map[month] ?? 0) + (a.distance_meters ?? 0) / 1000
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, km]) => ({
      month: new Date(month + '-01').toLocaleDateString('ja', { month: 'short' }),
      km: Math.round(km * 10) / 10,
    }))
}

function buildWeeklyData(activities: HealthActivity[]) {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))

  return ['月', '火', '水', '木', '金', '土', '日'].map((day, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const km = activities
      .filter(a => a.workout_date === dateStr)
      .reduce((sum, a) => sum + (a.distance_meters ?? 0) / 1000, 0)
    return { day, km: Math.round(km * 10) / 10 }
  })
}

export function StatsTab() {
  const { user, profile } = useAuth()
  const [activities, setActivities] = useState<HealthActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  async function fetchActivities() {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('health_activities')
      .select('*')
      .eq('user_id', user.id)
      .order('workout_date', { ascending: false })
    setActivities(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchActivities() }, [user])

  async function handleSync() {
    setSyncing(true)
    await new Promise(r => setTimeout(r, 1000))
    await fetchActivities()
    setSyncing(false)
  }

  const totalDistanceKm = activities.reduce((s, a) => s + (a.distance_meters ?? 0) / 1000, 0)
  const totalSeconds = activities.reduce((s, a) => s + (a.duration_seconds ?? 0), 0)
  const count = activities.length
  const avgPace = activities.length
    ? Math.round(activities.reduce((s, a) => s + (a.avg_pace_sec_per_km ?? 0), 0) / activities.filter(a => a.avg_pace_sec_per_km).length)
    : 0
  const recentActivity = activities[0]
  const avgHR = recentActivity?.avg_heart_rate
  const maxHR = recentActivity?.max_heart_rate

  const monthlyData = buildMonthlyData(activities)
  const weeklyData = buildWeeklyData(activities)

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{
          color: theme.textDim, fontSize: 12,
          fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em',
        }}>
          {profile?.display_name ?? 'あなた'}
        </div>
        <div style={{
          color: theme.text, fontSize: 22, fontWeight: 700,
          fontFamily: "'Barlow Condensed', sans-serif",
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          HealthKit統計
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              background: theme.surfaceMid,
              border: `1px solid ${theme.border}`,
              color: theme.textMid, borderRadius: 8,
              padding: '4px 10px', fontSize: 12,
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontFamily: "'Barlow Condensed', sans-serif",
            }}
          >
            {syncing ? '同期中...' : '↻ 同期'}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '60px 0' }}>読み込み中...</div>
      ) : activities.length === 0 ? (
        <div style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: 14, padding: '32px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ color: theme.textMid, fontSize: 14, marginBottom: 8 }}>まだ統計データがありません</div>
          <div style={{ color: theme.textDim, fontSize: 12 }}>
            iPhoneショートカット経由でデータをPOSTするか<br />「今すぐ同期」を押してください
          </div>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: '累計距離', value: totalDistanceKm.toFixed(1), unit: 'km' },
              { label: '累計時間', value: formatDuration(totalSeconds), unit: '' },
              { label: 'ワークアウト', value: String(count), unit: '回' },
              { label: '平均ペース', value: avgPace ? formatPace(avgPace) : '—', unit: '/km' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: 14, padding: 16,
              }}>
                <div style={{
                  color: theme.textDim, fontSize: 11,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: '0.08em', marginBottom: 6,
                }}>{kpi.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{
                    color: theme.text, fontSize: 26, fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>{kpi.value}</span>
                  {kpi.unit && (
                    <span style={{ color: theme.textMid, fontSize: 13 }}>{kpi.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Heart rate (latest workout) */}
          {(avgHR || maxHR) && (
            <div style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: 16,
              marginBottom: 16,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{
                  color: theme.textDim, fontSize: 11,
                  fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em',
                }}>心拍数（直近ワークアウト）</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 20 }}>
                  {avgHR != null && (
                    <div>
                      <div style={{ color: theme.textDim, fontSize: 11 }}>平均</div>
                      <div style={{
                        color: theme.text, fontSize: 26, fontWeight: 700,
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}>
                        {avgHR}<span style={{ fontSize: 13, color: theme.textMid }}> bpm</span>
                      </div>
                    </div>
                  )}
                  {maxHR != null && (
                    <div>
                      <div style={{ color: theme.textDim, fontSize: 11 }}>最高</div>
                      <div style={{
                        color: '#F87171', fontSize: 26, fontWeight: 700,
                        fontFamily: "'Barlow Condensed', sans-serif",
                      }}>
                        {maxHR}<span style={{ fontSize: 13, color: theme.textMid }}> bpm</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 40, opacity: 0.6 }}>♥</div>
            </div>
          )}

          {/* Monthly chart */}
          {monthlyData.length > 0 && (
            <div style={{
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: 14, padding: '16px 12px 8px',
              marginBottom: 14,
            }}>
              <div style={{
                color: theme.textMid, fontSize: 13,
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 600, marginBottom: 14,
              }}>月別走行距離 (km)</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={monthlyData}>
                  <defs>
                    <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.accent} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={theme.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fill: theme.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="km" stroke={theme.accent} strokeWidth={2} fill="url(#purpleGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly chart */}
          <div style={{
            background: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: 14, padding: '16px 12px 8px',
          }}>
            <div style={{
              color: theme.textMid, fontSize: 13,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600, marginBottom: 14,
            }}>今週 (km)</div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={weeklyData} barSize={20}>
                <XAxis dataKey="day" tick={{ fill: theme.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="km" fill={theme.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
