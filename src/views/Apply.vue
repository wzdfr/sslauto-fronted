<template>
  <div class="space-y-4">
    <!-- 顶部页面栏 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <button type="button" class="wb-row-btn" @click="$router.push('/cert')">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回列表</span>
          </button>
          <h1 class="wb-page-title">申请新证书</h1>
        </div>
        <p class="wb-page-sub">
          <span>支持单域名、SAN 多域名合并签发及泛域名 (*.example.com)</span>
          <span class="wb-sep">·</span>
          <span>签发后自动纳入全生命周期资产监控</span>
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <!-- 左侧表单区 -->
      <div class="lg:col-span-2 space-y-4">
        <div class="wb-panel">
          <div class="wb-panel-header">
            <div>
              <h3 class="wb-panel-title">1. 域名与签发机构 (CA)</h3>
              <p class="wb-panel-sub">选择加密算法规格与目标签发品牌</p>
            </div>
          </div>

          <div class="wb-panel-body space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                  证书业务名称 (选填，默认取主域名)
                </label>
                <el-input
                  v-model="form.name"
                  placeholder="例如：核心支付网关泛域名证书"
                />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                  密钥算法规格
                </label>
                <div class="wb-mode-switch w-full flex">
                  <button
                    type="button"
                    class="wb-mode-btn flex-1 justify-center"
                    :class="{ active: form.keyType === 'ECC' }"
                    @click="form.keyType = 'ECC'"
                  >
                    ECC (P-256 · 推荐)
                  </button>
                  <button
                    type="button"
                    class="wb-mode-btn flex-1 justify-center"
                    :class="{ active: form.keyType === 'RSA' }"
                    @click="form.keyType = 'RSA'"
                  >
                    RSA (2048 · 兼容)
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-semibold text-gray-700">
                  绑定域名列表 (每行或逗号分隔一个域名) <span class="text-red-600">*</span>
                </label>
                <span class="mono text-xs text-gray-400">
                  已解析 {{ parsedDomains.length }} 个有效域名
                  <template v-if="hasWildcard"> · 含通配符域名</template>
                </span>
              </div>
              <el-input
                v-model="domainText"
                type="textarea"
                :rows="4"
                class="mono text-xs"
                placeholder="*.api.example.com&#10;api.example.com"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                选择签发机构 (CA Brand) <span class="text-red-600">*</span>
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  v-for="item in caOptions"
                  :key="item.value"
                  type="button"
                  class="text-left p-3.5 rounded-xl border transition-all cursor-pointer bg-white"
                  :class="
                    form.brand === item.value
                      ? 'border-[#111827] ring-1 ring-[#111827]'
                      : 'border-[#e5e7eb] hover:border-gray-400'
                  "
                  @click="selectBrand(item.value)"
                >
                  <div class="font-bold text-[13px] text-[#111827]">{{ item.label }}</div>
                  <div class="text-[11.5px] text-gray-500 mt-0.5">{{ item.desc }}</div>
                </button>
              </div>
            </div>

            <div
              v-if="form.brand === 'INTERNAL'"
              class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#f1f3f6]"
            >
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                  自定义组织名称 (O · Organization)
                </label>
                <el-input v-model="form.orgName" placeholder="例如：银河云数字科技有限公司" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1.5">
                  自定义部门单位 (OU · Organizational Unit)
                </label>
                <el-input v-model="form.orgUnit" placeholder="例如：基础架构与安全部" />
              </div>
            </div>
          </div>
        </div>

        <div class="wb-panel">
          <div class="wb-panel-header">
            <div>
              <h3 class="wb-panel-title">2. 域名所有权验证方式</h3>
              <p class="wb-panel-sub">生产环境推荐使用云 DNS API 授权，实现无人值守自动续签</p>
            </div>
          </div>

          <div class="wb-panel-body space-y-4">
            <div class="wb-tabs">
              <button
                v-if="form.brand !== 'INTERNAL'"
                type="button"
                class="wb-tab"
                :class="{ active: form.validation === 'CLOUD_DNS' }"
                @click="form.validation = 'CLOUD_DNS'"
              >
                云 DNS 自动验证 (推荐)
              </button>
              <button
                v-if="form.brand !== 'INTERNAL'"
                type="button"
                class="wb-tab"
                :class="{ active: form.validation === 'MANUAL_DNS' }"
                @click="form.validation = 'MANUAL_DNS'"
              >
                手动 TXT 验证
              </button>
              <button
                type="button"
                class="wb-tab"
                :class="{ active: form.validation === 'AUTO' }"
                @click="form.validation = 'AUTO'"
              >
                {{ form.brand === 'INTERNAL' ? '内置私有 CA 直接签发' : 'HTTP-01 / 自动验证' }}
              </button>
            </div>

            <div v-if="form.validation === 'CLOUD_DNS'" class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold text-gray-700">
                  选择已配置的云 DNS API 授权凭证 <span class="text-red-600">*</span>
                </label>
                <button type="button" class="wb-row-link" @click="$router.push('/auth')">
                  管理云 DNS 授权 →
                </button>
              </div>
              <el-select
                v-model="form.cloudAuthId"
                placeholder="请选择托管该域名的云厂商 DNS 账号"
                class="w-full"
              >
                <el-option
                  v-for="auth in authList"
                  :key="auth.id"
                  :value="auth.id"
                  :label="`${auth.name} (${providerLabel(auth.provider)} · ${auth.accesskey})`"
                />
              </el-select>
            </div>

            <div
              v-else-if="form.validation === 'MANUAL_DNS'"
              class="text-xs text-gray-600 bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-3"
            >
              提交订单后系统将生成 <code class="mono">_acme-challenge</code> TXT 记录值，您可在证书列表打开「DNS 验证向导」检测传播状态并完成签发。
            </div>
          </div>
        </div>

        <div class="wb-panel">
          <div class="wb-panel-header">
            <div>
              <h3 class="wb-panel-title">3. 资产归属与责任人登记</h3>
              <p class="wb-panel-sub">签发后自动同步至「证书档案」，避免产生无人认领的孤儿证书</p>
            </div>
          </div>

          <div class="wb-panel-body grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">归属业务项目</label>
              <el-input v-model="form.project" placeholder="例如：核心网关 / 开放平台" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">运行环境</label>
              <el-select v-model="form.env" class="w-full">
                <el-option v-for="(label, code) in ENV_MAP" :key="code" :label="label" :value="code" />
              </el-select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">资产责任人</label>
              <el-input v-model="form.owner" placeholder="例如：陈工 (sre_chen)" />
            </div>
            <div class="sm:col-span-3">
              <label class="block text-xs font-semibold text-gray-700 mb-1.5">运维备注</label>
              <el-input
                v-model="form.remark"
                placeholder="可选：说明关联负载均衡或业务变更窗口要求"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧核对清单 -->
      <div class="wb-panel lg:sticky lg:top-6">
        <div class="wb-panel-header">
          <div>
            <h3 class="wb-panel-title">申请单核对清单</h3>
            <p class="wb-panel-sub">提交前确认生命周期策略</p>
          </div>
        </div>

        <div class="wb-panel-body space-y-3.5 text-[13px]">
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">主域名 (CN)</span>
            <span class="mono font-bold text-[#111827]">{{ parsedDomains[0] || '待输入' }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">SAN 域名数量</span>
            <span class="mono font-medium text-gray-900">{{ parsedDomains.length }} 个</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">签发 CA 品牌</span>
            <span class="font-medium text-gray-900">{{ brandLabel(form.brand) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">密钥算法</span>
            <span class="mono font-medium text-gray-900">{{ form.keyType }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">验证方式</span>
            <span class="font-medium text-gray-900">{{ form.validation }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">归属环境</span>
            <span class="font-medium text-gray-900">{{ ENV_MAP[form.env] || form.env }}</span>
          </div>

          <div class="text-xs text-gray-500 bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-3 leading-relaxed">
            签发成功后自动纳入全生命周期巡检：到期前自动触发续签，关联 Agent 部署节点支持写前备份与 <code class="mono">nginx -t</code> 回滚保护。
          </div>

          <button
            type="button"
            class="wb-btn wb-btn-primary w-full !h-10"
            :disabled="submitting"
            @click="submitApply"
          >
            {{ submitting ? '正在提交申请...' : '立即发起证书申请' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { call } from '../api'
import { currentUser } from '../store'
import { ENV_MAP, brandLabel, providerLabel } from '../utils'

const router = useRouter()
const route = useRoute()

const caOptions = [
  { value: 'LETSENCRYPT', label: "Let's Encrypt", desc: '90天公信DV · 全球广泛兼容' },
  { value: 'GOOGLE', label: 'Google Trust', desc: '90天公信DV · 现代边缘网络优选' },
  { value: 'ZEROSSL', label: 'ZeroSSL', desc: '90天公信DV · ACME 多CA互备' },
  { value: 'LITESSL', label: 'LiteSSL', desc: '公信DV · 备选亚洲节点链路' },
  { value: 'INTERNAL', label: '内置私有 CA', desc: '365天内网专用 · 免公网DNS验证' }
]

const authList = ref([])
const submitting = ref(false)
const domainText = ref(route.query.domain ? String(route.query.domain) : '')

const form = reactive({
  name: '',
  keyType: 'ECC',
  brand: 'LETSENCRYPT',
  validation: 'CLOUD_DNS',
  cloudAuthId: null,
  orgName: '',
  orgUnit: '',
  project: '',
  env: 'prod',
  owner: currentUser.value.nickname || currentUser.value.username || '',
  remark: ''
})

const parsedDomains = computed(() => {
  return Array.from(
    new Set(
      domainText.value
        .split(/[\n,;,\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  )
})

const hasWildcard = computed(() => parsedDomains.value.some((d) => d.startsWith('*.')))

function selectBrand(brand) {
  form.brand = brand
  if (brand === 'INTERNAL') {
    form.validation = 'AUTO'
  } else if (form.validation === 'AUTO' && hasWildcard.value) {
    form.validation = 'CLOUD_DNS'
  }
}

async function loadCloudAuths() {
  try {
    authList.value = (await call('/cloud/auth/list')) || []
    if (authList.value.length > 0 && !form.cloudAuthId) {
      form.cloudAuthId = authList.value[0].id
    }
  } catch {
    authList.value = []
  }
}

async function submitApply() {
  if (parsedDomains.value.length === 0) {
    ElMessage.warning('请至少输入一个有效域名')
    return
  }
  if (hasWildcard.value && form.validation === 'AUTO' && form.brand !== 'INTERNAL') {
    ElMessage.warning('通配符域名 (*.example.com) 按 ACME 规范必须使用 DNS 验证方式')
    return
  }
  if (form.validation === 'CLOUD_DNS' && !form.cloudAuthId && form.brand !== 'INTERNAL') {
    ElMessage.warning('请选择云 DNS 授权账号，或切换为手动 TXT 验证')
    return
  }

  submitting.value = true
  try {
    const res = await call('/cert/apply', {
      method: 'POST',
      body: {
        domains: parsedDomains.value,
        mainDomain: parsedDomains.value[0],
        name: form.name.trim() || parsedDomains.value[0],
        keyType: form.keyType,
        brand: form.brand,
        validation: form.validation,
        cloudAuthId: form.validation === 'CLOUD_DNS' ? form.cloudAuthId : null,
        orgName: form.brand === 'INTERNAL' ? form.orgName : undefined,
        orgUnit: form.brand === 'INTERNAL' ? form.orgUnit : undefined,
        project: form.project.trim() || undefined,
        env: form.env,
        owner: form.owner.trim() || undefined,
        remark: form.remark.trim() || undefined
      }
    })

    if (res?.id && (form.project || form.env || form.owner)) {
      try {
        await call('/cert/assetSave', {
          method: 'POST',
          body: {
            id: res.id,
            project: form.project.trim(),
            env: form.env,
            owner: form.owner.trim(),
            remark: form.remark.trim()
          }
        })
      } catch {
        // ignore secondary governance save
      }
    }

    if (res?.status === 'WAIT_DNS') {
      ElMessage.success('订单已创建，请在证书列表点击「DNS 验证向导」配置 TXT 记录')
    } else {
      ElMessage.success('证书签发成功，已自动纳入资产档案')
    }
    router.push('/cert')
  } catch {
    // handled in call()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  loadCloudAuths()
})
</script>
