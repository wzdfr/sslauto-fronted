import { ref, computed } from 'vue'

/** 当前登录用户信息（含角色与菜单权限） */
export const currentUser = ref({
  username: '',
  nickname: '',
  roleCode: '',
  roleName: '',
  permissions: []
})

export function setCurrentUser(info) {
  currentUser.value = {
    username: info.username || '',
    nickname: info.nickname || '',
    roleCode: info.roleCode || '',
    roleName: info.roleName || '',
    permissions: info.permissions || []
  }
}

/** 是否具备某个权限（支持 module:action 细粒度键；传入模块名时按前缀兼容） */
export function can(perm) {
  if (currentUser.value.roleCode === 'super') {
    return true
  }
  const permissions = currentUser.value.permissions || []
  if (!perm) {
    return false
  }
  if (permissions.indexOf(perm) >= 0) {
    return true
  }
  if (perm.indexOf(':') >= 0) {
    const module = perm.slice(0, perm.indexOf(':'))
    if (permissions.indexOf(module) >= 0) {
      return true
    }
    return false
  }
  for (let i = 0; i < permissions.length; i++) {
    if (permissions[i].indexOf(perm + ':') === 0) {
      return true
    }
  }
  return false
}

/** 侧边栏全局统计缓存（用于导航栏右侧数字角标） */
export const sidebarSummary = ref({
  certTotal: 0,
  certIssued: 0,
  certExpiring: 0,
  serverTotal: 0,
  serverOnline: 0,
  siteTotal: 0,
  deployTotal: 0,
  deploySuccess: 0,
  authTotal: 0
})

export function setSidebarSummary(data) {
  if (!data) return
  sidebarSummary.value = {
    ...sidebarSummary.value,
    ...data
  }
}

/**
 * 7 套工作台主题配色（1:1 对齐参考站点「工作台设置 · 主题外观」）
 * 默认采用「水墨极简黑 (ink)」
 */
export const THEMES = [
  {
    id: 'aurora',
    name: '流光渐变蓝',
    shortName: '流光蓝',
    category: '科技风格',
    desc: '蓝青流光渐变主色与数字微光画布，现代云原生运维科技感',
    dot: '#0284c7',
    primary: '#0284c7',
    primaryHover: '#0369a1',
    primarySoft: '#e0f2fe',
    canvas: '#f4f8fc',
    sidebarBg: '#fbfdff',
    border: '#e2ecf5',
    chart: '#0ea5e9',
    boardAccent: '#0284c7',
    previewTint: '#eff8ff'
  },
  {
    id: 'royal',
    name: '晴空商务蓝',
    shortName: '商务蓝',
    category: '商务风格',
    desc: '沉稳皇家深蓝搭配冷灰白底色，干练利落、层次清晰',
    dot: '#1d4ed8',
    primary: '#1d4ed8',
    primaryHover: '#1e40af',
    primarySoft: '#eff6ff',
    canvas: '#f5f7fb',
    sidebarBg: '#fbfcfe',
    border: '#e5e9f2',
    chart: '#2563eb',
    boardAccent: '#2563eb',
    previewTint: '#eef4ff'
  },
  {
    id: 'danxia',
    name: '丹霞活力红',
    shortName: '活力红',
    category: '热情红韵',
    desc: '温暖朱红至丹橘微渐变，高对比风险预警与值班凝聚感',
    dot: '#dc2626',
    primary: '#dc2626',
    primaryHover: '#b91c1c',
    primarySoft: '#fef2f2',
    canvas: '#fbf7f6',
    sidebarBg: '#fffcfc',
    border: '#f1e4e2',
    chart: '#ea580c',
    boardAccent: '#dc2626',
    previewTint: '#fff5f4'
  },
  {
    id: 'sakura',
    name: '蜜桃樱花粉',
    shortName: '樱花粉',
    category: '可爱风格',
    desc: '柔和樱花玫粉配奶油粉底与圆润卡片圆角，亲切柔和',
    dot: '#db2777',
    primary: '#db2777',
    primaryHover: '#be185d',
    primarySoft: '#fdf2f8',
    canvas: '#fdf7fa',
    sidebarBg: '#fffbfd',
    border: '#f4e3ec',
    chart: '#ec4899',
    boardAccent: '#db2777',
    previewTint: '#fff4f9'
  },
  {
    id: 'mint',
    name: '薄荷晴空青',
    shortName: '薄荷青',
    category: '可爱风格',
    desc: '清爽晴空蓝与薄荷青渐变，圆润灵动、轻快通透',
    dot: '#0d9488',
    primary: '#0d9488',
    primaryHover: '#0f766e',
    primarySoft: '#f0fdfa',
    canvas: '#f3faf9',
    sidebarBg: '#fbfffe',
    border: '#ddeee9',
    chart: '#14b8a6',
    boardAccent: '#0d9488',
    previewTint: '#effcf9'
  },
  {
    id: 'pine',
    name: '松石护眼绿',
    shortName: '护眼绿',
    category: '护眼风格',
    desc: '温润松石翠绿搭配柔和豆沙纸底，长时间值班巡检更舒适',
    dot: '#059669',
    primary: '#059669',
    primaryHover: '#047857',
    primarySoft: '#ecfdf5',
    canvas: '#f4f9f6',
    sidebarBg: '#fbfefb',
    border: '#dfece4',
    chart: '#10b981',
    boardAccent: '#059669',
    previewTint: '#eefaf3'
  },
  {
    id: 'ink',
    name: '水墨极简黑',
    shortName: '极简黑',
    category: '极简原版',
    desc: '原版高对比度黑白灰极简设计，纯粹克制',
    dot: '#18181b',
    primary: '#18181b',
    primaryHover: '#27272a',
    primarySoft: '#f1f3f5',
    canvas: '#f7f8fa',
    sidebarBg: '#fbfbfc',
    border: '#eceef2',
    chart: '#1d6bf3',
    boardAccent: '#2563eb',
    previewTint: '#f5f6f8'
  }
]

