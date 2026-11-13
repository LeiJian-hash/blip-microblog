# Blip · 微动态

一个极简的「微动态」应用：发布、查看、删除短消息，并可以给动态点赞、收藏。

- **前端**：Vue 3（`<script setup>` + TypeScript）+ Pinia + Vite
- **后端**：Hono + `@hono/node-server`，RESTful API，数据保存在**进程内存**中（重启即清空，刻意不落盘）
- **工程**：全流程 TDD，Vitest + Vue Test Utils + jsdom；领域校验规则前后端共用一份

> 项目名称与界面均为自行设计，不使用任何第三方平台的名称或标识。

## 功能

- **发布**：正文上限 280 字，实时字数统计（剩余 40 字变黄、超出变红并禁用发布），可自定义昵称，`Ctrl / Cmd + Enter` 快捷发布
- **查看**：按时间倒序展示，相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期），每分钟自动刷新
- **点赞**：`♥ / ♡` 胶囊按钮，已点赞高亮并显示累计数；点赞总数由服务端维护，重复点击不会重复计数
- **收藏**：`★ / ☆` 胶囊按钮，已收藏显示「已收藏」；时间线右上角的「收藏 N」可切换只看收藏，没有收藏时展示专属空态
- **删除**：单条二次确认删除、一键清空全部（同样二次确认）
- **状态反馈**：请求中显示「正在同步…」，失败时展示服务端返回的中文错误文案；点赞/收藏只禁用对应按钮，不打断其他操作
- **健壮性**：请求 10 秒超时、并发请求期间禁用发布/删除/清空、发布失败保留草稿、首屏 GET 与写操作交错时丢弃过期快照
- **安全**：内容一律以纯文本插值渲染，不使用 `v-html`

## 快速开始

需要 Node.js 20+。前后端分两个终端启动：

```bash
npm install

# 终端 1：后端（默认 http://127.0.0.1:8787）
npm run start:server      # 或 npm run dev:server（tsx watch 热重载）

# 终端 2：前端（http://localhost:5173，/api 已代理到 8787）
npm run dev
```

生产构建：

```bash
npm run build     # vue-tsc 类型检查 + vite build
npm run preview   # 预览 dist（仍需后端在 8787 运行）
```

后端端口可用 `PORT` 覆盖；前端代理目标可用 `API_TARGET` 覆盖：

```bash
PORT=9000 npm run start:server
API_TARGET=http://127.0.0.1:9000 npm run dev
```

## REST API

Base URL `/api`，请求与响应均为 JSON。

| 方法 | 路径 | 说明 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/health` | 健康检查 | 200 `{ status: "ok" }` | — |
| GET | `/api/posts` | 全部动态，最新在前 | 200 `{ posts: Post[] }` | — |
| POST | `/api/posts` | 新建动态，body `{ author?, content }` | 201 `{ post: Post }` | 400 / 413 `{ error }` |
| DELETE | `/api/posts/:id` | 删除单条 | 204（无 body） | 404 `{ error: "动态不存在" }` |
| PUT | `/api/posts/:id/like` | 设为已点赞（幂等） | 200 `{ post: Post }` | 404 `{ error: "动态不存在" }` |
| DELETE | `/api/posts/:id/like` | 取消点赞（幂等） | 200 `{ post: Post }` | 404 `{ error: "动态不存在" }` |
| PUT | `/api/posts/:id/favorite` | 设为已收藏（幂等） | 200 `{ post: Post }` | 404 `{ error: "动态不存在" }` |
| DELETE | `/api/posts/:id/favorite` | 取消收藏（幂等） | 200 `{ post: Post }` | 404 `{ error: "动态不存在" }` |
| DELETE | `/api/posts` | 清空全部 | 204（无 body） | — |

```ts
type Post = {
  id: string           // crypto.randomUUID()
  author: string       // 昵称，≤ 16 字，留空时服务端填充「匿名用户」
  content: string      // 正文，≤ 280 字
  createdAt: number    // 毫秒时间戳
  likes: number        // 点赞总数，最小 0
  liked: boolean       // 当前使用者是否已点赞
  favorited: boolean   // 当前使用者是否已收藏
}
```

点赞/收藏接口都返回**更新后的完整动态**，客户端直接用响应替换本地条目，计数不在前端做加法，避免两端漂移；重复 PUT/DELETE 是幂等的，不会把计数加/减两次。

校验错误文案（400）：`内容不能为空`、`内容不能超过 280 字`、`昵称不能超过 16 字`、`昵称必须是字符串`、`请求体不是合法的 JSON`。

请求体上限 8KB（超过返回 413 `{ "error": "请求体过大" }`），避免把超大 body 读进内存后才校验。

统一兜底：未知路径 404 `{ "error": "接口不存在" }`；路由内未捕获异常 500 `{ "error": "服务内部错误" }`（堆栈只写服务端日志，不出现在响应里）；`HTTPException` 保留自身状态码与响应体。

服务端默认只监听 `127.0.0.1`，不会暴露到局域网。

示例：

```bash
curl -X POST http://127.0.0.1:8787/api/posts \
  -H 'Content-Type: application/json' \
  -d '{"author":"阿蓝","content":"第一条动态"}'
