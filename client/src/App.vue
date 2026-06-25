<template>
  <div class="app">
    <aside class="sidebar">
      <router-link to="/" class="sidebar-brand">
        <span class="brand-icon">📔</span>
        <span class="brand-text">我的日记</span>
      </router-link>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-link" exact-active-class="nav-link-active">
          📖 日记
        </router-link>
        <router-link to="/calendar" class="nav-link" active-class="nav-link-active">
          📅 日历
        </router-link>
        <router-link to="/timeline" class="nav-link" active-class="nav-link-active">
          📜 时间线
        </router-link>
      </nav>

      <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到亮色模式' : '切换到暗色模式'">
        {{ isDark ? '☀️ 亮色' : '🌙 暗色' }}
      </button>

      <div class="sidebar-footer">
        <router-link to="/stats" class="nav-link" active-class="nav-link-active">
          📊 统计
        </router-link>
        <router-link to="/settings" class="nav-link" active-class="nav-link-active">
          ⚙️ 设置
        </router-link>
        <div class="sync-bar" @click="goSettings" title="点击查看同步设置">
          <span :class="['sync-bar-dot', syncStatus]"></span>
          <span class="sync-bar-text">{{ syncBarText }}</span>
        </div>
        <router-link to="/edit" class="btn btn-primary sidebar-write">
          ✏️ 写日记
        </router-link>
      </div>
    </aside>

    <main class="main">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useSyncConfig } from './composables/useSyncConfig'
import { SyncService } from './sync'

const router = useRouter()
const {
  serverUrl, syncStatus, autoSync,
  setSyncStatus, setLastSyncTime, setLastError,
} = useSyncConfig()

const THEME_KEY = 'diary_theme'
const isDark = ref(localStorage.getItem(THEME_KEY) === 'dark')

function applyTheme(dark: boolean): void {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
  isDark.value = dark
}

function toggleTheme(): void {
  applyTheme(!isDark.value)
}

applyTheme(isDark.value)

const syncBarText = computed(() => {
  const map: Record<string, string> = { idle: '未配置同步', connecting: '连接中...', connected: '已同步', syncing: '同步中...', error: '同步错误' }
  return map[syncStatus.value] || syncStatus.value
})

function goSettings() {
  router.push('/settings')
}

/* 启动时初始化同步（仅当用户开启了自动同步） */
onMounted(async () => {
  if (!autoSync.value) return
  const url = serverUrl.value
  if (!url) return
  const svc = new SyncService(url, (s) => setSyncStatus(s as any))
  const online = await svc.ping()
  if (online) {
    setSyncStatus('connected')
    const result = await svc.fullSync()
    if (result.errors.length === 0) {
      setLastSyncTime(new Date().toLocaleString('zh-CN'))
    } else {
      setLastError(result.errors.join('; '))
    }
    if (autoSync.value) {
      svc.start()
    }
  } else {
    // 服务器不可达，不启动自动同步
    setSyncStatus('idle')
  }
})
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
}

.sidebar {
  width: 200px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-right: 1px solid var(--color-border);
  padding: var(--space-lg) var(--space-md);
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 100;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
  padding: var(--space-sm) var(--space-sm);
  margin-bottom: var(--space-xl);
}

.sidebar-brand:hover {
  color: var(--color-primary);
}

.brand-icon {
  font-size: 1.4rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  flex: 1;
}

.theme-toggle {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  margin-bottom: var(--space-sm);
}

.theme-toggle:hover {
  color: var(--color-text);
  background: rgba(107, 68, 35, 0.05);
}

.nav-link {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-sm);
  color: var(--color-text-secondary);
  text-decoration: none;
  font-size: 0.95rem;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  border-left: 3px solid transparent;
  margin-left: -3px;
}

.nav-link:hover {
  color: var(--color-text);
  background: rgba(107, 68, 35, 0.05);
  border-left-color: var(--color-border);
}

.nav-link-active {
  color: var(--color-primary);
  font-weight: 700;
  background: rgba(107, 68, 35, 0.08);
  border-left-color: var(--color-primary);
  font-size: 1rem;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: 1px solid var(--color-border);
}

.sidebar-write {
  width: 100%;
  justify-content: center;
}

.sidebar-write:hover {
  text-decoration: none;
}

.sync-bar {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  margin-top: var(--space-xs);
}

.sync-bar:hover {
  color: var(--color-text);
  background: rgba(107, 68, 35, 0.05);
}

.sync-bar-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-bar-dot.idle { background: #9E9E9E; }
.sync-bar-dot.connecting { background: #FFA726; animation: syncPulse 1s infinite; }
.sync-bar-dot.connected { background: #66BB6A; }
.sync-bar-dot.syncing { background: #42A5F5; animation: syncPulse 0.5s infinite; }
.sync-bar-dot.error { background: #EF5350; }

@keyframes syncPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.sync-bar-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  flex: 1;
  min-width: 0;
  padding: var(--space-xl) var(--space-xl) var(--space-2xl);
}

@media (max-width: 768px) {
  .app {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    height: auto;
    flex-direction: row;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    position: sticky;
    top: 0;
  }

  .sidebar-brand {
    margin-bottom: 0;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .sidebar-nav {
    flex: 1;
    flex-direction: row;
  }

  .nav-link {
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .sidebar-footer {
    flex-direction: row;
    border-top: none;
    padding-top: 0;
  }

  .sidebar-write {
    width: auto;
    font-size: 0.85rem;
    padding: var(--space-xs) var(--space-sm);
  }

  .main {
    padding: var(--space-md);
  }
}
</style>
