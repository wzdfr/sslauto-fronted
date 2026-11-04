<template>
  <div class="wb-shell">
    <!-- 左侧持久化工作台边栏（1:1 对齐参考站点布局） -->
    <aside :class="['wb-sidebar', { open: mobileOpen }]">
      <div class="sidebar-scroll">
        <!-- 1. 顶部品牌标识 -->
        <div class="brand-header" @click="go('/dashboard')">
          <div class="brand-squircle">
            <svg viewBox="0 0 24 24" class="brand-svg" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 3l7 3v5c0 4.8-3 9.1-7 10.5C8 20.1 5 15.8 5 11V6l7-3z" />
              <path d="M9.5 12l2 2 3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="brand-copy">
            <div class="brand-title">SSLAuto 工作台</div>
            <div class="brand-sub">多环境 TLS 生命周期</div>
          </div>
        </div>

        <!-- 2. 全局圆角快速搜索框 -->
        <div class="sidebar-search">
          <el-icon class="search-icon"><Search /></el-icon>
          <input
            v-model="quickKeyword"
            type="text"
            placeholder="搜索域名 / 证书 / IP"
            @keyup.enter="submitQuickSearch"
          />
        </div>

        <!-- 3. 可折叠「今日待办」迷你白卡（与首页右侧待办实时同步） -->
        <div class="sidebar-todo-card">
          <div class="todo-card-head">
            <div class="todo-head-left" @click="todoExpanded = !todoExpanded">
              <el-icon class="todo-list-icon"><List /></el-icon>
              <span class="todo-today-label">今日</span>
              <span class="todo-date mono">{{ todayShort }}</span>
              <span class="todo-count-chip">待办 {{ pendingTodoCount }}</span>
            </div>
            <div class="todo-head-actions">
              <button
                type="button"
                class="todo-icon-btn"
                title="新增待办"
                @click="addingTodo = !addingTodo"
              >
                +
              </button>
              <button
                type="button"
                class="todo-icon-btn"
                :title="todoExpanded ? '收起' : '展开'"
                @click="todoExpanded = !todoExpanded"
              >
                <el-icon>
                  <ArrowUp v-if="todoExpanded" />
                  <ArrowDown v-else />
                </el-icon>
              </button>
            </div>
          </div>

          <div v-if="addingTodo" class="todo-quick-add">
            <input
              v-model="newTodoText"
              type="text"
              placeholder="输入运维待办，回车添加..."
              @keyup.enter="confirmAddTodo"
            />
          </div>

          <div v-if="todoExpanded" class="todo-card-list">
            <label
              v-for="item in activeSidebarTodos"
              :key="item.id"
              class="todo-check-row"
            >
              <input
                type="checkbox"
                :checked="item.done"
                class="todo-checkbox"
                @change="toggleShiftTodo(item.id)"
              />
              <span :class="['todo-item-text', { done: item.done }]">{{ item.text }}</span>
            </label>
            <div v-if="!activeSidebarTodos.length" class="todo-empty">
              今日待办已全部完成
            </div>
          </div>
        </div>

        <!-- 4. 主导航列表（带右侧数字角标） -->
        <nav class="primary-nav" aria-label="主导航">
          <button
            v-for="item in visibleNavItems"
            :key="item.path"
            type="button"
            :class="['nav-item', { active: isRouteActive(item.path) }]"
            @click="go(item.path)"
          >
            <el-icon class="nav-icon"><component :is="item.icon" /></el-icon>
            <span class="nav-label">{{ item.label }}</span>
            <span
              v-if="item.badge !== null && item.badge !== undefined && item.badge !== ''"
              class="nav-badge mono"
            >
              {{ item.badge }}
            </span>
          </button>
        </nav>

        <!-- 5. 快捷动作区 -->
        <div class="sidebar-quick-section">
          <div class="quick-sec-title">快捷操作</div>
          <button
            v-if="can('cert:apply')"
            type="button"
            class="quick-link-row"
            @click="go('/cert/apply')"
          >
            <el-icon class="quick-icon"><Plus /></el-icon>
            <span class="quick-text">申请新域名 SSL 证书...</span>
          </button>
          <button
            type="button"
            class="quick-link-row"
            @click="go('/probe')"
          >
            <el-icon class="quick-icon"><Aim /></el-icon>
            <span class="quick-text">检测线上 443 证书链一致性...</span>
          </button>
        </div>
      </div>

      <!-- 6. 底部主题切换、设置与当前登录身份 -->
      <div class="sidebar-bottom">
        <button
          type="button"
          class="bottom-action-row"
          title="点击快速切换下一套主题配色"
          @click="handleQuickThemeSwitch"
        >
          <div class="bottom-row-left">
            <el-icon class="nav-icon"><Brush /></el-icon>
            <span>主题 · {{ currentTheme.shortName }}</span>
          </div>
          <span class="theme-swatch-dot" :style="{ background: currentTheme.dot }" />
        </button>

        <button
          type="button"
          :class="['bottom-action-row', { active: route.path === '/settings' }]"
          @click="go('/settings')"
        >
          <div class="bottom-row-left">
            <el-icon class="nav-icon"><Setting /></el-icon>
            <span>设置</span>
          </div>
        </button>

        <el-dropdown trigger="click" class="w-full" @command="onAccountCommand">
          <div class="user-profile-row">
            <div class="user-avatar-circle">{{ initial }}</div>
            <div class="user-profile-meta">
              <div class="user-display-name">{{ nickname || '管理员' }}</div>
              <div class="user-role-line">{{ roleName || '系统默认会话' }}</div>
            </div>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="settings">工作台与主题设置</el-dropdown-item>
              <el-dropdown-item command="password">修改个人密码</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出当前账号</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </aside>

    <!-- 移动端遮罩 -->
    <div v-if="mobileOpen" class="mobile-backdrop" @click="mobileOpen = false" />

    <!-- 右侧主视口画布 -->
    <div class="wb-viewport">
      <!-- 仅移动端显示的紧凑顶栏 -->
      <header class="mobile-topbar">
        <button type="button" class="mobile-menu-btn" @click="mobileOpen = !mobileOpen">
          <el-icon><Menu /></el-icon>
        </button>
        <span class="mobile-bar-title">{{ pageTitle }}</span>
        <button
          v-if="can('cert:apply')"
          type="button"
          class="wb-btn wb-btn-primary !h-7 !px-3 !text-xs"
          @click="go('/cert/apply')"
        >
          + 申请
        </button>
      </header>

      <!-- 主内容区（首页全屏铺满三栏，子页面优雅内边距） -->
      <main :class="['wb-main', { 'is-dashboard': route.path === '/dashboard' }]">
        <div :class="route.path === '/dashboard' ? 'wb-dashboard-wrap' : 'wb-container'">
          <router-view />
        </div>
      </main>
    </div>

    <!-- 修改个人密码弹窗 -->
    <el-dialog v-model="pwdVisible" title="修改个人登录密码" width="420px">
      <el-form label-position="top">
        <el-form-item label="当前原密码">
          <el-input v-model="pwd.oldPassword" type="password" show-password placeholder="请输入当前密码" />
        </el-form-item>
        <el-form-item label="设置新密码">
          <el-input v-model="pwd.newPassword" type="password" show-password placeholder="至少 6 位字符" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="pwdVisible = false">取消</button>
        <button type="button" class="wb-btn wb-btn-primary ml-2" @click="changePassword">
          确认更新
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Grid,
  Collection,
  Tickets,
  Upload,
  Monitor,
  DataAnalysis,
  Key,
  User,
  Setting,
  Brush,
  Search,
  List,
  ArrowUp,
  ArrowDown,
  Plus,
  Aim,
  Menu
} from '@element-plus/icons-vue'
import { api, clearToken } from '../api'
import {
  can,
  currentUser,
  setCurrentUser,
  sidebarSummary,
  setSidebarSummary,
  currentTheme,
  cycleTheme,
  shiftTodos,
  addShiftTodo,
  toggleShiftTodo
} from '../store'

