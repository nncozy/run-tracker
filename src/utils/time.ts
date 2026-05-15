export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const min = Math.floor((totalSec % 3600) / 60)
  const sec = totalSec % 60
  const cs = Math.floor((ms % 1000) / 10)
  const csStr = String(cs).padStart(2, '0')
  const secStr = String(sec).padStart(2, '0')
  if (h > 0) return `${h}:${String(min).padStart(2, '0')}:${secStr}.${csStr}`
  if (min === 0) return `${sec}.${csStr}`
  return `${min}:${secStr}.${csStr}`
}

export function parseTime(input: string): number | null {
  const trimmed = input.trim()
  const withMinutes = /^(\d+):(\d{1,2})(?:\.(\d{1,2}))?$/.exec(trimmed)
  if (withMinutes) {
    const min = parseInt(withMinutes[1])
    const sec = parseInt(withMinutes[2])
    const cs = parseInt((withMinutes[3] ?? '0').padEnd(2, '0'))
    return min * 60 * 1000 + sec * 1000 + cs * 10
  }
  const noMinutes = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed)
  if (noMinutes) {
    const sec = parseInt(noMinutes[1])
    const cs = parseInt((noMinutes[2] ?? '0').padEnd(2, '0'))
    return sec * 1000 + cs * 10
  }
  return null
}

export function formatPace(secPerKm: number): string {
  const min = Math.floor(secPerKm / 60)
  const sec = secPerKm % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}分`
  return `${h}h${String(m).padStart(2, '0')}m`
}

export function formatRecordedAt(date: string, time?: string | null): string {
  const [y, m, d] = date.split('-')
  return time ? `${y}/${m}/${d} (${time})` : `${y}/${m}/${d}`
}

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

export function nowTimeString(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
