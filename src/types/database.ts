export interface Profile {
  id: string
  nickname: string
  created_at: string
}

export interface Room {
  id: string
  name: string
  invite_token: string
  created_by: string
  created_at: string
}

export interface RoomMember {
  room_id: string
  user_id: string
  role: string
  joined_at: string
  users?: Profile
}

export interface UserDistance {
  id: string
  user_id: string
  name: string
  distance_km: number
  usage_count: number
  last_used_at: string
  created_at: string
}

export interface RunRecord {
  id: string
  user_id: string
  distance_id: string | null
  time_ms: number
  run_date: string
  custom_fields: { weather?: string; memo?: string; [key: string]: unknown }
  created_at: string
  user_distances?: UserDistance | null
  users?: Profile
}

export interface HealthActivity {
  id: string
  user_id: string
  external_id: string | null
  workout_date: string
  start_time: string | null
  duration_seconds: number | null
  distance_meters: number | null
  avg_pace_sec_per_km: number | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  avg_cadence: number | null
  elevation_gain: number | null
  calories_active: number | null
  vo2max: number | null
  hr_zone1_seconds: number | null
  hr_zone2_seconds: number | null
  hr_zone3_seconds: number | null
  hr_zone4_seconds: number | null
  hr_zone5_seconds: number | null
  status: 'pending' | 'done' | 'skipped' | null
  record_id: string | null
  synced_at: string
}
