import type { Post } from '../src/domain/post.js'
import { createId } from '../src/domain/post.js'

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
      // 数组与元素都返回副本，避免外部改动污染内部存储
      return posts.map((post) => ({ ...post }))
    },
    add(post) {
      // 存入副本，避免调用方之后修改原对象影响存储
      posts.unshift({ ...post })
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
