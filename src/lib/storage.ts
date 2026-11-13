export const AUTHOR_KEY = 'blip.author.v1'

const PROBE_KEY = '__blip_storage_probe__'

/** 只依赖 Web Storage 的三件套，便于测试注入 */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function readLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    // 某些浏览器在隐私模式下访问 localStorage 会直接抛错
    return null
  }
}

/** 探测存储是否真的可写；不可用时返回 null */
export function getBrowserStorage(
  candidate: StorageLike | null = readLocalStorage(),
): StorageLike | null {
  if (!candidate) return null

  try {
    candidate.setItem(PROBE_KEY, '1')
    candidate.removeItem(PROBE_KEY)
    return candidate
  } catch {
    return null
  }
}

export function readAuthor(storage: StorageLike | null = getBrowserStorage()): string {
  if (!storage) return ''

  try {
    return storage.getItem(AUTHOR_KEY) ?? ''
  } catch {
    return ''
  }
}

export function writeAuthor(
  author: string,
  storage: StorageLike | null = getBrowserStorage(),
): boolean {
  if (!storage) return false

  try {
    storage.setItem(AUTHOR_KEY, author)
    return true
  } catch {
    return false
  }
}
