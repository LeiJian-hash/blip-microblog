import { describe, expect, it } from 'vitest'
import { AUTHOR_KEY, getBrowserStorage, readAuthor, writeAuthor, type StorageLike } from './storage'

function createFakeStorage(overrides: Partial<StorageLike> = {}): StorageLike {
  const map = new Map<string, string>()

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
    ...overrides,
  }
}

describe('getBrowserStorage', () => {
  it('在可用环境中返回可读写的存储', () => {
    const storage = getBrowserStorage()
    expect(storage).not.toBeNull()

    storage!.setItem('__probe__', '1')
    expect(storage!.getItem('__probe__')).toBe('1')
    storage!.removeItem('__probe__')
  })

  it('写入抛错时视为不可用', () => {
    const broken = createFakeStorage({
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })

    expect(getBrowserStorage(broken)).toBeNull()
  })
})

describe('readAuthor / writeAuthor', () => {
  it('写入后可读回', () => {
    const storage = createFakeStorage()
    expect(writeAuthor('阿蓝', storage)).toBe(true)
    expect(readAuthor(storage)).toBe('阿蓝')
    expect(storage.getItem(AUTHOR_KEY)).toBe('阿蓝')
  })

  it('没有数据时返回空字符串', () => {
    expect(readAuthor(createFakeStorage())).toBe('')
    expect(readAuthor(null)).toBe('')
  })

  it('无存储可用时写入返回 false', () => {
    expect(writeAuthor('阿蓝', null)).toBe(false)
  })

  it('写入抛错时返回 false 而不抛出', () => {
    const storage = createFakeStorage({
      setItem: () => {
        throw new Error('quota')
      },
    })

    expect(writeAuthor('阿蓝', storage)).toBe(false)
  })
})
