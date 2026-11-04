<template>
  <div class="settings-canvas">
    <div class="settings-card">
      <!-- 顶部栏：工作台设置 + 返回按钮 -->
      <div class="settings-header">
        <h1 class="settings-title">工作台设置</h1>
        <button type="button" class="back-btn" @click="router.push('/dashboard')">
          返回工作台
        </button>
      </div>

      <!-- 双栏主体 -->
      <div class="settings-body">
        <!-- 左侧设置分组菜单 -->
        <aside class="settings-nav">
          <button
            v-for="tab in navTabs"
            :key="tab.id"
            type="button"
            :class="['settings-nav-item', { active: activeSection === tab.id }]"
            @click="activeSection = tab.id"
          >
            <span>{{ tab.label }}</span>
            <el-icon class="nav-item-icon"><component :is="tab.icon" /></el-icon>
          </button>
        </aside>

        <!-- 右侧内容面板 -->
        <div class="settings-content">
          <!-- 1. 主题外观（1:1 还原截图 4） -->
          <template v-if="activeSection === 'theme'">
            <div class="intro-banner">
              <div class="intro-title">页面整体风格与主题配色</div>
              <div class="intro-desc">
                点击任意卡片即可实时切换全局配色、中枢黑板大屏、图表色系与按钮圆角质感（自动保存在本地，不影响导出的 CSV 台账与证书文件）。
              </div>
            </div>

            <div class="wb-tabs" style="margin: 16px 0">
              <button
                v-for="cat in themeCategories"
                :key="cat"
                type="button"
                :class="['wb-tab', { active: selectedCategory === cat }]"
                @click="selectedCategory = cat"
              >
                {{ cat }}
              </button>
            </div>

            <div class="theme-grid">
              <button
                v-for="theme in filteredThemes"
                :key="theme.id"
                type="button"
                :class="['theme-card', { selected: currentThemeId === theme.id }]"
                @click="selectTheme(theme)"
              >
                <!-- 迷你工作台 UI 预览缩略图 -->
                <div class="theme-preview" :style="{ background: theme.previewTint, borderColor: theme.border }">
                  <div class="preview-sidebar" :style="{ background: theme.sidebarBg, borderColor: theme.border }">
                    <span class="preview-logo" :style="{ background: theme.primary }" />
                    <span class="preview-nav-active" :style="{ background: theme.primarySoft }" />
                    <span class="preview-nav-line" />
                    <span class="preview-nav-foot" />
                  </div>
                  <div class="preview-main">
                    <div class="preview-top">
                      <span class="preview-hero-pill" :style="{ background: theme.primary }" />
                      <span class="preview-ghost-pill" />
                    </div>
                    <div class="preview-kpis" :style="{ borderColor: theme.border }">
                      <span class="preview-kpi" />
                      <span class="preview-kpi" />
                      <span class="preview-kpi" />
                      <span class="preview-kpi" />
                    </div>
                  </div>
                </div>

                <!-- 卡片标题行 -->
                <div class="theme-meta-row">
                  <div class="theme-name-wrap">
                    <span class="theme-dot" :style="{ background: theme.dot }" />
                    <span class="theme-name">{{ theme.name }}</span>
                  </div>
                  <div class="theme-badges">
                    <span
                      class="theme-cat-tag"
                      :style="{
                        color: theme.id === 'ink' ? '#374151' : theme.primary,
                        background: theme.primarySoft
                      }"
                    >
                      {{ theme.category }}
                    </span>
                    <span v-if="currentThemeId === theme.id" class="selected-check" aria-label="当前使用">
                      ✓
                    </span>
                  </div>
                </div>

                <div class="theme-desc">{{ theme.desc }}</div>
              </button>
            </div>
          </template>

          <!-- 2. 续期与分级告警策略 -->
          <template v-else-if="activeSection === 'policy'">
            <div class="intro-banner">
              <div class="intro-title">自动续期窗口与多级升级告警策略</div>
              <div class="intro-desc">
                配置公信 DV 证书提前自动续期天数、临期预警阈值与 P2/P1/P0 值班升级通道，防止证书静默过期。
              </div>
            </div>

            <div class="setting-form-list">
              <div class="setting-row">
                <div>
                  <div class="setting-label">提前自动续期窗口（天）</div>
                  <div class="setting-help">Let's Encrypt / Google / ZeroSSL 90 天证书建议提前 30 天自动触发续签</div>
                </div>
                <el-input-number v-model="draftPolicy.autoRenewDaysBefore" :min="7" :max="60" />
              </div>

              <div class="setting-row">
                <div>
                  <div class="setting-label">P2 临期提醒阈值（天）</div>
                  <div class="setting-help">剩余有效期低于该天数时进入工作台「即将到期」预警列表</div>
                </div>
                <el-input-number v-model="draftPolicy.warnDaysThreshold" :min="10" :max="60" />
              </div>

              <div class="setting-row">
                <div>
                  <div class="setting-label">P0 紧急升级阈值（天）</div>
                  <div class="setting-help">剩余天数 ≤ 该值仍未续期成功时升级至架构与安全负责人</div>
                </div>
                <el-input-number v-model="draftPolicy.urgentDaysThreshold" :min="1" :max="20" />
              </div>

              <div class="setting-block">
                <div class="setting-label" style="margin-bottom: 8px">通知渠道与 Webhook 机器人</div>
                <div class="flex flex-wrap gap-5 mb-3">
                  <el-checkbox v-model="draftPolicy.channels.webhook">飞书 / 企微 / 钉钉 Webhook</el-checkbox>
                  <el-checkbox v-model="draftPolicy.channels.email">责任人邮件日报</el-checkbox>
                  <el-checkbox v-model="draftPolicy.channels.smsEscalation">P0 语音/短信升级</el-checkbox>
                </div>
                <el-input
                  v-model="draftPolicy.webhookUrl"
                  placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
                />
              </div>

              <div class="setting-block">
                <div class="setting-label" style="margin-bottom: 6px">升级责任链路说明</div>
                <el-input v-model="draftPolicy.escalationOwner" placeholder="SRE 值班组 -> 基础架构负责人" />
              </div>

              <div class="pt-3 flex justify-end">
                <button type="button" class="wb-btn wb-btn-primary" @click="savePolicySettings">
                  保存续期与告警策略
                </button>
              </div>
            </div>
          </template>

          <!-- 3. 部署与回滚安全护栏 -->
          <template v-else-if="activeSection === 'guardrail'">
            <div class="intro-banner">
              <div class="intro-title">自动部署与故障回滚安全护栏</div>
              <div class="intro-desc">
                确保每次证书续期升版或在线修改 Nginx 配置时“线上服务不挂死、失败可秒级回滚、生效可真机验证”。
              </div>
            </div>

            <div class="setting-form-list">
              <div class="setting-row">
                <div>
                  <div class="setting-label">写前快照与 nginx -t 失败自动回滚</div>
                  <div class="setting-help">Agent 落盘证书与站点配置前自动备份原文件，语法预检报错立即无损还原</div>
                </div>
                <el-switch v-model="draftPolicy.autoRollbackOnNginxFail" />
              </div>

              <div class="setting-row">
                <div>
                  <div class="setting-label">部署完成后自动发起公网 TLS 真机核验</div>
                  <div class="setting-help">比对线上 443 端口实际握手返回的 SHA-256 指纹与平台最新签发版本是否一致</div>
                </div>
                <el-switch v-model="draftPolicy.postDeployVerify" />
              </div>

              <div class="pt-3 flex justify-end">
                <button type="button" class="wb-btn wb-btn-primary" @click="savePolicySettings">
                  保存安全护栏配置
                </button>
              </div>
            </div>
          </template>

          <!-- 4. 账号与登录密码 -->
          <template v-else>
            <div class="intro-banner">
              <div class="intro-title">当前登录身份与密码修改</div>
              <div class="intro-desc">
                当前登录账号：<strong class="mono">{{ currentUser.username || 'admin' }}</strong> ·
                绑定角色：<strong>{{ currentUser.roleName || '管理员' }}</strong>
              </div>
            </div>

            <div class="setting-form-list" style="max-width: 440px">
              <div class="setting-block">
                <label class="setting-label block mb-1.5">当前原密码</label>
                <el-input
                  v-model="pwdForm.oldPassword"
                  type="password"
                  show-password
                  placeholder="请输入当前登录密码"
                />
              </div>

              <div class="setting-block">
                <label class="setting-label block mb-1.5">新登录密码（至少 6 位）</label>
                <el-input
                  v-model="pwdForm.newPassword"
                  type="password"
                  show-password
                  placeholder="请输入新密码"
                />
              </div>

              <div class="pt-2">
                <button
                  type="button"
                  class="wb-btn wb-btn-primary"
                  :disabled="savingPwd"
                  @click="updatePassword"
                >
                  {{ savingPwd ? '正在提交...' : '更新登录密码' }}
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Brush, Bell, Lock, Operation } from '@element-plus/icons-vue'
import { api } from '../api'
import {
  THEMES,
  currentThemeId,
  applyTheme,
  clmPolicy,
  saveClmPolicy,
  currentUser
} from '../store'

