import { Hono } from 'hono'
import type { PostDraft } from '../src/domain/post.js'
import { createPost, normalizeDraft, validateDraft } from '../src/domain/post.js'
import type { PostRepository } from './repository'

export interface CreateAppOptions {
  repository: PostRepository
}

/** 把未知请求体收窄成可读的键值对象 */
function toBody(payload: unknown): Record<string, unknown> {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return {}

  return payload as Record<string, unknown>
}

/** 创建 Hono 应用，只负责 HTTP 层，业务校验复用领域模块 */
export function createApp({ repository }: CreateAppOptions): Hono {
  const app = new Hono()

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

  app.delete('/api/posts', (c) => {
    repository.clear()

    return c.body(null, 204)
  })

  return app
}
