<template>
  <el-container class="layout">
    <el-aside width="216px" class="aside">
      <div class="logo">
        <span class="logo-mark">S</span>
        <span class="logo-text">sslauto</span>
      </div>
      <el-menu :default-active="activePath" router class="menu">
        <el-menu-item v-if="can('dashboard')" index="/dashboard">
          <el-icon><HomeFilled /></el-icon><span>首页概览</span>
        </el-menu-item>
        <el-menu-item v-if="can('auth')" index="/auth">
          <el-icon><Key /></el-icon><span>云服务授权</span>
        </el-menu-item>
        <el-menu-item v-if="can('cert')" index="/cert">
          <el-icon><Tickets /></el-icon><span>证书管理</span>
        </el-menu-item>
        <el-menu-item v-if="can('cert')" index="/cert/assets">
          <el-icon><Collection /></el-icon><span>证书资产中心</span>
        </el-menu-item>
        <el-menu-item v-if="can('deploy')" index="/deploy">
          <el-icon><Upload /></el-icon><span>自动部署</span>
        </el-menu-item>
        <el-menu-item v-if="can('agent')" index="/agent">
          <el-icon><Monitor /></el-icon><span>服务器 Agent</span>
        </el-menu-item>
        <el-menu-item v-if="can('system')" index="/system">
          <el-icon><Setting /></el-icon><span>系统管理</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-title">{{ pageTitle }}</div>
        <el-dropdown @command="onCommand">
          <span class="user">
            <el-avatar :size="28" class="avatar">{{ initial }}</el-avatar>
            <span class="nick">{{ nickname }}</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="roleName" disabled>角色：{{ roleName }}</el-dropdown-item>
              <el-dropdown-item command="password" divided>修改密码</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>

    <el-dialog v-model="pwdVisible" title="修改密码" width="420px">
      <el-form label-width="90px">
        <el-form-item label="原密码">
          <el-input v-model="pwd.oldPassword" type="password" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwd.newPassword" type="password" placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdVisible = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确定</el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { HomeFilled, Key, Tickets, Upload, Monitor, Setting, ArrowDown } from '@element-plus/icons-vue'
import { api, clearToken } from '../api'
import { can, currentUser, setCurrentUser } from '../store'

const route = useRoute()
const router = useRouter()
const nickname = ref('')
const pwdVisible = ref(false)
const pwd = ref({ oldPassword: '', newPassword: '' })

const activePath = computed(() => route.path)
const pageTitle = computed(() => (route.meta && route.meta.title) || '')
const initial = computed(() => (nickname.value || 'U').slice(0, 1).toUpperCase())
const roleName = computed(() => currentUser.value.roleName || '')

onMounted(async () => {
  try {
    const info = await api('/auth/info')
    setCurrentUser(info)
    nickname.value = info.nickname || info.username
  } catch (e) {
    clearToken()
    router.push('/login')
  }
})

async function onCommand(cmd) {
  if (cmd === 'password') {
    pwdVisible.value = true
    return
  }
  if (cmd === 'logout') {
    try {
      await api('/auth/logout', { method: 'POST', body: {} })
    } catch (e) {
      /* 忽略 */
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

<script>
export default { name: 'LayoutView' }
</script>

<style scoped>
.layout {
  height: 100vh;
}
.aside {
  background: #fff;
  border-right: 1px solid #ebeef5;
}
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 20px;
}
.logo-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1677ff, #4f9dff);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-text {
  font-size: 17px;
  font-weight: 600;
}
.menu {
  border-right: none;
}
.header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}
.header-title {
  font-size: 15px;
  font-weight: 600;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #1f2329;
  outline: none;
}
.avatar {
  background: #1677ff;
  color: #fff;
  font-size: 13px;
}
.nick {
  font-size: 14px;
}
.main {
  background: #f5f7fb;
  padding: 20px;
}
</style>
