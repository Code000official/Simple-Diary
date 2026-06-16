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
        <router-link to="/tags" class="nav-link" active-class="nav-link-active">
          🏷️ 标签
        </router-link>
        <router-link to="/settings" class="nav-link" active-class="nav-link-active">
          ⚙️ 设置
        </router-link>
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
import { ref } from 'vue'

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
