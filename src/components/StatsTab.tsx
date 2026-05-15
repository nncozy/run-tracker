import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import { formatPace, formatDuration } from '../utils/time'
import type { HealthActivity, RunRecord, RunEvent } from '../types/database'

const tooltipStyle = {
  background: '#150830',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.text,
  fontSize: 12,
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div style={{
      color: theme.textMid, fontSize: 13, fontWeight: 600,
      fontFamily: "'Barlow Condensed', sans-serif",
      letterSpacing: '0.04em', marginBottom: 14,
    }}>{title}</div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: '16px 14px',
      marginBottom: 14,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── data builders ──────────────────────────────────────────────────────────

function isoWeekKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  const thu = new Date(d)
  thu.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const jan4 = new Date(thu.getFullYear(), 0, 4)
  const wk = 1 + Math.round((thu.getTime() - jan4.getTime()) / 604800000)
  return `${thu.getFullYear()}-W${String(wk).padStart(2, '0')}`
}

function buildWeeklyVolume(activities: HealthActivity[]) {
  const map: Record<string, number> = {}
  activities.forEach(a => {
    const k = isoWeekKey(a.workout_date)
    map[k] = (map[k] ?? 0) + (a.distance_meters ?? 0) / 1000
  })
  const sorted = Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).slice(-12)
  return sorted.map(([wk, km], i) => {
    const prev = i > 0 ? sorted[i - 1][1] : null
    const over10 = prev != null && prev > 0 && km > prev * 1.10
    return {
      label: `W${parseInt(wk.split('-W')[1])}`,
      km: Math.round(km * 10) / 10,
      over10,
    }
  })
}

function buildVO2maxTrend(activities: HealthActivity[]) {
  return [...activities]
    .filter(a => a.vo2max != null)
    .sort((a, b) => a.workout_date.localeCompare(b.workout_date))
    .slice(-20)
    .map(a => ({ date: a.workout_date.slice(5).replace('-', '/'), vo2max: a.vo2max }))
}

function buildHRZones(activities: HealthActivity[]) {
  let z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0
  activities.forEach(a => {
    z1 += a.hr_zone1_seconds ?? 0
    z2 += a.hr_zone2_seconds ?? 0
    z3 += a.hr_zone3_seconds ?? 0
    z4 += a.hr_zone4_seconds ?? 0
    z5 += a.hr_zone5_seconds ?? 0
  })
  if (z1 + z2 + z3 + z4 + z5 === 0) return []
  return [
    { zone: 'Z1\n回復', minutes: Math.round(z1 / 60), color: '#60A5FA' },
    { zone: 'Z2\n有酸素', minutes: Math.round(z2 / 60), color: '#34D399' },
    { zone: 'Z3\n閾値', minutes: Math.round(z3 / 60), color: '#FBBF24' },
    { zone: 'Z4\nVO2', minutes: Math.round(z4 / 60), color: '#F97316' },
    { zone: 'Z5\n無酸素', minutes: Math.round(z5 / 60), color: '#EF4444' },
  ]
}

function buildCadenceTrend(activities: HealthActivity[]) {
  return [...activities]
    .filter(a => a.avg_cadence != null && a.avg_cadence > 100)
    .sort((a, b) => a.workout_date.localeCompare(b.workout_date))
    .slice(-20)
    .map(a => ({ date: a.workout_date.slice(5).replace('-', '/'), cadence: a.avg_cadence }))
}

type RecordWithEvent = RunRecord & { events: RunEvent }

function buildAerobicEfficiency(records: RecordWithEvent[]) {
  const map: Record<string, { name: string; data: { date: string; hr: number }[] }> = {}
  records.forEach(r => {
    if (!r.avg_heart_rate) return
    const id = r.event_id
    if (!map[id]) map[id] = { name: r.events?.name ?? id, data: [] }
    map[id].data.push({ date: r.recorded_at.slice(5).replace('-', '/'), hr: r.avg_heart_rate })
  })
  return Object.entries(map)
    .filter(([, v]) => v.data.length >= 2)
    .map(([id, v]) => ({
      id,
      name: v.name,
      data: [...v.data].sort((a, b) => a.date.localeCompare(b.date)),
    }))
}

