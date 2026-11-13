import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostItem from './PostItem.vue'
import type { Post } from '@/domain/post'

const NOW = new Date('2026-11-13T10:00:00+08:00').getTime()

const post: Post = {
  id: 'p1',
  author: '阿蓝',
  content: '你好，世界',
  createdAt: NOW - 5 * 60_000,
}

function mountItem(overrides: Partial<Post> = {}, busy = false) {
  return mount(PostItem, { props: { post: { ...post, ...overrides }, now: NOW, busy } })
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
    const wrapper = mountItem({}, true)

    expect(wrapper.find('[data-testid="post-delete"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.find('[data-testid="post-delete-confirm"]').exists()).toBe(false)
  })
})
