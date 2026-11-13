import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { AUTHOR_KEY, POSTS_KEY } from '@/lib/storage'
import { MAX_CONTENT_LENGTH } from '@/domain/post'
import { usePostsStore } from './posts'

function readStoredPosts(): unknown[] {
  const raw = localStorage.getItem(POSTS_KEY)
  return raw ? (JSON.parse(raw) as unknown[]) : []
}

describe('usePostsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('没有已存数据时初始为空', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.count).toBe(0)
    expect(store.isEmpty).toBe(true)
    expect(store.author).toBe('')
    expect(store.storageError).toBeNull()
  })

  it('发布后新动态排在最前', () => {
    const store = usePostsStore()

    store.publish({ content: '第一条', author: '阿蓝' })
    store.publish({ content: '第二条', author: '阿蓝' })

    expect(store.posts.map((post) => post.content)).toEqual(['第二条', '第一条'])
    expect(store.count).toBe(2)
    expect(store.isEmpty).toBe(false)
  })

  it('发布后写入 localStorage 并记住昵称', () => {
    const store = usePostsStore()
    const result = store.publish({ content: '  你好  ', author: '  阿蓝  ' })

    expect(result.ok).toBe(true)
    expect(readStoredPosts()).toHaveLength(1)
    expect(store.posts[0]).toMatchObject({ author: '阿蓝', content: '你好' })
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('阿蓝')
  })

  it('未填昵称时使用默认昵称', () => {
    const store = usePostsStore()
    store.publish({ content: '你好', author: '   ' })

    expect(store.posts[0].author).toBe('匿名用户')
  })

  it('空内容不发布也不写存储', () => {
    const store = usePostsStore()
    const result = store.publish({ content: '   ', author: '' })

    expect(result).toEqual({ ok: false, error: '内容不能为空' })
    expect(store.posts).toHaveLength(0)
    expect(localStorage.getItem(POSTS_KEY)).toBeNull()
  })

  it('超出字数上限不发布', () => {
    const store = usePostsStore()
    const result = store.publish({ content: 'a'.repeat(MAX_CONTENT_LENGTH + 1), author: '' })

    expect(result).toEqual({ ok: false, error: `内容不能超过 ${MAX_CONTENT_LENGTH} 字` })
    expect(store.posts).toHaveLength(0)
  })

  it('从 localStorage 恢复动态与昵称', () => {
    localStorage.setItem(
      POSTS_KEY,
      JSON.stringify([
        { id: 'b', author: '阿蓝', content: '更新的', createdAt: 2 },
        { id: 'a', author: '阿蓝', content: '更早的', createdAt: 1 },
      ]),
    )
    localStorage.setItem(AUTHOR_KEY, '阿蓝')

    setActivePinia(createPinia())
    const store = usePostsStore()

    expect(store.posts.map((post) => post.content)).toEqual(['更新的', '更早的'])
    expect(store.author).toBe('阿蓝')
  })

  it('损坏的存储数据不会中断初始化', () => {
    localStorage.setItem(POSTS_KEY, '{not-json')

    setActivePinia(createPinia())
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.storageError).toBeNull()
  })

  it('删除指定动态并同步存储', () => {
    const store = usePostsStore()
    store.publish({ content: '保留', author: '' })
    const kept = store.posts[0]
    store.publish({ content: '删除我', author: '' })

    store.remove(store.posts[0].id)

    expect(store.posts).toHaveLength(1)
    expect(store.posts[0].id).toBe(kept.id)
    expect(readStoredPosts()).toHaveLength(1)
  })

  it('删除不存在的 id 不改变列表', () => {
    const store = usePostsStore()
    store.publish({ content: '保留', author: '' })

    store.remove('missing')

    expect(store.posts).toHaveLength(1)
  })

  it('清空全部动态并写入空数组', () => {
    const store = usePostsStore()
    store.publish({ content: 'a', author: '' })
    store.publish({ content: 'b', author: '' })

    store.clear()

    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
    expect(readStoredPosts()).toEqual([])
  })

  it('setAuthor 去除空白并持久化', () => {
    const store = usePostsStore()

    store.setAuthor('  小明 ')

    expect(store.author).toBe('小明')
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('小明')
  })
})
