# Blip · 本地微动态

一个极简的「微动态」应用：可以发布、查看、删除短消息，数据全部保存在浏览器的 **Local Storage** 中，没有后端、不需要账号。

技术栈：**Node.js + Vite + Vue 3（Composition API + TypeScript）+ Pinia**，测试用 **Vitest + Vue Test Utils + jsdom**，整个项目按 **TDD（测试先行）** 的方式重写。

> 项目名称与界面均为自行设计，不使用任何第三方平台的名称或标识。

## 功能

- **发布**：正文上限 280 字，实时字数统计（剩余 40 字变黄、超出变红并禁用发布），可自定义昵称（本地记忆），`Ctrl / Cmd + Enter` 快捷发布
- **查看**：按时间倒序展示，相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期），每分钟自动刷新
- **删除**：单条二次确认删除、一键清空全部数据（同样二次确认）
- **本地持久化**：刷新、关闭浏览器后数据仍在；存储不可用或写入失败时给出提示，但内存中仍可正常使用
- **安全**：内容一律以纯文本插值渲染，不使用 `v-html`

## 快速开始

```bash
npm install      # 安装依赖
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 类型检查 + 生产构建（输出 dist/）
npm run preview  # 预览构建产物
```

## 测试

```bash
npm run test        # 监听模式
npm run test:run    # 单次运行（CI 用）
npm run typecheck   # vue-tsc 类型检查
```

当前 **9 个测试文件 / 82 个用例**全部通过：

| 测试文件 | 覆盖内容 |
| --- | --- |
| `src/domain/post.test.ts` | 草稿校验、归一化、动态构造、脏数据过滤 |
| `src/utils/time.test.ts` | 相对时间、绝对时间、头像首字 |
| `src/lib/storage.test.ts` | localStorage 读写、损坏数据、不可用/写入失败降级 |
| `src/stores/posts.test.ts` | store 初始状态、发布排序、持久化、删除、清空、恢复 |
| `src/stores/posts.storage-failure.test.ts` | 存储缺失与写入失败时的降级行为 |
| `src/components/PostComposer.test.ts` | 计数、禁用态、提交事件、快捷键、错误提示 |
| `src/components/PostItem.test.ts` | 渲染、XSS 防护、二次确认删除 |
| `src/components/PostList.test.ts` | 空状态、列表顺序、事件转发 |
| `src/App.test.ts` | 发布→落库→刷新恢复→删除→清空的完整链路 |

### TDD 过程

实现按「红 → 绿 → 重构」分三轮推进，每一轮先写失败测试再补实现：

1. **领域层**：先把校验与时间格式化的行为写成测试，再实现纯函数
2. **状态层**：先写 store 与存储适配层的测试（含降级路径），再实现 Pinia store
3. **UI 层**：先写组件与 App 集成测试（通过 `data-testid` 黑盒断言），再实现组件

## 目录结构

```
.
├── index.html                  # Vite 入口
├── src
│   ├── main.ts                 # 创建应用、注册 Pinia
│   ├── App.vue                 # 编排：头部 / 发布框 / 列表 / 页脚
│   ├── assets/main.css         # 全局变量与基础样式
│   ├── components
│   │   ├── PostComposer.vue    # 发布框，拥有草稿状态
│   │   ├── PostItem.vue        # 单条动态，拥有删除确认状态
│   │   └── PostList.vue        # 列表与空状态
│   ├── composables/useNow.ts   # 共享时钟（每分钟刷新）
│   ├── domain/post.ts          # 纯函数：校验、归一化、构造、脏数据过滤
│   ├── lib/storage.ts          # localStorage 适配层（可注入、可降级）
│   ├── stores/posts.ts         # Pinia store：唯一状态拥有者
│   └── test/setup.ts           # 测试环境初始化
├── vite.config.ts              # Vite + Vitest 配置（@ → src）
└── tsconfig.json
```

## 架构要点

- **单向数据流**：`App` 通过 props 下发数据、监听子组件事件；`PostComposer` 只暴露 `submit` 草稿事件，`PostItem` 只暴露 `delete(id)`，父级决定业务动作。
- **状态唯一来源**：动态列表与昵称只存在于 `usePostsStore`，组件不各自复制一份。
- **纯函数下沉**：校验、时间格式化、动态构造都是无副作用的纯函数，便于直接单测。
- **存储适配可注入**：`lib/storage.ts` 只依赖 `getItem / setItem / removeItem`，测试可注入假实现，也便于将来替换为 IndexedDB。
- **可观测的降级**：存储不可用（隐私模式）或写入失败（配额）时，`storageError` 会给出提示，写操作不会抛错打断交互。

## 存储设计

| 键名 | 类型 | 说明 |
| --- | --- | --- |
| `blip.posts.v1` | `Post[]` | 动态列表，最新的排在最前 |
| `blip.author.v1` | `string` | 上次使用的昵称 |

```ts
type Post = {
  id: string          // crypto.randomUUID()
  author: string      // 昵称，留空时为「匿名用户」
  content: string     // 正文，≤ 280 字
  createdAt: number   // 毫秒时间戳
}
```

读取时会逐条校验结构，非法记录被丢弃，JSON 损坏则回落到空列表，不会因为脏数据白屏。

## 版本历史

- **v1**：纯 HTML + CSS + JavaScript 单页实现（见历史提交）
- **v2**：以 TDD 方式重写为 Node.js + Vue 3 + Pinia，保持同一套 Local Storage 数据结构
