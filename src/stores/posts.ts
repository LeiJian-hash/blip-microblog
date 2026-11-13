import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { normalizeDraft, validateDraft, type Post, type PostDraft } from '@/domain/post'
import {
  ApiError,
  clearPosts,
  createPost,
  deletePost,
  fetchPosts,
  setPostFavorited,
  setPostLiked,
} from '@/api/posts'
import { getBrowserStorage, readAuthor, writeAuthor } from '@/lib/storage'

export type PublishResult = { ok: true; post: Post } | { ok: false; error: string }

/** 兜底文案：服务端与网络错误已由 api 层翻译，这里只接住意外异常 */
const UNKNOWN_ERROR = '操作失败，请稍后重试。'

/** 服务端已经没有这条动态，删除按幂等处理 */
const NOT_FOUND = 404

/** 把任意异常收敛成可展示的中文文案 */
function toMessage(cause: unknown): string {
  if (cause instanceof Error && cause.message.trim()) return cause.message
  return UNKNOWN_ERROR
}

/**
 * 动态数据源：唯一状态拥有者。
 * 动态列表来自 REST API，昵称仍作为界面偏好保存在 localStorage。
 */
export const usePostsStore = defineStore('posts', () => {
  const storage = getBrowserStorage()

  const posts = shallowRef<Post[]>([])
  const author = shallowRef(storage ? readAuthor(storage) : '')
  const error = shallowRef<string | null>(null)
  /**
   * 正在请求中的互动动作，键为 `${id}:like` / `${id}:favorite`。
   * 只影响对应条目的按钮，不复用 pending，避免出现全局「正在同步…」。
   */
  const reacting = shallowRef<string | null>(null)

  /** 进行中的请求数：并发时不会因为先结束的那个提前收起加载态 */
  const inflight = shallowRef(0)
  const pending = computed(() => inflight.value > 0)

  /**
   * 写操作版本号与 load 序号：
   * 首屏 GET 可能在发布/删除之后才落地，直接用旧快照覆盖会丢数据，所以落地前要核对。
   */
  let writeRevision = 0
  let loadToken = 0

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)
  /** 已收藏的条数，供筛选入口展示 */
  const favoriteCount = computed(() => posts.value.filter((post) => post.favorited).length)
  /** 已收藏的动态，保持与主列表一致的顺序 */
  const favorites = computed(() => posts.value.filter((post) => post.favorited))

  function beginRequest(): void {
    inflight.value += 1
  }

  function endRequest(): void {
    inflight.value -= 1
  }

  function setAuthor(name: string): void {
    author.value = name.trim()
    if (!storage) return

    writeAuthor(author.value, storage)
  }

  /** 记住这次发布用的昵称，空昵称不覆盖已有偏好 */
  function rememberAuthor(name: string): void {
    const trimmed = name.trim()
    if (trimmed && trimmed !== author.value) setAuthor(trimmed)
  }

  /** 从服务端拉取全量动态；若期间已有写操作或更新的 load，则丢弃这份过期快照 */
  async function load(): Promise<void> {
    const token = (loadToken += 1)
    const revision = writeRevision

    beginRequest()
    error.value = null

    try {
      const remote = await fetchPosts()

      const isStale = revision !== writeRevision || token !== loadToken
      if (isStale) return

      posts.value = remote
    } catch (cause) {
      // 已有更新的 load 在跑时，旧请求的失败不代表当前状态
      if (token === loadToken) error.value = toMessage(cause)
    } finally {
      endRequest()
    }
  }

  /** 发布动态：先本地校验，成功则交给服务端并插到列表最前 */
  async function publish(draft: PostDraft): Promise<PublishResult> {
    const message = validateDraft(draft)
    if (message) return { ok: false, error: message }

    beginRequest()
    error.value = null

    try {
      const post = await createPost(normalizeDraft(draft))
      writeRevision += 1
      posts.value = [post, ...posts.value]
      rememberAuthor(draft.author)

      return { ok: true, post }
    } catch (cause) {
      const reason = toMessage(cause)
      error.value = reason

      return { ok: false, error: reason }
    } finally {
      endRequest()
    }
  }

  /** 删除单条动态；服务端已不存在时视为删除成功，避免列表里留下幽灵条目 */
  async function remove(id: string): Promise<void> {
    beginRequest()
    error.value = null

    let removed = false

    try {
      await deletePost(id)
      removed = true
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === NOT_FOUND) {
        removed = true
      } else {
        error.value = toMessage(cause)
      }
    } finally {
      endRequest()
    }

    if (!removed) return

    writeRevision += 1
    posts.value = posts.value.filter((post) => post.id !== id)
  }

  /** 清空全部动态，成功后才清空本地列表 */
  async function clear(): Promise<void> {
    beginRequest()
    error.value = null

    try {
      await clearPosts()
      writeRevision += 1
      posts.value = []
    } catch (cause) {
      error.value = toMessage(cause)
    } finally {
      endRequest()
    }
  }

  /**
   * 点赞 / 收藏的共用流程：取反 → 请求 → 只替换该条目。
   * 计数以服务端返回为准；失败只记录错误，不动本地状态。
   */
  async function toggleReaction(id: string, action: 'like' | 'favorite'): Promise<void> {
    const current = posts.value.find((post) => post.id === id)
    if (!current) return

    // 同一条目的动作进行中时忽略重复点击，避免并发写同一个状态
    if (reacting.value?.startsWith(`${id}:`)) return

    const key = `${id}:${action}`
    reacting.value = key
    error.value = null

    try {
      const updated =
        action === 'like'
          ? await setPostLiked(id, !current.liked)
          : await setPostFavorited(id, !current.favorited)

      // 互动也是写操作：让仍在飞行中的首屏快照作废，避免被旧数据覆盖
      writeRevision += 1
      posts.value = posts.value.map((post) => (post.id === id ? updated : post))
    } catch (cause) {
      error.value = toMessage(cause)
    } finally {
      if (reacting.value === key) reacting.value = null
    }
  }

  function toggleLike(id: string): Promise<void> {
    return toggleReaction(id, 'like')
  }

  function toggleFavorite(id: string): Promise<void> {
    return toggleReaction(id, 'favorite')
  }

  return {
    posts,
    author,
    pending,
    error,
    reacting,
    count,
    isEmpty,
    favoriteCount,
    favorites,
    load,
    publish,
    remove,
    clear,
    toggleLike,
    toggleFavorite,
    setAuthor,
  }
})
