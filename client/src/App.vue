<template>
  <div class="app">
    <aside class="sidebar">
      <router-link to="/" class="sidebar-brand">
        <span class="brand-badge" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>
        </span>
        <span class="brand-text">我的日记</span>
      </router-link>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-link" exact-active-class="nav-link-active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          日记
        </router-link>
        <router-link to="/calendar" class="nav-link" active-class="nav-link-active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          日历
        </router-link>
        <router-link to="/timeline" class="nav-link" active-class="nav-link-active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          时间线
        </router-link>
      </nav>

      <button class="theme-toggle" @click="toggleTheme" :title="isDark ? '切换到亮色模式' : '切换到暗色模式'">
        <svg v-if="isDark" class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        <svg v-else class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span class="theme-label">{{ isDark ? '亮色' : '暗色' }}</span>
      </button>

      <div class="sync-bar" @click="goSettings" title="点击查看同步设置">
        <span :class="['sync-bar-dot', syncStatus]"></span>
        <span class="sync-bar-text">{{ syncBarText }}</span>
      </div>

      <div class="sidebar-footer">
        <router-link to="/stats" class="nav-link" active-class="nav-link-active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          统计
        </router-link>
        <router-link to="/settings" class="nav-link" active-class="nav-link-active">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
          设置
        </router-link>
        <router-link to="/edit" class="btn btn-primary sidebar-write">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          写日记
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
  width: 208px;
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
  letter-spacing: -0.01em;
  color: var(--color-text);
  text-decoration: none;
  padding: var(--space-xs) var(--space-sm);
  margin-bottom: var(--space-xl);
}

.sidebar-brand:hover .brand-badge {
  background-color: var(--color-primary-wash-2);
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background-color: var(--color-primary-wash-1);
  color: var(--color-primary);
  transition: background-color var(--transition-fast);
}

.brand-badge svg {
  width: 18px;
  height: 18px;
}

.nav-icon {
  width: 17px;
  height: 17px;
  flex-shrink: 0;
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
  background-color: var(--color-primary-wash-1);
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
  background-color: var(--color-primary-wash-1);
  border-left-color: var(--color-border-strong);
}

.nav-link-active {
  color: var(--color-primary);
  font-weight: 700;
  background-color: var(--color-primary-wash-2);
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
  border: 1px solid transparent;
  transition: all var(--transition-fast);
  margin-top: var(--space-xs);
}

.sync-bar:hover {
  color: var(--color-text);
  background-color: var(--color-primary-wash-1);
  border-color: var(--color-border);
}

.sync-bar-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-bar-dot.idle { background: var(--color-text-muted); }
.sync-bar-dot.connecting { background: var(--color-warning); animation: syncPulse 1s infinite; }
.sync-bar-dot.connected { background: var(--color-success); }
.sync-bar-dot.syncing { background: var(--color-info); animation: syncPulse 0.5s infinite; }
.sync-bar-dot.error { background: var(--color-danger); }

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

  /*
   * 移动端顶栏（≤768px）：两行布局
   * 行1: 徽标 · 主题 · 同步点 · 统计 · 设置 · [写日记]
   * 行2: 日记 / 日历 / 时间线（均分）
   * footer 用 display:contents 把子元素提升到顶栏 flex 流里排序。
   */
  .sidebar {
    width: 100%;
    height: auto;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    row-gap: 2px;
    column-gap: var(--space-xs);
    padding: var(--space-sm) var(--space-md);
    position: sticky;
    top: 0;
    border-right: none;
    border-bottom: 1px solid var(--color-border);
    box-shadow: var(--shadow-sm);
  }

  .sidebar-brand {
    order: 0;
    margin-bottom: 0;
    font-size: 1rem;
    flex-shrink: 0;
    padding-left: 0;
    gap: var(--space-xs);
  }

  .brand-badge {
    width: 28px;
    height: 28px;
  }

  .brand-badge svg {
    width: 15px;
    height: 15px;
  }

  .theme-toggle,
  .sync-bar,
  .sidebar-footer .nav-link {
    min-width: 44px;
    min-height: 44px;
    justify-content: center;
    padding: var(--space-sm);
    margin-top: 0;
    margin-bottom: 0;
  }

  .theme-toggle {
    order: 1;
  }

  .theme-label {
    display: none;
  }

  /* 同步状态压缩为单个圆点 */
  .sync-bar {
    order: 2;
    cursor: pointer;
  }

  .sync-bar-text {
    display: none;
  }

  .sidebar-footer {
    display: contents;
  }

  .sidebar-footer .nav-link {
    font-size: 0;
    gap: 0;
    border-left: none;
    margin-left: 0;
    border-radius: var(--radius-sm);
  }

  .sidebar-footer .nav-link:nth-of-type(1) { order: 3; }
  .sidebar-footer .nav-link:nth-of-type(2) { order: 4; }

  .sidebar-write {
    order: 5;
    margin-left: auto;
    width: auto;
    font-size: 0.85rem;
    padding: var(--space-xs) var(--space-md);
    min-height: 44px;
  }

  /* 第二行：主导航均分 */
  .sidebar-nav {
    order: 6;
    flex-basis: 100%;
    flex-direction: row;
    justify-content: space-around;
    gap: var(--space-sm);
    border-top: 1px solid var(--color-border);
    margin-top: var(--space-xs);
    padding-top: var(--space-xs);
  }

  .nav-link {
    font-size: 0.85rem;
    white-space: nowrap;
    justify-content: center;
    gap: var(--space-xs);
    border-left: none;
    margin-left: 0;
    padding: var(--space-sm) var(--space-md);
    min-height: 44px;
    min-width: 44px;
    flex: 1;
  }

  .nav-link-active {
    font-size: 0.85rem;
  }

  .main {
    padding: var(--space-md);
  }
}

/* 极窄屏（≤480px）：行1 收得更紧，隐藏品牌文字与底部链接文字 */
@media (max-width: 480px) {
  .brand-text {
    display: none;
  }

  .sidebar-write {
    font-size: 0.8rem;
    padding: var(--space-xs) var(--space-sm);
  }
}
</style>
