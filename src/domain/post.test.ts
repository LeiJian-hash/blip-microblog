import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUTHOR,
  EMPTY_REACTIONS,
  MAX_AUTHOR_LENGTH,
  MAX_CONTENT_LENGTH,
  createPost,
  isPost,
  normalizeDraft,
  setFavorited,
  setLiked,
  validateDraft,
  type Post,
} from './post'

const validPost = {
  id: 'p1',
  author: '阿蓝',
  content: '第一条动态',
  createdAt: 1_700_000_000_000,
  ...EMPTY_REACTIONS,
}

function makePost(overrides: Partial<Post> = {}): Post {
  return { ...validPost, ...overrides }
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

describe('validateDraft 昵称长度', () => {
  const tooLong = `昵称不能超过 ${MAX_AUTHOR_LENGTH} 字`

  it('接受恰好达到上限的昵称', () => {
    const author = '一'.repeat(MAX_AUTHOR_LENGTH)

    expect(validateDraft({ content: '你好', author })).toBeNull()
  })

  it('拒绝超出上限的昵称', () => {
    const author = '一'.repeat(MAX_AUTHOR_LENGTH + 1)

    expect(validateDraft({ content: '你好', author })).toBe(tooLong)
  })

  it('按去除首尾空白后的长度校验昵称', () => {
    const author = `   ${'一'.repeat(MAX_AUTHOR_LENGTH)}   `

    expect(validateDraft({ content: '你好', author })).toBeNull()
  })

  it('纯空白昵称视为留空，不触发长度校验', () => {
    expect(validateDraft({ content: '你好', author: '   ' })).toBeNull()
    expect(validateDraft(normalizeDraft({ content: '你好', author: '   ' }))).toBeNull()
  })

  it('按与内容一致的口径计长（UTF-16 码元）', () => {
    const wide = '一'.repeat(MAX_AUTHOR_LENGTH + 1)
    const emoji = `${'😀'.repeat(8)}一`

    expect(wide.length).toBe(emoji.length)
    expect(validateDraft({ content: '你好', author: emoji })).toBe(tooLong)
    expect(validateDraft({ content: '你好', author: '😀'.repeat(8) })).toBeNull()
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
      likes: 0,
      liked: false,
      favorited: false,
    })
  })

  it('新建动态的互动状态为零赞、未点赞、未收藏', () => {
    expect(createPost({ content: '你好', author: '' })).toMatchObject(EMPTY_REACTIONS)
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
    ['缺少 likes', { ...validPost, likes: undefined }],
    ['likes 为负数', { ...validPost, likes: -1 }],
    ['likes 类型错误', { ...validPost, likes: '0' }],
    ['liked 类型错误', { ...validPost, liked: 'false' }],
    ['favorited 类型错误', { ...validPost, favorited: 0 }],
  ])('拒绝异常数据：%s', (_label, value) => {
    expect(isPost(value)).toBe(false)
  })
})

describe('setLiked', () => {
  it('点赞时计数加一并标记已点赞', () => {
    expect(setLiked(makePost({ likes: 3 }), true)).toMatchObject({ liked: true, likes: 4 })
  })

  it('取消点赞时计数减一并清除标记', () => {
    expect(setLiked(makePost({ likes: 3, liked: true }), false)).toMatchObject({
      liked: false,
      likes: 2,
    })
  })

  it('重复设置同一个状态时计数不变，且返回同一引用', () => {
    const liked = makePost({ likes: 1, liked: true })

    expect(setLiked(liked, true)).toBe(liked)
  })

  it('计数不会被减成负数', () => {
    expect(setLiked(makePost({ likes: 0, liked: true }), false).likes).toBe(0)
  })

  it('不修改原对象', () => {
    const original = makePost({ likes: 0 })

    setLiked(original, true)

    expect(original).toMatchObject({ likes: 0, liked: false })
  })

  it('不影响收藏状态', () => {
    const post = makePost({ favorited: true })

    expect(setLiked(post, true).favorited).toBe(true)
  })
})

describe('setFavorited', () => {
  it('收藏与取消收藏只改变标记', () => {
    const post = makePost({ likes: 2 })

    expect(setFavorited(post, true)).toMatchObject({ favorited: true, likes: 2 })
    expect(setFavorited(setFavorited(post, true), false)).toMatchObject({
      favorited: false,
      likes: 2,
    })
  })

  it('重复设置同一个状态时返回同一引用', () => {
    const post = makePost({ favorited: true })

    expect(setFavorited(post, true)).toBe(post)
  })

  it('不影响点赞状态与计数', () => {
    const post = makePost({ likes: 5, liked: true })

    expect(setFavorited(post, true)).toMatchObject({ likes: 5, liked: true })
  })
})


