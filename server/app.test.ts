// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createPostRepository } from './repository'

function setup() {
  const repository = createPostRepository({
    now: () => 1700000000000,
    generateId: () => 'generated-id',
  })

  return { repository, app: createApp({ repository }) }
}

async function postJson(app: ReturnType<typeof setup>['app'], body: unknown) {
  return app.request('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
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
