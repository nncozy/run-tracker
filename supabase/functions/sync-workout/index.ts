import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 認証: X-API-Key ヘッダー（ショートカット用）または JWT の両方を受け付ける
  let userId: string | null = null

  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('api_key', apiKey)
      .single()
    userId = profile?.id ?? null
  } else {
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } },
      )
      const { data: { user } } = await supabaseUser.auth.getUser()
      userId = user?.id ?? null
    }
  }

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json().catch(() => ({}))
  const workouts: unknown[] = body.workouts ?? []

  if (workouts.length === 0) {
    return new Response(JSON.stringify({ synced: 0 }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const rows = workouts.map((w: any) => ({
    user_id: userId,
    external_id: w.external_id ?? crypto.randomUUID(),
    workout_date: w.workout_date,
    start_time: w.start_time ?? null,
    duration_seconds: w.duration_seconds != null ? Math.round(w.duration_seconds) : null,
    distance_meters: w.distance_meters ?? null,
    avg_pace_sec_per_km: w.avg_pace_sec_per_km != null ? Math.round(w.avg_pace_sec_per_km) : null,
    avg_heart_rate: w.avg_heart_rate != null ? Math.round(w.avg_heart_rate) : null,
    max_heart_rate: w.max_heart_rate != null ? Math.round(w.max_heart_rate) : null,
    avg_cadence: w.avg_cadence != null ? Math.round(w.avg_cadence) : null,
    elevation_gain: w.elevation_gain ?? null,
    calories_active: w.calories_active != null ? Math.round(w.calories_active) : null,
    vo2max: w.vo2max ?? null,
    hr_zone1_seconds: w.hr_zone1_seconds != null ? Math.round(w.hr_zone1_seconds) : null,
    hr_zone2_seconds: w.hr_zone2_seconds != null ? Math.round(w.hr_zone2_seconds) : null,
    hr_zone3_seconds: w.hr_zone3_seconds != null ? Math.round(w.hr_zone3_seconds) : null,
    hr_zone4_seconds: w.hr_zone4_seconds != null ? Math.round(w.hr_zone4_seconds) : null,
    hr_zone5_seconds: w.hr_zone5_seconds != null ? Math.round(w.hr_zone5_seconds) : null,
    status: 'pending',
  }))

  // external_id が同じものは重複なので無視（再送対策）
  const { error } = await supabaseAdmin
    .from('health_activities')
    .upsert(rows, { onConflict: 'user_id,external_id', ignoreDuplicates: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ synced: rows.length }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
