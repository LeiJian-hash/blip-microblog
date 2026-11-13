<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import { MAX_CONTENT_LENGTH, validateDraft, type PostDraft } from '@/domain/post'
import { initialOf } from '@/utils/time'

const props = defineProps<{
  /** 上次使用的昵称，作为输入框初值 */
  initialAuthor: string
  /** 是否有请求正在进行：禁用发布并阻止重复提交 */
  busy?: boolean
  /** 提交草稿；返回 true 表示服务端已接受，此时才清空输入框 */
  onSubmit: (draft: PostDraft) => Promise<boolean>
}>()

const WARNING_THRESHOLD = 40

const content = shallowRef('')
const author = shallowRef(props.initialAuthor)
const error = shallowRef<string | null>(null)

watch(
  () => props.initialAuthor,
  (value) => {
    if (!author.value) author.value = value
  },
)

const length = computed(() => content.value.length)
const remaining = computed(() => MAX_CONTENT_LENGTH - length.value)
const counterLabel = computed(() => `${length.value} / ${MAX_CONTENT_LENGTH}`)
const isOverLimit = computed(() => remaining.value < 0)
const canSubmit = computed(
  () => content.value.trim().length > 0 && !isOverLimit.value && !props.busy,
)
const authorInitial = computed(() => initialOf(author.value))
const counterClasses = computed(() => ({
  'counter--warning': remaining.value <= WARNING_THRESHOLD && remaining.value >= 0,
  'counter--over': isOverLimit.value,
}))

async function submitDraft(): Promise<void> {
  if (props.busy) return

  const draft = { content: content.value, author: author.value }
  const message = validateDraft(draft)

  if (message) {
    error.value = message
    return
  }

  error.value = null

  // 只有服务端接受后才清空，失败时保留草稿，用户不必重新输入
  const accepted = await props.onSubmit({
    content: draft.content.trim(),
    author: draft.author.trim(),
  })

  if (accepted) content.value = ''
}

function clearError(): void {
  error.value = null
}

function handleKeydown(event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void submitDraft()
  }
}
</script>

<template>
  <section class="composer" aria-label="发布动态">
    <div class="composer-avatar" aria-hidden="true">{{ authorInitial }}</div>

    <div class="composer-body">
      <input
        v-model="author"
        class="author-input"
        data-testid="composer-author"
        type="text"
        maxlength="16"
        autocomplete="off"
        placeholder="你的昵称（可留空）"
        aria-label="昵称"
      />

      <textarea
        v-model="content"
        class="content-input"
        data-testid="composer-content"
        rows="3"
        placeholder="此刻想说点什么？"
        aria-label="动态内容"
        @input="clearError"
        @keydown="handleKeydown"
      />

      <p v-if="error" class="composer-error" data-testid="composer-error" role="alert">
        {{ error }}
      </p>

      <div class="composer-footer">
        <span class="counter" :class="counterClasses" data-testid="composer-counter">
          {{ counterLabel }}
        </span>
        <button
          class="submit-button"
          data-testid="composer-submit"
          type="button"
          :disabled="!canSubmit"
          @click="submitDraft"
        >
          发布
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.composer {
  display: flex;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.composer-avatar {
  flex: none;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: linear-gradient(145deg, #2b3444, #1f2634);
  font-size: 14px;
  font-weight: 600;
  user-select: none;
}

.composer-body {
  flex: 1;
  min-width: 0;
}

.author-input {
  width: 100%;
  margin-bottom: 8px;
  padding: 6px 0;
  border: none;
  border-bottom: 1px dashed transparent;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  outline: none;
  transition: border-color 0.18s ease;
}

.author-input::placeholder {
  color: var(--text-dim);
  font-weight: 400;
}

.author-input:focus {
  border-bottom-color: var(--border);
}

.content-input {
  width: 100%;
  min-height: 84px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-soft);
  color: var(--text);
  font-family: inherit;
  font-size: 15px;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}

.content-input::placeholder {
  color: var(--text-dim);
}

.content-input:focus {
  border-color: rgba(76, 141, 255, 0.7);
  box-shadow: 0 0 0 3px rgba(76, 141, 255, 0.14);
}

.composer-error {
  margin: 10px 0 0;
  font-size: 13px;
  color: #ff9b9b;
}

.composer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}

.counter {
  font-size: 12.5px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
  transition: color 0.18s ease;
}

.counter--warning {
  color: #ffb454;
}

.counter--over {
  color: var(--danger);
}

.submit-button {
  padding: 9px 22px;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(76, 141, 255, 0.28);
  transition: background 0.18s ease, transform 0.12s ease, opacity 0.18s ease;
}

.submit-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.submit-button:active:not(:disabled) {
  transform: scale(0.97);
}

.submit-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
