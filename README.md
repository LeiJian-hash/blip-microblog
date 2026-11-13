# Blip · 微动态

一个极简的「微动态」应用：发布、查看、删除短消息。

- **前端**：Vue 3（`<script setup>` + TypeScript）+ Pinia + Vite
- **后端**：Hono + `@hono/node-server`，RESTful API，数据保存在**进程内存**中（重启即清空，刻意不落盘）
- **工程**：全流程 TDD，Vitest + Vue Test Utils + jsdom；领域校验规则前后端共用一份

> 项目名称与界面均为自行设计，不使用任何第三方平台的名称或标识。

## 功能

- **发布**：正文上限 280 字，实时字数统计（剩余 40 字变黄、超出变红并禁用发布），可自定义昵称，`Ctrl / Cmd + Enter` 快捷发布
- **查看**：按时间倒序展示，相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期），每分钟自动刷新
- **删除**：单条二次确认删除、一键清空全部（同样二次确认）
- **状态反馈**：请求中显示「正在同步…」，失败时展示服务端返回的中文错误文案
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
| POST | `/api/posts` | 新建动态，body `{ author?, content }` | 201 `{ post: Post }` | 400 `{ error }` |
| DELETE | `/api/posts/:id` | 删除单条 | 204（无 body） | 404 `{ error: "动态不存在" }` |
| DELETE | `/api/posts` | 清空全部 | 204（无 body） | — |

```ts
type Post = {
  id: string          // crypto.randomUUID()
  author: string      // 昵称，留空时服务端填充「匿名用户」
  content: string     // 正文，≤ 280 字
  createdAt: number   // 毫秒时间戳
}
```

校验错误文案（400）：`内容不能为空`、`内容不能超过 280 字`、`请求体不是合法的 JSON`、`昵称必须是字符串`。

统一兜底：未知路径 404 `{ "error": "接口不存在" }`；路由内未捕获异常 500 `{ "error": "服务内部错误" }`（堆栈只写服务端日志，不出现在响应里）。

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

当前 **11 个测试文件 / 115 个用例**全部通过，其中后端 23 个、前端 92 个。

| 测试文件 | 覆盖内容 |
| --- | --- |
| `src/domain/post.test.ts` | 草稿校验、归一化、动态构造、脏数据过滤 |
| `src/utils/time.test.ts` | 相对时间、绝对时间、头像首字 |
| `src/api/posts.test.ts` | 成功解析、错误体文案、非 JSON 兜底、网络异常兜底 |
| `src/lib/storage.test.ts` | 昵称偏好的读写与不可用降级 |
| `src/stores/posts.test.ts` | 加载/发布/删除/清空的成功与失败、本地校验拦截、pending 时序 |
| `src/components/PostComposer.test.ts` | 计数、禁用态、提交事件、快捷键、错误提示 |
| `src/components/PostItem.test.ts` | 渲染、XSS 防护、二次确认删除 |
| `src/components/PostList.test.ts` | 空状态、列表顺序、事件转发 |
| `src/App.test.ts` | 首屏加载、发布、失败提示、删除、清空、重新挂载恢复 |
| `server/app.test.ts` | HTTP 契约：状态码、错误文案、最新在前、204/404 |
| `server/repository.test.ts` | 内存仓储：副本隔离、插入顺序、remove 返回值、注入时钟/ID |

### TDD 过程

所有实现都是「先红后绿」：先写会失败的测试并运行确认失败，再补实现让测试通过。当前版本由两个子代理并行推进：

1. **后端子代理**：`server/repository.test.ts` → `server/app.test.ts` → 实现仓储与 Hono 路由
2. **前端子代理**：`src/api/posts.test.ts` → `src/stores/posts.test.ts` → `src/App.test.ts` → 实现 API 客户端、异步 store 与页面
3. **主会话**：进度跟踪、代码审查（分层与错误处理）、真机 HTTP 验收与内置浏览器验收

## 目录结构

```
.
├── index.html                  # Vite 入口
├── server
│   ├── app.ts                  # Hono 应用：只做 HTTP 层
│   ├── repository.ts           # 进程内存仓储（可注入时钟与 ID 生成器）
│   └── index.ts                # Node 启动入口（PORT 可配）
├── src
│   ├── main.ts                 # 创建应用、注册 Pinia
│   ├── App.vue                 # 编排：加载数据 / 发布 / 删除 / 清空
│   ├── api/posts.ts            # REST 客户端封装（ApiError 统一错误）
│   ├── assets/main.css         # 全局变量与基础样式
│   ├── components
│   │   ├── PostComposer.vue    # 发布框，拥有草稿状态
│   │   ├── PostItem.vue        # 单条动态，拥有删除确认状态
│   │   └── PostList.vue        # 列表与空状态
│   ├── composables/useNow.ts   # 共享时钟（每分钟刷新）
│   ├── domain/post.ts          # 纯函数：校验、归一化、构造、脏数据过滤（前后端共用）
│   ├── lib/storage.ts          # 仅存昵称偏好（界面偏好，不是业务数据）
│   └── stores/posts.ts         # Pinia store：唯一状态拥有者，异步动作
└── vite.config.ts              # Vite + Vitest + /api 代理
```

## 架构要点

- **前后端共享领域规则**：`src/domain/post.ts` 被 BFF 与客户端同时引用，280 字上限、默认昵称、空内容判定只有一处定义，避免两端漂移。
- **HTTP 层薄、仓储被动**：`server/app.ts` 只负责解析、状态码与响应；`server/repository.ts` 只负责存放与顺序，时钟与 ID 可注入以便确定性测试。
- **单一状态源 + 异步动作**：动态列表只存在于 `usePostsStore`，`load/publish/remove/clear` 都是 `async`，失败写入 `error` 而不抛到组件层。
- **组件边界不变**：`PostComposer` 仍只发 `submit(draft)`、`PostItem` 只发 `delete(id)`，页面在 `App.vue` 里编排。
- **错误可读**：API 客户端把非 2xx 与网络异常统一翻译成中文 `ApiError`，界面直接展示。

## 已知限制（刻意的 MVP 取舍）

- 数据在进程内存中，**重启后端即清空**，且只适用于单进程部署
- 无鉴权、无分页、无编辑功能，无并发冲突处理
- 昵称作为界面偏好仍存 localStorage；业务数据已不在浏览器侧
- 发布请求失败时，发布框中的草稿不会自动恢复（客户端已做同等规则预校验，服务端 400 概率极低）
- `pending` 期间未禁用按钮，快速重复点击会产生并发请求（无幂等键）；无乐观更新与自动重试
- 错误提示没有手动关闭入口，只在下一次操作时清空

## 版本历史

- **v1**：纯 HTML + CSS + JavaScript 单页实现，数据存 localStorage
- **v2**：以 TDD 方式重写为 Node.js + Vue 3 + Pinia，仍用 localStorage
- **v3**：新增 Hono + REST + 内存存储，前端改为通过 API 读写（当前版本）
