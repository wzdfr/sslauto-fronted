<template>
  <div class="login-page">
    <div class="login-box">
      <div class="brand">
        <span class="logo-mark">S</span>
        <div>
          <div class="brand-name">sslauto</div>
          <div class="brand-sub">SSL 证书管理平台</div>
        </div>
      </div>
      <el-form @submit.prevent="submit">
        <el-form-item>
          <el-input v-model="form.username" size="large" placeholder="用户名" :prefix-icon="User" />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            size="large"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="submit">
          登录
        </el-button>
      </el-form>
      <!-- <div class="hint">默认账号 admin / admin123（首次登录后请修改密码）</div> -->
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { api, setToken } from '../api'

const router = useRouter()
const loading = ref(false)
const form = ref({ username: 'admin', password: '' })

async function submit() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    const data = await api('/auth/login', { method: 'POST', body: form.value })
    setToken(data.token)
    router.push('/dashboard')
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #eef4ff, #f7faff);
}
.login-box {
  width: 380px;
  background: #fff;
  border-radius: 12px;
  padding: 36px 32px 24px;
  box-shadow: 0 8px 30px rgba(22, 119, 255, 0.12);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 28px;
}
.logo-mark {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff, #4f9dff);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-name {
  font-size: 20px;
  font-weight: 600;
}
.brand-sub {
  font-size: 12px;
  color: #8a919f;
}
.login-btn {
  width: 100%;
}
.hint {
  margin-top: 16px;
  font-size: 12px;
  color: #8a919f;
  text-align: center;
}
</style>
