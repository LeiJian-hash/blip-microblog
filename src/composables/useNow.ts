import { onScopeDispose, shallowRef } from 'vue'

/**
 * 共享的“当前时间”：定时刷新，让相对时间文案保持准确。
 * 依赖作用域销毁时自动清理定时器。
 */
export function useNow(intervalMs = 60_000) {
  const now = shallowRef(Date.now())

  const timer = setInterval(() => {
    now.value = Date.now()
  }, intervalMs)

  onScopeDispose(() => {
    clearInterval(timer)
  })

  return now
}
