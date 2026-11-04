<template>
  <div v-loading="loading" class="space-y-4">
    <!-- 顶部页面栏 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <button type="button" class="wb-row-btn" @click="$router.push('/cert/assets')">
            <el-icon><ArrowLeft /></el-icon>
            <span>返回档案</span>
          </button>
          <h1 class="wb-page-title">{{ detail.name || primaryDomain }}</h1>
          <span class="wb-state" :class="assetStateClass(detail.assetstatus)">
            {{ assetStateText(detail.assetstatus) }}
          </span>
        </div>
        <p class="wb-page-sub">
          <span>{{ brandLabel(detail.brand) }}</span>
          <span class="wb-sep">·</span>
          <span class="mono">{{ detail.keytype || 'ECC' }}</span>
          <span class="wb-sep">·</span>
          <span class="mono">当前版本 v{{ detail.version || 1 }}</span>
          <span class="wb-sep">·</span>
          <span>项目：{{ detail.project || '未归属项目' }}</span>
          <span class="wb-sep">·</span>
          <span>环境：{{ envShortLabel(detail.env) }}</span>
          <span class="wb-sep">·</span>
          <span>责任人：{{ detail.owner || '未指派' }}</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="openEditGov">
          <el-icon><Edit /></el-icon>
          <span>编辑归属</span>
        </button>
        <button type="button" class="wb-btn" @click="$router.push('/deploy')">
          <el-icon><UploadFilled /></el-icon>
          <span>自动部署</span>
        </button>
        <button
          type="button"
          class="wb-btn wb-btn-primary"
          :disabled="probing"
          @click="runLiveVerify"
        >
          <el-icon><Connection /></el-icon>
          <span>{{ probing ? '握手中...' : '真机一致性核验' }}</span>
        </button>
      </div>
    </div>

    <!-- 真机握手核验即时结果条 -->
    <div
      v-if="probeResult"
      class="wb-panel p-4 flex flex-wrap items-center justify-between gap-4 text-xs"
    >
      <div class="space-y-1">
        <span
          class="wb-state"
          :class="isFingerprintConsistent ? 'wb-state-ok' : 'wb-state-err'"
        >
          {{
            isFingerprintConsistent
              ? '线上真机握手验证通过：443 端口实际生效证书与平台最新版指纹完全一致'
              : '发现部署漂移告警：线上节点生效证书指纹与平台最新版不一致（可能未重载或下发滞后）'
          }}
        </span>
        <div class="wb-meta">
          <span class="mono">探测端点 {{ probeResult.hostname }}:{{ probeResult.port }}</span>
          <span class="wb-sep">·</span>
          <span class="mono">{{ probeResult.protocol }} / {{ probeResult.cipher }}</span>
          <span class="wb-sep">·</span>
          <span class="mono">线上指纹 {{ probeResult.fingerprint }}</span>
        </div>
      </div>
      <button type="button" class="wb-row-link" @click="probeResult = null">收起报告</button>
    </div>

    <!-- X.509 密码学参数 + 资产归属双栏 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="wb-panel lg:col-span-2">
        <div class="wb-panel-header">
          <div>
            <h3 class="wb-panel-title">X.509 证书链密码学参数</h3>
            <p class="wb-panel-sub">服务端自动解析证书实体，私钥与挑战令牌已做安全隔离</p>
          </div>
          <span v-if="detail.notafter" class="mono text-xs font-semibold" :class="daysColor">
            {{ daysLabel }}
          </span>
        </div>

        <div v-if="detail.parsed && detail.parsed.subject" class="wb-panel-body space-y-3 text-[13px]">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div class="text-xs text-gray-400">使用者 (Subject DN)</div>
              <div class="mono text-gray-900 mt-0.5 break-all">{{ detail.parsed.subject }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">签发者 (Issuer DN)</div>
              <div class="mono text-gray-900 mt-0.5 break-all">{{ detail.parsed.issuer }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">生效时间 (Not Before)</div>
              <div class="mono text-gray-900 mt-0.5">{{ formatDate(detail.parsed.notbefore) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">到期时间 (Not After)</div>
              <div class="mono text-gray-900 mt-0.5">{{ formatDate(detail.parsed.notafter) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-400">签名算法 / 公钥规格</div>
              <div class="mono text-gray-900 mt-0.5">
                {{ detail.parsed.signaturealg }} · {{ detail.parsed.pubkeyalg }}
              </div>
            </div>
            <div>
              <div class="text-xs text-gray-400">证书序列号 (Serial Number)</div>
              <div class="mono text-gray-900 mt-0.5 break-all">{{ detail.parsed.serialno || '-' }}</div>
            </div>
          </div>

          <div class="pt-3 border-t border-[#f1f3f6]">
            <div class="flex items-center justify-between">
              <span class="text-xs text-gray-400">SHA-256 指纹 (Fingerprint)</span>
              <button
                type="button"
                class="wb-row-link"
                @click="copyToClipboard(detail.parsed.fingerprint, '证书指纹已复制')"
              >
                复制指纹
              </button>
            </div>
            <div class="mono text-xs text-gray-900 mt-0.5 break-all">
              {{ detail.parsed.fingerprint || '-' }}
            </div>
          </div>

          <div class="pt-3 border-t border-[#f1f3f6]">
            <div class="text-xs text-gray-400 mb-1">包含域名列表 (SAN · 共 {{ sanList.length }} 项)</div>
            <div class="wb-meta">
              <template v-for="(d, idx) in sanList" :key="d">
                <span class="mono text-gray-900 font-medium">{{ d }}</span>
                <span v-if="idx < sanList.length - 1" class="wb-sep">·</span>
              </template>
            </div>
          </div>
        </div>
        <div v-else class="wb-panel-body text-sm text-gray-400">
          当前订单尚未完成签发（状态：{{ detail.status }}），暂无 X.509 实体参数。
        </div>
      </div>

      <div class="wb-panel">
        <div class="wb-panel-header">
          <div>
            <h3 class="wb-panel-title">资产归属与运维备注</h3>
            <p class="wb-panel-sub">支撑到期告警路由与多团队分权治理</p>
          </div>
        </div>
        <div class="wb-panel-body space-y-3 text-[13px]">
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">归属业务项目</span>
            <span class="font-medium text-gray-900">{{ detail.project || '未设置' }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">所属环境</span>
            <span class="font-medium text-gray-900">{{ envShortLabel(detail.env) }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">主责任人 (Owner)</span>
            <span class="font-medium text-gray-900">{{ detail.owner || '未指派' }}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">累计续期次数</span>
            <span class="mono font-medium text-gray-900">{{ detail.renewcount || 0 }} 次</span>
          </div>
          <div class="flex justify-between py-1 border-b border-[#f3f4f6]">
            <span class="text-gray-500">资产纳管时间</span>
            <span class="mono text-gray-600">{{ formatDate(detail.createdat) }}</span>
          </div>
          <div>
            <div class="text-gray-500 mb-1">运维交接备注</div>
            <div class="text-xs text-gray-600 bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-3 leading-relaxed">
              {{ detail.remark || '暂无备注说明，点击右上角「编辑归属」可补充业务影响面与应急联系人。' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部三栏演进记录 -->
    <div class="wb-panel overflow-hidden px-3 pt-3">
      <div class="px-2 pb-3 border-b border-[#f1f3f6] flex flex-wrap items-center justify-between gap-3">
        <div class="wb-tabs">
          <button
            type="button"
            class="wb-tab"
            :class="{ active: activeTab === 'deploys' }"
            @click="activeTab = 'deploys'"
          >
            关联部署 ({{ (detail.deploys || []).length }})
          </button>
          <button
            type="button"
            class="wb-tab"
            :class="{ active: activeTab === 'versions' }"
            @click="activeTab = 'versions'"
          >
            历史版本 ({{ (detail.versions || []).length }})
          </button>
          <button
            type="button"
            class="wb-tab"
            :class="{ active: activeTab === 'operations' }"
            @click="activeTab = 'operations'"
          >
            操作审计 ({{ (detail.operations || []).length }})
          </button>
        </div>

        <span v-if="activeTab === 'deploys'" class="text-xs text-gray-400">
          写前自动创建快照并执行 nginx -t 语法预检，失败自动回滚
        </span>
      </div>

      <div v-if="activeTab === 'deploys'">
        <el-table :data="detail.deploys || []" empty-text="当前证书暂未绑定自动部署服务器节点">
          <el-table-column label="部署任务名称" prop="NAME" min-width="180" />
          <el-table-column label="目标服务器" min-width="190">
            <template #default="{ row }">
              <div class="font-medium text-gray-900">{{ row.SERVERNAME }}</div>
              <div class="mono text-xs text-gray-400">{{ row.IP }} · {{ row.OS }}</div>
            </template>
          </el-table-column>
          <el-table-column label="证书落地路径" min-width="190">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-700">{{ row.TARGETPATH }}</span>
            </template>
          </el-table-column>
          <el-table-column label="版本一致性" width="160">
            <template #default="{ row }">
              <div class="mono text-xs font-semibold">
                已部署 v{{ row.DEPLOYEDVERSION || 0 }} / 最新 v{{ detail.version || 1 }}
              </div>
              <div
                v-if="(row.DEPLOYEDVERSION || 0) < (detail.version || 1)"
                class="text-[11px] text-red-600 font-medium"
              >
                版本滞后，待同步
              </div>
              <div v-else class="text-[11px] text-emerald-600">版本已对齐</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="110">
            <template #default="{ row }">
              <span
                class="wb-state"
                :class="
                  row.STATUS === 'SUCCESS'
                    ? 'wb-state-ok'
                    : row.STATUS === 'FAILED'
                    ? 'wb-state-err'
                    : 'wb-state-warn'
                "
              >
                {{ row.STATUS === 'SUCCESS' ? '已生效' : row.STATUS === 'FAILED' ? '下发失败' : '待同步' }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="最近执行时间与反馈" min-width="240">
            <template #default="{ row }">
              <div class="mono text-xs text-gray-400">{{ formatDate(row.LASTDEPLOYTIME) }}</div>
              <div class="text-xs text-gray-700 mt-0.5">{{ row.LASTMESSAGE || '-' }}</div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="activeTab === 'versions'">
        <el-table :data="detail.versions || []" empty-text="暂无历史版本快照">
          <el-table-column label="版本号" width="100">
            <template #default="{ row }">
              <span class="mono font-bold text-gray-900">v{{ row.VERSION }}</span>
            </template>
          </el-table-column>
          <el-table-column label="演进来源" width="130">
            <template #default="{ row }">
              <span>
                {{
                  { APPLY: '首次申请签发', RENEW: '自动/手动续期', UPLOAD: '外部覆盖上传' }[row.SOURCE] ||
                  row.SOURCE
                }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="生效区间" min-width="210">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-700">
                {{ formatDay(row.NOTBEFORE) }} ~ {{ formatDay(row.NOTAFTER) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="签名算法" prop="SIGNATUREALG" width="160" />
          <el-table-column label="SHA-256 指纹" min-width="260">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-500">{{ row.FINGERPRINT }}</span>
            </template>
          </el-table-column>
          <el-table-column label="归档时间" width="175">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-400">{{ formatDate(row.CREATEDAT) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="activeTab === 'operations'">
        <el-table :data="detail.operations || []" empty-text="暂无关联审计记录">
          <el-table-column label="操作时间" width="175">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-500">{{ formatDate(row.CREATEDAT) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="执行账号" prop="USERNAME" width="130" />
          <el-table-column label="动作类型" width="140">
            <template #default="{ row }">
              <span class="mono text-xs font-semibold text-gray-800">{{ row.ACTION }}</span>
            </template>
          </el-table-column>
          <el-table-column label="结果" width="110">
            <template #default="{ row }">
              <span
                class="wb-state"
                :class="String(row.RESULT).includes('200') ? 'wb-state-ok' : 'wb-state-err'"
              >
                {{ row.RESULT }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="审计详情" prop="DETAIL" min-width="260" />
        </el-table>
      </div>
    </div>

    <!-- 编辑资产归属弹窗 -->
    <el-dialog v-model="govVisible" title="编辑证书资产归属信息" width="480px">
      <el-form label-position="top">
        <el-form-item label="所属业务项目 (Project)">
          <el-input v-model="govForm.project" placeholder="例如：核心网关 / 开放平台" />
        </el-form-item>
        <el-form-item label="运行环境 (Environment)">
          <el-select v-model="govForm.env" class="w-full">
            <el-option v-for="(label, code) in ENV_MAP" :key="code" :label="label" :value="code" />
          </el-select>
        </el-form-item>
        <el-form-item label="资产主责任人 (Owner)">
          <el-input v-model="govForm.owner" placeholder="例如：陈工 (sre_chen)" />
        </el-form-item>
        <el-form-item label="运维交接与影响面备注">
          <el-input
            v-model="govForm.remark"
            type="textarea"
            :rows="3"
            placeholder="记录使用该证书的负载均衡实例、上下游调用方或变更窗口要求"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="govVisible = false">取消</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          :disabled="savingGov"
          @click="saveGov"
        >
          {{ savingGov ? '保存中...' : '保存归属信息' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Connection, Edit, UploadFilled } from '@element-plus/icons-vue'
import { call } from '../api'
import {
  ENV_MAP,
  brandLabel,
  envShortLabel,
  parseDomains,
  formatDate,
  formatDay,
  calcDaysDiff,
  copyToClipboard
} from '../utils'

const route = useRoute()
const loading = ref(false)
const probing = ref(false)
const activeTab = ref('deploys')
const detail = ref({})
const probeResult = ref(null)

const govVisible = ref(false)
const savingGov = ref(false)
const govForm = reactive({
  project: '',
  env: 'prod',
  owner: '',
  remark: ''
})

const sanList = computed(() => {
  if (detail.value?.parsed?.san?.length) return detail.value.parsed.san
  return parseDomains(detail.value?.domains)
})

const primaryDomain = computed(() => sanList.value[0] || '-')

const daysLabel = computed(() => {
  const d = calcDaysDiff(detail.value?.notafter)
  if (d === null) return ''
  if (d < 0) return `已过期 ${Math.abs(d)} 天`
  return `距到期剩余 ${d} 天`
})

const daysColor = computed(() => {
  const d = calcDaysDiff(detail.value?.notafter)
  if (d === null) return 'text-gray-400'
  if (d < 0 || d <= 7) return 'text-red-600'
  if (d <= 30) return 'text-amber-600'
  return 'text-emerald-600'
})

const isFingerprintConsistent = computed(() => {
  if (!probeResult.value || !detail.value?.parsed?.fingerprint) return false
  return probeResult.value.fingerprint === detail.value.parsed.fingerprint
})

function assetStateText(st) {
  return (
    {
      VALID: '正常受控',
      EXPIRING: '即将到期',
      EXPIRED: '已过期',
      DEPLOY_ABNORMAL: '部署滞后/异常',
      UNKNOWN: '待签发'
    }[st] || st || '未知'
  )
}

function assetStateClass(st) {
  if (st === 'VALID') return 'wb-state-ok'
  if (st === 'EXPIRING') return 'wb-state-warn'
  if (st === 'EXPIRED' || st === 'DEPLOY_ABNORMAL') return 'wb-state-err'
  return 'wb-state-neutral'
}

async function loadDetail() {
  loading.value = true
  try {
    const id = route.params.id
    detail.value = (await call('/cert/assetDetail?id=' + encodeURIComponent(id))) || {}
  } catch {
    // handled in call()
  } finally {
    loading.value = false
  }
}

async function runLiveVerify() {
  const host = primaryDomain.value.replace(/^\*\./, '')
  if (!host || host === '-') {
    ElMessage.warning('当前资产没有可探测的域名')
    return
  }
  probing.value = true
  try {
    probeResult.value = await call('/probe/tls', {
      method: 'POST',
      body: { hostname: host, port: 443 }
    })
    if (isFingerprintConsistent.value) {
      ElMessage.success('真机握手核验完成：线上生效证书与当前平台版本一致')
    } else {
      ElMessage.warning('检测到线上生效指纹与当前平台最新版本不一致，请检查部署节点状态')
    }
  } catch {
    // handled in call()
  } finally {
    probing.value = false
  }
}

function openEditGov() {
  govForm.project = detail.value.project || ''
  govForm.env = detail.value.env || 'prod'
  govForm.owner = detail.value.owner || ''
  govForm.remark = detail.value.remark || ''
  govVisible.value = true
}

async function saveGov() {
  savingGov.value = true
  try {
    await call('/cert/assetSave', {
      method: 'POST',
      body: {
        id: detail.value.id,
        project: govForm.project,
        env: govForm.env,
        owner: govForm.owner,
        remark: govForm.remark
      }
    })
    ElMessage.success('资产归属信息已保存')
    govVisible.value = false
    await loadDetail()
  } catch {
    // handled in call()
  } finally {
    savingGov.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>
