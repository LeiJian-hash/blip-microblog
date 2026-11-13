import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { EMPTY_REACTIONS, MAX_CONTENT_LENGTH, type Post } from '@/domain/post'
import {
  ApiError,
  clearPosts,
  createPost,
  deletePost,
  fetchPosts,
  setPostFavorited,
  setPostLiked,
} from '@/api/posts'
import { AUTHOR_KEY } from '@/lib/storage'
import { usePostsStore } from './posts'

// 只替换网络调用，保留 ApiError 等真实导出，便于断言错误类型
vi.mock('@/api/posts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/posts')>()

  return {
    ...actual,
    fetchPosts: vi.fn(),
    createPost: vi.fn(),
    deletePost: vi.fn(),
    clearPosts: vi.fn(),
    setPostLiked: vi.fn(),
    setPostFavorited: vi.fn(),
  }
})

const mockedFetchPosts = vi.mocked(fetchPosts)
const mockedCreatePost = vi.mocked(createPost)
const mockedDeletePost = vi.mocked(deletePost)
const mockedClearPosts = vi.mocked(clearPosts)
const mockedSetPostLiked = vi.mocked(setPostLiked)
const mockedSetPostFavorited = vi.mocked(setPostFavorited)

function createFakePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '阿蓝',
    content: '你好',
    createdAt: 1_700_000_000_000,
    ...EMPTY_REACTIONS,
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return { promise, resolve }
}

