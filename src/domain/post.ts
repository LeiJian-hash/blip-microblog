/** 单条动态的最大字数 */
export const MAX_CONTENT_LENGTH = 280

/** 昵称的最大字数，按去除首尾空白后的长度计算 */
export const MAX_AUTHOR_LENGTH = 16

/** 未填写昵称时使用的作者名 */
export const DEFAULT_AUTHOR = '匿名用户'

export interface Post {
  id: string
  author: string
  content: string
  createdAt: number
  /** 点赞总数，最小为 0 */
  likes: number
  /** 当前使用者是否已点赞（MVP 无鉴权，服务端只保存一份状态） */
  liked: boolean
  /** 当前使用者是否已收藏（同上，无双用户区分） */
  favorited: boolean
}

/** 新建动态时的互动状态：零赞、未点赞、未收藏 */
export const EMPTY_REACTIONS = { likes: 0, liked: false, favorited: false } as const

export interface PostDraft {
  content: string
  author: string
}

/** 校验草稿，返回错误文案；合法时返回 null */
export function validateDraft(draft: PostDraft): string | null {
  const content = draft.content.trim()
  const author = draft.author.trim()

  if (!content) return '内容不能为空'
  if (content.length > MAX_CONTENT_LENGTH) return `内容不能超过 ${MAX_CONTENT_LENGTH} 字`
  // 空昵称会回落成默认昵称，只有填写了昵称才需要校验长度
  if (author.length > MAX_AUTHOR_LENGTH) return `昵称不能超过 ${MAX_AUTHOR_LENGTH} 字`

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
    ...EMPTY_REACTIONS,
  }
}

/** 设置点赞状态；计数器跟着状态变化，重复调用同一个状态不改变计数 */
export function setLiked(post: Post, liked: boolean): Post {
  if (post.liked === liked) return post

  const likes = Math.max(0, post.likes + (liked ? 1 : -1))

  return { ...post, liked, likes }
}

/** 设置收藏状态；收藏不影响点赞计数 */
export function setFavorited(post: Post, favorited: boolean): Post {
  if (post.favorited === favorited) return post

  return { ...post, favorited }
}

export function isPost(value: unknown): value is Post {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.author === 'string' &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'number' &&
    Number.isFinite(candidate.createdAt) &&
    typeof candidate.likes === 'number' &&
    Number.isFinite(candidate.likes) &&
    candidate.likes >= 0 &&
    typeof candidate.liked === 'boolean' &&
    typeof candidate.favorited === 'boolean'
  )
}
