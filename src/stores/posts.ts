import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { normalizeDraft, validateDraft, type Post, type PostDraft } from '@/domain/post'
import { clearPosts, createPost, deletePost, fetchPosts } from '@/api/posts'
import { getBrowserStorage, readAuthor, writeAuthor } from '@/lib/storage'

export type PublishResult = { ok: true; post: Post } | { ok: false; error: string }

/** 兜底文案：服务端与网络错误已由 api 层翻译，这里只接住意外异常 */
const UNKNOWN_ERROR = '操作失败，请稍后重试。'

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
  /** 是否有请求正在进行，供界面展示加载态与禁用操作 */
  const pending = shallowRef(false)
  const error = shallowRef<string | null>(null)

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

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

  /** 从服务端拉取全量动态 */
  async function load(): Promise<void> {
    pending.value = true
    error.value = null

    try {
      posts.value = await fetchPosts()
    } catch (cause) {
      error.value = toMessage(cause)
    } finally {
      pending.value = false
    }
  }

  /** 发布动态：先本地校验，成功则交给服务端并插到列表最前 */
  async function publish(draft: PostDraft): Promise<PublishResult> {
    const message = validateDraft(draft)
    if (message) return { ok: false, error: message }

    pending.value = true
    error.value = null

    try {
      const post = await createPost(normalizeDraft(draft))
      posts.value = [post, ...posts.value]
      rememberAuthor(draft.author)

      return { ok: true, post }
    } catch (cause) {
      const reason = toMessage(cause)
      error.value = reason

      return { ok: false, error: reason }
    } finally {
      pending.value = false
    }
  }

  /** 删除单条动态，成功后才更新本地列表 */
  async function remove(id: string): Promise<void> {
    pending.value = true
    error.value = null

    try {
      await deletePost(id)
      posts.value = posts.value.filter((post) => post.id !== id)
    } catch (cause) {
      error.value = toMessage(cause)
    } finally {
      pending.value = false
    }
  }

  /** 清空全部动态，成功后才清空本地列表 */
  async function clear(): Promise<void> {
    pending.value = true
    error.value = null

    try {
      await clearPosts()
      posts.value = []
    } catch (cause) {
      error.value = toMessage(cause)
    } finally {
      pending.value = false
    }
  }

  return {
    posts,
    author,
    pending,
    error,
    count,
    isEmpty,
    load,
    publish,
    remove,
    clear,
    setAuthor,
  }
})
