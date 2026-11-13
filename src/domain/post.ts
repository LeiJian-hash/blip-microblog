/** 单条动态的最大字数 */
export const MAX_CONTENT_LENGTH = 280

/** 未填写昵称时使用的作者名 */
export const DEFAULT_AUTHOR = '匿名用户'

export interface Post {
  id: string
  author: string
  content: string
  createdAt: number
}

export interface PostDraft {
  content: string
  author: string
}

/** 校验草稿，返回错误文案；合法时返回 null */
export function validateDraft(draft: PostDraft): string | null {
  const content = draft.content.trim()

  if (!content) return '内容不能为空'
  if (content.length > MAX_CONTENT_LENGTH) return `内容不能超过 ${MAX_CONTENT_LENGTH} 字`

  return null
}

/** 去除首尾空白，昵称为空时回落到默认昵称 */
export function normalizeDraft(draft: PostDraft): PostDraft {
  return {
    content: draft.content.trim(),
    author: draft.author.trim() || DEFAULT_AUTHOR,
  }
}

export function createId(): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }
  return `post_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function createPost(
  draft: PostDraft,
  options: { id?: string; now?: number } = {},
): Post {
  const normalized = normalizeDraft(draft)

  return {
    id: options.id ?? createId(),
    author: normalized.author,
    content: normalized.content,
    createdAt: options.now ?? Date.now(),
  }
}

export function isPost(value: unknown): value is Post {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.author === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt)
  )
}

/** 解析存储中的动态数组，过滤掉结构异常的记录 */
export function parseStoredPosts(raw: unknown): Post[] {
  if (!Array.isArray(raw)) return []

  return raw.filter(isPost)
}
