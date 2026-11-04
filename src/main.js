import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import router from './router'
import './styles.css'

// Stabilize Element Plus el-table ResizeObserver callbacks across frames and silence benign browser loop notifications
if (typeof window !== 'undefined') {
  const NativeResizeObserver = window.ResizeObserver
  if (NativeResizeObserver) {
    window.ResizeObserver = class SafeResizeObserver extends NativeResizeObserver {
      constructor(callback) {
        let rafId = 0
        super((entries, observer) => {
          if (rafId) cancelAnimationFrame(rafId)
          rafId = requestAnimationFrame(() => {
            rafId = 0
            callback(entries, observer)
          })
        })
      }
    }
  }

  window.addEventListener(
    'error',
    (event) => {
      const msg = String(event?.message || '')
      if (
        msg.includes('ResizeObserver loop completed with undelivered notifications') ||
        msg.includes('ResizeObserver loop limit exceeded')
      ) {
        event.stopImmediatePropagation()
        event.preventDefault()
      }
    },
    true
  )

  window.addEventListener('unhandledrejection', (event) => {
    if (event?.reason?.isAuthError) {
      event.preventDefault()
    }
  })
}

const app = createApp(App)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
app.mount('#app')
