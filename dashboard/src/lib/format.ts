export function formatUptime(ms: number): string {
  if (!ms || ms < 0) return '—'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

export function formatShards(value: number | null): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatClock(time: number): string {
  const d = new Date(time)
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function formatPosition(p: { x: number; y: number; z: number } | null) {
  if (!p) return '—'
  return `${p.x}, ${p.y}, ${p.z}`
}
