import type { Post } from '../src/domain/post'
import { createId } from '../src/domain/post'

export interface PostRepositoryOptions {
  /** 当前时间戳来源，默认 Date.now */
  now?: () => number
  /** 唯一 ID 生成器，默认 crypto.randomUUID */
  generateId?: () => string
}

export interface PostRepository {
  /** 返回最新在前的动态数组副本 */
  list(): Post[]
  /** 把动态插到列表最前 */
  add(post: Post): void
  /**
   * 按 ID 就地改写一条动态：命中时用 `change` 返回的对象原位替换（顺序不变）并返回它，
   * 未命中返回 null。供点赞/收藏这类只改局部状态的场景使用，调用方拿不到内部数组。
   */
  update(id: string, change: (post: Post) => Post): Post | null
  /** 删除指定 ID 的动态，返回是否删除成功 */
  remove(id: string): boolean
  /** 清空全部动态 */
  clear(): void
  /** 当前动态条数 */
  size(): number
  /** 读取注入的时钟 */
  now(): number
  /** 读取注入的 ID 生成器 */
  nextId(): string
}

/** 创建进程内存中的动态仓储，重启即丢失 */
export function createPostRepository(options: PostRepositoryOptions = {}): PostRepository {
  const clock = options.now ?? Date.now
  const generateId = options.generateId ?? createId
  const posts: Post[] = []

  return {
    list() {
      // 返回副本，避免外部改动污染内部数组
      return [...posts]
    },
    add(post) {
      posts.unshift(post)
    },
    update(id, change) {
      const index = posts.findIndex((post) => post.id === id)
      if (index === -1) return null

      // 原位替换保持列表顺序，change 返回同一引用时也不破坏原有数据
      const updated = change(posts[index]!)
      posts[index] = updated
      return updated
    },
    remove(id) {
      const index = posts.findIndex((post) => post.id === id)
      if (index === -1) return false

      posts.splice(index, 1)
      return true
    },
    clear() {
      posts.length = 0
    },
    size() {
      return posts.length
    },
    now: clock,
    nextId: generateId,
  }
}
