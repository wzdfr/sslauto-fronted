import { ref } from 'vue'
import { ElMessage } from 'element-plus'

/**
 * 统一时间格式化：兼容后端返回的时间戳（秒/毫秒）、ISO 字符串与普通日期字符串。
 * 输出本地时区的 "YYYY-MM-DD HH:mm:ss"，无效/空值返回 "-"。
 */
export function formatDate(value) {
  if (value === null || value === undefined || value === '') return '-'
  let date
  if (typeof value === 'number') {
    date = new Date(value < 1e11 ? value * 1000 : value)
  } else {
    const text = String(value).trim()
    if (!text) return '-'
    if (/^\d+$/.test(text)) {
      const num = Number(text)
      date = new Date(num < 1e11 ? num * 1000 : num)
    } else {
      date = new Date(text.replace(' ', 'T'))
    }
  }
  if (!date || isNaN(date.getTime())) return String(value)
  return fmt(date)
}

/** 仅日期部分 "YYYY-MM-DD" */
export function formatDay(value) {
  const text = formatDate(value)
  return text === '-' ? '-' : text.slice(0, 10)
}

function fmt(date) {
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    ' ' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds())
  )
}

function pad(n) {
  return n < 10 ? '0' + n : String(n)
}

/** 安全解析 domains JSON 数组字符串 */
export function parseDomains(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : [String(raw)]
  } catch {
    return String(raw).split(/[\s,]+/).filter(Boolean)
  }
}

/** 计算距今剩余天数（负数代表已过期天数，null 代表未知） */
export function calcDaysDiff(value) {
  if (value === null || value === undefined || value === '') return null
  const d = typeof value === 'number'
    ? new Date(value < 1e11 ? value * 1000 : value)
    : new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return null
  return Math.floor((d.getTime() - Date.now()) / 86400000)
}

export const BRAND_MAP = {
  LETSENCRYPT: "Let's Encrypt",
  ZEROSSL: 'ZeroSSL',
  GOOGLE: 'Google Trust',
  LITESSL: 'LiteSSL',
  INTERNAL: '内置私有 CA',
  UPLOAD: '商业导入'
}

export function brandLabel(v) {
  return BRAND_MAP[v] || v || '-'
}

export const PROVIDER_LIST = [
  { value: 'aliyun', label: '阿里云 DNS', autoDns: true },
  { value: 'cloudflare', label: 'Cloudflare', autoDns: true },
  { value: 'tencent', label: '腾讯云 DNSPod', autoDns: true },
  { value: 'huawei', label: '华为云 DNS', autoDns: false },
  { value: 'volcengine', label: '火山引擎', autoDns: false },
  { value: 'baidu', label: '百度智能云', autoDns: false },
  { value: 'qiniu', label: '七牛云', autoDns: false },
  { value: 'leidian', label: '雷池 WAF', autoDns: false },
  { value: 'west', label: '西部数码', autoDns: false },
  { value: 'godaddy', label: 'GoDaddy', autoDns: false },
  { value: 'namecheap', label: 'Namecheap', autoDns: false },
  { value: 'ns1', label: 'NS1', autoDns: false }
]

export function providerLabel(v) {
  if (!v) return '-'
  const lower = String(v).toLowerCase()
  const hit = PROVIDER_LIST.find((p) => p.value === lower)
  return hit ? hit.label : v
}

export const ENV_MAP = {
  prod: '生产环境 (prod)',
  staging: '预发环境 (staging)',
  test: '测试环境 (test)',
  dev: '开发环境 (dev)'
}

export function envShortLabel(v) {
  return { prod: '生产', staging: '预发', test: '测试', dev: '开发' }[v] || v || '未标记'
}

export async function copyToClipboard(text, successMsg = '已复制到剪贴板') {
  try {
    await navigator.clipboard.writeText(String(text || ''))
    ElMessage.success(successMsg)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = String(text || '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      ElMessage.success(successMsg)
    } catch {
      ElMessage.error('复制失败，请手动选择文本复制')
    }
    document.body.removeChild(ta)
  }
}

export const isFullscreen = ref(false)

if (typeof document !== 'undefined') {
  document.addEventListener('fullscreenchange', () => {
    isFullscreen.value = Boolean(document.fullscreenElement)
  })
}

export async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
      isFullscreen.value = true
    } else {
      await document.exitFullscreen()
      isFullscreen.value = false
    }
  } catch {
    ElMessage.info('当前预览窗口受限，请在新标签页打开后使用全屏视图')
  }
}
