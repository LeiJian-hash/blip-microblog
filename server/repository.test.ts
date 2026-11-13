// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../src/domain/post'
import { createPostRepository } from './repository'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    author: '阿蓝',
    content: '第一条动态',
    createdAt: 1,
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
