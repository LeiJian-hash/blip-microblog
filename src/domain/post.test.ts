import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTHOR,
  MAX_CONTENT_LENGTH,
  createPost,
  isPost,
  normalizeDraft,
  parseStoredPosts,
  validateDraft,
} from './post'

const validPost = {
  id: 'p1',
  author: '阿蓝',
  content: '第一条动态',
  createdAt: 1_700_000_000_000,
}

describe('validateDraft', () => {
  it('拒绝空内容', () => {
    expect(validateDraft({ content: '', author: '' })).toBe('内容不能为空')
  })

  it('拒绝纯空白内容', () => {
    expect(validateDraft({ content: '   \n\t ', author: '' })).toBe('内容不能为空')
  })

  it('接受普通内容', () => {
    expect(validateDraft({ content: '你好，世界', author: '' })).toBeNull()
  })

  it('接受恰好达到上限的内容', () => {
    expect(validateDraft({ content: 'a'.repeat(MAX_CONTENT_LENGTH), author: '' })).toBeNull()
  })

  it('拒绝超出上限的内容', () => {
    expect(validateDraft({ content: 'a'.repeat(MAX_CONTENT_LENGTH + 1), author: '' })).toBe(
      `内容不能超过 ${MAX_CONTENT_LENGTH} 字`,
    )
  })

  it('按去除首尾空白后的长度校验', () => {
    const padded = `   ${'a'.repeat(MAX_CONTENT_LENGTH)}   `
    expect(validateDraft({ content: padded, author: '' })).toBeNull()
  })
})

describe('normalizeDraft', () => {
  it('去除内容与昵称的首尾空白', () => {
    expect(normalizeDraft({ content: '  你好  ', author: '  阿蓝  ' })).toEqual({
      content: '你好',
      author: '阿蓝',
    })
  })

  it('昵称为空白时回落到默认昵称', () => {
    expect(normalizeDraft({ content: '你好', author: '   ' }).author).toBe(DEFAULT_AUTHOR)
  })
})

describe('createPost', () => {
  it('生成包含 id、作者、内容与时间戳的动态', () => {
    expect(createPost({ content: ' 你好 ', author: ' 阿蓝 ' }, { id: 'p1', now: 1000 })).toEqual({
      id: 'p1',
      author: '阿蓝',
      content: '你好',
      createdAt: 1000,
    })
  })

  it('未传入 id 与时间时自动生成', () => {
    const post = createPost({ content: '你好', author: '阿蓝' })
    expect(post.id).not.toBe('')
    expect(typeof post.createdAt).toBe('number')
  })

  it('每次生成的 id 都不相同', () => {
    const first = createPost({ content: 'a', author: '' })
    const second = createPost({ content: 'b', author: '' })
    expect(first.id).not.toBe(second.id)
  })
})

describe('isPost', () => {
  it('接受结构完整的动态', () => {
    expect(isPost(validPost)).toBe(true)
  })

  it.each([
    ['null', null],
    ['字符串', 'not-a-post'],
    ['缺少 content', { id: 'p1', author: 'a', createdAt: 1 }],
    ['content 类型错误', { ...validPost, content: 123 }],
    ['createdAt 类型错误', { ...validPost, createdAt: '1700000000000' }],
    ['author 类型错误', { ...validPost, author: undefined }],
  ])('拒绝异常数据：%s', (_label, value) => {
    expect(isPost(value)).toBe(false)
  })
})

describe('parseStoredPosts', () => {
  it('保留合法记录并过滤异常记录', () => {
    const parsed = parseStoredPosts([
      validPost,
      null,
      { id: 'broken' },
      { ...validPost, id: 42 },
      'string',
      { ...validPost, content: '第二条', createdAt: 1_700_000_000_001 },
    ])

    expect(parsed).toHaveLength(2)
    expect(parsed.map((post) => post.content)).toEqual(['第一条动态', '第二条'])
  })

  it('非数组输入返回空数组', () => {
    expect(parseStoredPosts(null)).toEqual([])
    expect(parseStoredPosts('oops')).toEqual([])
    expect(parseStoredPosts({ posts: [] })).toEqual([])
  })

  it('保持存储中的原始顺序', () => {
    const parsed = parseStoredPosts([
      { ...validPost, id: 'b', createdAt: 2 },
      { ...validPost, id: 'a', createdAt: 1 },
    ])
    expect(parsed.map((post) => post.id)).toEqual(['b', 'a'])
  })
})
