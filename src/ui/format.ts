export function formatMoney(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    const body = Number.isInteger(m) || m >= 10 ? m.toFixed(0) : m.toFixed(1)
    return `${sign}$${body}M`
  }
  if (abs >= 1000) {
    const k = abs / 1000
    const body = k >= 10 ? Math.round(k).toString() : k.toFixed(1).replace(/\.0$/, '')
    return `${sign}$${body}k`
  }
  return `${sign}$${Math.round(abs)}`
}

export function formatSignedMoney(n: number): string {
  if (n > 0) return `+${formatMoney(n)}`
  return formatMoney(n)
}

export function formatWeek(week: number, total: number): string {
  return `Week ${week}/${total}`
}

export function deadlineTone(weeksLeft: number): 'ok' | 'urgent' | 'late' {
  if (weeksLeft < 0) return 'late'
  if (weeksLeft <= 3) return 'urgent'
  return 'ok'
}
