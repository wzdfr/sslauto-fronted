<template>
  <div class="space-y-4">
    <!-- 顶部标题与操作栏 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">签发与续期</h1>
        </div>
        <p class="wb-page-sub">
          <span>共 {{ total }} 笔证书订单</span>
          <span class="wb-sep">·</span>
          <span>到期前 {{ clmPolicy.autoRenewDaysBefore }} 天自动触发 ACME 续签并同步关联服务器</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button
          v-if="can('cert:download') && rows.length > 0"
          type="button"
          class="wb-btn"
          @click="downloadRootCa"
        >
          <el-icon><Key /></el-icon>
          <span>下载根 CA</span>
        </button>
        <button
          v-if="can('cert:upload')"
          type="button"
          class="wb-btn"
          @click="openUploadDialog()"
        >
          <el-icon><Upload /></el-icon>
          <span>导入证书</span>
        </button>
        <button
          v-if="can('cert:apply')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="$router.push('/cert/apply')"
        >
          <el-icon><Plus /></el-icon>
          <span>申请新证书</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 圆角搜索与筛选标签行 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="wb-search w-60">
          <el-icon class="text-gray-400"><Search /></el-icon>
          <input
            v-model="query.keyword"
            type="text"
            placeholder="搜索证书名称、域名或备注"
            @keyup.enter="handleSearch"
          />
        </div>

        <div class="wb-tabs">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            class="wb-tab"
            :class="{ active: query.status === tab.value }"
            @click="switchStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <el-select
          v-model="query.brand"
          placeholder="全部签发品牌"
          clearable
          class="wb-pill-select !w-36"
          @change="handleSearch"
        >
          <el-option
            v-for="(label, code) in BRAND_MAP"
            :key="code"
            :label="label"
            :value="code"
          />
        </el-select>

        <el-select
          v-model="query.expiry"
          placeholder="到期窗口"
          clearable
          class="wb-pill-select !w-36"
          @change="handleSearch"
        >
          <el-option label="已过期" value="EXPIRED" />
          <el-option label="30 天内到期" value="MONTH" />
          <el-option label="90 天内到期" value="QUARTER" />
        </el-select>

        <button
          v-if="query.keyword || query.brand || query.status || query.expiry"
          type="button"
          class="wb-row-link"
          @click="resetQuery"
        >
          重置
        </button>
      </div>
    </div>

    <!-- 证书订单表格 -->
    <div class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loading" :data="rows" empty-text="当前暂无证书签发记录">
        <el-table-column label="证书名称 / 域名" min-width="240">
          <template #default="{ row }">
            <div class="py-0.5">
              <div class="flex items-center gap-2">
                <span class="font-bold text-[#111827]">{{ row.name || firstDomain(row) }}</span>
                <span class="mono text-[11px] text-gray-400">v{{ row.version || 1 }}</span>
              </div>
              <div class="wb-meta mt-0.5">
                <span class="mono text-gray-600">{{ firstDomain(row) }}</span>
                <template v-if="parseDomains(row.domains).length > 1">
                  <span class="wb-sep">·</span>
                  <span>共 {{ parseDomains(row.domains).length }} 个域名</span>
                </template>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="签发 CA / 验证方式" min-width="165">
          <template #default="{ row }">
            <div class="font-medium text-gray-800">{{ brandLabel(row.brand) }}</div>
            <div class="wb-meta mt-0.5">
              <span class="mono">{{ row.keytype }}</span>
              <span class="wb-sep">·</span>
              <span>{{ validationText(row.validation) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="125">
          <template #default="{ row }">
            <span class="wb-state" :class="statusStateClass(row.status)">
              {{ statusText(row.status) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="有效期限" min-width="190">
          <template #default="{ row }">
            <template v-if="row.notafter">
              <div class="mono text-xs font-semibold" :class="daysColor(row.notafter)">
                {{ daysLabel(row.notafter) }}
              </div>
              <div class="mono text-[11.5px] text-gray-400 mt-0.5">
                {{ formatDay(row.notbefore) }} ~ {{ formatDay(row.notafter) }}
              </div>
            </template>
            <span v-else class="text-xs text-gray-400">待完成验证签发</span>
          </template>
        </el-table-column>

        <el-table-column label="备注 / 异常诊断" min-width="200">
          <template #default="{ row }">
            <span class="text-xs text-gray-500 line-clamp-2">{{ row.remark || '—' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="290" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex flex-wrap items-center justify-end gap-1.5">
              <button
                v-if="row.status === 'WAIT_DNS' && can('cert:verify')"
                type="button"
                class="wb-row-btn"
                @click="openDnsWizard(row)"
              >
                DNS 验证向导
              </button>

              <button
                v-if="row.status === 'FAILED' && can('cert:verify')"
                type="button"
                class="wb-row-btn"
                :disabled="actionId === row.id"
                @click="retryOrder(row)"
              >
                重试签发
              </button>

              <button
                v-if="row.status === 'ISSUED' && row.brand !== 'UPLOAD' && can('cert:renew')"
                type="button"
                class="wb-row-btn"
                :disabled="actionId === row.id"
                @click="renewCert(row)"
              >
                续期
              </button>

              <button
                v-if="row.status === 'ISSUED' && can('cert:download')"
                type="button"
                class="wb-row-btn"
                @click="openDownloadDialog(row)"
              >
                下载证书
              </button>

              <button
                v-if="row.status === 'ISSUED' && can('cert:upload')"
                type="button"
                class="wb-row-link"
                @click="openUploadDialog(row)"
              >
                覆盖上传
              </button>

              <button
                type="button"
                class="wb-row-link"
                @click="$router.push('/cert/assets/' + row.id)"
              >
                档案
              </button>

              <button
                v-if="can('cert:delete')"
                type="button"
                class="wb-row-link wb-row-link-danger"
                @click="deleteCert(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="px-3 py-3.5 flex items-center justify-between">
        <span class="text-xs text-gray-400">
          续期或覆盖上传后版本号自动递增，并触发关联在线服务器自动部署
        </span>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="sizes, prev, pager, next"
          small
          @size-change="loadPage"
          @current-change="loadPage"
        />
      </div>
    </div>

    <!-- DNS-01 解析验证向导弹窗 -->
    <el-dialog v-model="dnsVisible" title="手动 DNS-01 解析验证向导" width="680px">
      <div v-loading="dnsLoading" class="space-y-4">
        <div class="text-xs text-gray-600 bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-3 leading-relaxed">
          请前往您的域名权威 DNS 服务商控制台添加以下 <strong>TXT</strong> 记录。添加完成后，先点击「预检权威 DNS 传播状态」确认生效，再提交 ACME 签发。
        </div>

        <el-table :data="dnsChallenges" empty-text="未读取到待验证的 TXT 挑战记录">
          <el-table-column label="待验证域名" prop="domain" width="170">
            <template #default="{ row }">
              <span class="mono text-xs font-medium">{{ row.domain }}</span>
            </template>
          </el-table-column>
          <el-table-column label="主机记录 (TXT Name)" min-width="200">
            <template #default="{ row }">
              <div class="flex items-center justify-between gap-2">
                <span class="mono text-xs text-gray-800 break-all">{{ row.recordName }}</span>
                <button
                  type="button"
                  class="wb-row-link"
                  @click="copyToClipboard(row.recordName, '主机记录已复制')"
                >
                  复制
                </button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="记录值 (TXT Value)" min-width="210">
            <template #default="{ row }">
              <div class="flex items-center justify-between gap-2">
                <span class="mono text-xs text-gray-800 break-all">{{ row.txtValue }}</span>
                <button
                  type="button"
                  class="wb-row-link"
                  @click="copyToClipboard(row.txtValue, 'TXT 记录值已复制')"
                >
                  复制
                </button>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="传播检测" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.valid === true" class="wb-state wb-state-ok">已生效</span>
              <span v-else-if="row.valid === false" class="wb-state wb-state-err">未检出</span>
              <span v-else class="text-xs text-gray-400">待检测</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <button type="button" class="wb-btn" :disabled="dnsChecking" @click="checkDnsStatus">
            {{ dnsChecking ? '正在预检...' : '1. 预检权威 DNS 传播状态' }}
          </button>
          <div class="flex items-center gap-2">
            <button type="button" class="wb-btn" @click="dnsVisible = false">关闭</button>
            <button
              type="button"
              class="wb-btn wb-btn-primary"
              :disabled="dnsVerifying"
              @click="confirmVerifyDns"
            >
              {{ dnsVerifying ? '签发中...' : '2. 提交 ACME 验证并签发' }}
            </button>
          </div>
        </div>
      </template>
    </el-dialog>

    <!-- 多格式证书下载弹窗 -->
    <el-dialog v-model="dlVisible" title="下载证书与私钥文件包" width="500px">
      <el-form label-position="top">
        <div class="mb-3 text-xs text-gray-500">
          目标证书：<strong class="text-gray-900">{{ dlCert?.name }}</strong>
          <span class="mono ml-1">(v{{ dlCert?.version || 1 }})</span>
        </div>

        <el-form-item label="选择目标服务器/中间件格式">
          <el-select v-model="dlForm.type" class="w-full">
            <el-option label="Nginx 标准包 (server.pem + server.key)" value="nginx" />
            <el-option label="Apache 标准包 (crt + ca_bundle + key)" value="apache" />
            <el-option label="全量 PEM 压缩包 (cert/chain/fullchain/privkey)" value="zip" />
            <el-option label="Fullchain 证书链 (fullchain.pem)" value="fullchain" />
            <el-option label="单独私钥文件 (privkey.pem)" value="privkey" />
            <el-option label="PKCS#12 / PFX 通用格式 (.pfx)" value="pfx" />
            <el-option label="Windows IIS 专用导入包 (.pfx)" value="iis" />
            <el-option label="Tomcat 密钥库格式 (.pfx)" value="tomcat" />
            <el-option label="Java JKS 密钥库 (.jks)" value="jks" />
          </el-select>
        </el-form-item>

        <el-form-item
          v-if="needsPassword"
          label="密钥库保护密码 (留空默认使用 changeit)"
        >
          <el-input
            v-model="dlForm.password"
            placeholder="请输入 PFX / JKS 导出加密密码，如 changeit"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="dlVisible = false">取消</button>
        <button type="button" class="wb-btn wb-btn-primary ml-2" @click="confirmDownload">
          立即下载文件包
        </button>
      </template>
    </el-dialog>

    <!-- 导入/覆盖上传外部证书弹窗 -->
    <el-dialog
      v-model="upVisible"
      :title="upForm.id ? '覆盖更新证书版本 (自动同步下游部署)' : '导入外部商业/存量证书纳管'"
      width="580px"
    >
      <el-form label-position="top">
        <el-form-item v-if="!upForm.id" label="证书资产名称" required>
          <el-input v-model="upForm.name" placeholder="例如：集团官网 DigiCert OV 证书" />
        </el-form-item>

        <el-form-item label="导入格式">
          <div class="wb-mode-switch">
            <button
              type="button"
              class="wb-mode-btn"
              :class="{ active: upMode === 'PEM' }"
              @click="upMode = 'PEM'"
            >
              PEM 文本粘贴 (证书 + 私钥)
            </button>
            <button
              type="button"
              class="wb-mode-btn"
              :class="{ active: upMode === 'PFX' }"
              @click="upMode = 'PFX'"
            >
              PFX / P12 二进制文件上传
            </button>
          </div>
        </el-form-item>

        <template v-if="upMode === 'PEM'">
          <el-form-item label="证书内容 (PEM · -----BEGIN CERTIFICATE-----)" required>
            <el-input
              v-model="upForm.cert"
              type="textarea"
              :rows="4"
              class="mono text-xs"
              placeholder="-----BEGIN CERTIFICATE-----&#10;MIIFazCCA1OgAwIBAgIRA...&#10;-----END CERTIFICATE-----"
            />
          </el-form-item>
          <el-form-item label="私钥内容 (PEM · 后端自动校验公私钥配对)" required>
            <el-input
              v-model="upForm.key"
              type="textarea"
              :rows="4"
              class="mono text-xs"
              placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0B...&#10;-----END PRIVATE KEY-----"
            />
          </el-form-item>
          <el-form-item label="中间证书链 (Chain PEM · 可选)">
            <el-input
              v-model="upForm.chain"
              type="textarea"
              :rows="2"
              class="mono text-xs"
              placeholder="可选：粘贴中间 CA 证书链"
            />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="选择 PFX / P12 文件" required>
            <input
              type="file"
              accept=".pfx,.p12"
              class="block w-full text-xs text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border file:border-gray-300 file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
              @change="onPfxFileChange"
            />
            <div v-if="pfxFileName" class="text-xs text-emerald-600 mt-1">
              已读取文件：{{ pfxFileName }}
            </div>
          </el-form-item>
          <el-form-item label="PFX 解密密码">
            <el-input v-model="upForm.pfxPassword" show-password placeholder="输入 PFX 文件保护密码" />
          </el-form-item>
        </template>

        <el-form-item label="备注说明">
          <el-input v-model="upForm.remark" placeholder="例如：2026 年度新采购续费证书" />
        </el-form-item>
      </el-form>

      <template #footer>
        <button type="button" class="wb-btn" @click="upVisible = false">取消</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          :disabled="uploading"
          @click="submitUpload"
        >
          {{ uploading ? '提交中...' : upForm.id ? '确认覆盖并升版' : '确认导入纳管' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus, Upload, Key, FullScreen } from '@element-plus/icons-vue'
import { call, download } from '../api'
import { can, clmPolicy } from '../store'
import {
  BRAND_MAP,
  brandLabel,
  parseDomains,
  formatDay,
  calcDaysDiff,
  copyToClipboard,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const route = useRoute()

const statusTabs = [
  { label: '全部', value: '' },
  { label: '已签发', value: 'ISSUED' },
  { label: '待 DNS 验证', value: 'WAIT_DNS' },
  { label: '签发失败', value: 'FAILED' }
]

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const actionId = ref(null)

const query = reactive({
  page: 1,
  size: 10,
  keyword: '',
  brand: '',
  status: '',
  expiry: route.query.expiry ? String(route.query.expiry) : ''
})

// DNS Wizard State
const dnsVisible = ref(false)
const dnsLoading = ref(false)
const dnsChecking = ref(false)
const dnsVerifying = ref(false)
const dnsCertId = ref(null)
const dnsChallenges = ref([])

// Download Modal State
const dlVisible = ref(false)
const dlCert = ref(null)
const dlForm = reactive({
  type: 'nginx',
  password: 'changeit'
})

const needsPassword = computed(() =>
  ['pfx', 'tomcat', 'iis', 'jks'].includes(dlForm.type)
)

// Upload Modal State
const upVisible = ref(false)
const uploading = ref(false)
const upMode = ref('PEM')
const pfxFileName = ref('')
const upForm = reactive({
  id: null,
  name: '',
  cert: '',
  key: '',
  chain: '',
  pfx: '',
  pfxPassword: '',
  remark: ''
})

function firstDomain(row) {
  return parseDomains(row.domains)[0] || '-'
}

function validationText(v) {
  return { CLOUD_DNS: '云 DNS 自动', MANUAL_DNS: '手动 TXT', AUTO: '免验证' }[v] || v || '-'
}

function statusText(s) {
  return (
    {
      ISSUED: '已签发',
      WAIT_DNS: '等待验证',
      FAILED: '校验失败',
      PENDING: '处理中'
    }[s] || s
  )
}

function statusStateClass(s) {
  if (s === 'ISSUED') return 'wb-state-ok'
  if (s === 'WAIT_DNS' || s === 'PENDING') return 'wb-state-warn'
  if (s === 'FAILED') return 'wb-state-err'
  return 'wb-state-neutral'
}

function daysLabel(notafter) {
  const d = calcDaysDiff(notafter)
  if (d === null) return '-'
  if (d < 0) return `已过期 ${Math.abs(d)} 天`
  return `剩余 ${d} 天`
}

function daysColor(notafter) {
  const d = calcDaysDiff(notafter)
  if (d === null) return 'text-gray-400'
  if (d < 0 || d <= 7) return 'text-red-600'
  if (d <= 30) return 'text-amber-600'
  return 'text-emerald-600'
}

async function loadPage() {
  loading.value = true
  try {
    const res = await call('/cert/page', {
      method: 'POST',
      body: { ...query }
    })
    rows.value = res?.rows || []
    total.value = res?.total || 0
  } catch {
    // Error toast or 401 redirect already handled in call()
  } finally {
    loading.value = false
  }
}

function switchStatus(val) {
  query.status = val
  query.page = 1
  loadPage()
}

function handleSearch() {
  query.page = 1
  loadPage()
}

function resetQuery() {
  query.keyword = ''
  query.brand = ''
  query.status = ''
  query.expiry = ''
  query.page = 1
  loadPage()
}

async function openDnsWizard(row) {
  dnsCertId.value = row.id
  dnsChallenges.value = []
  dnsVisible.value = true
  dnsLoading.value = true
  try {
    const detail = await call('/cert/detail?id=' + row.id)
    const chList = detail?.dnsrecords?.challenges || []
    dnsChallenges.value = chList.map((item) => ({ ...item, valid: undefined }))
  } catch {
    // handled in call()
  } finally {
    dnsLoading.value = false
  }
}

async function checkDnsStatus() {
  if (!dnsCertId.value) return
  dnsChecking.value = true
  try {
    const res = await call('/cert/checkDns', {
      method: 'POST',
      body: { id: dnsCertId.value }
    })
    dnsChallenges.value = res?.challenges || dnsChallenges.value
    if (res?.allValid) {
      ElMessage.success('权威 DNS TXT 记录已全部生效，请点击提交验证签发')
    } else {
      ElMessage.warning('部分域名 TXT 记录尚未传播生效，请稍后重试')
    }
  } catch {
    // handled in call()
  } finally {
    dnsChecking.value = false
  }
}

async function confirmVerifyDns() {
  if (!dnsCertId.value) return
  dnsVerifying.value = true
  try {
    await call('/cert/verifyDns', {
      method: 'POST',
      body: { id: dnsCertId.value }
    })
    ElMessage.success('DNS 验证通过，证书已成功签发')
    dnsVisible.value = false
    await loadPage()
  } catch {
    // handled in call()
  } finally {
    dnsVerifying.value = false
  }
}

async function retryOrder(row) {
  actionId.value = row.id
  try {
    const updated = await call('/cert/retry', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success(updated?.status === 'WAIT_DNS' ? '已重新生成 DNS 验证挑战' : '重试签发成功')
    await loadPage()
  } catch {
    // handled in call()
  } finally {
    actionId.value = null
  }
}

async function renewCert(row) {
  await ElMessageBox.confirm(
    `确定立即为「${row.name || firstDomain(row)}」执行续期吗？续期成功后版本号将升至 v${(row.version || 1) + 1}，并自动触发关联服务器同步部署。`,
    '手动续期确认',
    { type: 'info', confirmButtonText: '立即续期', cancelButtonText: '取消' }
  )
  actionId.value = row.id
  try {
    await call('/cert/renew', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('证书续期成功，下游在线节点已触发同步')
    await loadPage()
  } catch {
    // handled in call()
  } finally {
    actionId.value = null
  }
}

function openDownloadDialog(row) {
  dlCert.value = row
  dlForm.type = 'nginx'
  dlForm.password = 'changeit'
  dlVisible.value = true
}

async function confirmDownload() {
  if (!dlCert.value) return
  let url = `/cert/download?id=${dlCert.value.id}&type=${encodeURIComponent(dlForm.type)}`
  if (needsPassword.value && dlForm.password) {
    url += `&password=${encodeURIComponent(dlForm.password)}`
  }
  dlVisible.value = false
  await download(url, `cert-${dlCert.value.id}-${dlForm.type}`)
}

async function downloadRootCa() {
  const targetId = rows.value[0]?.id || 101
  await download(`/cert/download?id=${targetId}&type=root`, 'sslauto-internal-root-ca.crt')
}

function openUploadDialog(row = null) {
  upForm.id = row ? row.id : null
  upForm.name = row ? row.name : ''
  upForm.cert = ''
  upForm.key = ''
  upForm.chain = ''
  upForm.pfx = ''
  upForm.pfxPassword = ''
  upForm.remark = row ? row.remark || '' : ''
  pfxFileName.value = ''
  upMode.value = 'PEM'
  upVisible.value = true
}

function onPfxFileChange(e) {
  const file = e.target.files?.[0]
  if (!file) return
  pfxFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    const res = String(reader.result || '')
    const idx = res.indexOf('base64,')
    upForm.pfx = idx >= 0 ? res.slice(idx + 7) : res
  }
  reader.readAsDataURL(file)
}

async function submitUpload() {
  if (!upForm.id && !upForm.name.trim()) {
    ElMessage.warning('请填写证书资产名称')
    return
  }
  const payload = {
    id: upForm.id || undefined,
    name: upForm.name.trim() || undefined,
    remark: upForm.remark
  }
  if (upMode.value === 'PEM') {
    if (!upForm.cert.trim() || !upForm.key.trim()) {
      ElMessage.warning('请完整填写 PEM 证书与私钥内容')
      return
    }
    payload.cert = upForm.cert.trim()
    payload.key = upForm.key.trim()
    if (upForm.chain.trim()) payload.chain = upForm.chain.trim()
  } else {
    if (!upForm.pfx) {
      ElMessage.warning('请先选择 PFX / P12 证书文件')
      return
    }
    payload.pfx = upForm.pfx
    payload.pfxPassword = upForm.pfxPassword
  }

  uploading.value = true
  try {
    await call('/cert/upload', {
      method: 'POST',
      body: payload
    })
    ElMessage.success(upForm.id ? '证书已覆盖更新并升版' : '外部证书导入纳管成功')
    upVisible.value = false
    await loadPage()
  } catch {
    // handled in call()
  } finally {
    uploading.value = false
  }
}

async function deleteCert(row) {
  await ElMessageBox.confirm(
    `删除证书「${row.name || firstDomain(row)}」将同时级联移除关联的自动部署任务，确定继续吗？`,
    '删除证书确认',
    { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
  )
  try {
    await call('/cert/delete', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('证书已删除')
    await loadPage()
  } catch {
    // handled in call()
  }
}

onMounted(() => {
  loadPage()
})
</script>
