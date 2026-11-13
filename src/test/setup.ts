import { beforeEach } from 'vitest'

beforeEach(() => {
  // 服务端测试运行在 node 环境，没有 localStorage
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
})