```

## 测试

```bash
npm run test          # 监听模式（前后端全部）
npm run test:run      # 单次运行
npm run test:server   # 只跑后端
npm run typecheck     # vue-tsc 类型检查
```

当前 **11 个测试文件 / 212 个用例**全部通过：服务端 54 个、前后端共享的领域层 38 个、前端界面 120 个。

| 测试文件 | 覆盖内容 |
| --- | --- |
| `src/domain/post.test.ts` | 草稿校验（含昵称 16 字上限）、归一化、动态构造、脏数据过滤、点赞计数与收藏状态的纯函数 |
| `src/utils/time.test.ts` | 相对时间、绝对时间、头像首字 |
| `src/api/posts.test.ts` | 成功解析、错误体文案、非 JSON 兜底、网络异常与 10 秒超时兜底、点赞/收藏的 PUT/DELETE 方法与 URL 编码 |
| `src/lib/storage.test.ts` | 昵称偏好的读写与不可用降级 |
| `src/stores/posts.test.ts` | 加载/发布/删除/清空的成功与失败、本地校验拦截、并发 pending、过期快照与过期失败、404 幂等删除、点赞/收藏的替换语义与 `reacting` 时序 |
| `src/components/PostComposer.test.ts` | 计数、禁用态（含请求中）、提交成功清空/失败保留草稿、快捷键、错误提示 |
| `src/components/PostItem.test.ts` | 渲染、XSS 防护、二次确认删除、请求中禁用删除、点赞/收藏的图标与 `aria-pressed`、事件与按钮禁用 |
| `src/components/PostList.test.ts` | 空状态、列表顺序、删除/点赞/收藏事件转发、`reacting` 映射为单条禁用 |
| `src/App.test.ts` | 首屏加载、发布、失败提示与草稿保留、请求中禁用、删除、清空、重新挂载恢复、点赞计数随服务端更新、收藏筛选与空态 |
| `server/app.test.ts` | HTTP 契约：状态码、错误文案、最新在前、204/404、昵称上限、413 请求体上限、HTTPException 状态码、四条点赞/收藏路由与幂等 |
| `server/repository.test.ts` | 内存仓储：数组与元素副本隔离、插入顺序、`update` 原位替换、remove 返回值、注入时钟/ID |

### TDD 过程

所有实现都是「先红后绿」：先写会失败的测试并运行确认失败，再补实现让测试通过。当前版本由两个子代理并行推进：

1. **后端子代理**：`server/repository.test.ts` → `server/app.test.ts` → 实现仓储与 Hono 路由
2. **前端子代理**：`src/api/posts.test.ts` → `src/stores/posts.test.ts` → `src/App.test.ts` → 实现 API 客户端、异步 store 与页面
3. **主会话**：进度跟踪、代码审查（分层与错误处理）、真机 HTTP 验收与内置浏览器验收

迁移完成后又做了一轮渗透式审查与加固，同样先红后绿：审查子代理定位缺陷（store 并发覆盖、服务端无体积上限、草稿丢失等），再逐条补失败用例：

- 后端：昵称 16 字上限下沉到共享领域层、8KB 请求体上限（413）、`HTTPException` 保留状态码、仓储元素级副本、相对导入统一 `.js`、只监听 `127.0.0.1`
- 前端：10 秒请求超时、并发请求计数式 `pending`、`load` 与写操作交错时丢弃过期快照、404 删除幂等、请求中禁用发布/删除/清空、发布失败保留草稿

### v4 点赞与收藏：Git Worktree 并行

这一版用 Git Worktree 把前后端彻底隔离后并行实现，三个代理各管一段：

1. **主会话**：先落地共享领域契约（`Post` 新增 `likes/liked/favorited`、`setLiked/setFavorited`、`EMPTY_REACTIONS`）并提交，作为两条分支的共同基线——契约唯一，避免两端各写一套
2. **后端子代理**（worktree `feat/reactions-backend`）：`server/repository.test.ts` → `server/app.test.ts` → 实现 `update(id, change)` 与四条幂等路由，只碰 `server/**`
3. **前端子代理**（worktree `feat/reactions-frontend`）：`src/api/posts.test.ts` → `src/stores/posts.test.ts` → `src/components/*.test.ts` → `src/App.test.ts` → 实现 API 客户端、`reacting` 状态、互动按钮与收藏筛选，只碰 `src/**`（`domain/` 只读）
4. **主会话合并**：两条分支改动文件互不重叠，冲突只出现在双方都触碰的导入行与共享测试夹具上，逐处按「两套语义都保留」合并（例如 `PostItem` 同时接受全局 `busy` 与单条 `reacting`），再进行真机 HTTP 验收与浏览器点击验收

## 目录结构

```
.
├── index.html                  # Vite 入口
├── server
│   ├── app.ts                  # Hono 应用：只做 HTTP 层
│   ├── repository.ts           # 进程内存仓储（可注入时钟与 ID 生成器）
│   └── index.ts                # Node 启动入口（PORT 可配，默认只监听 127.0.0.1）
├── src
│   ├── main.ts                 # 创建应用、注册 Pinia
│   ├── App.vue                 # 编排：加载 / 发布 / 删除 / 点赞 / 收藏 / 筛选 / 清空
│   ├── api/posts.ts            # REST 客户端封装（ApiError 统一错误，含 10 秒超时与互动接口）
│   ├── assets/main.css         # 全局变量与基础样式
│   ├── components
│   │   ├── PostComposer.vue    # 发布框，拥有草稿状态
│   │   ├── PostItem.vue        # 单条动态：删除确认、点赞与收藏按钮
│   │   └── PostList.vue        # 列表、空状态、事件转发与单条禁用映射
│   ├── composables/useNow.ts   # 共享时钟（每分钟刷新）
│   ├── domain/post.ts          # 纯函数：校验（280 字 / 16 字昵称）、归一化、构造、点赞收藏状态、脏数据过滤（前后端共用）
│   ├── lib/storage.ts          # 仅存昵称偏好（界面偏好，不是业务数据）
│   └── stores/posts.ts         # Pinia store：唯一状态拥有者，异步动作
└── vite.config.ts              # Vite + Vitest + /api 代理
```

## 架构要点

- **前后端共享领域规则**：`src/domain/post.ts` 被 BFF 与客户端同时引用，280 字上限、默认昵称、空内容判定只有一处定义，避免两端漂移。
- **HTTP 层薄、仓储被动**：`server/app.ts` 只负责解析、状态码与响应；`server/repository.ts` 只负责存放与顺序，时钟与 ID 可注入以便确定性测试。
- **单一状态源 + 异步动作**：动态列表只存在于 `usePostsStore`，`load/publish/remove/clear` 都是 `async`，失败写入 `error` 而不抛到组件层。
- **并发自洽**：`pending` 是进行中请求的计数而非布尔量；写操作会推进版本号，`load` 落地前核对版本与序号，过期快照直接丢弃，避免首屏 GET 覆盖刚发布/刚删除的结果。
- **组件边界清晰**：`PostComposer` 通过 `onSubmit(draft): Promise<boolean>` 上报草稿，只有返回 `true` 才清空输入框；`PostItem` 只发 `delete(id)` / `like(id)` / `favorite(id)`；页面在 `App.vue` 里编排。
- **互动状态以服务端为准**：点赞与收藏接口返回更新后的完整动态，store 只做「按 id 替换」，计数不在前端加减；`reacting` 记录 `` `${id}:like` `` 这类键，只禁用对应按钮，不复用全局 `pending`，因此点收藏不会让整页显示「正在同步…」。
- **错误可读**：API 客户端把非 2xx、网络异常与 10 秒超时统一翻译成中文 `ApiError`，界面直接展示。

## 已知限制（刻意的 MVP 取舍）

- 数据在进程内存中，**重启后端即清空**，且只适用于单进程部署
- 无鉴权、无分页、无编辑功能；无幂等键，也没有服务端并发冲突处理
- 点赞/收藏没有用户体系：`liked` / `favorited` 是服务端唯一一份状态，所有访问者共享；`likes` 只是累计计数，无法追溯是谁点的
- 昵称作为界面偏好仍存 localStorage；业务数据已不在浏览器侧
- 过期快照被丢弃后，列表以本地已确认的写结果为准，需下次刷新才能看到其他客户端的改动
- 无乐观更新与自动重试；错误提示没有手动关闭入口，只在下一次操作时清空
- 正文按 UTF-16 码元计长（与 280 字上限同口径），一个 emoji 算 2 字

## 版本历史

- **v1**：纯 HTML + CSS + JavaScript 单页实现，数据存 localStorage
- **v2**：以 TDD 方式重写为 Node.js + Vue 3 + Pinia，仍用 localStorage
- **v3**：新增 Hono + REST + 内存存储，前端改为通过 API 读写
- **v4**：新增点赞与收藏（幂等的 PUT/DELETE 接口、`reacting` 单条禁用、收藏筛选与空态），以 Git Worktree 并行实现前后端后合并（当前版本）
