import { ref } from 'vue'
import { ElMessage } from 'element-plus'

const TOKEN_KEY = 'sslauto_token'
const LOGOUT_FLAG = 'sslauto_logged_out'
let lastAuthRedirectAt = 0
let modeInitialized = false

/** 是否运行在本地内置演示沙箱模式（未连接真实 Java 后端时为 true） */
export const isSandboxMode = ref(false)

/** 启动时探测后端运行模式：连接真实后端时绝不注入演示 token */
export async function initRuntimeMode() {
  if (modeInitialized) return
  modeInitialized = true
  try {
    const resp = await fetch('/api/runtime-mode')
    const json = await resp.json()
    const sandbox = Boolean(json?.data?.sandbox)
    isSandboxMode.value = sandbox
    if (!sandbox) {
      if (localStorage.getItem(TOKEN_KEY) === 'demo-super-token') {
        localStorage.removeItem(TOKEN_KEY)
      }
    } else if (!localStorage.getItem(TOKEN_KEY) && localStorage.getItem(LOGOUT_FLAG) !== '1') {
      localStorage.setItem(TOKEN_KEY, 'demo-super-token')
    }
  } catch {
    isSandboxMode.value = false
    if (localStorage.getItem(TOKEN_KEY) === 'demo-super-token') {
      localStorage.removeItem(TOKEN_KEY)
    }
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.removeItem(LOGOUT_FLAG)
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.setItem(LOGOUT_FLAG, '1')
}

function handleUnauthorized(message) {
  clearToken()
  const now = Date.now()
  if (now - lastAuthRedirectAt > 2000) {
    lastAuthRedirectAt = now
    if (!window.location.hash.startsWith('#/login')) {
      ElMessage.warning(message || '登录状态已失效，请重新登录')
    }
  }
  if (!window.location.hash.startsWith('#/login')) {
    window.location.hash = '#/login'
  }
  const err = new Error(message || '未登录或会话已过期')
  err.isAuthError = true
  return err
}

/**
 * 统一 API 请求：/api/**，自动携带 X-Token。
 * 返回后端 JsonResult 的 data 字段；失败抛出 Error。
 */
export async function api(path, options = {}) {
  const { method = 'GET', body, blob = false } = options
  const token = getToken()
  const headers = {}
  if (token) {
    headers['X-Token'] = token
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const resp = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (blob) {
    if (resp.status === 401) throw handleUnauthorized('登录已失效，请重新登录')
    if (!resp.ok) throw new Error('下载失败 HTTP ' + resp.status)
    return resp.blob()
  }
  let json
  try {
    json = await resp.json()
  } catch {
    if (resp.status === 401) throw handleUnauthorized('登录已失效，请重新登录')
    throw new Error('服务响应异常 HTTP ' + resp.status)
  }
  if (json.code === 401) {
    throw handleUnauthorized(json.message || '未登录或会话已过期')
  }
  if (json.code !== 200) {
    throw new Error(json.message || '请求失败')
  }
  return json.data
}

/** 包装调用，失败统一弹错（401 统一由 handleUnauthorized 跳转，不重复弹窗） */
export async function call(path, options) {
  try {
    return await api(path, options)
  } catch (e) {
    if (!e?.isAuthError) {
      ElMessage.error(e.message || '请求失败')
    }
    throw e
  }
}

/** 触发文件流下载（使用 fetch + Blob 避免 iframe 内 window.open 被拦截，并携带 ?token= 查询参数） */
export async function download(path, fallbackFilename = 'certificate-bundle') {
  const sep = path.includes('?') ? '&' : '?'
  const url = '/api' + path + sep + 'token=' + encodeURIComponent(getToken())
  try {
    const resp = await fetch(url)
    if (resp.status === 401) {
      throw handleUnauthorized('登录已失效，请重新登录')
    }
    if (!resp.ok) {
      throw new Error('下载失败 (HTTP ' + resp.status + ')')
    }
    const disposition = resp.headers.get('Content-Disposition') || ''
    let filename = fallbackFilename
    const match = disposition.match(/filename="?([^";]+)"?/i)
    if (match && match[1]) {
      try {
        filename = decodeURIComponent(match[1])
      } catch {
        filename = match[1]
      }
    }
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500)
    ElMessage.success('证书文件已开始下载：' + filename)
  } catch (e) {
    if (!e?.isAuthError) {
      ElMessage.error(e.message || '下载失败')
    }
  }
}
