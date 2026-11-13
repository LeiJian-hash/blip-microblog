import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createPostRepository } from './repository'

const port = Number(process.env.PORT ?? 8787) || 8787
const app = createApp({ repository: createPostRepository() })

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`动态服务已启动，监听地址：http://127.0.0.1:${info.port}`)
})
