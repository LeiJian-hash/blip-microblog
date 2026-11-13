<script setup lang="ts">
import { computed, shallowRef } from 'vue'
import type { Post } from '@/domain/post'
import { formatAbsoluteTime, formatRelativeTime, initialOf } from '@/utils/time'

const props = withDefaults(
  defineProps<{
    post: Post
    /** 由父级统一提供的“当前时间”，保证列表内相对时间一致 */
    now: number
    /** 是否有请求正在进行：禁用删除，避免重复提交 */
    busy?: boolean
    /** 该条目正在进行中的互动动作，用于禁用对应按钮 */
    reacting?: 'like' | 'favorite' | null
  }>(),
  { busy: false, reacting: null },
)

const emit = defineEmits<{
  delete: [id: string]
  like: [id: string]
  favorite: [id: string]
}>()

const confirming = shallowRef(false)

const initial = computed(() => initialOf(props.post.author))
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now))
const absoluteTime = computed(() => formatAbsoluteTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())

function confirmDelete(): void {
  emit('delete', props.post.id)
}

function toggleLike(): void {
  emit('like', props.post.id)
}

function toggleFavorite(): void {
  emit('favorite', props.post.id)
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
              :disabled="busy"
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
            :disabled="busy"
            @click="confirming = true"
          >
            删除
          </button>
        </div>
      </div>

      <p class="post-content" data-testid="post-content">{{ post.content }}</p>

      <div class="post-reactions">
        <button
          type="button"
          class="reaction reaction--like"
          :class="{ 'reaction--on': post.liked }"
          data-testid="post-like"
          :aria-pressed="post.liked"
          :aria-label="post.liked ? '取消点赞' : '点赞'"
          :disabled="busy || reacting === 'like'"
          @click="toggleLike"
        >
          <span class="reaction-icon" aria-hidden="true">{{ post.liked ? '♥' : '♡' }}</span>
          <span class="reaction-count" data-testid="post-like-count">{{ post.likes }}</span>
        </button>

        <button
          type="button"
          class="reaction reaction--favorite"
          :class="{ 'reaction--on': post.favorited }"
          data-testid="post-favorite"
          :aria-pressed="post.favorited"
          :aria-label="post.favorited ? '取消收藏' : '收藏'"
          :disabled="busy || reacting === 'favorite'"
          @click="toggleFavorite"
        >
          <span class="reaction-icon" aria-hidden="true">{{ post.favorited ? '★' : '☆' }}</span>
          <span>{{ post.favorited ? '已收藏' : '收藏' }}</span>
        </button>
      </div>
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

.action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.post-content {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #dbe2ee;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.post-reactions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

/* 互动按钮始终可见，不依赖 hover */
.reaction {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 11px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-soft);
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.4;
  cursor: pointer;
  transition:
    color 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease,
    opacity 0.16s ease;
}

.reaction:hover:not(:disabled) {
  color: var(--text);
  border-color: rgba(139, 149, 167, 0.5);
  background: var(--surface-hover);
}

.reaction:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.reaction:disabled {
  opacity: 0.55;
  cursor: progress;
}

.reaction-icon {
  font-size: 14px;
  line-height: 1;
}

.reaction-icon,
.reaction-count {
  font-variant-numeric: tabular-nums;
}

.reaction--like.reaction--on {
  border-color: rgba(255, 122, 156, 0.45);
  background: rgba(255, 122, 156, 0.12);
  color: #ff7a9c;
}

.reaction--favorite.reaction--on {
  border-color: rgba(255, 194, 71, 0.45);
  background: rgba(255, 194, 71, 0.12);
  color: #ffc247;
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

  .reaction {
    padding: 6px 13px;
    font-size: 13px;
  }
}
</style>
