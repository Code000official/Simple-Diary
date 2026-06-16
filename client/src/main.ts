/**
 * 应用入口文件
 *
 * 初始化流程：
 * 1. 创建 Vue 应用实例
 * 2. 挂载路由插件
 * 3. 挂载根组件 App.vue
 * 4. 将应用挂载到 DOM 的 #app 元素
 *
 * 为什么不在 main.ts 中引入全局 CSS？
 * - App.vue 中引入更符合组件化理念
 * - 每个组件管理自己的样式，便于维护
 */

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/main.css'

// 创建 Vue 应用实例并挂载
const app = createApp(App)
app.use(router)
app.mount('#app')