const THEME_STORAGE_KEY = 'sslauto_theme_v1'

function loadSavedThemeId() {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (saved && THEMES.some((t) => t.id === saved)) return saved
  } catch {
    // ignore
  }
  return 'ink'
}

export const currentThemeId = ref(loadSavedThemeId())

export const currentTheme = computed(
  () => THEMES.find((t) => t.id === currentThemeId.value) || THEMES[THEMES.length - 1]
)

export function applyTheme(themeId) {
  const target = THEMES.find((t) => t.id === themeId) || THEMES[THEMES.length - 1]
  currentThemeId.value = target.id
  try {
    localStorage.setItem(THEME_STORAGE_KEY, target.id)
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    root.style.setProperty('--wb-primary', target.primary)
    root.style.setProperty('--wb-primary-hover', target.primaryHover)
    root.style.setProperty('--wb-primary-soft', target.primarySoft)
    root.style.setProperty('--wb-canvas', target.canvas)
    root.style.setProperty('--wb-sidebar-bg', target.sidebarBg)
    root.style.setProperty('--wb-border', target.border)
    root.style.setProperty('--wb-chart', target.chart)
    root.style.setProperty('--wb-board-accent', target.boardAccent)
    root.style.setProperty('--el-color-primary', target.id === 'ink' ? '#18181b' : target.primary)
    root.style.setProperty('--el-color-primary-dark-2', target.primaryHover)
    root.style.setProperty('--el-color-primary-light-3', target.primaryHover)
    root.style.setProperty('--el-color-primary-light-9', target.primarySoft)
  }
}

export function cycleTheme() {
  const idx = THEMES.findIndex((t) => t.id === currentThemeId.value)
  const next = THEMES[(idx + 1) % THEMES.length]
  applyTheme(next.id)
  return next
}

// 启动时立即应用已保存主题
if (typeof document !== 'undefined') {
  applyTheme(currentThemeId.value)
}

/** 个人与值班待办清单（侧边栏 + 首页右侧面板实时同步） */
const TODO_STORAGE_KEY = 'sslauto_shift_todos_v1'

const defaultShiftTodos = [
  { id: 't1', text: '核查本月 30 天内临期证书自动续签通道', done: false },
  { id: 't2', text: '巡检核心网关 Nginx 节点证书指纹一致性', done: false },
  { id: 't3', text: '清理并接管服务器扫描发现的存量站点', done: false },
  { id: 't4', text: '归档上周 TLS 证书变更与安全审计周报', done: true }
]

function loadShiftTodos() {
  try {
    const raw = localStorage.getItem(TODO_STORAGE_KEY)
    if (!raw) return [...defaultShiftTodos]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [...defaultShiftTodos]
  } catch {
    return [...defaultShiftTodos]
  }
}

export const shiftTodos = ref(loadShiftTodos())

function persistTodos() {
  try {
    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(shiftTodos.value))
  } catch {
    // ignore
  }
}

export function addShiftTodo(text) {
  const clean = String(text || '').trim()
  if (!clean) return
  shiftTodos.value.unshift({
    id: 'todo_' + Date.now(),
    text: clean,
    done: false
  })
  persistTodos()
}

export function toggleShiftTodo(id) {
  const hit = shiftTodos.value.find((t) => t.id === id)
  if (hit) {
    hit.done = !hit.done
    persistTodos()
  }
}

export function removeShiftTodo(id) {
  shiftTodos.value = shiftTodos.value.filter((t) => t.id !== id)
  persistTodos()
}

/** CLM 续期与分级告警升级策略 */
const POLICY_KEY = 'sslauto_alert_policy_v1'

const defaultPolicy = {
  autoRenewDaysBefore: 30,
  warnDaysThreshold: 30,
  urgentDaysThreshold: 7,
  postDeployVerify: true,
  autoRollbackOnNginxFail: true,
  channels: {
    webhook: true,
    email: true,
    smsEscalation: false
  },
  webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/sslauto-ops-alert',
  escalationOwner: 'SRE 值班组 -> 基础架构负责人'
}

function loadSavedPolicy() {
  try {
    const raw = localStorage.getItem(POLICY_KEY)
    if (!raw) return { ...defaultPolicy }
    return { ...defaultPolicy, ...JSON.parse(raw) }
  } catch {
    return { ...defaultPolicy }
  }
}

export const clmPolicy = ref(loadSavedPolicy())

export function saveClmPolicy(next) {
  clmPolicy.value = { ...clmPolicy.value, ...next }
  try {
    localStorage.setItem(POLICY_KEY, JSON.stringify(clmPolicy.value))
  } catch {
    // ignore storage quota errors
  }
}
