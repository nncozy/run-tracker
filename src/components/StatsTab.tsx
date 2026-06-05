import { useState, useEffect } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { theme } from '../theme'
import { formatTime } from '../utils/time'
import type { RunRecord } from '../types/database'

const tooltipStyle = {
  background: '#150830',
  border: `1px solid ${theme.border}`,
  borderRadius: 8,
  color: theme.text,
  fontSize: 12,
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: '16px 14px', marginBottom: 14,
      ...style,
    }}>{children}</div>
  )
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

// ── data builders ─────────────────────────────────────────────────────────

type DistanceStat = {
  id: string
  name: string
  distanceKm: number | null
  count: number
  best: number
  latest: number
  trend: number | null
  trendData: { date: string; ms: number }[]
}

function buildDistanceStats(records: RunRecord[]): DistanceStat[] {
  const map: Record<string, RunRecord[]> = {}
  records.forEach(r => {
    const key = r.distance_id ?? '__none__'
    if (!map[key]) map[key] = []
    map[key].push(r)
  })
  return Object.entries(map).map(([, recs]) => {
    const sorted = [...recs].sort((a, b) => a.run_date.localeCompare(b.run_date))
    const best = Math.min(...recs.map(r => r.time_ms))
    const latest = sorted[sorted.length - 1].time_ms
    const prev = sorted.length >= 2 ? sorted[sorted.length - 2].time_ms : null
    const trend = prev != null ? latest - prev : null
    return {
      id: sorted[0].distance_id ?? '__none__',
      name: sorted[0].user_distances?.name ?? '未分類',
      distanceKm: sorted[0].user_distances?.distance_km ?? null,
      count: recs.length,
      best,
      latest,
      trend,
      trendData: sorted.slice(-10).map(r => ({
        date: new Date(r.run_date).toLocaleDateString('ja', { month: 'numeric', day: 'numeric' }),
        ms: r.time_ms,
      })),
    }
  }).sort((a, b) => b.count - a.count)
}

function buildMonthlyActivity(records: RunRecord[]) {
  const map: Record<string, number> = {}
  records.forEach(r => {
    const m = r.run_date.slice(0, 7)
    map[m] = (map[m] ?? 0) + 1
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, count]) => ({
      month: new Date(month + '-01').toLocaleDateString('ja', { month: 'short' }),
      count,
    }))
}

// ── component ─────────────────────────────────────────────────────────────

