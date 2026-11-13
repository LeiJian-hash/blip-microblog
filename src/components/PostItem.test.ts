import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from './PostItem.vue'
import { EMPTY_REACTIONS, type Post } from '@/domain/post'

const NOW = new Date('2026-11-13T10:00:00+08:00').getTime()

const post: Post = {
  id: 'p1',
  author: '阿蓝',
  content: '你好，世界',
  createdAt: NOW - 5 * 60_000,
  ...EMPTY_REACTIONS,
}

function mountItem(
  overrides: Partial<Post> = {},
  options: { busy?: boolean; reacting?: 'like' | 'favorite' | null } = {},
) {
  return mount(PostItem, { props: { post: { ...post, ...overrides }, now: NOW, ...options } })
}

describe('PostItem', () => {
  it('渲染作者、内容与相对时间', () => {
    const wrapper = mountItem()

    expect(wrapper.find('[data-testid="post-author"]').text()).toBe('阿蓝')
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('你好，世界')
    expect(wrapper.find('[data-testid="post-time"]').text()).toBe('5 分钟前')
  })

  it('时间元素带有完整时间的 title 与 datetime', () => {
    const wrapper = mountItem()
    const time = wrapper.find('[data-testid="post-time"]')

    expect(time.attributes('title')).toContain('2026')
    expect(time.attributes('datetime')).toBe(new Date(post.createdAt).toISOString())
  })

  it('头像使用作者首字', () => {
    expect(mountItem().find('[data-testid="post-avatar"]').text()).toBe('阿')
  })

  it('内容按纯文本渲染，不解析 HTML', () => {
    const wrapper = mountItem({ content: '<b>不是加粗</b>' })

    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('<b>不是加粗</b>')
    expect(wrapper.find('[data-testid="post-content"] b').exists()).toBe(false)
  })

  it('点击删除进入二次确认状态，不立即发出事件', async () => {
    const wrapper = mountItem()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.emitted('delete')).toBeUndefined()
    expect(wrapper.find('[data-testid="post-delete-confirm"]').exists()).toBe(true)
  })

  it('确认删除后发出带 id 的事件', async () => {
    const wrapper = mountItem()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await wrapper.find('[data-testid="post-delete-confirm"]').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['p1']])
  })

  it('取消后回到初始状态', async () => {
    const wrapper = mountItem()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await wrapper.find('[data-testid="post-delete-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="post-delete-confirm"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="post-delete"]').exists()).toBe(true)
    expect(wrapper.emitted('delete')).toBeUndefined()
  })

  it('请求进行中禁用删除，避免重复提交', async () => {
    const wrapper = mountItem({}, { busy: true })

    expect(wrapper.find('[data-testid="post-delete"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.find('[data-testid="post-delete-confirm"]').exists()).toBe(false)
  })

  it('未点赞时渲染空心图标、未按下状态与计数 0', () => {
    const wrapper = mountItem()
    const like = wrapper.find('[data-testid="post-like"]')

    expect(like.attributes('aria-pressed')).toBe('false')
    expect(like.attributes('aria-label')).toBe('点赞')
    expect(like.text()).toContain('♡')
    expect(wrapper.find('[data-testid="post-like-count"]').text()).toBe('0')
  })

  it('已点赞时渲染实心图标、按下状态与累计计数', () => {
    const wrapper = mountItem({ likes: 7, liked: true })
    const like = wrapper.find('[data-testid="post-like"]')

    expect(like.attributes('aria-pressed')).toBe('true')
    expect(like.attributes('aria-label')).toBe('取消点赞')
    expect(like.text()).toContain('♥')
    expect(wrapper.find('[data-testid="post-like-count"]').text()).toBe('7')
  })

  it('收藏按钮按状态切换文案与图标', () => {
    const plain = mountItem().find('[data-testid="post-favorite"]')
    expect(plain.attributes('aria-pressed')).toBe('false')
    expect(plain.attributes('aria-label')).toBe('收藏')
    expect(plain.text()).toContain('☆')
    expect(plain.text()).toContain('收藏')

    const favorited = mountItem({ favorited: true }).find('[data-testid="post-favorite"]')
    expect(favorited.attributes('aria-pressed')).toBe('true')
    expect(favorited.attributes('aria-label')).toBe('取消收藏')
    expect(favorited.text()).toContain('★')
    expect(favorited.text()).toContain('已收藏')
  })

  it('点击点赞按钮发出带 id 的 like 事件', async () => {
    const wrapper = mountItem()

    await wrapper.find('[data-testid="post-like"]').trigger('click')

    expect(wrapper.emitted('like')).toEqual([['p1']])
  })

  it('点击收藏按钮发出带 id 的 favorite 事件', async () => {
    const wrapper = mountItem()

    await wrapper.find('[data-testid="post-favorite"]').trigger('click')

    expect(wrapper.emitted('favorite')).toEqual([['p1']])
  })

  it('点赞请求进行中只禁用点赞按钮', () => {
    const wrapper = mountItem({}, { reacting: 'like' })

    expect(wrapper.find('[data-testid="post-like"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="post-favorite"]').attributes('disabled')).toBeUndefined()
  })

  it('收藏请求进行中只禁用收藏按钮', () => {
    const wrapper = mountItem({}, { reacting: 'favorite' })

    expect(wrapper.find('[data-testid="post-favorite"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="post-like"]').attributes('disabled')).toBeUndefined()
  })

  it('没有进行中的请求时两个互动按钮都可点击', () => {
    const wrapper = mountItem()

    expect(wrapper.find('[data-testid="post-like"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-testid="post-favorite"]').attributes('disabled')).toBeUndefined()
  })
})
