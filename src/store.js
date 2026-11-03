import { ref } from 'vue'

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
  // 历史数据可能只存了模块级键，模块级键视为拥有该模块全部动作
  if (perm.indexOf(':') >= 0) {
    const module = perm.slice(0, perm.indexOf(':'))
    if (permissions.indexOf(module) >= 0) {
      return true
    }
    return false
  }
  // 传入模块名：拥有任意该模块的细粒度权限即视为可见
  for (let i = 0; i < permissions.length; i++) {
    if (permissions[i].indexOf(perm + ':') === 0) {
      return true
    }
  }
  return false
}