// ── component ──────────────────────────────────────────────────────────────

export function StatsTab() {
  const { user, profile } = useAuth()
  const [activities, setActivities] = useState<HealthActivity[]>([])
  const [records, setRecords] = useState<RecordWithEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([
      supabase
        .from('health_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('workout_date', { ascending: false }),
      supabase
        .from('records')
        .select('*, events(*)')
        .eq('user_id', user.id)
        .not('avg_heart_rate', 'is', null)
        .order('recorded_at', { ascending: false }),
    ]).then(([actRes, recRes]) => {
      setActivities(actRes.data ?? [])
      setRecords((recRes.data ?? []) as RecordWithEvent[])
      setLoading(false)
    })
  }, [user])

  // Summary numbers
  const totalKm = activities.reduce((s, a) => s + (a.distance_meters ?? 0) / 1000, 0)
  const totalSeconds = activities.reduce((s, a) => s + (a.duration_seconds ?? 0), 0)
  const count = activities.length

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthKm = activities
    .filter(a => a.workout_date.startsWith(thisMonth))
    .reduce((s, a) => s + (a.distance_meters ?? 0) / 1000, 0)

  const latestVO2max = activities.find(a => a.vo2max != null)?.vo2max ?? null

  const avgPaceActivities = activities.filter(a => a.avg_pace_sec_per_km)
  const avgPace = avgPaceActivities.length
    ? Math.round(avgPaceActivities.reduce((s, a) => s + (a.avg_pace_sec_per_km ?? 0), 0) / avgPaceActivities.length)
    : 0

  // Charts
  const weeklyData = buildWeeklyVolume(activities)
  const vo2maxData = buildVO2maxTrend(activities)
  const hrZones = buildHRZones(activities)
  const cadenceData = buildCadenceTrend(activities)
  const aerobicEvents = buildAerobicEfficiency(records)
  const selectedEvent = aerobicEvents.find(e => e.id === selectedEventId) ?? aerobicEvents[0] ?? null

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
          {profile?.display_name ?? 'あなた'}
        </div>
        <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
          ランナー統計
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '60px 0' }}>読み込み中...</div>
      ) : activities.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ color: theme.textMid, fontSize: 14, marginBottom: 8 }}>まだ統計データがありません</div>
            <div style={{ color: theme.textDim, fontSize: 12 }}>
              iPhoneショートカット経由でワークアウトデータを<br />送信すると統計が表示されます
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* ── 1. Summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: '累計距離', value: totalKm.toFixed(1), unit: 'km' },
              { label: '今月', value: thisMonthKm.toFixed(1), unit: 'km' },
              { label: 'ワークアウト', value: String(count), unit: '回' },
              { label: '累計時間', value: formatDuration(totalSeconds), unit: '' },
              ...(avgPace ? [{ label: '平均ペース', value: formatPace(avgPace), unit: '/km' }] : []),
              ...(latestVO2max != null ? [{ label: 'VO2max', value: latestVO2max.toFixed(1), unit: 'mL/kg/min' }] : []),
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
                    color: theme.text, fontSize: 24, fontWeight: 700,
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}>{kpi.value}</span>
                  {kpi.unit && <span style={{ color: theme.textMid, fontSize: 12 }}>{kpi.unit}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* ── 2. 有酸素効率（同コース・HR推移） ── */}
          {aerobicEvents.length > 0 && (
            <Card>
              <SectionHeader title="有酸素効率（同コースの心拍推移）" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {aerobicEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    style={{
                      background: (selectedEvent?.id === ev.id) ? theme.accentDeep : theme.surfaceMid,
                      border: `1px solid ${(selectedEvent?.id === ev.id) ? theme.accent : theme.border}`,
                      color: (selectedEvent?.id === ev.id) ? '#fff' : theme.textDim,
                      borderRadius: 20, padding: '4px 12px', fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: "'Barlow Condensed', sans-serif",
                    }}
                  >{ev.name}</button>
                ))}
              </div>
              {selectedEvent && (
                <>
                  <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 8 }}>
                    心拍↓ = 有酸素能力向上
                  </div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={selectedEvent.data}>
                      <XAxis dataKey="date" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} bpm`, '心拍']} />
                      <Line
                        type="monotone" dataKey="hr"
                        stroke="#F87171" strokeWidth={2} dot={{ r: 3, fill: '#F87171' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </Card>
          )}

          {/* ── 3. VO2max トレンド ── */}
          {vo2maxData.length >= 2 && (
            <Card>
              <SectionHeader title="VO2max トレンド" />
              <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 8 }}>
                数値↑ = 心肺持久力向上
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={vo2maxData}>
                  <defs>
                    <linearGradient id="vo2Grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.accentBright} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={theme.accentBright} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${typeof v === 'number' ? v.toFixed(1) : v} mL/kg/min`, 'VO2max']} />
                  <Area type="monotone" dataKey="vo2max" stroke={theme.accentBright} strokeWidth={2} fill="url(#vo2Grad)" dot={{ r: 3, fill: theme.accentBright }} />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── 4. 週間走行距離 + 10%ルール ── */}
          {weeklyData.length > 0 && (
            <Card>
              <SectionHeader title="週間走行距離 (km)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: theme.accent }} />
                  <span style={{ color: theme.textDim, fontSize: 11 }}>通常</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#F97316' }} />
                  <span style={{ color: theme.textDim, fontSize: 11 }}>+10%超（オーバートレ注意）</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={weeklyData} barSize={18}>
                  <XAxis dataKey="label" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} km`, '距離']} />
                  <Bar dataKey="km" radius={[4, 4, 0, 0]}>
                    {weeklyData.map((entry, i) => (
                      <Cell key={i} fill={entry.over10 ? '#F97316' : theme.accent} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── 5. 心拍ゾーン ── */}
          {hrZones.length > 0 && (
            <Card>
              <SectionHeader title="心拍ゾーン分布（累計）" />
              <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 8 }}>
                Z2（有酸素）が多いほど基礎心肺が向上
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={hrZones} barSize={36}>
                  <XAxis dataKey="zone" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} min`, '時間']} />
                  <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                    {hrZones.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
                {hrZones.map(z => (
                  <div key={z.zone} style={{ textAlign: 'center' }}>
                    <div style={{ color: z.color, fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
                      {z.minutes}
                    </div>
                    <div style={{ color: theme.textDim, fontSize: 10 }}>min</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* ── 6. ケイデンス トレンド ── */}
          {cadenceData.length >= 2 && (
            <Card>
              <SectionHeader title="ケイデンス トレンド (spm)" />
              <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 8 }}>
                180 spm 付近が効率的なストライドの目安
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <LineChart data={cadenceData}>
                  <XAxis dataKey="date" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} spm`, 'ケイデンス']} />
                  <ReferenceLine y={180} stroke={theme.textDim} strokeDasharray="4 3" label={{ value: '180', position: 'insideRight', fill: theme.textDim, fontSize: 10 }} />
                  <Line type="monotone" dataKey="cadence" stroke="#34D399" strokeWidth={2} dot={{ r: 3, fill: '#34D399' }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Placeholder when metrics missing */}
          {vo2maxData.length < 2 && cadenceData.length < 2 && hrZones.length === 0 && (
            <Card>
              <div style={{ color: theme.textDim, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
                VO2max・ケイデンス・心拍ゾーンデータはiPhoneショートカット経由で<br />自動取得されます
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
