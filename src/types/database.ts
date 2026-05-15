export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  api_key: string | null
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
  profiles?: Profile
}

export interface RunEvent {
  id: string
  name: string
  distance_meters: number | null
  is_preset: boolean
  created_by: string | null
  room_id: string | null
  created_at: string
}

export interface RunRecord {
  id: string
  user_id: string
  room_id: string | null
  event_id: string
  time_ms: number
  recorded_at: string
  recorded_at_time: string | null
  avg_heart_rate: number | null
  max_heart_rate: number | null
  comment: string | null
  created_at: string
  updated_at: string
  events?: RunEvent
  profiles?: Profile
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
