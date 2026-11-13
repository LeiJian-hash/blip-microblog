import { describe, expect, it } from 'vitest'
import {
  AUTHOR_KEY,
  POSTS_KEY,
  getBrowserStorage,
  readAuthor,
  readPosts,
  writeAuthor,
  writePosts,
  type StorageLike,
} from './storage'

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

const post = {
  id: 'p1',
  author: '阿蓝',
  content: '你好',
  createdAt: 1_700_000_000_000,
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

describe('readPosts / writePosts', () => {
  it('写入后可读回', () => {
    const storage = createFakeStorage()
    expect(writePosts([post], storage)).toBe(true)
    expect(readPosts(storage)).toEqual([post])
    expect(storage.getItem(POSTS_KEY)).toContain('你好')
  })

  it('没有数据时返回空数组', () => {
    expect(readPosts(createFakeStorage())).toEqual([])
  })

  it('JSON 损坏时返回空数组', () => {
    const storage = createFakeStorage({ getItem: () => '{oops' })
    expect(readPosts(storage)).toEqual([])
  })

  it('存储的不是数组时返回空数组', () => {
    const storage = createFakeStorage({ getItem: () => '{"posts":[]}' })
    expect(readPosts(storage)).toEqual([])
  })

  it('无存储可用时写入返回 false', () => {
    expect(writePosts([post], null)).toBe(false)
    expect(readPosts(null)).toEqual([])
  })

  it('写入抛错时返回 false 而不抛出', () => {
    const storage = createFakeStorage({
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(writePosts([post], storage)).toBe(false)
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
})
