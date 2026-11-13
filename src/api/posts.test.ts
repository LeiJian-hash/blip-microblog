import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  clearPosts,
  createPost,
  deletePost,
  fetchPosts,
  setPostFavorited,
  setPostLiked,
} from './posts'

const post = {
  id: 'p1',
  author: '阿蓝',
  content: '你好',
  createdAt: 1_700_000_000_000,
  likes: 0,
  liked: false,
  favorited: false,
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response
}

function emptyResponse(status = 204): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input')
    },
    text: async () => '',
  } as unknown as Response
}

type FetchMock = ReturnType<typeof vi.fn<(input: string, init?: RequestInit) => Promise<Response>>>

function stubResponse(response: Response): FetchMock {
  const mock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => response)
  vi.stubGlobal('fetch', mock)

  return mock
}

function stubNetworkError(): FetchMock {
  const mock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => {
    throw new TypeError('Failed to fetch')
  })
  vi.stubGlobal('fetch', mock)

  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPosts', () => {
  it('请求 GET /api/posts 并解析 posts 数组', async () => {
    const mock = stubResponse(jsonResponse({ posts: [post] }))

    const posts = await fetchPosts()

    expect(posts).toEqual([post])
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][0]).toBe('/api/posts')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'GET' })
  })

  it('缺少 posts 字段时返回空数组', async () => {
    stubResponse(jsonResponse({}))

    expect(await fetchPosts()).toEqual([])
  })

  it('响应体不是 JSON 时抛出中文兜底错误', async () => {
    stubResponse({
      ok: false,
      status: 500,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
      text: async () => '<html>oops</html>',
    } as unknown as Response)

    const error = await fetchPosts().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(500)
    expect((error as Error).message).toBe('请求失败，请稍后重试。')
  })
})

describe('createPost', () => {
  it('发送 JSON body 并返回新建动态', async () => {
    const mock = stubResponse(jsonResponse({ post }, 201))

    const created = await createPost({ author: '阿蓝', content: '你好' })

    expect(created).toEqual(post)
    expect(mock.mock.calls[0][0]).toBe('/api/posts')
    expect(mock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: '阿蓝', content: '你好' }),
    })
  })

  it('服务端返回 400 时抛出服务端错误文案', async () => {
    stubResponse(jsonResponse({ error: '内容不能为空' }, 400))

    const error = await createPost({ author: '', content: '' }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(400)
    expect((error as Error).message).toBe('内容不能为空')
  })

  it('响应里缺少合法 post 时抛出兜底错误', async () => {
    stubResponse(jsonResponse({ post: { id: 1 } }, 201))

    const error = await createPost({ author: '', content: '你好' }).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as Error).message).toBe('请求失败，请稍后重试。')
  })
})

describe('deletePost', () => {
  it('请求 DELETE /api/posts/:id 且不发送 body', async () => {
    const mock = stubResponse(emptyResponse())

    await deletePost('a b')

    expect(mock.mock.calls[0][0]).toBe('/api/posts/a%20b')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
    expect((mock.mock.calls[0][1] as RequestInit).body).toBeUndefined()
  })

  it('动态不存在时抛出服务端文案', async () => {
    stubResponse(jsonResponse({ error: '动态不存在' }, 404))

    const error = await deletePost('missing').catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as Error).message).toBe('动态不存在')
  })
})

describe('clearPosts', () => {
  it('请求 DELETE /api/posts 且不发送 body', async () => {
    const mock = stubResponse(emptyResponse())

    await clearPosts()

    expect(mock.mock.calls[0][0]).toBe('/api/posts')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
    expect((mock.mock.calls[0][1] as RequestInit).body).toBeUndefined()
  })
})

describe('setPostLiked', () => {
  it('点赞时用 PUT /api/posts/:id/like 并返回更新后的动态', async () => {
    const updated = { ...post, likes: 1, liked: true }
    const mock = stubResponse(jsonResponse({ post: updated }))

    const result = await setPostLiked('a b', true)

    expect(result).toEqual(updated)
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][0]).toBe('/api/posts/a%20b/like')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'PUT' })
    expect((mock.mock.calls[0][1] as RequestInit).body).toBeUndefined()
  })

  it('取消点赞时用 DELETE /api/posts/:id/like', async () => {
    const updated = { ...post, likes: 0, liked: false }
    const mock = stubResponse(jsonResponse({ post: updated }))

    const result = await setPostLiked('p1', false)

    expect(result).toEqual(updated)
    expect(mock.mock.calls[0][0]).toBe('/api/posts/p1/like')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('动态不存在时透传服务端中文文案', async () => {
    stubResponse(jsonResponse({ error: '动态不存在' }, 404))

    const error = await setPostLiked('missing', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as Error).message).toBe('动态不存在')
  })

  it('响应里的 post 结构非法时抛兜底错误', async () => {
    stubResponse(jsonResponse({ post: { ...post, likes: -1 } }))

    const error = await setPostLiked('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(200)
    expect((error as Error).message).toBe('请求失败，请稍后重试。')
  })
})

describe('setPostFavorited', () => {
  it('收藏时用 PUT /api/posts/:id/favorite 并返回更新后的动态', async () => {
    const updated = { ...post, favorited: true }
    const mock = stubResponse(jsonResponse({ post: updated }))

    const result = await setPostFavorited('p1', true)

    expect(result).toEqual(updated)
    expect(mock.mock.calls[0][0]).toBe('/api/posts/p1/favorite')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'PUT' })
  })

  it('取消收藏时用 DELETE /api/posts/:id/favorite 且 URL 会被编码', async () => {
    const updated = { ...post, favorited: false }
    const mock = stubResponse(jsonResponse({ post: updated }))

    const result = await setPostFavorited('a/b', false)

    expect(result).toEqual(updated)
    expect(mock.mock.calls[0][0]).toBe('/api/posts/a%2Fb/favorite')
    expect(mock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' })
  })

  it('动态不存在时透传服务端中文文案', async () => {
    stubResponse(jsonResponse({ error: '动态不存在' }, 404))

    const error = await setPostFavorited('missing', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
    expect((error as Error).message).toBe('动态不存在')
  })

  it('响应体不是 JSON 时抛兜底错误', async () => {
    stubResponse({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected end of JSON input')
      },
      text: async () => '',
    } as unknown as Response)

    const error = await setPostFavorited('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as Error).message).toBe('请求失败，请稍后重试。')
  })
})

describe('网络异常', () => {
  it('fetch 抛错时转换成可读中文错误', async () => {
    stubNetworkError()

    const error = await fetchPosts().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as Error).message).toBe('网络异常，请检查连接后重试。')
  })

  it('点赞请求断网时转换成可读中文错误', async () => {
    stubNetworkError()

    const error = await setPostLiked('p1', true).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(0)
    expect((error as Error).message).toBe('网络异常，请检查连接后重试。')
  })
})
