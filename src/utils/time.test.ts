import { describe, expect, it } from 'vitest'
import { formatAbsoluteTime, formatRelativeTime, initialOf } from './time'

const NOW = new Date('2026-11-13T10:00:00+08:00').getTime()
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('一分钟内显示「刚刚」', () => {
    expect(formatRelativeTime(NOW - 30_000, NOW)).toBe('刚刚')
  })

  it('未来时间（时钟偏差）也显示「刚刚」', () => {
    expect(formatRelativeTime(NOW + 5_000, NOW)).toBe('刚刚')
  })

  it('一小时内显示分钟', () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE, NOW)).toBe('5 分钟前')
    expect(formatRelativeTime(NOW - 59 * MINUTE, NOW)).toBe('59 分钟前')
  })

  it('一天内显示小时', () => {
    expect(formatRelativeTime(NOW - 3 * HOUR, NOW)).toBe('3 小时前')
    expect(formatRelativeTime(NOW - 23 * HOUR, NOW)).toBe('23 小时前')
  })

  it('一周内显示天数', () => {
    expect(formatRelativeTime(NOW - 2 * DAY, NOW)).toBe('2 天前')
    expect(formatRelativeTime(NOW - 6 * DAY, NOW)).toBe('6 天前')
  })

  it('超过一周显示日期与时间', () => {
    const stamp = new Date('2026-10-05T08:07:00+08:00').getTime()
    expect(formatRelativeTime(stamp, NOW)).toBe('10-05 08:07')
  })
})

describe('formatAbsoluteTime', () => {
  it('返回包含年份的可读时间', () => {
    expect(formatAbsoluteTime(NOW)).toContain('2026')
  })
})

describe('initialOf', () => {
  it('取昵称首字符并大写', () => {
    expect(initialOf('阿蓝')).toBe('阿')
    expect(initialOf(' bob ')).toBe('B')
  })

  it('昵称为空时回落到默认首字', () => {
    expect(initialOf('')).toBe('匿')
    expect(initialOf('   ')).toBe('匿')
  })
})
