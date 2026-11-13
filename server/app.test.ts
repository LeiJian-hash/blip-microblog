// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../src/domain/post'
import { createApp } from './app'
import { createPostRepository } from './repository'

function setup() {
  const repository = createPostRepository({
    now: () => 1700000000000,
    generateId: () => 'generated-id',
  })

  return { repository, app: createApp({ repository }) }
}

type App = ReturnType<typeof setup>['app']

async function postJson(app: App, body: unknown) {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

/** 建好一条动态，供点赞/收藏接口复用 */
async function setupWithPost() {
  const context = setup()
  await postJson(context.app, { content: '待互动的动态' })

  return context
}

/** 已存在动态的完整快照，互动接口只在它基础上改互动字段 */
const BASE_POST: Post = {
  id: 'generated-id',
  author: '匿名用户',
  content: '待互动的动态',
  createdAt: 1700000000000,
  likes: 0,
  liked: false,
  favorited: false,
}

/** 读取 `{ post }` 响应体 */
async function readPost(response: Response): Promise<Post> {
  const data = (await response.json()) as { post: Post }

  return data.post
}

/** 调用点赞/收藏接口；PUT 表示设置，DELETE 表示取消 */
async function react(
  app: App,
  method: 'PUT' | 'DELETE',
  reaction: 'like' | 'favorite',
  id = BASE_POST.id,
) {
  return app.request(`/api/posts/${id}/${reaction}`, { method })
}

describe('GET /api/health', () => {
  it('返回 200 与 ok 状态', async () => {
    const { app } = setup()

    const response = await app.request('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})

describe('GET /api/posts', () => {
  it('空数据时返回空数组', async () => {
    const { app } = setup()

    const response = await app.request('/api/posts')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ posts: [] })
  })

  it('按最新在前返回全部动态', async () => {
    const { app } = setup()
    await postJson(app, { content: '旧的' })
    await postJson(app, { content: '新的' })

    const response = await app.request('/api/posts')
    const data = (await response.json()) as { posts: Array<{ content: string }> }

    expect(data.posts.map((post) => post.content)).toEqual(['新的', '旧的'])
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201 与完整动态，未填昵称回落到默认昵称', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: '  第一条动态  ' })
    const data = (await response.json()) as { post: Record<string, unknown> }

    expect(response.status).toBe(201)
    expect(data.post).toEqual({
      id: 'generated-id',
      author: '匿名用户',
      content: '第一条动态',
      createdAt: 1700000000000,
      likes: 0,
      liked: false,
      favorited: false,
    })
  })

  it('保留自定义昵称', async () => {
    const { app } = setup()

    const response = await postJson(app, { author: ' 阿蓝 ', content: '你好' })
    const data = (await response.json()) as { post: { author: string } }

    expect(response.status).toBe(201)
    expect(data.post.author).toBe('阿蓝')
  })

  it('内容恰好 280 字时允许创建', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: '一'.repeat(280) })

    expect(response.status).toBe(201)
  })

  it('内容为空时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: '' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '内容不能为空' })
  })

  it('内容为纯空白时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: '   \n  ' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '内容不能为空' })
  })

  it('内容超过 280 字时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: '一'.repeat(281) })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '内容不能超过 280 字' })
  })

  it('请求体不是合法 JSON 时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, '{ not json')

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '请求体不是合法的 JSON' })
  })

  it('content 不是字符串时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, { content: 123 })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '内容不能为空' })
  })

  it('author 存在但不是字符串时返回 400', async () => {
    const { app } = setup()

    const response = await postJson(app, { author: 42, content: '合法内容' })

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: '昵称必须是字符串' })
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功返回 204 且无响应体', async () => {
    const { app } = setup()
    await postJson(app, { content: '待删除' })

    const response = await app.request('/api/posts/generated-id', { method: 'DELETE' })
    const listResponse = await app.request('/api/posts')
    const data = (await listResponse.json()) as { posts: unknown[] }

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(data.posts).toEqual([])
  })

  it('id 不存在时返回 404', async () => {
    const { app } = setup()

    const response = await app.request('/api/posts/missing', { method: 'DELETE' })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '动态不存在' })
  })
})

describe('DELETE /api/posts', () => {
  it('清空全部动态返回 204 且无响应体', async () => {
    const { app } = setup()
    await postJson(app, { content: '第一条' })
    await postJson(app, { content: '第二条' })

    const response = await app.request('/api/posts', { method: 'DELETE' })
    const listResponse = await app.request('/api/posts')
    const data = (await listResponse.json()) as { posts: unknown[] }

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(data.posts).toEqual([])
  })
})

describe('未知路径与异常', () => {
  it('未定义的 API 路径返回 JSON 404', async () => {
    const { app } = setup()

    const response = await app.request('/api/unknown')

    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: '接口不存在' })
  })

  it('路由内部抛错时返回 JSON 500，而不是泄漏堆栈', async () => {
    const { app } = setup()
    app.get('/api/boom', () => {
      throw new Error('内部错误细节')
    })

    const response = await app.request('/api/boom')
    const data = (await response.json()) as { error: string }

    expect(response.status).toBe(500)
    expect(data).toEqual({ error: '服务内部错误' })
  })
})

