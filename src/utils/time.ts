const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** 相对时间：刚刚 / N 分钟前 / N 小时前 / N 天前 / MM-DD HH:mm */
export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - timestamp)

  if (diff < MINUTE) return '刚刚'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} 分钟前`
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 小时前`
  if (diff < WEEK) return `${Math.floor(diff / DAY)} 天前`

  const date = new Date(timestamp)
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

/** 完整时间，用于 hover 提示 */
export function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', { hour12: false })
}

/** 头像首字 */
export function initialOf(name: string): string {
  const trimmed = name.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : '匿'
}
