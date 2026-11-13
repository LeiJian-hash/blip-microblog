import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { createPostRepository } from './repository.js'

const port = Number(process.env.PORT ?? 8787) || 8787
const hostname = '127.0.0.1'
const app = createApp({ repository: createPostRepository() })

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`动态服务已启动，监听地址：http://${hostname}:${info.port}`)
})
