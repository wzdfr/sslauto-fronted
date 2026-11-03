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
      // "2026-10-31 03:09:36" 形式在部分浏览器无法直接解析，替换空格为 T
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
