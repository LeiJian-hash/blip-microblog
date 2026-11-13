import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostList from './PostList.vue'
import type { Post } from '@/domain/post'

const NOW = new Date('2026-11-13T10:00:00+08:00').getTime()

const posts: Post[] = [
  { id: 'p2', author: '阿蓝', content: '新的', createdAt: NOW - 60_000 },
  { id: 'p1', author: '小明', content: '旧的', createdAt: NOW - 2 * 3600_000 },
]

describe('PostList', () => {
  it('没有动态时显示空状态', () => {
    const wrapper = mount(PostList, { props: { posts: [], now: NOW } })

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
  })

  it('按传入顺序渲染全部动态', () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW } })
    const items = wrapper.findAll('[data-testid="post"]')

    expect(items).toHaveLength(2)
    expect(items[0].find('[data-testid="post-content"]').text()).toBe('新的')
    expect(items[1].find('[data-testid="post-content"]').text()).toBe('旧的')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)
  })

  it('转发子组件的删除事件', async () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW } })

    await wrapper.findAll('[data-testid="post-delete"]')[0].trigger('click')
    await wrapper.findAll('[data-testid="post-delete-confirm"]')[0].trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['p2']])
  })
})
