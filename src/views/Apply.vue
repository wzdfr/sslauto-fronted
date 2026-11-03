<template>
  <div class="apply-page">
    <!-- 顶部面包屑/导航 -->
    <div class="page-header">
      <el-page-header @back="goBack" content="申请证书" description="选择域名和验证方式，提交后系统会创建 ACME 订单并生成需要配置的 DNS 记录">
        <template #content>
          <div class="header-content">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/cert' }">证书管理</el-breadcrumb-item>
              <el-breadcrumb-item>申请证书</el-breadcrumb-item>
            </el-breadcrumb>
          </div>
        </template>
      </el-page-header>
    </div>

    <div class="apply-container">
      <!-- 左侧主表单 -->
      <div class="apply-main">
        <el-form label-position="top" class="apply-form" :model="form">
          <!-- 证书名称 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Document /></el-icon></span>
              证书名称
            </div>
            <el-input
              v-model="form.name"
              placeholder="网站/业务的中文名称，如：公司官网、客户A商城（用于列表识别）"
              maxlength="64"
              size="large"
            />
            <div class="form-hint">
              <el-icon><InfoFilled /></el-icon>
              不填写时默认使用第一个域名作为名称；名称可用于搜索和自动部署时识别站点
            </div>
          </div>

          <!-- 域名 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Collection /></el-icon></span>
              域名
              <span class="required">*</span>
            </div>
            <div class="domain-input-area">
              <el-input
                v-model="domainInput"
                placeholder="输入域名后回车添加，如 example.com 或 *.example.com"
                @keyup.enter="addDomain"
                :disabled="form.domains.length >= 100"
                size="large"
              >
                <template #append>
                  <el-button size="large" @click="addDomain">
                    <el-icon><Plus /></el-icon> 添加
                  </el-button>
                </template>
              </el-input>
            </div>
            <div class="domain-tags" v-if="form.domains.length">
              <div
                v-for="(d, i) in form.domains"
                :key="d"
                :class="['domain-tag', { wildcard: d.startsWith('*.') }]"
              >
                <span class="domain-tag-text">{{ d }}</span>
                <el-icon class="domain-tag-close" @click="form.domains.splice(i, 1)"><Close /></el-icon>
              </div>
            </div>
            <div class="form-hint">
              <el-icon><InfoFilled /></el-icon>
              普通域名最多可添加 100 个；通配符域名（*.example.com）必须单独提交。每个域名将独立生成证书记录。
            </div>
          </div>

          <!-- 域名验证 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Lock /></el-icon></span>
              域名验证
              <span class="required">*</span>
            </div>
            <div class="validation-tabs">
              <div
                :class="['validation-tab', { active: form.validation === 'CLOUD_DNS' }]"
                @click="form.validation = 'CLOUD_DNS'"
              >
                <div class="tab-icon"><el-icon><Cloudy /></el-icon></div>
                <div>
                  <div class="tab-title">云 DNS 服务商授权</div>
                  <div class="tab-hint">已授权 DNS 服务商自动添加 TXT 记录，全自动验证</div>
                </div>
              </div>
              <div
                :class="['validation-tab', { active: form.validation === 'MANUAL_DNS' }]"
                @click="form.validation = 'MANUAL_DNS'"
              >
                <div class="tab-icon"><el-icon><EditPen /></el-icon></div>
                <div>
                  <div class="tab-title">手动 DNS 解析</div>
                  <div class="tab-hint">在您的 DNS 平台手动添加 TXT 记录，适合无 API 授权场景</div>
                </div>
              </div>
            </div>

            <!-- 云 DNS 选择 -->
            <div v-if="form.validation === 'CLOUD_DNS'" class="validation-content">
              <el-select
                v-model="form.cloudAuthId"
                placeholder="选择已授权的 DNS 服务商"
                style="width: 100%"
                filterable
                size="large"
              >
                <el-option
                  v-for="a in auths"
                  :key="a.id"
                  :label="a.name + '（' + providerLabel(a.provider) + '）'"
                  :value="a.id"
                />
              </el-select>
              <div class="form-hint">
                没有看到可用的授权？<el-button link type="primary" @click="goAuth">前往添加云服务授权 →</el-button>
              </div>
              <el-input
                v-model="form.mainDomain"
                placeholder="主域名（DNS Zone），如 example.com"
                size="large"
                style="margin-top: 12px"
              />
            </div>

            <!-- 手动 DNS 说明 -->
            <div v-if="form.validation === 'MANUAL_DNS'" class="validation-content">
              <div class="manual-dns-info">
                <div class="dns-guide-steps">
                  <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-content">
                      <div class="step-title">提交申请</div>
                      <div class="step-desc">系统会为每个域名生成对应的 TXT 验证记录</div>
                    </div>
                  </div>
                  <div class="step-arrow"><el-icon><ArrowRight /></el-icon></div>
                  <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-content">
                      <div class="step-title">添加 TXT 记录</div>
                      <div class="step-desc">到 DNS 托管平台添加系统生成的 TXT 记录</div>
                    </div>
                  </div>
                  <div class="step-arrow"><el-icon><ArrowRight /></el-icon></div>
                  <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-content">
                      <div class="step-title">等待传播</div>
                      <div class="step-desc">DNS 传播通常需要 1-10 分钟</div>
                    </div>
                  </div>
                  <div class="step-arrow"><el-icon><ArrowRight /></el-icon></div>
                  <div class="step">
                    <div class="step-num">4</div>
                    <div class="step-content">
                      <div class="step-title">验证签发</div>
                      <div class="step-desc">返回本系统点击验证，自动完成签发</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 证书品牌 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Medal /></el-icon></span>
              证书品牌
              <span class="required">*</span>
            </div>
            <div class="brand-grid">
              <div
                v-for="b in brandOptions"
                :key="b.value"
                :class="['brand-card', { active: form.brand === b.value }]"
                @click="selectBrand(b.value)"
              >
                <div class="brand-radio">
                  <div v-if="form.brand === b.value" class="radio-inner"></div>
                </div>
                <div class="brand-icon-wrap">
                  <div class="brand-icon" :style="{ background: b.bg }">
                    <el-icon><component :is="b.icon" /></el-icon>
                  </div>
                </div>
                <div class="brand-info">
                  <div class="brand-name">
                    {{ b.label }}
                    <el-tag v-if="b.recommend" type="danger" size="small" effect="light" class="brand-tag">推荐</el-tag>
                  </div>
                  <div class="brand-desc">{{ b.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 加密算法 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Key /></el-icon></span>
              加密算法
              <span class="required">*</span>
            </div>
            <div class="algo-cards">
              <div
                :class="['algo-card', { active: form.keyType === 'RSA' }]"
                @click="form.keyType = 'RSA'"
              >
                <div class="algo-name">RSA</div>
                <div class="algo-spec">RSA 2048</div>
                <div class="algo-badge">兼容性好</div>
              </div>
              <div
                :class="['algo-card', { active: form.keyType === 'ECC' }]"
                @click="form.keyType = 'ECC'"
              >
                <div class="algo-name">ECC</div>
                <div class="algo-spec">EC P-256</div>
                <div class="algo-badge">更现代</div>
              </div>
            </div>
            <div class="form-hint">RSA 兼容性好，适合老旧服务器；ECC 体积更小、加密强度更高，推荐现代服务器使用</div>
          </div>

          <!-- 备注 -->
          <div class="form-section">
            <div class="section-title">
              <span class="section-icon"><el-icon><Document /></el-icon></span>
              备注（可选）
            </div>
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="2"
              placeholder="如：生产环境主站、测试用证书、客户 A 的网站等"
            />
          </div>

          <!-- 自定义组织信息（仅内置 CA） -->
          <div class="form-section" v-if="form.brand === 'INTERNAL'">
            <div class="section-title">
              <span class="section-icon"><el-icon><UserFilled /></el-icon></span>
              自定义组织信息（仅内置 CA）
            </div>
            <el-alert
              type="info"
              :closable="false"
              show-icon
              style="margin-bottom: 12px"
              title="Let's Encrypt / ZeroSSL 等 DV 证书不支持自定义组织（O/OU 字段），以下设置仅对内置 CA 生效"
            />
            <el-row :gutter="12">
              <el-col :span="12">
                <div class="sub-field">
                  <div class="sub-label">组织 (O)</div>
                  <el-input
                    v-model="form.orgName"
                    placeholder="如：浙江索联信息科技有限公司"
                    maxlength="64"
                  />
                </div>
              </el-col>
              <el-col :span="12">
                <div class="sub-field">
                  <div class="sub-label">组织单位 (OU)</div>
                  <el-input
                    v-model="form.orgUnit"
                    placeholder="如：技术部 / 运维组"
                    maxlength="64"
                  />
                </div>
              </el-col>
            </el-row>
          </div>
        </el-form>
      </div>

      <!-- 右侧操作栏 -->
      <div class="apply-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-title">申请概览</div>
          <div class="summary-list">
            <div class="summary-item">
              <span class="summary-label">域名数量</span>
              <span class="summary-value">{{ form.domains.length }} 个</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">验证方式</span>
              <span class="summary-value">{{ validationLabel }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">签发机构</span>
              <span class="summary-value">{{ brandLabel(form.brand) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">密钥算法</span>
              <span class="summary-value">{{ form.keyType === 'RSA' ? 'RSA 2048' : 'ECC P-256' }}</span>
            </div>
          </div>
          <div class="sidebar-actions">
            <el-button size="large" @click="goBack" style="width: 100%; margin-bottom: 10px">取消</el-button>
            <el-button
              type="primary"
              size="large"
              :loading="submitting"
              @click="submit"
              style="width: 100%"
            >
              {{ submitting ? '提交中...' : '提交申请' }}
            </el-button>
          </div>
        </div>

        <div class="sidebar-card tips">
          <div class="sidebar-title">
            <el-icon><QuestionFilled /></el-icon> 帮助提示
          </div>
          <div class="tips-list">
            <div class="tip-item">
              <div class="tip-icon">
                <el-icon><Warning /></el-icon>
              </div>
              <div class="tip-text">
                <strong>通配符注意：</strong>通配符证书（*.example.com）不能和普通域名同时申请，请单独提交。
              </div>
            </div>
            <div class="tip-item">
              <div class="tip-icon">
                <el-icon><Timer /></el-icon>
              </div>
              <div class="tip-text">
                <strong>DNS 传播：</strong>手动 DNS 验证需要等待 DNS 记录生效，通常 1-10 分钟。
              </div>
            </div>
            <div class="tip-item">
              <div class="tip-icon">
                <el-icon><Lock /></el-icon>
              </div>
              <div class="tip-text">
                <strong>有效期：</strong>Let's Encrypt 证书有效期为 90 天，系统会在到期前 30 天自动续期。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Close, Lock, Cloudy, EditPen, ArrowRight, Medal, Key, Document,
  InfoFilled, QuestionFilled, Warning, Timer, Collection, HomeFilled,
  SuccessFilled, Star, CircleCheck, UserFilled
} from '@element-plus/icons-vue'
import { api } from '../api'

const router = useRouter()
const submitting = ref(false)
const domainInput = ref('')
const auths = ref([])
const form = ref({
  name: '',
  domains: [],
  brand: 'LETSENCRYPT',
  keyType: 'RSA',
  validation: 'MANUAL_DNS',
  cloudAuthId: null,
  mainDomain: '',
  remark: '',
  orgName: '',
  orgUnit: ''
})

const validationLabel = computed(() => {
  return form.value.validation === 'MANUAL_DNS' ? '手动 DNS' : '云 DNS 自动'
})

const brandOptions = [
  { value: 'LETSENCRYPT', label: "Let's Encrypt", desc: '免费、全球最流行、自动续期', icon: 'Lock', bg: 'linear-gradient(135deg, #1677ff, #4f9dff)', recommend: true },
  { value: 'ZEROSSL', label: 'ZeroSSL', desc: '免费、支持 90 天有效期', icon: 'Star', bg: 'linear-gradient(135deg, #fa8c16, #ffa940)' },
  { value: 'GOOGLE', label: 'Google', desc: '谷歌信任的证书颁发机构', icon: 'SuccessFilled', bg: 'linear-gradient(135deg, #22c55e, #4ade80)' },
  { value: 'LITESSL', label: 'LiteSSL', desc: 'Let\'s Encrypt 替代服务', icon: 'Key', bg: 'linear-gradient(135deg, #a855f7, #c084fc)' },
  { value: 'INTERNAL', label: '内置 CA', desc: '离线可用，内网测试使用', icon: 'HomeFilled', bg: 'linear-gradient(135deg, #64748b, #94a3b8)' }
]

const brands = {
  INTERNAL: '内置 CA',
  LETSENCRYPT: "Let's Encrypt",
  ZEROSSL: 'ZeroSSL',
  GOOGLE: 'Google',
  LITESSL: 'LiteSSL'
}

const providerMap = {
  ALIYUN: '阿里云',
  TENCENT: '腾讯云',
  CLOUDFLARE: 'Cloudflare',
  HUAWEI: '华为云',
  AWS: 'AWS Route53'
}

function providerLabel(v) { return providerMap[v] || v }
function brandLabel(v) { return brands[v] || v }

function selectBrand(v) {
  form.value.brand = v
  if (v === 'INTERNAL') {
    form.value.validation = 'MANUAL_DNS'
  }
}

function goBack() {
  if (form.value.domains.length > 0) {
    ElMessageBox.confirm('已填写的内容将丢失，确认返回？', '提示', { type: 'warning' })
      .then(() => router.push('/cert'))
      .catch(() => {})
  } else {
    router.push('/cert')
  }
}

function addDomain() {
  const value = (domainInput.value || '').trim().toLowerCase()
  if (!value) return
  if (!/^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(value)) {
    ElMessage.warning('域名格式不正确，请输入完整域名（如 example.com）')
    return
  }
  if (form.value.domains.length >= 100) {
    ElMessage.warning('最多添加 100 个域名')
    return
  }
  if (!form.value.domains.includes(value)) {
    if (value.startsWith('*.')) {
      const hasNormal = form.value.domains.some(d => !d.startsWith('*.'))
      if (hasNormal) {
        ElMessage.warning('通配符证书不能与普通域名同时申请，请单独提交')
        return
      }
    } else {
      const hasWildcard = form.value.domains.some(d => d.startsWith('*.'))
      if (hasWildcard) {
        ElMessage.warning('普通域名不能与通配符同时申请，请单独提交')
        return
      }
    }
    form.value.domains.push(value)
  }
  domainInput.value = ''
}

function goAuth() {
  router.push('/auth')
}

async function loadAuths() {
  try {
    auths.value = await api('/cloud/auth/list')
  } catch (e) {
    auths.value = []
  }
}

async function submit() {
  if (!form.value.domains.length) {
    ElMessage.warning('请至少输入一个域名')
    return
  }
  if (form.value.brand === 'INTERNAL') {
    form.value.validation = 'AUTO'
  } else if (form.value.validation === 'AUTO') {
    ElMessage.warning('非内置 CA 需选择 DNS 验证方式')
    return
  }
  if (form.value.validation === 'CLOUD_DNS' && !form.value.cloudAuthId) {
    ElMessage.warning('请选择云 DNS 服务商授权')
    return
  }

  submitting.value = true
  try {
    const cert = await api('/cert/apply', { method: 'POST', body: form.value })
    if (cert.status === 'ISSUED') {
      ElMessage.success('🎉 证书签发成功！')
    } else {
      ElMessage.success('订单已创建！请前往证书管理查看 DNS 验证指引')
    }
    // 成功后跳转回证书列表
    setTimeout(() => router.push('/cert'), 800)
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadAuths()
})
</script>

<style scoped>
.apply-page {
  padding: 0;
}

.page-header {
  margin-bottom: 20px;
}

.header-content {
  font-size: 14px;
}

.apply-container {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 20px;
  align-items: flex-start;
}

/* ========== 主表单区域 ========== */
.apply-main {
  background: #fff;
  border-radius: 12px;
  padding: 24px 32px;
  border: 1px solid #f0f2f5;
}

.apply-form {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.form-section {
  padding-bottom: 24px;
  border-bottom: 1px dashed #f0f2f5;
}
.form-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 14px;
}

.section-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(135deg, #1677ff22, #4f9dff22);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1677ff;
  font-size: 14px;
}

.section-title .required {
  color: #f56c6c;
}

.form-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #8a919f;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ========== 域名输入 ========== */
.domain-input-area {
  width: 100%;
}

.domain-tags {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.domain-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 6px 14px;
  border-radius: 20px;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  font-size: 13px;
  color: #303133;
  transition: all 0.2s;
}
.domain-tag:hover {
  border-color: #1677ff;
  background: #e6f4ff;
}
.domain-tag.wildcard {
  background: #fff7e6;
  border-color: #ffd591;
  color: #d46b08;
}
.domain-tag-text {
  font-family: 'SFMono-Regular', Consolas, monospace;
}
.domain-tag-close {
  cursor: pointer;
  color: #c0c4cc;
  font-size: 14px;
  border-radius: 50%;
  padding: 2px;
  transition: all 0.15s;
}
.domain-tag-close:hover {
  background: #f56c6c;
  color: #fff;
}

/* ========== 验证方式 ========== */
.validation-tabs {
  display: flex;
  gap: 12px;
}

.validation-tab {
  flex: 1;
  padding: 18px;
  border: 2px solid #ebf0fa;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fafbfc;
}
.validation-tab:hover {
  border-color: #4f9dff;
  background: #fff;
}
.validation-tab.active {
  border-color: #1677ff;
  background: linear-gradient(135deg, #e6f4ff, #ffffff);
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.1);
}

.tab-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #1677ff, #4f9dff);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.validation-tab.active .tab-icon {
  background: linear-gradient(135deg, #1677ff, #4096ff);
}

.tab-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2329;
}
.tab-hint {
  font-size: 12px;
  color: #8a919f;
  margin-top: 4px;
  line-height: 1.5;
}

.validation-content {
  margin-top: 14px;
}

/* ========== 手动 DNS 引导步骤 ========== */
.dns-guide-steps {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #f0f2f5;
}

.step {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}

.step-desc {
  font-size: 12px;
  color: #8a919f;
  margin-top: 2px;
  line-height: 1.4;
}

.step-arrow {
  color: #c0c4cc;
  font-size: 16px;
  flex-shrink: 0;
}

/* ========== 证书品牌 ========== */
.brand-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.brand-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 2px solid #ebf0fa;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafbfc;
  position: relative;
}
.brand-card:hover {
  border-color: #4f9dff;
  background: #fff;
}
.brand-card.active {
  border-color: #1677ff;
  background: #e6f4ff;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.08);
}

.brand-radio {
  width: 18px;
  height: 18px;
  border: 2px solid #c0c4cc;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}
.brand-card.active .brand-radio {
  border-color: #1677ff;
}
.radio-inner {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1677ff;
}

.brand-icon-wrap {
  flex-shrink: 0;
}
.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 18px;
}

.brand-info {
  flex: 1;
  min-width: 0;
}

.brand-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2329;
  display: flex;
  align-items: center;
  gap: 6px;
}
.brand-tag {
  font-size: 11px;
}

.brand-desc {
  font-size: 12px;
  color: #8a919f;
  margin-top: 2px;
}

/* ========== 加密算法 ========== */
.algo-cards {
  display: flex;
  gap: 12px;
}

.algo-card {
  flex: 1;
  padding: 16px 20px;
  border: 2px solid #ebf0fa;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fafbfc;
  text-align: center;
}
.algo-card:hover {
  border-color: #4f9dff;
}
.algo-card.active {
  border-color: #1677ff;
  background: #e6f4ff;
}

.algo-name {
  font-size: 18px;
  font-weight: 600;
  color: #1f2329;
}
.algo-spec {
  font-size: 12px;
  color: #8a919f;
  margin-top: 4px;
}
.algo-badge {
  display: inline-block;
  margin-top: 8px;
  padding: 2px 10px;
  background: rgba(22, 119, 255, 0.1);
  color: #1677ff;
  font-size: 11px;
  border-radius: 10px;
}

/* ========== 右侧边栏 ========== */
.apply-sidebar {
  position: sticky;
  top: 20px;
}

.sidebar-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  border: 1px solid #f0f2f5;
  margin-bottom: 16px;
}

.sidebar-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2329;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.summary-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.summary-label {
  color: #8a919f;
}
.summary-value {
  color: #1f2329;
  font-weight: 500;
}

.sidebar-actions {
  border-top: 1px solid #f0f2f5;
  padding-top: 16px;
}

.tips-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-item {
  display: flex;
  gap: 10px;
  font-size: 12px;
  line-height: 1.5;
}

.tip-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #fff7e6;
  color: #fa8c16;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tip-text {
  color: #606266;
}
.tip-text strong {
  color: #1f2329;
}

.sub-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.sub-label {
  font-size: 12px;
  color: #8a919f;
}
</style>
