<script setup lang="ts">
import type { Post } from '@/domain/post'
import PostItem from './PostItem.vue'

const props = withDefaults(
  defineProps<{
    posts: Post[]
    now: number
    /** 是否有请求正在进行：透传给单条动态以禁用删除 */
    busy?: boolean
    /** 正在进行中的互动动作，键为 `${id}:like` / `${id}:favorite` */
    reacting?: string | null
  }>(),
  { busy: false, reacting: null },
)

const emit = defineEmits<{
  delete: [id: string]
  like: [id: string]
  favorite: [id: string]
}>()

/** 把全局的 reacting 键解析成单条动态的 busy 动作 */
function busyOf(id: string): 'like' | 'favorite' | null {
  const key = props.reacting
  if (!key || !key.startsWith(`${id}:`)) return null

  const action = key.slice(id.length + 1)

  return action === 'like' || action === 'favorite' ? action : null
}
</script>

<template>
  <ul v-if="posts.length > 0" class="post-list">
    <PostItem
      v-for="post in posts"
      :key="post.id"
      :post="post"
      :now="now"
      :busy="busy"
      :reacting="busyOf(post.id)"
      @delete="emit('delete', $event)"
      @like="emit('like', $event)"
      @favorite="emit('favorite', $event)"
    />
  </ul>

  <div v-else class="empty-state" data-testid="empty-state">
    <div class="empty-icon" aria-hidden="true">✎</div>
    <p class="empty-title">还没有任何动态</p>
    <p class="empty-hint" data-testid="empty-hint">
      在上面写下第一句话，它会保存到服务端。
    </p>
  </div>
</template>

<style scoped>
.post-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.empty-state {
  padding: 40px 20px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  text-align: center;
}

.empty-icon {
  margin-bottom: 8px;
  font-size: 26px;
  color: var(--text-dim);
}

.empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.empty-hint {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-dim);
}
</style>
