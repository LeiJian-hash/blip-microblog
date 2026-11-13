import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { EMPTY_REACTIONS, type Post } from '@/domain/post'
import { createPost, setPostFavorited, setPostLiked } from '@/api/posts'
import { AUTHOR_KEY } from '@/lib/storage'
import App from './App.vue'

/** 内存版假后端：测试里只关心界面与调用参数，不关心真实 HTTP */
const fake = vi.hoisted(() => ({
  posts: [] as Post[],
  failLoad: false,
  failCreate: false,
  failReact: false,
  gate: null as Promise<void> | null,
  seq: 0,
}))

/** 假服务端的互动实现：返回更新后的完整动态，计数由“服务端”算 */
function react(id: string, patch: (post: Post) => Post): Post {
  const target = fake.posts.find((post) => post.id === id)
  if (!target) throw new Error('动态不存在')

  const updated = patch(target)
  fake.posts = fake.posts.map((post) => (post.id === id ? updated : post))

  return { ...updated }
}

vi.mock('@/api/posts', () => ({
  fetchPosts: vi.fn(async () => {
    if (fake.gate) await fake.gate
    if (fake.failLoad) throw new Error('无法连接到服务器，请稍后重试。')

    return fake.posts.map((post) => ({ ...post }))
  }),
  createPost: vi.fn(async (draft: { author: string; content: string }) => {
    if (fake.failCreate) throw new Error('发布失败：服务暂时不可用。')

    fake.seq += 1
    const post: Post = {
      id: `post-${fake.seq}`,
      author: draft.author,
      content: draft.content,
      createdAt: Date.now(),
      ...EMPTY_REACTIONS,
    }

    fake.posts = [post, ...fake.posts]
    return post
  }),
  deletePost: vi.fn(async (id: string) => {
    fake.posts = fake.posts.filter((post) => post.id !== id)
  }),
  clearPosts: vi.fn(async () => {
    fake.posts = []
  }),
  setPostLiked: vi.fn(async (id: string, liked: boolean) => {
    if (fake.failReact) throw new Error('动态不存在')

    return react(id, (post) => ({
      ...post,
      liked,
      likes: Math.max(0, post.likes + (liked ? 1 : -1)),
    }))
  }),
  setPostFavorited: vi.fn(async (id: string, favorited: boolean) => {
    if (fake.failReact) throw new Error('动态不存在')

    return react(id, (post) => ({ ...post, favorited }))
  }),
}))

function seedPosts(posts: Post[]): void {
  fake.posts = posts
}

async function mountApp() {
  const wrapper = mount(App, { global: { plugins: [createPinia()] } })
  await flushPromises()

  return wrapper
}

async function publish(
  wrapper: Awaited<ReturnType<typeof mountApp>>,
  text: string,
  name = '',
): Promise<void> {
  if (name) await wrapper.find('[data-testid="composer-author"]').setValue(name)
  await wrapper.find('[data-testid="composer-content"]').setValue(text)
  await wrapper.find('[data-testid="composer-submit"]').trigger('click')
  await flushPromises()
}

