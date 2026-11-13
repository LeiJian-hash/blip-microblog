import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { createPost, normalizeDraft, validateDraft, type Post, type PostDraft } from '@/domain/post'
import { getBrowserStorage, readAuthor, readPosts, writeAuthor, writePosts } from '@/lib/storage'

export type PublishResult = { ok: true; post: Post } | { ok: false; error: string }

const STORAGE_UNAVAILABLE = '当前浏览器无法使用本地存储，数据仅保留在内存中。'
const STORAGE_WRITE_FAILED = '保存失败：本地存储空间不足或被禁用。'

/**
 * 动态数据源：唯一状态拥有者。
 * 所有写操作都会同步到 localStorage，失败时只提示，不影响内存中的可用性。
 */
export const usePostsStore = defineStore('posts', () => {
  const storage = getBrowserStorage()

  const posts = shallowRef<Post[]>(storage ? readPosts(storage) : [])
  const author = shallowRef(storage ? readAuthor(storage) : '')
  const storageError = shallowRef<string | null>(storage ? null : STORAGE_UNAVAILABLE)

  const count = computed(() => posts.value.length)
  const isEmpty = computed(() => posts.value.length === 0)

  function persistPosts(): void {
    if (!storage) return
    if (!writePosts(posts.value, storage)) {
      storageError.value = STORAGE_WRITE_FAILED
    }
  }

  function setAuthor(name: string): void {
    author.value = name.trim()
    if (!storage) return

    if (!writeAuthor(author.value, storage)) {
      storageError.value = STORAGE_WRITE_FAILED
    }
  }

  function publish(draft: PostDraft): PublishResult {
    const error = validateDraft(draft)
    if (error) return { ok: false, error }

    const post = createPost(normalizeDraft(draft))
    posts.value = [post, ...posts.value]
    persistPosts()

    const trimmedAuthor = draft.author.trim()
    if (trimmedAuthor && trimmedAuthor !== author.value) {
      setAuthor(trimmedAuthor)
    }

    return { ok: true, post }
  }

  function remove(id: string): void {
    if (!posts.value.some((post) => post.id === id)) return

    posts.value = posts.value.filter((post) => post.id !== id)
    persistPosts()
  }

  function clear(): void {
    posts.value = []
    persistPosts()
  }

  return {
    posts,
    author,
    storageError,
    count,
    isEmpty,
    publish,
    remove,
    clear,
    setAuthor,
  }
})
