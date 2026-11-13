<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue'
import { storeToRefs } from 'pinia'
import PostComposer from './components/PostComposer.vue'
import PostList from './components/PostList.vue'
import { usePostsStore } from './stores/posts'
import { useNow } from './composables/useNow'
import type { PostDraft } from './domain/post'

const store = usePostsStore()
const { posts, author, count, pending, error } = storeToRefs(store)
const now = useNow()

const confirmingClear = shallowRef(false)

const countLabel = computed(() => `${count.value} 条动态`)

onMounted(() => {
  // 首屏数据来自服务端；不 await，避免 mount 阶段阻塞渲染
  void store.load()
})

async function handleSubmit(draft: PostDraft): Promise<void> {
  await store.publish(draft)
}

async function handleDelete(id: string): Promise<void> {
  await store.remove(id)
}

async function handleClear(): Promise<void> {
  await store.clear()
  confirmingClear.value = false
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">B</div>
        <div class="brand-text">
          <h1 class="brand-title">Blip</h1>
          <p class="brand-subtitle">极简微动态 · 数据保存在服务端</p>
        </div>
      </div>
      <span class="count-badge" data-testid="post-count">{{ countLabel }}</span>
    </header>

    <main class="app-main">
      <PostComposer :initial-author="author" @submit="handleSubmit" />

      <p v-if="error" class="alert" role="alert" data-testid="request-error">
        {{ error }}
      </p>
      <p v-if="pending" class="status" data-testid="loading">正在同步…</p>

      <section class="timeline" aria-label="动态列表">
        <h2 class="timeline-title">最新动态</h2>
        <PostList :posts="posts" :now="now" @delete="handleDelete" />
      </section>
    </main>

    <footer class="app-footer">
      <span class="footer-note">Vue 3 · Pinia · Hono</span>
      <div class="footer-actions">
        <template v-if="confirmingClear">
          <button
            type="button"
            class="link-button link-button--danger"
            data-testid="clear-confirm"
            @click="handleClear"
          >
            确认清空
          </button>
          <button
            type="button"
            class="link-button"
            data-testid="clear-cancel"
            @click="confirmingClear = false"
          >
            取消
          </button>
        </template>
        <button
          v-else
          type="button"
          class="link-button"
          data-testid="clear-all"
          :disabled="count === 0"
          @click="confirmingClear = true"
        >
          清空全部数据
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 40px 20px 64px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-mark {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(145deg, var(--accent), #7a5cff);
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  box-shadow: 0 8px 20px rgba(76, 141, 255, 0.32);
}

.brand-title {
  margin: 0;
  font-size: 20px;
  letter-spacing: 0.2px;
}

.brand-subtitle {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: var(--text-dim);
}

.count-badge {
  flex: none;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--bg-soft);
  font-size: 12.5px;
  color: var(--text-dim);
}

.alert {
  margin: 12px 2px 0;
  padding: 9px 12px;
  border: 1px solid rgba(255, 107, 107, 0.35);
  border-radius: 10px;
  background: rgba(255, 107, 107, 0.1);
  color: #ff9b9b;
  font-size: 13px;
}

.status {
  margin: 12px 2px 0;
  font-size: 12.5px;
  color: var(--text-dim);
}

.timeline {
  margin-top: 28px;
}

.timeline-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 36px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
  color: var(--text-dim);
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.link-button {
  padding: 0;
  border: none;
  background: none;
  color: var(--text-dim);
  font-family: inherit;
  font-size: 12.5px;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.link-button:hover:not(:disabled) {
  color: var(--text);
}

.link-button--danger {
  color: var(--danger);
}

.link-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

@media (max-width: 520px) {
  .app {
    padding: 28px 14px 48px;
  }

  .brand-subtitle {
    display: none;
  }

  .app-footer {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