const router = useRouter()
const activeSection = ref('theme')
const selectedCategory = ref('全部')

const navTabs = [
  { id: 'theme', label: '主题外观', icon: Brush },
  { id: 'policy', label: '续期与告警', icon: Bell },
  { id: 'guardrail', label: '部署与回滚', icon: Operation },
  { id: 'account', label: '账号与密码', icon: Lock }
]

const themeCategories = ['全部', '科技风格', '商务风格', '可爱风格', '热情红韵', '护眼风格', '极简原版']

const filteredThemes = computed(() => {
  if (selectedCategory.value === '全部') return THEMES
  return THEMES.filter((t) => t.category === selectedCategory.value)
})

const draftPolicy = reactive(JSON.parse(JSON.stringify(clmPolicy.value)))

const pwdForm = reactive({
  oldPassword: '',
  newPassword: ''
})
const savingPwd = ref(false)

function selectTheme(theme) {
  applyTheme(theme.id)
  ElMessage.success(`已切换为「${theme.name}」主题`)
}

function savePolicySettings() {
  saveClmPolicy(JSON.parse(JSON.stringify(draftPolicy)))
  ElMessage.success('工作台治理策略已保存生效')
}

async function updatePassword() {
  if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) {
    ElMessage.warning('新密码长度至少 6 位')
    return
  }
  savingPwd.value = true
  try {
    await api('/auth/password', { method: 'POST', body: pwdForm })
    ElMessage.success('登录密码修改成功')
    pwdForm.oldPassword = ''
    pwdForm.newPassword = ''
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    savingPwd.value = false
  }
}
</script>

