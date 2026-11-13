import { Hono } from 'hono'
import type { Context } from 'hono'
import type { Post, PostDraft } from '../src/domain/post.js'
import {
  createPost,
  normalizeDraft,
  setFavorited,
  setLiked,
  validateDraft,
} from '../src/domain/post.js'
import type { PostRepository } from './repository'

export interface CreateAppOptions {
  repository: PostRepository
}

/** 把未知请求体收窄成可读的键值对象 */
function toBody(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {}

  return payload as Record<string, unknown>
}

/** 点赞/收藏四条路由共用：取 ID、套用领域函数、决定状态码与响应体 */
function applyReaction(
  c: Context,
  repository: PostRepository,
  change: (post: Post) => Post,
): Response {
  const id = c.req.param('id')
  // 路径参数缺失时同样按“动态不存在”处理，不把 undefined 交给仓储
  if (!id) return c.json({ error: '动态不存在' }, 404)

  const post = repository.update(id, change)

  if (!post) return c.json({ error: '动态不存在' }, 404)

  return c.json({ post }, 200)
}

/** 创建 Hono 应用，只负责 HTTP 层，业务校验复用领域模块 */
export function createApp({ repository }: CreateAppOptions): Hono {
  const app = new Hono()

  // 统一的 JSON 兜底：未知路径与未捕获异常都不返回纯文本/堆栈
  app.notFound((c) => c.json({ error: '接口不存在' }, 404))
  app.onError((error, c) => {
    console.error('[blip] 处理请求时发生未捕获异常：', error)
    return c.json({ error: '服务内部错误' }, 500)
  })

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => c.json({ posts: repository.list() }))

  app.post('/api/posts', async (c) => {
    let payload: unknown

    try {
      payload = await c.req.json()
    } catch {
      return c.json({ error: '请求体不是合法的 JSON' }, 400)
    }

    const body = toBody(payload)
    const rawContent = body.content
    const rawAuthor = body.author

    if (typeof rawContent !== 'string') return c.json({ error: '内容不能为空' }, 400)
    if (rawAuthor !== undefined && typeof rawAuthor !== 'string') {
      return c.json({ error: '昵称必须是字符串' }, 400)
    }

    const draft: PostDraft = { content: rawContent, author: rawAuthor ?? '' }
    const normalized = normalizeDraft(draft)
    const invalid = validateDraft(normalized)

    if (invalid) return c.json({ error: invalid }, 400)

    const post = createPost(normalized, { id: repository.nextId(), now: repository.now() })
    repository.add(post)

    return c.json({ post }, 201)
  })

  app.delete('/api/posts/:id', (c) => {
    const removed = repository.remove(c.req.param('id'))

    if (!removed) return c.json({ error: '动态不存在' }, 404)

    return c.body(null, 204)
  })

  // 点赞/收藏都做成幂等的“设为某状态”，重复调用不会重复计数
  app.put('/api/posts/:id/like', (c) =>
    applyReaction(c, repository, (post) => setLiked(post, true)),
  )

  app.delete('/api/posts/:id/like', (c) =>
    applyReaction(c, repository, (post) => setLiked(post, false)),
  )

  app.put('/api/posts/:id/favorite', (c) =>
    applyReaction(c, repository, (post) => setFavorited(post, true)),
  )

  app.delete('/api/posts/:id/favorite', (c) =>
    applyReaction(c, repository, (post) => setFavorited(post, false)),
  )

  app.delete('/api/posts', (c) => {
    repository.clear()

    return c.body(null, 204)
  })

  return app
}
