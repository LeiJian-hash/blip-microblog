import { isPost, type Post, type PostDraft } from '@/domain/post'

/** 接口调用失败时统一抛出的错误，status 为 0 表示没拿到响应 */
export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 网络层失败（断网、服务未启动等）的兜底文案 */
export const NETWORK_ERROR = '网络异常，请检查连接后重试。'
/** 服务端响应无法解读时的兜底文案 */
export const UNKNOWN_ERROR = '请求失败，请稍后重试。'

const POSTS_ENDPOINT = '/api/posts'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** 读取错误响应里的 error 文案，任何异常都回落到中文兜底 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const raw = await response.text()
    if (!raw) return UNKNOWN_ERROR

    const parsed = JSON.parse(raw) as { error?: unknown }
    const message = parsed?.error

    if (typeof message === 'string' && message.trim()) return message.trim()
    return UNKNOWN_ERROR
  } catch {
    return UNKNOWN_ERROR
  }
}

/** 发起请求；网络异常与非 2xx 都转成 ApiError */
async function request(path: string, init: RequestInit): Promise<Response> {
  let response: Response

  try {
    response = await fetch(path, init)
  } catch {
    throw new ApiError(NETWORK_ERROR)
  }

  if (!response.ok) {
    throw new ApiError(await readErrorMessage(response), response.status)
  }

  return response
}

/** 解析成功响应体，格式不对时抛兜底错误 */
async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(UNKNOWN_ERROR, response.status)
  }
}

/** 拉取全部动态（服务端保证最新在前） */
export async function fetchPosts(): Promise<Post[]> {
  const response = await request(POSTS_ENDPOINT, { method: 'GET' })
  const data = await readJson<{ posts?: unknown }>(response)

  if (!Array.isArray(data?.posts)) return []

  return data.posts.filter(isPost)
}

/** 新建一条动态 */
export async function createPost(draft: PostDraft): Promise<Post> {
  const response = await request(POSTS_ENDPOINT, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ author: draft.author, content: draft.content }),
  })
  const data = await readJson<{ post?: unknown }>(response)

  if (!isPost(data?.post)) throw new ApiError(UNKNOWN_ERROR, response.status)

  return data.post
}

/** 删除指定动态，服务端返回 204 无响应体 */
export async function deletePost(id: string): Promise<void> {
  await request(`${POSTS_ENDPOINT}/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/** 清空全部动态，服务端返回 204 无响应体 */
export async function clearPosts(): Promise<void> {
  await request(POSTS_ENDPOINT, { method: 'DELETE' })
}

/**
 * 切换某条动态的互动状态（点赞 / 收藏）。
 * 成功响应里带着更新后的完整动态，计数一律以服务端为准。
 */
async function toggleReaction(
  id: string,
  action: 'like' | 'favorite',
  on: boolean,
): Promise<Post> {
  const response = await request(`${POSTS_ENDPOINT}/${encodeURIComponent(id)}/${action}`, {
    method: on ? 'PUT' : 'DELETE',
  })
  const data = await readJson<{ post?: unknown }>(response)

  if (!isPost(data?.post)) throw new ApiError(UNKNOWN_ERROR, response.status)

  return data.post
}

/** 点赞（on 为 true）或取消点赞（on 为 false），幂等 */
export async function setPostLiked(id: string, liked: boolean): Promise<Post> {
  return toggleReaction(id, 'like', liked)
}

/** 收藏（on 为 true）或取消收藏（on 为 false），幂等 */
export async function setPostFavorited(id: string, favorited: boolean): Promise<Post> {
  return toggleReaction(id, 'favorite', favorited)
}
