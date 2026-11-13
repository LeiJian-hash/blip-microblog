import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostList from './PostList.vue'
import { EMPTY_REACTIONS, type Post } from '@/domain/post'

const NOW = new Date('2026-11-13T10:00:00+08:00').getTime()

const posts: Post[] = [
  { id: 'p2', author: '阿蓝', content: '新的', createdAt: NOW - 60_000, ...EMPTY_REACTIONS },
  { id: 'p1', author: '小明', content: '旧的', createdAt: NOW - 2 * 3600_000, ...EMPTY_REACTIONS },
]

describe('PostList', () => {
  it('没有动态时显示空状态', () => {
    const wrapper = mount(PostList, { props: { posts: [], now: NOW } })

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
  })

  it('空状态提示数据保存在服务端，而不是浏览器', () => {
    const wrapper = mount(PostList, { props: { posts: [], now: NOW } })
    const hint = wrapper.find('[data-testid="empty-hint"]').text()

    expect(hint).toContain('保存到服务端')
    expect(hint).not.toContain('Local Storage')
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

  it('转发子组件的点赞事件', async () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW } })

    await wrapper.findAll('[data-testid="post-like"]')[1].trigger('click')

    expect(wrapper.emitted('like')).toEqual([['p1']])
  })

  it('转发子组件的收藏事件', async () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW } })

    await wrapper.findAll('[data-testid="post-favorite"]')[0].trigger('click')

    expect(wrapper.emitted('favorite')).toEqual([['p2']])
  })

  it('reacting 命中 `${id}:like` 时只禁用该条目的点赞按钮', () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW, reacting: 'p2:like' } })
    const likes = wrapper.findAll('[data-testid="post-like"]')
    const favorites = wrapper.findAll('[data-testid="post-favorite"]')

    expect(likes[0].attributes('disabled')).toBeDefined()
    expect(likes[1].attributes('disabled')).toBeUndefined()
    expect(favorites[0].attributes('disabled')).toBeUndefined()
  })

  it('reacting 命中 `${id}:favorite` 时只禁用该条目的收藏按钮', () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW, reacting: 'p1:favorite' } })
    const likes = wrapper.findAll('[data-testid="post-like"]')
    const favorites = wrapper.findAll('[data-testid="post-favorite"]')

    expect(favorites[1].attributes('disabled')).toBeDefined()
    expect(likes[1].attributes('disabled')).toBeUndefined()
    expect(favorites[0].attributes('disabled')).toBeUndefined()
  })

  it('没有进行中的互动时所有按钮都可点击', () => {
    const wrapper = mount(PostList, { props: { posts, now: NOW, reacting: null } })

    const disabled = wrapper
      .findAll('[data-testid="post-like"], [data-testid="post-favorite"]')
      .filter((button) => button.attributes('disabled') !== undefined)

    expect(disabled).toHaveLength(0)
  })
})
