export function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  const cs = Math.floor((ms % 1000) / 10)
  if (min === 0) return `${sec}.${String(cs).padStart(2, '0')}`
  return `${min}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
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

export function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}