describe('PUT /api/posts/:id/like', () => {
  it('点赞成功返回 200 与更新后的完整动态', async () => {
    const { app } = await setupWithPost()

    const response = await react(app, 'PUT', 'like')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual({ ...BASE_POST, likes: 1, liked: true })
  })

  it('重复点赞保持幂等，点赞数始终为 1', async () => {
    const { app } = await setupWithPost()

    await react(app, 'PUT', 'like')
    const response = await react(app, 'PUT', 'like')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual({ ...BASE_POST, likes: 1, liked: true })
  })

  it('id 不存在时返回 404 与中文错误文案', async () => {
    const { app } = setup()

    const response = await react(app, 'PUT', 'like', 'missing')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '动态不存在' })
  })
})

describe('DELETE /api/posts/:id/like', () => {
  it('取消点赞后点赞数回到 0 且 liked 为 false', async () => {
    const { app } = await setupWithPost()
    await react(app, 'PUT', 'like')

    const response = await react(app, 'DELETE', 'like')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual({ ...BASE_POST, likes: 0, liked: false })
  })

  it('未点赞时取消点赞幂等，计数不会小于 0', async () => {
    const { app } = await setupWithPost()

    const response = await react(app, 'DELETE', 'like')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual(BASE_POST)
  })

  it('id 不存在时返回 404 与中文错误文案', async () => {
    const { app } = setup()

    const response = await react(app, 'DELETE', 'like', 'missing')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '动态不存在' })
  })
})

describe('PUT /api/posts/:id/favorite', () => {
  it('收藏成功返回 200，只改 favorited 不动点赞', async () => {
    const { app } = await setupWithPost()

    const response = await react(app, 'PUT', 'favorite')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual({ ...BASE_POST, favorited: true })
  })

  it('重复收藏保持幂等', async () => {
    const { app } = await setupWithPost()

    await react(app, 'PUT', 'favorite')
    const response = await react(app, 'PUT', 'favorite')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual({ ...BASE_POST, favorited: true })
  })

  it('id 不存在时返回 404 与中文错误文案', async () => {
    const { app } = setup()

    const response = await react(app, 'PUT', 'favorite', 'missing')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '动态不存在' })
  })
})

describe('DELETE /api/posts/:id/favorite', () => {
  it('取消收藏后 favorited 回到 false', async () => {
    const { app } = await setupWithPost()
    await react(app, 'PUT', 'favorite')

    const response = await react(app, 'DELETE', 'favorite')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual(BASE_POST)
  })

  it('未收藏时取消收藏幂等', async () => {
    const { app } = await setupWithPost()

    const response = await react(app, 'DELETE', 'favorite')

    expect(response.status).toBe(200)
    expect(await readPost(response)).toEqual(BASE_POST)
  })

  it('id 不存在时返回 404 与中文错误文案', async () => {
    const { app } = setup()

    const response = await react(app, 'DELETE', 'favorite', 'missing')

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: '动态不存在' })
  })
})

describe('点赞与收藏互不影响', () => {
  it('两种互动状态各自独立累加与撤销', async () => {
    const { app } = await setupWithPost()

    await react(app, 'PUT', 'like')
    await react(app, 'PUT', 'favorite')
    const both = await readPost(await react(app, 'PUT', 'favorite'))
    expect(both).toEqual({ ...BASE_POST, likes: 1, liked: true, favorited: true })

    const unfavorited = await readPost(await react(app, 'DELETE', 'favorite'))
    expect(unfavorited).toEqual({ ...BASE_POST, likes: 1, liked: true, favorited: false })

    const unliked = await readPost(await react(app, 'DELETE', 'like'))
    expect(unliked).toEqual({ ...BASE_POST, likes: 0, liked: false, favorited: false })
  })
})

describe('GET /api/posts 反映互动状态', () => {
  it('点赞与收藏后列表条目带上最新状态', async () => {
    const { app } = await setupWithPost()
    await react(app, 'PUT', 'like')
    await react(app, 'PUT', 'favorite')

    const response = await app.request('/api/posts')
    const data = (await response.json()) as { posts: Post[] }

    expect(response.status).toBe(200)
    expect(data.posts).toEqual([{ ...BASE_POST, likes: 1, liked: true, favorited: true }])
  })

  it('互动不改写动态本身的内容与创建时间', async () => {
    const { app } = await setupWithPost()

    await react(app, 'PUT', 'like')
    const response = await app.request('/api/posts')
    const data = (await response.json()) as { posts: Post[] }
    const [post] = data.posts

    expect(post!.id).toBe(BASE_POST.id)
    expect(post!.author).toBe(BASE_POST.author)
    expect(post!.content).toBe(BASE_POST.content)
    expect(post!.createdAt).toBe(BASE_POST.createdAt)
  })
})
