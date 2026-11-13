<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Post } from '@/domain/post'
import { formatAbsoluteTime, formatRelativeTime, initialOf } from '@/utils/time'

const props = defineProps<{
  post: Post
  /** 由父级统一提供的“当前时间”，保证列表内相对时间一致 */
  now: number
}>()

const emit = defineEmits<{
  delete: [id: string]
}>()

const confirming = shallowRef(false)

const initial = computed(() => initialOf(props.post.author))
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now))
const absoluteTime = computed(() => formatAbsoluteTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())

function confirmDelete(): void {
  emit('delete', props.post.id)
}
</script>

<template>
  <li class="post" data-testid="post">
    <div class="post-avatar" data-testid="post-avatar" aria-hidden="true">{{ initial }}</div>

    <div class="post-main">
      <div class="post-head">
        <span class="post-author" data-testid="post-author">{{ post.author }}</span>
        <time
          class="post-time"
          data-testid="post-time"
          :datetime="isoTime"
          :title="absoluteTime"
        >
          {{ relativeTime }}
        </time>

        <div class="post-actions">
          <template v-if="confirming">
            <button
              type="button"
              class="action action--danger"
              data-testid="post-delete-confirm"
              @click="confirmDelete"
            >
              确认
            </button>
            <button
              type="button"
              class="action"
              data-testid="post-delete-cancel"
              @click="confirming = false"
            >
              取消
            </button>
          </template>
          <button
            v-else
            type="button"
            class="action"
            data-testid="post-delete"
            @click="confirming = true"
          >
            删除
          </button>
        </div>
      </div>

      <p class="post-content" data-testid="post-content">{{ post.content }}</p>
    </div>
  </li>
</template>

<style scoped>
.post {
  display: flex;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  transition: background 0.18s ease;
  animation: rise 0.24s ease both;
}

.post:hover {
  background: var(--surface-hover);
}

.post-avatar {
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

.post-main {
  flex: 1;
  min-width: 0;
}

.post-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 4px;
}

.post-author {
  max-width: 45%;
  overflow: hidden;
  font-size: 14px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.post-time {
  flex: 1;
  font-size: 12.5px;
  color: var(--text-dim);
}

.post-actions {
  flex: none;
  display: flex;
  gap: 6px;
}

.action {
  padding: 2px 8px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.16s ease, color 0.16s ease, border-color 0.16s ease;
}

.post:hover .action,
.action:focus-visible {
  opacity: 1;
}

.action:hover {
  color: var(--text);
  border-color: var(--border);
}

.action--danger {
  color: var(--danger);
  border-color: rgba(255, 107, 107, 0.4);
  opacity: 1;
}

.post-content {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #dbe2ee;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 520px) {
  .action {
    opacity: 1;
  }
}
</style>
