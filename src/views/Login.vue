<template>
  <div class="login-shell">
    <div class="login-card">
      <!-- 左侧水墨黑板品牌介绍区 -->
      <div class="login-brand-pane">
        <div>
          <div class="brand-lockup">
            <div class="brand-squircle">
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3l7 3v5c0 4.8-3 9.1-7 10.5C8 20.1 5 15.8 5 11V6l7-3z" />
                <path d="M9.5 12l2 2 3.5-3.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
            <div>
              <div class="brand-title">SSLAuto 工作台</div>
              <div class="brand-kicker">TLS Certificate Lifecycle Management</div>
            </div>
          </div>

          <h1 class="hero-heading">
            面向多域名、多服务器、多环境的 TLS 生命周期管理工作台
          </h1>
          <p class="hero-lead">
            统一发现未知证书、自动续期签发、事务级安全部署、线上真机指纹核验与合规审计，让证书永不静默过期、部署永不破坏线上服务。
          </p>
        </div>

        <div class="pillar-list">
          <div class="pillar-item">
            <div class="pillar-index mono">01</div>
            <div>
              <div class="pillar-name">防静默过期与多级升级告警</div>
              <div class="pillar-desc">到期前自动发起 DNS-01 / HTTP-01 续期，失败即时触发通知</div>
            </div>
          </div>
          <div class="pillar-item">
            <div class="pillar-index mono">02</div>
            <div>
              <div class="pillar-name">写前自动快照与 nginx -t 失败回滚</div>
              <div class="pillar-desc">语法预检通过才平滑重载，杜绝证书更新把线上服务搞挂</div>
            </div>
          </div>
          <div class="pillar-item">
            <div class="pillar-index mono">03</div>
            <div>
              <div class="pillar-name">部署后 443 真机 TLS 握手验证</div>
              <div class="pillar-desc">实时比对线上实际生效证书链与平台签发指纹，杜绝假更新</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单区 -->
      <div class="login-form-pane">
        <div class="form-head">
          <h2>登录工作台</h2>
          <p>请使用平台分配的运维账号与 RBAC 角色凭证登录</p>
        </div>

        <el-form @submit.prevent="submit" class="login-form">
          <el-form-item>
            <label class="field-label">登录账号</label>
            <el-input
              v-model="form.username"
              size="large"
              placeholder="请输入用户名"
              :prefix-icon="User"
            />
          </el-form-item>

          <el-form-item>
            <label class="field-label">登录密码</label>
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="Lock"
              show-password
              @keyup.enter="submit"
            />
          </el-form-item>

          <button
            type="button"
            class="wb-btn wb-btn-primary w-full !h-11 !text-sm mt-2"
            :disabled="loading"
            @click="submit"
          >
            {{ loading ? '正在验证身份...' : '进入工作台' }}
          </button>
        </el-form>

        <div v-if="isSandboxMode" class="quick-roles">
          <div class="quick-title">快速切换角色体验（演示沙箱）</div>
          <div class="quick-btns">
            <button type="button" class="role-btn" @click="quickLogin('admin', '123456')">
              <span class="role-btn-name">超级管理员</span>
              <span class="role-btn-sub mono">admin · 全量权限</span>
            </button>
            <button type="button" class="role-btn" @click="quickLogin('sre_chen', '123456')">
              <span class="role-btn-name">SRE 负责人</span>
              <span class="role-btn-sub mono">sre_chen · 运维操作</span>
            </button>
            <button type="button" class="role-btn" @click="quickLogin('sec_audit', '123456')">
              <span class="role-btn-name">安全审计员</span>
              <span class="role-btn-sub mono">sec_audit · 只读合规</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { api, setToken, isSandboxMode } from '../api'

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

function quickLogin(username, password) {
  form.value = { username, password }
  submit()
}
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--wb-canvas);
}

.login-card {
  width: 100%;
  max-width: 960px;
  background: #ffffff;
  border: 1px solid var(--wb-border);
  border-radius: 22px;
  display: grid;
  grid-template-columns: 1.15fr 1fr;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(17, 24, 39, 0.05);
}

@media (max-width: 820px) {
  .login-card {
    grid-template-columns: 1fr;
  }
  .login-brand-pane {
    display: none !important;
  }
}

.login-brand-pane {
  background: #1e222d;
  color: #f9fafb;
  padding: 44px 40px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 36px;
}

.brand-lockup {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.brand-squircle {
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: #2563eb;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-title {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.brand-kicker {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}

.hero-heading {
  margin: 26px 0 12px;
  font-size: 23px;
  line-height: 1.38;
  font-weight: 700;
  color: #ffffff;
}

.hero-lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #9ca3af;
}

.pillar-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 22px;
}

.pillar-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.pillar-index {
  font-size: 11.5px;
  font-weight: 700;
  color: #60a5fa;
  padding-top: 2px;
}

.pillar-name {
  font-size: 13px;
  font-weight: 600;
  color: #f3f4f6;
}

.pillar-desc {
  font-size: 11.5px;
  color: #9ca3af;
  margin-top: 2px;
}

.login-form-pane {
  padding: 46px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.form-head h2 {
  margin: 0;
  font-size: 21px;
  font-weight: 800;
  color: #111827;
}

.form-head p {
  margin: 6px 0 26px;
  font-size: 12.5px;
  color: #8c95a4;
}

.field-label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 6px;
}

.login-form :deep(.el-form-item__content) {
  display: block;
}

.quick-roles {
  margin-top: 26px;
  padding-top: 18px;
  border-top: 1px solid #f1f3f6;
}

.quick-title {
  font-size: 11.5px;
  color: #8c95a4;
  margin-bottom: 10px;
}

.quick-btns {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.role-btn {
  border: 1px solid #eceef2;
  background: #f8f9fb;
  border-radius: 10px;
  padding: 8px 9px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.role-btn:hover {
  border-color: #111827;
  background: #ffffff;
}

.role-btn-name {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.role-btn-sub {
  display: block;
  font-size: 10.5px;
  color: #8c95a4;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
