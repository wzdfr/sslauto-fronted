import { ElMessage } from 'element-plus'

const TOKEN_KEY = 'sslauto_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

/**
 * 统一 API 请求：/api/**，自动携带 X-Token。
 * 返回后端 JsonResult 的 data 字段；失败抛出 Error。
 */
export async function api(path, options = {}) {
  const { method = 'GET', body, blob = false } = options
  const headers = { 'X-Token': getToken() }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const resp = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  if (blob) {
    if (!resp.ok) throw new Error('下载失败 HTTP ' + resp.status)
    return resp.blob()
  }
  let json
  try {
    json = await resp.json()
  } catch (e) {
    throw new Error('服务响应异常 HTTP ' + resp.status)
  }
  if (json.code === 401) {
    clearToken()
    window.location.hash = '#/login'
    throw new Error(json.message || '未登录')
  }
  if (json.code !== 200) {
    throw new Error(json.message || '请求失败')
  }
  return json.data
}

/** 包装调用，失败统一弹错 */
export async function call(path, options) {
  try {
    return await api(path, options)
  } catch (e) {
    ElMessage.error(e.message)
    throw e
  }
}

/** 触发浏览器下载（携带 token 查询参数，供后端校验） */
export function download(path) {
  const sep = path.includes('?') ? '&' : '?'
  window.open('/api' + path + sep + 'token=' + encodeURIComponent(getToken()), '_blank')
}