describe('App', () => {
  beforeEach(() => {
    fake.posts = []
    fake.failLoad = false
    fake.failCreate = false
    fake.failReact = false
    fake.gate = null
    fake.seq = 0
    vi.clearAllMocks()
  })

  it('首次加载渲染服务端已有动态', async () => {
    localStorage.setItem(AUTHOR_KEY, '阿蓝')
    seedPosts([
      {
        id: 'seed',
        author: '旧用户',
        content: '历史动态',
        createdAt: Date.now() - 3_600_000,
        ...EMPTY_REACTIONS,
      },
    ])

    const wrapper = await mountApp()

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('历史动态')
    expect(wrapper.find('[data-testid="post-time"]').text()).toBe('1 小时前')
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('1 条动态')
    expect((wrapper.find('[data-testid="composer-author"]').element as HTMLInputElement).value).toBe(
      '阿蓝',
    )
  })

  it('请求进行中展示加载态，结束后隐藏', async () => {
    let release!: () => void
    fake.gate = new Promise<void>((resolve) => {
      release = resolve
    })

    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await flushPromises()

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)

    release()
    await flushPromises()

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
  })

  it('发布后列表更新并调用 API', async () => {
    const wrapper = await mountApp()

    await publish(wrapper, '第一条动态', '阿蓝')

    expect(createPost).toHaveBeenCalledWith({ content: '第一条动态', author: '阿蓝' })
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('第一条动态')
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('1 条动态')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('阿蓝')
  })

  it('多条动态按最新在前排列', async () => {
    const wrapper = await mountApp()

    await publish(wrapper, '先发的')
    await publish(wrapper, '后发的')

    const contents = wrapper.findAll('[data-testid="post-content"]').map((item) => item.text())
    expect(contents).toEqual(['后发的', '先发的'])
  })

  it('发布失败时展示接口错误文案', async () => {
    fake.failCreate = true

    const wrapper = await mountApp()
    await publish(wrapper, '会失败的内容')

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="request-error"]').text()).toBe('发布失败：服务暂时不可用。')
  })

  it('加载失败时展示接口错误文案', async () => {
    fake.failLoad = true

    const wrapper = await mountApp()

    expect(wrapper.find('[data-testid="request-error"]').text()).toBe(
      '无法连接到服务器，请稍后重试。',
    )
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('删除动态后回到空状态', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '待删除')

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await wrapper.find('[data-testid="post-delete-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('清空全部数据需要二次确认', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '第一条')
    await publish(wrapper, '第二条')

    await wrapper.find('[data-testid="clear-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(2)

    await wrapper.find('[data-testid="clear-confirm"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('0 条动态')
  })

  it('刷新（重新挂载）后能从 API 恢复动态', async () => {
    const first = await mountApp()
    await publish(first, '重启也在的动态')
    first.unmount()

    const second = await mountApp()

    expect(second.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(second.find('[data-testid="post-content"]').text()).toBe('重启也在的动态')
  })

  it('点击点赞按钮调用接口并用服务端计数刷新界面', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '可以点赞')

    await wrapper.find('[data-testid="post-like"]').trigger('click')
    await flushPromises()

    expect(setPostLiked).toHaveBeenCalledWith('post-1', true)
    expect(wrapper.find('[data-testid="post-like-count"]').text()).toBe('1')
    expect(wrapper.find('[data-testid="post-like"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
  })

  it('再次点击点赞按钮取消点赞', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '可以取消')

    await wrapper.find('[data-testid="post-like"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-testid="post-like"]').trigger('click')
    await flushPromises()

    expect(setPostLiked).toHaveBeenLastCalledWith('post-1', false)
    expect(wrapper.find('[data-testid="post-like-count"]').text()).toBe('0')
  })

  it('点赞失败时展示错误文案且计数不变', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '会失败的点赞')
    fake.failReact = true

    await wrapper.find('[data-testid="post-like"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="request-error"]').text()).toBe('动态不存在')
    expect(wrapper.find('[data-testid="post-like-count"]').text()).toBe('0')
    expect(wrapper.find('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
  })

  it('收藏后筛选按钮的计数同步变化', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '要收藏的')

    expect(wrapper.find('[data-testid="favorites-filter"]').text()).toContain('收藏 0')

    await wrapper.find('[data-testid="post-favorite"]').trigger('click')
    await flushPromises()

    expect(setPostFavorited).toHaveBeenCalledWith('post-1', true)
    expect(wrapper.find('[data-testid="favorites-filter"]').text()).toContain('收藏 1')
    expect(wrapper.find('[data-testid="post-favorite"]').text()).toContain('已收藏')
  })

  it('切换到收藏筛选后列表只剩收藏的动态', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '先发的不收藏')
    await publish(wrapper, '后发的收藏')

    const items = wrapper.findAll('[data-testid="post"]')
    await items[0].find('[data-testid="post-favorite"]').trigger('click')
    await flushPromises()

    const filter = wrapper.find('[data-testid="favorites-filter"]')
    expect(filter.attributes('aria-pressed')).toBe('false')

    await filter.trigger('click')
    await flushPromises()

    expect(filter.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('后发的收藏')
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('2 条动态')
  })

  it('筛选状态下再次点击恢复显示全部动态', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '第一条')
    await publish(wrapper, '第二条')

    await wrapper.find('[data-testid="favorites-filter"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="post"]').exists()).toBe(false)

    await wrapper.find('[data-testid="favorites-filter"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(2)
  })

  it('筛选状态下没有收藏时展示专属空态提示', async () => {
    const wrapper = await mountApp()
    await publish(wrapper, '没有收藏的动态')

    await wrapper.find('[data-testid="favorites-filter"]').trigger('click')
    await flushPromises()

    const empty = wrapper.find('[data-testid="favorites-empty"]')

    expect(empty.exists()).toBe(true)
    expect(empty.text()).not.toContain('还没有任何动态')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
  })
})
