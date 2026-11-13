// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../src/domain/post'
import { EMPTY_REACTIONS, setFavorited, setLiked } from '../src/domain/post'
import { createPostRepository } from './repository'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    author: '阿蓝',
    content: '第一条动态',
    createdAt: 1,
    ...EMPTY_REACTIONS,
    ...overrides,
  }
}

describe('createPostRepository', () => {
  it('初始为空数组', () => {
    const repository = createPostRepository()

    expect(repository.list()).toEqual([])
    expect(repository.size()).toBe(0)
  })

  it('add 会把新动态插到最前，list 最新在前', () => {
    const repository = createPostRepository()

    repository.add(makePost({ id: 'a', content: '旧' }))
    repository.add(makePost({ id: 'b', content: '新' }))

    expect(repository.list().map((post) => post.id)).toEqual(['b', 'a'])
    expect(repository.size()).toBe(2)
  })

  it('list 返回新数组副本，外部改动不会污染内部存储', () => {
    const repository = createPostRepository()
    repository.add(makePost())

    const first = repository.list()
    first.pop()
    first.push(makePost({ id: 'injected' }))

    expect(repository.list()).toHaveLength(1)
    expect(repository.list()[0]!.id).toBe('post-1')
    expect(repository.list()).not.toBe(repository.list())
  })

  it('remove 命中时返回 true 并删除该条动态', () => {
    const repository = createPostRepository()
    repository.add(makePost({ id: 'a' }))
    repository.add(makePost({ id: 'b' }))

    expect(repository.remove('a')).toBe(true)
    expect(repository.list().map((post) => post.id)).toEqual(['b'])
  })

  it('remove 未命中时返回 false 且不影响已有数据', () => {
    const repository = createPostRepository()
    repository.add(makePost())

    expect(repository.remove('missing')).toBe(false)
    expect(repository.size()).toBe(1)
  })

  it('clear 会清空全部动态', () => {
    const repository = createPostRepository()
    repository.add(makePost({ id: 'a' }))
    repository.add(makePost({ id: 'b' }))

    repository.clear()

    expect(repository.list()).toEqual([])
    expect(repository.size()).toBe(0)
  })

  it('可注入时钟与 ID 生成器', () => {
    const repository = createPostRepository({
      now: () => 1700000000000,
      generateId: () => 'fixed-id',
    })

    expect(repository.now()).toBe(1700000000000)
    expect(repository.nextId()).toBe('fixed-id')
  })

  it('默认使用 Date.now 与 crypto.randomUUID 作为时钟和 ID 来源', () => {
    const repository = createPostRepository()

    expect(Number.isFinite(repository.now())).toBe(true)
    expect(repository.nextId()).toMatch(/^[0-9a-f-]{36}$/i)
  })
})

describe('PostRepository.update', () => {
  it('命中时返回 change 的结果，并原位替换、保持顺序不变', () => {
    const repository = createPostRepository()
    repository.add(makePost({ id: 'a', content: '旧' }))
    repository.add(makePost({ id: 'b', content: '新' }))
    repository.add(makePost({ id: 'c', content: '更旧' }))

    const updated = repository.update('b', (post) => setLiked(post, true))

    expect(updated).toEqual(makePost({ id: 'b', content: '新', likes: 1, liked: true }))
    expect(repository.list().map((post) => post.id)).toEqual(['c', 'b', 'a'])
    expect(repository.size()).toBe(3)
  })

  it('未命中时返回 null 且不改变仓储内容', () => {
    const repository = createPostRepository()
    repository.add(makePost({ id: 'a' }))

    const updated = repository.update('missing', (post) => setLiked(post, true))

    expect(updated).toBeNull()
    expect(repository.list()).toEqual([makePost({ id: 'a' })])
  })

  it('change 返回同一引用时仓储保持原样', () => {
    const repository = createPostRepository()
    const original = makePost({ likes: 5, liked: true })
    repository.add(original)

    const updated = repository.update('post-1', (post) => setLiked(post, true))

    expect(updated).toBe(original)
    expect(repository.list()).toHaveLength(1)
    expect(repository.list()[0]).toEqual(makePost({ likes: 5, liked: true }))
  })

  it('更新结果对后续 list 可见，且 list 仍返回数组副本', () => {
    const repository = createPostRepository()
    repository.add(makePost())

    repository.update('post-1', (post) => setFavorited(post, true))

    const first = repository.list()
    first.length = 0

    expect(repository.list()).toHaveLength(1)
    expect(repository.list()[0]).toEqual(makePost({ favorited: true }))
    expect(repository.list()).not.toBe(repository.list())
  })

  it('change 只影响目标动态，其他动态保持原引用与内容', () => {
    const repository = createPostRepository()
    const other = makePost({ id: 'other', content: '旁观者' })
    repository.add(makePost({ id: 'target' }))
    repository.add(other)

    repository.update('target', (post) => setLiked(post, true))

    const [newest, oldest] = repository.list()
    expect(newest).toBe(other)
    expect(oldest!.id).toBe('target')
    expect(oldest!.likes).toBe(1)
    expect(oldest!.liked).toBe(true)
  })
})
