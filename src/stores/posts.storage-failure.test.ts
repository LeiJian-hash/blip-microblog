import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { StorageLike } from '@/lib/storage'

const storageRef: { current: StorageLike | null } = { current: null }

vi.mock('@/lib/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/storage')>()
  return {
    ...actual,
    getBrowserStorage: () => storageRef.current,
  }
})

const { usePostsStore } = await import('./posts')

function createStorage(options: { failOnWrite?: boolean } = {}): StorageLike {
  const map = new Map<string, string>()

  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      if (options.failOnWrite && key === 'blip.posts.v1') {
        throw new Error('QuotaExceededError')
      }
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

describe('usePostsStore 在存储不可用时', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storageRef.current = null
  })

  it('给出持久化提示，但仍可在内存中发布', () => {
    const store = usePostsStore()

    expect(store.storageError).not.toBeNull()

    const result = store.publish({ content: '内存里的动态', author: '阿蓝' })

    expect(result.ok).toBe(true)
    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].content).toBe('内存里的动态')
  })

  it('删除与清空仍然可用', () => {
    const store = usePostsStore()
    store.publish({ content: 'a', author: '' })
    store.publish({ content: 'b', author: '' })

    store.remove(store.posts[0].id)
    expect(store.count).toBe(1)

    store.clear()
    expect(store.isEmpty).toBe(true)
  })
})

describe('usePostsStore 在写入失败时', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    storageRef.current = createStorage({ failOnWrite: true })
  })

  it('发布后提示保存失败，但内存状态已更新', () => {
    const store = usePostsStore()

    expect(store.storageError).toBeNull()

    store.publish({ content: '写入会失败', author: '' })

    expect(store.posts).toHaveLength(1)
    expect(store.storageError).toBe('保存失败：本地存储空间不足或被禁用。')
  })
})
