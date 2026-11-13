import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  REQUEST_TIMEOUT_MS,
  clearPosts,
  createPost,
  deletePost,
  fetchPosts,
} from './posts'

const post = {
  id: 'p1',
  author: '阿蓝',
  content: '你好',
  createdAt: 1_700_000_000_000,
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

describe('网络异常', () => {
  it('fetch 抛错时转换成可读中文错误', async () => {
    stubNetworkError()

    const error = await fetchPosts().catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as Error).message).toBe('网络异常，请检查连接后重试。')
  })

  it('超时后中止请求并转换成可读中文错误', async () => {
    vi.useFakeTimers()

    try {
      const mock = vi.fn(
        (_input: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'))
            })
          }),
      )
      vi.stubGlobal('fetch', mock)

      const pending = fetchPosts().catch((cause: unknown) => cause)
      // 让出一次微任务，确保 request 已经调用 fetch 并挂好中止监听
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)
      const error = await pending

      expect(mock.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal)
      expect(error).toBeInstanceOf(ApiError)
      expect((error as Error).message).toBe('网络异常，请检查连接后重试。')
    } finally {
      vi.useRealTimers()
    }
  })
})