const route = useRoute()
const router = useRouter()
const nickname = ref('')
const mobileOpen = ref(false)
const quickKeyword = ref('')
const todoExpanded = ref(true)
const addingTodo = ref(false)
const newTodoText = ref('')

const pwdVisible = ref(false)
const pwd = ref({ oldPassword: '', newPassword: '' })

const todayShort = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()}`
})

const pendingTodoCount = computed(() => shiftTodos.value.filter((t) => !t.done).length)
const activeSidebarTodos = computed(() => shiftTodos.value.slice(0, 5))

const navItems = computed(() => [
  {
    path: '/dashboard',
    label: '中枢看板',
    icon: Grid,
    perm: 'dashboard',
    badge: null
  },
  {
    path: '/cert/assets',
    label: '证书档案',
    icon: Collection,
    perm: 'cert',
    badge: sidebarSummary.value.certTotal || ''
  },
  {
    path: '/cert',
    label: '签发与续期',
    icon: Tickets,
    perm: 'cert',
    badge: sidebarSummary.value.certExpiring > 0 ? `${sidebarSummary.value.certExpiring}临期` : ''
  },
  {
    path: '/probe',
    label: '态势与真机核验',
    icon: DataAnalysis,
    perm: 'cert',
    badge: null
  },
  {
    path: '/deploy',
    label: '自动部署',
    icon: Upload,
    perm: 'deploy',
    badge: sidebarSummary.value.deployTotal || ''
  },
  {
    path: '/agent',
    label: '服务器节点',
    icon: Monitor,
    perm: 'agent',
    badge: sidebarSummary.value.serverTotal || ''
  },
  {
    path: '/auth',
    label: '云 DNS 授权',
    icon: Key,
    perm: 'auth',
    badge: sidebarSummary.value.authTotal || ''
  },
  {
    path: '/system',
    label: '权限与审计',
    icon: User,
    perm: 'system',
    badge: null
  }
])

const visibleNavItems = computed(() => navItems.value.filter((it) => can(it.perm)))

const pageTitle = computed(() => (route.meta && route.meta.title) || '工作台')
const initial = computed(() => (nickname.value || '管').slice(0, 1).toUpperCase())
const roleName = computed(() => currentUser.value.roleName || '')

function isRouteActive(targetPath) {
  if (targetPath === '/cert') {
    return route.path === '/cert' || route.path === '/cert/apply'
  }
  if (targetPath === '/cert/assets') {
    return route.path.startsWith('/cert/assets')
  }
  return route.path === targetPath
}

function go(path) {
  mobileOpen.value = false
  router.push(path)
}

function submitQuickSearch() {
  const kw = quickKeyword.value.trim()
  mobileOpen.value = false
  router.push({ path: '/cert/assets', query: kw ? { keyword: kw } : {} })
}

function confirmAddTodo() {
  if (!newTodoText.value.trim()) return
  addShiftTodo(newTodoText.value)
  newTodoText.value = ''
  addingTodo.value = false
  todoExpanded.value = true
}

function handleQuickThemeSwitch() {
  const next = cycleTheme()
  ElMessage.success(`已切换主题：${next.name}`)
}

async function refreshSidebarSummary() {
  try {
    const sum = await api('/dashboard/summary')
    setSidebarSummary(sum)
  } catch {
    // ignore background summary error
  }
}

onMounted(async () => {
  try {
    const info = await api('/auth/info')
    setCurrentUser(info)
    nickname.value = info.nickname || info.username
    refreshSidebarSummary()
  } catch {
    clearToken()
    router.push('/login')
  }
})

async function onAccountCommand(cmd) {
  if (cmd === 'settings') {
    go('/settings')
    return
  }
  if (cmd === 'password') {
    pwdVisible.value = true
    return
  }
  if (cmd === 'logout') {
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } catch {
      // ignore
    }
    clearToken()
    router.push('/login')
  }
}

async function changePassword() {
  if (!pwd.value.newPassword || pwd.value.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  try {
    await api('/auth/password', { method: 'POST', body: pwd.value })
    ElMessage.success('密码修改成功')
    pwdVisible.value = false
    pwd.value = { oldPassword: '', newPassword: '' }
  } catch (e) {
    ElMessage.error(e.message)
  }
}
</script>

<style scoped>
.wb-shell {
  min-height: 100vh;
  display: flex;
  background: var(--wb-canvas);
}

/* 左侧固定工作台栏（222px 宽，与参考图一致） */
.wb-sidebar {
  width: 222px;
  flex-shrink: 0;
  background: var(--wb-sidebar-bg);
  border-right: 1px solid var(--wb-border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 40;
  user-select: none;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 1. 品牌头 */
.brand-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2px 4px 4px;
  cursor: pointer;
}

.brand-squircle {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--wb-primary);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-svg {
  width: 19px;
  height: 19px;
}

.brand-copy {
  min-width: 0;
}

.brand-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #111827;
  line-height: 1.2;
}

.brand-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

/* 2. 圆角搜索框 */
.sidebar-search {
  height: 32px;
  padding: 0 11px;
  border-radius: 999px;
  background: #f1f3f6;
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-icon {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}

.sidebar-search input {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  color: #111827;
}

.sidebar-search input::placeholder {
  color: #9ca3af;
}

/* 3. 今日待办卡片 */
.sidebar-todo-card {
  background: #ffffff;
  border: 1px solid #eceef2;
  border-radius: 12px;
  padding: 9px 10px;
}

.todo-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.todo-head-left {
  display: flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  min-width: 0;
}

.todo-list-icon {
  font-size: 13px;
  color: #374151;
}

.todo-today-label {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}

.todo-date {
  font-size: 11px;
  color: #9ca3af;
}

.todo-count-chip {
  font-size: 10.5px;
  font-weight: 600;
  color: #4b5563;
  background: #f3f4f6;
  padding: 1px 6px;
  border-radius: 999px;
}

.todo-head-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

.todo-icon-btn {
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 5px;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.todo-icon-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.todo-quick-add {
  margin-top: 7px;
}

.todo-quick-add input {
  width: 100%;
  height: 27px;
  padding: 0 8px;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
  font-size: 11.5px;
  outline: none;
}

.todo-card-list {
  margin-top: 7px;
  max-height: 132px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.todo-check-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  cursor: pointer;
  font-size: 11.5px;
  line-height: 1.4;
  color: #374151;
}

.todo-checkbox {
  margin-top: 2px;
  accent-color: var(--wb-primary);
  cursor: pointer;
}

.todo-item-text.done {
  color: #9ca3af;
  text-decoration: line-through;
}

.todo-empty {
  font-size: 11.5px;
  color: #9ca3af;
  padding: 4px 0;
}

/* 4. 主导航列表 */
.primary-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 2px;
}

.nav-item {
  width: 100%;
  border: none;
  background: transparent;
  height: 36px;
  padding: 0 11px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.14s ease;
}

.nav-item:hover {
  background: #f2f4f7;
  color: #111827;
}

.nav-item.active {
  background: var(--wb-primary-soft);
  color: #111827;
  font-weight: 700;
}

.nav-icon {
  font-size: 15px;
  flex-shrink: 0;
}

.nav-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nav-badge {
  font-size: 11px;
  font-weight: 500;
  color: #9ca3af;
}

/* 5. 快捷动作区 */
.sidebar-quick-section {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid #f1f3f6;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-sec-title {
  padding: 0 8px 4px;
  font-size: 11px;
  color: #9ca3af;
}

.quick-link-row {
  border: none;
  background: transparent;
  padding: 6px 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.quick-link-row:hover {
  background: #f3f4f6;
  color: #111827;
}

.quick-icon {
  font-size: 13px;
  color: #9ca3af;
  flex-shrink: 0;
}

.quick-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 6. 底部固定栏 */
.sidebar-bottom {
  padding: 8px 12px 12px;
  border-top: 1px solid #f1f3f6;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.bottom-action-row {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: none;
  background: transparent;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #4b5563;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.14s ease;
}

.bottom-action-row:hover,
.bottom-action-row.active {
  background: var(--wb-primary-soft);
  color: #111827;
  font-weight: 600;
}

.bottom-row-left {
  display: flex;
  align-items: center;
  gap: 9px;
}

.theme-swatch-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  flex-shrink: 0;
}

.user-profile-row {
  margin-top: 4px;
  padding: 6px 8px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 9px;
  cursor: pointer;
  transition: background-color 0.14s ease;
}

.user-profile-row:hover {
  background: #f2f4f7;
}

.user-avatar-circle {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #18181b;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.user-profile-meta {
  min-width: 0;
}

.user-display-name {
  font-size: 12.5px;
  font-weight: 700;
  color: #111827;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role-line {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 主视口 */
.wb-viewport {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.mobile-topbar {
  display: none;
  height: 50px;
  padding: 0 14px;
  background: #ffffff;
  border-bottom: 1px solid var(--wb-border);
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 30;
}

.mobile-menu-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #374151;
}

.mobile-bar-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.wb-main {
  flex: 1;
  padding: 22px 26px 32px;
  min-width: 0;
}

.wb-main.is-dashboard {
  padding: 0;
}

.wb-container {
  max-width: 1440px;
  margin: 0 auto;
}

.wb-dashboard-wrap {
  min-height: 100vh;
}

.mobile-backdrop {
  display: none;
}

@media (max-width: 960px) {
  .wb-sidebar {
    position: fixed;
    left: -230px;
    top: 0;
    bottom: 0;
    transition: transform 0.2s ease;
  }

  .wb-sidebar.open {
    transform: translateX(230px);
  }

  .mobile-topbar {
    display: flex;
  }

  .mobile-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(17, 24, 39, 0.32);
    z-index: 35;
  }

  .wb-main {
    padding: 16px 14px 26px;
  }
}
</style>