export function StatsTab() {
  const { user, profile } = useAuth()
  const [records, setRecords] = useState<RunRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDistId, setSelectedDistId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    supabase
      .from('records')
      .select('*, user_distances(*)')
      .eq('user_id', user.id)
      .order('run_date', { ascending: false })
      .then(({ data }) => {
        setRecords((data ?? []) as RunRecord[])
        setLoading(false)
      })
  }, [user])

  const distanceStats = buildDistanceStats(records)
  const monthlyData = buildMonthlyActivity(records)
  const selectedStat = distanceStats.find(e => e.id === selectedDistId) ?? distanceStats[0] ?? null

  const totalRuns = records.length
  const uniqueCourses = new Set(records.filter(r => r.distance_id).map(r => r.distance_id)).size

  return (
    <div style={{ padding: '0 16px 100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 0 16px' }}>
        <div style={{ color: theme.textDim, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.1em' }}>
          {profile?.nickname ?? 'あなた'}
        </div>
        <div style={{ color: theme.text, fontSize: 22, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
          個人統計
        </div>
      </div>

      {loading ? (
        <div style={{ color: theme.textDim, textAlign: 'center', padding: '60px 0' }}>読み込み中...</div>
      ) : records.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ color: theme.textMid, fontSize: 14, marginBottom: 8 }}>まだ記録がありません</div>
            <div style={{ color: theme.textDim, fontSize: 12 }}>
              「記録」タブからタイムを入力すると<br />ここに統計が表示されます
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* ── 1. サマリー ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: '累計記録数', value: String(totalRuns), unit: '回' },
              { label: 'コース数', value: String(uniqueCourses), unit: 'コース' },
            ].map(kpi => (
              <div key={kpi.label} style={{
                background: theme.surface, border: `1px solid ${theme.border}`,
                borderRadius: 14, padding: 16,
              }}>
                <div style={{ color: theme.textDim, fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.08em', marginBottom: 6 }}>
                  {kpi.label}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ color: theme.text, fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
                    {kpi.value}
                  </span>
                  <span style={{ color: theme.textMid, fontSize: 13 }}>{kpi.unit}</span>
                </div>
              </div>
            ))}
          </div>

          {/* ── 2. コース別 PR & 記録数 ── */}
          <Card>
            <SectionHeader title="コース別 PR・記録数" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {distanceStats.map(ev => (
                <div key={ev.id} style={{
                  background: theme.surfaceMid, borderRadius: 10,
                  padding: '12px 14px', border: `1px solid ${theme.border}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>{ev.name}</div>
                      <div style={{ color: theme.textDim, fontSize: 11, marginTop: 2 }}>
                        {ev.count} 回
                        {ev.distanceKm != null && ` · ${ev.distanceKm}km`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: theme.accentBright, fontSize: 18, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {formatTime(ev.best)}
                      </div>
                      <div style={{ color: theme.textDim, fontSize: 10 }}>PR</div>
                    </div>
                  </div>
                  {ev.trend != null && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12, color: ev.trend < 0 ? '#34D399' : '#F87171' }}>
                        {ev.trend < 0 ? '▼' : '▲'}
                      </span>
                      <span style={{ fontSize: 12, color: ev.trend < 0 ? '#34D399' : '#F87171' }}>
                        前回より {formatTime(Math.abs(ev.trend))} {ev.trend < 0 ? '速い' : '遅い'}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* ── 3. コース別タイム推移 ── */}
          {distanceStats.some(e => e.trendData.length >= 2) && (
            <Card>
              <SectionHeader title="タイム推移（コース別）" />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {distanceStats.filter(e => e.trendData.length >= 2).map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedDistId(ev.id)}
                    style={{
                      background: (selectedStat?.id === ev.id) ? theme.accentDeep : theme.surfaceMid,
                      border: `1px solid ${(selectedStat?.id === ev.id) ? theme.accent : theme.border}`,
                      color: (selectedStat?.id === ev.id) ? '#fff' : theme.textDim,
                      borderRadius: 20, padding: '4px 12px', fontSize: 12,
                      cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
                    }}
                  >{ev.name}</button>
                ))}
              </div>
              {selectedStat && selectedStat.trendData.length >= 2 && (
                <>
                  <div style={{ color: theme.textDim, fontSize: 11, marginBottom: 8 }}>
                    タイム↓ = 記録更新
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={selectedStat.trendData}>
                      <XAxis dataKey="date" tick={{ fill: theme.textDim, fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: unknown) => [formatTime(v as number), 'タイム']}
                      />
                      <ReferenceLine
                        y={selectedStat.best}
                        stroke={theme.accentBright}
                        strokeDasharray="4 3"
                        label={{ value: 'PR', position: 'insideRight', fill: theme.accentBright, fontSize: 10 }}
                      />
                      <Line type="monotone" dataKey="ms" stroke={theme.accent} strokeWidth={2} dot={{ r: 3, fill: theme.accent }} />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </Card>
          )}

          {/* ── 4. 月別記録数 ── */}
          {monthlyData.length > 1 && (
            <Card>
              <SectionHeader title="月別記録数" />
              <ResponsiveContainer width="100%" height={110}>
                <BarChart data={monthlyData} barSize={28}>
                  <XAxis dataKey="month" tick={{ fill: theme.textDim, fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [`${v} 回`, '記録数']} />
                  <Bar dataKey="count" fill={theme.accent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