describe('usePostsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockedDeletePost.mockResolvedValue(undefined)
    mockedClearPosts.mockResolvedValue(undefined)
  })

  it('初始状态为空且没有请求错误', () => {
    const store = usePostsStore()

    expect(store.posts).toEqual([])
    expect(store.count).toBe(0)
    expect(store.isEmpty).toBe(true)
    expect(store.pending).toBe(false)
    expect(store.error).toBeNull()
    expect(store.author).toBe('')
  })

  it('load 成功后按服务端顺序写入动态', async () => {
    mockedFetchPosts.mockResolvedValue([
      createFakePost({ id: 'b', content: '更新的', createdAt: 2 }),
      createFakePost({ id: 'a', content: '更早的', createdAt: 1 }),
    ])

    const store = usePostsStore()
    await store.load()

    expect(mockedFetchPosts).toHaveBeenCalledTimes(1)
    expect(store.posts.map((post) => post.content)).toEqual(['更新的', '更早的'])
    expect(store.count).toBe(2)
    expect(store.isEmpty).toBe(false)
    expect(store.error).toBeNull()
  })

  it('load 失败时把错误写进 error 而不抛到组件层', async () => {
    mockedFetchPosts.mockRejectedValue(new Error('无法连接到服务器'))

    const store = usePostsStore()

    await expect(store.load()).resolves.toBeUndefined()

    expect(store.error).toBe('无法连接到服务器')
    expect(store.posts).toEqual([])
    expect(store.pending).toBe(false)
  })

  it('load 期间 pending 为 true，结束后恢复 false', async () => {
    const gate = deferred<Post[]>()
    mockedFetchPosts.mockReturnValue(gate.promise)

    const store = usePostsStore()
    const loading = store.load()

    expect(store.pending).toBe(true)

    gate.resolve([createFakePost()])
    await loading

    expect(store.pending).toBe(false)
  })

  it('publish 成功后把新动态插到最前，并把去空白的草稿交给 API', async () => {
    const created = createFakePost({ id: 'new', content: '你好', author: '阿蓝' })
    mockedCreatePost.mockResolvedValue(created)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'old', content: '旧的' })]

    const result = await store.publish({ content: '  你好  ', author: '  阿蓝  ' })

    expect(result).toEqual({ ok: true, post: created })
    expect(mockedCreatePost).toHaveBeenCalledWith({ content: '你好', author: '阿蓝' })
    expect(store.posts.map((post) => post.id)).toEqual(['new', 'old'])
    expect(store.error).toBeNull()
    expect(store.pending).toBe(false)
  })

  it('publish 成功后会清空上一次的错误', async () => {
    mockedFetchPosts.mockRejectedValue(new Error('加载失败'))
    mockedCreatePost.mockResolvedValue(createFakePost())

    const store = usePostsStore()
    await store.load()
    expect(store.error).toBe('加载失败')

    await store.publish({ content: '你好', author: '' })

    expect(store.error).toBeNull()
  })

  it('空内容被本地校验拦截，不发请求', async () => {
    const store = usePostsStore()

    const result = await store.publish({ content: '   ', author: '' })

    expect(result).toEqual({ ok: false, error: '内容不能为空' })
    expect(mockedCreatePost).not.toHaveBeenCalled()
    expect(store.posts).toEqual([])
    expect(store.error).toBeNull()
  })

  it('超长内容被本地校验拦截，不发请求', async () => {
    const store = usePostsStore()

    const result = await store.publish({
      content: 'a'.repeat(MAX_CONTENT_LENGTH + 1),
      author: '',
    })

    expect(result).toEqual({ ok: false, error: `内容不能超过 ${MAX_CONTENT_LENGTH} 字` })
    expect(mockedCreatePost).not.toHaveBeenCalled()
  })

  it('publish 失败时返回错误且不抛异常', async () => {
    mockedCreatePost.mockRejectedValue(new Error('发布失败：服务暂时不可用'))

    const store = usePostsStore()

    const result = await store.publish({ content: '你好', author: '' })

    expect(result).toEqual({ ok: false, error: '发布失败：服务暂时不可用' })
    expect(store.error).toBe('发布失败：服务暂时不可用')
    expect(store.posts).toEqual([])
    expect(store.pending).toBe(false)
  })

  it('publish 成功后记住昵称并持久化', async () => {
    mockedCreatePost.mockResolvedValue(createFakePost({ author: '小明' }))

    const store = usePostsStore()
    await store.publish({ content: '你好', author: '  小明  ' })

    expect(store.author).toBe('小明')
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('小明')
  })

  it('未填昵称时不会覆盖已保存的昵称', async () => {
    mockedCreatePost.mockResolvedValue(createFakePost({ author: '匿名用户' }))

    const store = usePostsStore()
    store.setAuthor('阿蓝')

    await store.publish({ content: '你好', author: '   ' })

    expect(store.author).toBe('阿蓝')
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('阿蓝')
  })

  it('remove 调用接口并把动态从列表移除', async () => {
    const store = usePostsStore()
    store.posts = [
      createFakePost({ id: 'keep', content: '保留' }),
      createFakePost({ id: 'drop', content: '删除我' }),
    ]

    await store.remove('drop')

    expect(mockedDeletePost).toHaveBeenCalledWith('drop')
    expect(store.posts.map((post) => post.id)).toEqual(['keep'])
  })

  it('remove 失败时保留列表并记录错误', async () => {
    mockedDeletePost.mockRejectedValue(new Error('动态不存在'))

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'keep' })]

    await expect(store.remove('keep')).resolves.toBeUndefined()

    expect(store.posts).toHaveLength(1)
    expect(store.error).toBe('动态不存在')
  })

  it('clear 调用接口并清空列表', async () => {
    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' }), createFakePost({ id: 'b' })]

    await store.clear()

    expect(mockedClearPosts).toHaveBeenCalledTimes(1)
    expect(store.posts).toEqual([])
    expect(store.isEmpty).toBe(true)
  })

  it('clear 失败时保留列表并记录错误', async () => {
    mockedClearPosts.mockRejectedValue(new Error('清空失败'))

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' })]

    await store.clear()

    expect(store.posts).toHaveLength(1)
    expect(store.error).toBe('清空失败')
  })

  it('load 与 publish 交错时，迟到的旧快照不会覆盖刚发布的动态', async () => {
    const gate = deferred<Post[]>()
    mockedFetchPosts.mockReturnValue(gate.promise)
    mockedCreatePost.mockResolvedValue(createFakePost({ id: 'new', content: '刚发布' }))

    const store = usePostsStore()
    const loading = store.load()

    await store.publish({ content: '刚发布', author: '' })

    // 首屏 GET 的快照里没有这条新动态，落地时不能把它冲掉
    gate.resolve([createFakePost({ id: 'old', content: '旧的' })])
    await loading

    expect(store.posts.map((post) => post.id)).toEqual(['new'])
    expect(store.error).toBeNull()
  })

  it('过期的 load 失败不覆盖更新请求的结果', async () => {
    const store = usePostsStore()
    mockedFetchPosts.mockRejectedValueOnce(new Error('第一次加载失败'))

    const first = store.load()

    mockedFetchPosts.mockResolvedValueOnce([createFakePost({ id: 'fresh' })])
    const second = store.load()

    await Promise.all([first, second])

    expect(store.error).toBeNull()
    expect(store.posts.map((post) => post.id)).toEqual(['fresh'])
  })

  it('并发请求期间 pending 保持为 true，全部结束才复位', async () => {
    const publishGate = deferred<Post>()
    const removeGate = deferred<void>()
    mockedCreatePost.mockReturnValue(publishGate.promise)
    mockedDeletePost.mockReturnValue(removeGate.promise)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'drop' })]

    const publishing = store.publish({ content: '你好', author: '' })
    const removing = store.remove('drop')

    expect(store.pending).toBe(true)

    publishGate.resolve(createFakePost({ id: 'new' }))
    await publishing
    expect(store.pending).toBe(true)

    removeGate.resolve()
    await removing
    expect(store.pending).toBe(false)
  })

  it('remove 遇到 404 时按幂等处理：移除本地条目且不报错', async () => {
    mockedDeletePost.mockRejectedValue(new ApiError('动态不存在', 404))

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'gone' }), createFakePost({ id: 'keep' })]

    await store.remove('gone')

    expect(store.posts.map((post) => post.id)).toEqual(['keep'])
    expect(store.error).toBeNull()
  })

  it('toggleLike 用服务端返回的动态替换该条目并保持顺序', async () => {
    const liked = createFakePost({ id: 'a', content: '被赞的', likes: 1, liked: true })
    mockedSetPostLiked.mockResolvedValue(liked)

    const store = usePostsStore()
    const first = createFakePost({ id: 'a', content: '被赞的' })
    const second = createFakePost({ id: 'b', content: '不动的' })
    store.posts = [first, second]

    await store.toggleLike('a')

    expect(mockedSetPostLiked).toHaveBeenCalledWith('a', true)
    expect(store.posts.map((post) => post.id)).toEqual(['a', 'b'])
    expect(store.posts[0]).toBe(liked)
    expect(store.posts[1]).toBe(second)
    expect(store.posts[0].likes).toBe(1)
    expect(store.error).toBeNull()
  })

  it('toggleLike 已点赞时请求取消点赞', async () => {
    mockedSetPostLiked.mockResolvedValue(createFakePost({ id: 'a', likes: 0, liked: false }))

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a', likes: 1, liked: true })]

    await store.toggleLike('a')

    expect(mockedSetPostLiked).toHaveBeenCalledWith('a', false)
  })

  it('toggleLike 失败时写入 error 且条目保持不变', async () => {
    mockedSetPostLiked.mockRejectedValue(new Error('动态不存在'))

    const store = usePostsStore()
    const original = createFakePost({ id: 'a' })
    store.posts = [original]

    await expect(store.toggleLike('a')).resolves.toBeUndefined()

    expect(store.error).toBe('动态不存在')
    expect(store.posts[0]).toBe(original)
  })

  it('请求进行中 reacting 标记该条目该动作，结束后清空', async () => {
    const gate = deferred<Post>()
    mockedSetPostLiked.mockReturnValue(gate.promise)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' })]

    const toggling = store.toggleLike('a')

    expect(store.reacting).toBe('a:like')

    gate.resolve(createFakePost({ id: 'a', likes: 1, liked: true }))
    await toggling

    expect(store.reacting).toBeNull()
  })

  it('请求进行中重复点击不会发出第二次请求', async () => {
    const gate = deferred<Post>()
    mockedSetPostLiked.mockReturnValue(gate.promise)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' })]

    const first = store.toggleLike('a')
    await store.toggleLike('a')

    expect(mockedSetPostLiked).toHaveBeenCalledTimes(1)

    gate.resolve(createFakePost({ id: 'a', likes: 1, liked: true }))
    await first

    expect(store.posts[0].likes).toBe(1)
    expect(store.reacting).toBeNull()
  })

  it('点赞不会触发全局 pending，页面不会出现同步提示', async () => {
    const gate = deferred<Post>()
    mockedSetPostLiked.mockReturnValue(gate.promise)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' })]

    const toggling = store.toggleLike('a')

    expect(store.pending).toBe(false)

    gate.resolve(createFakePost({ id: 'a', likes: 1, liked: true }))
    await toggling

    expect(store.pending).toBe(false)
  })

  it('id 不在列表里时不发请求', async () => {
    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' })]

    await store.toggleLike('missing')

    expect(mockedSetPostLiked).not.toHaveBeenCalled()
    expect(store.reacting).toBeNull()
  })

  it('toggleFavorite 用服务端返回的动态替换该条目', async () => {
    const favorited = createFakePost({ id: 'a', favorited: true })
    mockedSetPostFavorited.mockResolvedValue(favorited)

    const store = usePostsStore()
    store.posts = [createFakePost({ id: 'a' }), createFakePost({ id: 'b' })]

    await store.toggleFavorite('a')

    expect(mockedSetPostFavorited).toHaveBeenCalledWith('a', true)
    expect(store.posts[0]).toBe(favorited)
  })

  it('toggleFavorite 失败时写入 error 且条目保持不变', async () => {
    mockedSetPostFavorited.mockRejectedValue(new Error('网络异常，请检查连接后重试。'))

    const store = usePostsStore()
    const original = createFakePost({ id: 'a' })
    store.posts = [original]

    await store.toggleFavorite('a')

    expect(store.error).toBe('网络异常，请检查连接后重试。')
    expect(store.posts[0]).toBe(original)
    expect(store.reacting).toBeNull()
  })

  it('favoriteCount 与 favorites 只统计已收藏的动态并保持原顺序', () => {
    const store = usePostsStore()
    store.posts = [
      createFakePost({ id: 'a', content: '收藏一', favorited: true }),
      createFakePost({ id: 'b', content: '没收藏' }),
      createFakePost({ id: 'c', content: '收藏二', favorited: true }),
    ]

    expect(store.favoriteCount).toBe(2)
    expect(store.favorites.map((post) => post.id)).toEqual(['a', 'c'])
  })

  it('setAuthor 去除空白并持久化', () => {
    const store = usePostsStore()

    store.setAuthor('  小明 ')

    expect(store.author).toBe('小明')
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('小明')
  })

  it('初始化时从本地读取昵称', () => {
    localStorage.setItem(AUTHOR_KEY, '阿蓝')

    const store = usePostsStore()

    expect(store.author).toBe('阿蓝')
  })
})
