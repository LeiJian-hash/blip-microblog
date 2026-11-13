import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from './App.vue'
import { AUTHOR_KEY, POSTS_KEY } from '@/lib/storage'

function mountApp() {
  return mount(App, { global: { plugins: [createPinia()] } })
}

async function publish(wrapper: ReturnType<typeof mountApp>, text: string, name = '') {
  if (name) await wrapper.find('[data-testid="composer-author"]').setValue(name)
  await wrapper.find('[data-testid="composer-content"]').setValue(text)
  await wrapper.find('[data-testid="composer-submit"]').trigger('click')
}

describe('App', () => {
  it('首次进入显示空状态与 0 条动态', () => {
    const wrapper = mountApp()

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('0 条动态')
  })

  it('发布后动态立即出现在列表并写入本地存储', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '第一条动态', '阿蓝')

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('第一条动态')
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('1 条动态')
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(false)

    const stored = JSON.parse(localStorage.getItem(POSTS_KEY) ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ content: '第一条动态', author: '阿蓝' })
    expect(localStorage.getItem(AUTHOR_KEY)).toBe('阿蓝')
  })

  it('多条动态按最新在前排列', async () => {
    const wrapper = mountApp()

    await publish(wrapper, '先发的')
    await publish(wrapper, '后发的')

    const contents = wrapper.findAll('[data-testid="post-content"]').map((item) => item.text())
    expect(contents).toEqual(['后发的', '先发的'])
  })

  it('刷新后可从本地存储恢复动态与昵称', () => {
    localStorage.setItem(
      POSTS_KEY,
      JSON.stringify([
        { id: 'seed', author: '旧用户', content: '历史动态', createdAt: Date.now() - 3_600_000 },
      ]),
    )
    localStorage.setItem(AUTHOR_KEY, '阿蓝')

    const wrapper = mountApp()

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="post-content"]').text()).toBe('历史动态')
    expect(wrapper.find('[data-testid="post-time"]').text()).toBe('1 小时前')
    expect((wrapper.find('[data-testid="composer-author"]').element as HTMLInputElement).value).toBe(
      '阿蓝',
    )
  })

  it('删除动态后回到空状态并同步存储', async () => {
    const wrapper = mountApp()
    await publish(wrapper, '待删除')

    await wrapper.find('[data-testid="post-delete"]').trigger('click')
    await wrapper.find('[data-testid="post-delete-confirm"]').trigger('click')

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true)
    expect(JSON.parse(localStorage.getItem(POSTS_KEY) ?? '[]')).toEqual([])
  })

  it('清空全部数据需要二次确认', async () => {
    const wrapper = mountApp()
    await publish(wrapper, '第一条')
    await publish(wrapper, '第二条')

    await wrapper.find('[data-testid="clear-all"]').trigger('click')
    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(2)

    await wrapper.find('[data-testid="clear-confirm"]').trigger('click')

    expect(wrapper.findAll('[data-testid="post"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="post-count"]').text()).toBe('0 条动态')
  })
})