<style scoped>
.settings-canvas {
  display: flex;
  justify-content: center;
  padding: 6px 0 28px;
}

.settings-card {
  width: 100%;
  max-width: 980px;
  min-height: 680px;
  background: #ffffff;
  border: 1px solid var(--wb-border);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  padding: 20px 26px;
  border-bottom: 1px solid #f1f3f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.settings-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.back-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #374151;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.back-btn:hover {
  background: #f9fafb;
  border-color: #d1d5db;
  color: #111827;
}

.settings-body {
  flex: 1;
  display: grid;
  grid-template-columns: 196px 1fr;
}

@media (max-width: 760px) {
  .settings-body {
    grid-template-columns: 1fr;
  }
}

.settings-nav {
  padding: 18px 14px;
  border-right: 1px solid #f1f3f6;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-nav-item {
  width: 100%;
  height: 38px;
  padding: 0 14px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #4b5563;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-nav-item:hover {
  background: #f3f4f6;
  color: #111827;
}

.settings-nav-item.active {
  background: var(--wb-primary);
  color: #ffffff;
  font-weight: 600;
}

.nav-item-icon {
  font-size: 14px;
  opacity: 0.85;
}

.settings-content {
  padding: 22px 26px 30px;
  min-width: 0;
}

.intro-banner {
  background: #f7f8fa;
  border: 1px solid #eef0f4;
  border-radius: 12px;
  padding: 14px 16px;
}

.intro-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #111827;
}

.intro-desc {
  margin-top: 3px;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.55;
}

.theme-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

@media (max-width: 640px) {
  .theme-grid {
    grid-template-columns: 1fr;
  }
}

.theme-card {
  text-align: left;
  background: #ffffff;
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.16s ease;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.theme-card:hover {
  border-color: #9ca3af;
}

.theme-card.selected {
  border-color: #111827;
  box-shadow: 0 0 0 1px #111827;
}

.theme-preview {
  height: 82px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  display: grid;
  grid-template-columns: 68px 1fr;
  overflow: hidden;
}

.preview-sidebar {
  padding: 8px;
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.preview-logo {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.preview-nav-active {
  height: 8px;
  width: 100%;
  border-radius: 4px;
}

.preview-nav-line {
  height: 5px;
  width: 68%;
  border-radius: 3px;
  background: #d1d5db;
}

.preview-nav-foot {
  margin-top: auto;
  height: 5px;
  width: 48%;
  border-radius: 3px;
  background: #d1d5db;
}

.preview-main {
  padding: 9px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.preview-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-hero-pill {
  width: 44px;
  height: 13px;
  border-radius: 5px;
}

.preview-ghost-pill {
  width: 24px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.85);
}

.preview-kpis {
  border: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 7px;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}

.preview-kpi {
  height: 10px;
  border-radius: 3px;
  background: #e5e7eb;
}

.theme-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.theme-name-wrap {
  display: flex;
  align-items: center;
  gap: 7px;
}

.theme-dot {
  width: 11px;
  height: 11px;
  border-radius: 999px;
  flex-shrink: 0;
}

.theme-name {
  font-size: 13.5px;
  font-weight: 700;
  color: #111827;
}

.theme-badges {
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-cat-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
}

.selected-check {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #111827;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.theme-desc {
  font-size: 11.5px;
  color: #6b7280;
  line-height: 1.45;
}

.setting-form-list {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid #f1f3f6;
}

.setting-block {
  padding: 14px 0;
  border-bottom: 1px solid #f1f3f6;
}

.setting-label {
  font-size: 13.5px;
  font-weight: 600;
  color: #111827;
}

.setting-help {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
</style>
