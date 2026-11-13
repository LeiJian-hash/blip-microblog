import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PostComposer from './PostComposer.vue'
import { MAX_CONTENT_LENGTH } from '@/domain/post'

function mountComposer(props: Record<string, unknown> = {}) {
  return mount(PostComposer, { props: { initialAuthor: '', ...props } })
}

const content = () => '[data-testid="composer-content"]'
const author = () => '[data-testid="composer-author"]'
const submit = () => '[data-testid="composer-submit"]'
const counter = () => '[data-testid="composer-counter"]'

describe('PostComposer', () => {
  it('初始状态显示零字数并禁用发布', () => {
    const wrapper = mountComposer()

    expect(wrapper.find(counter()).text()).toBe(`0 / ${MAX_CONTENT_LENGTH}`)
    expect(wrapper.find(submit()).attributes('disabled')).toBeDefined()
  })

  it('使用传入的昵称作为初始值', () => {
    const wrapper = mountComposer({ initialAuthor: '阿蓝' })

    expect((wrapper.find(author()).element as HTMLInputElement).value).toBe('阿蓝')
  })

  it('输入内容后启用发布并更新计数', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('你好')

    expect(wrapper.find(counter()).text()).toBe(`2 / ${MAX_CONTENT_LENGTH}`)
    expect(wrapper.find(submit()).attributes('disabled')).toBeUndefined()
  })

  it('提交时发出去除首尾空白的草稿并清空输入框', async () => {
    const wrapper = mountComposer()

    await wrapper.find(author()).setValue('  阿蓝 ')
    await wrapper.find(content()).setValue('  你好，世界  ')
    await wrapper.find(submit()).trigger('click')

    expect(wrapper.emitted('submit')).toEqual([[{ content: '你好，世界', author: '阿蓝' }]])
    expect((wrapper.find(content()).element as HTMLTextAreaElement).value).toBe('')
    expect(wrapper.find(submit()).attributes('disabled')).toBeDefined()
  })

  it('Ctrl + Enter 可以快捷发布', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('快捷键发布')
    await wrapper.find(content()).trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toEqual([[{ content: '快捷键发布', author: '' }]])
  })

  it('普通回车不会发布', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('换行')
    await wrapper.find(content()).trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('超出字数上限时禁用发布并标记计数', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('a'.repeat(MAX_CONTENT_LENGTH + 1))

    expect(wrapper.find(submit()).attributes('disabled')).toBeDefined()
    expect(wrapper.find(counter()).classes()).toContain('counter--over')
  })

  it('剩余字数不足时给出警告样式', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('a'.repeat(MAX_CONTENT_LENGTH - 20))

    expect(wrapper.find(counter()).classes()).toContain('counter--warning')
  })

  it('纯空白内容通过快捷键提交时显示错误且不发出事件', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('   ')
    await wrapper.find(content()).trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.find('[data-testid="composer-error"]').text()).toBe('内容不能为空')
  })

  it('继续输入会清除错误提示', async () => {
    const wrapper = mountComposer()

    await wrapper.find(content()).setValue('   ')
    await wrapper.find(content()).trigger('keydown', { key: 'Enter', ctrlKey: true })
    await wrapper.find(content()).setValue('有内容了')

    expect(wrapper.find('[data-testid="composer-error"]').exists()).toBe(false)
  })
})
