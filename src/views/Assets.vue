<template>
  <div class="space-y-4">
    <!-- 顶部页面标题与圆角操作栏（1:1 对齐参考图 1「学生档案」顶栏） -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">证书档案</h1>
        </div>
        <p class="wb-page-sub">
          <span>共 {{ total }} 项资产</span>
          <span class="wb-sep">·</span>
          <span>正常 {{ validInPageCount }}</span>
          <span class="wb-sep">·</span>
          <span>临期/异常 {{ riskInPageCount }}</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="$router.push('/probe?tab=probe')">
          <el-icon><Aim /></el-icon>
          <span>扫描未知证书</span>
        </button>
        <button type="button" class="wb-btn" @click="exportCsv">
          <el-icon><Download /></el-icon>
          <span>导出名单 CSV</span>
        </button>
        <button
          v-if="can('cert:apply')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="$router.push('/cert/apply')"
        >
          <el-icon><Plus /></el-icon>
          <span>添加证书</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 圆角筛选条（左：圆角搜索框 + 胶囊筛选标签；右：品牌/环境/排序） -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="wb-search w-60">
          <el-icon class="text-gray-400"><Search /></el-icon>
          <input
            v-model="query.keyword"
            type="text"
            placeholder="搜索域名、名称或责任人"
            @keyup.enter="handleSearch"
          />
        </div>

        <div class="wb-tabs">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            class="wb-tab"
            :class="{ active: query.assetStatus === tab.value }"
            @click="switchStatus(tab.value)"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <el-select
          v-model="query.brand"
          placeholder="全部 CA 品牌"
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
          v-model="query.env"
          placeholder="全部环境"
          clearable
          class="wb-pill-select !w-32"
          @change="handleSearch"
        >
          <el-option
            v-for="(label, code) in ENV_MAP"
            :key="code"
            :label="label"
            :value="code"
          />
        </el-select>

        <el-select
          v-model="sortKey"
          class="wb-pill-select !w-44"
          @change="handleSortChange"
        >
          <el-option label="到期时间 · 最近优先" value="notafter_asc" />
          <el-option label="到期时间 · 最远优先" value="notafter_desc" />
          <el-option label="证书版本 · 高版本优先" value="version_desc" />
        </el-select>

        <button
          v-if="query.keyword || query.brand || query.env || query.assetStatus"
          type="button"
          class="wb-row-link"
          @click="resetFilters"
        >
          重置
        </button>
      </div>
    </div>

    <!-- 统一证书档案白卡表格（1:1 对齐参考图 1 的留白、头像圆标、软标签与右侧圆角按钮） -->
    <div class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loading" :data="rows" class="w-full" empty-text="暂无符合筛选条件的证书资产">
        <el-table-column label="编号 ↑" width="90">
          <template #default="{ row }">
            <span class="mono text-xs text-gray-500">#{{ row.id }}</span>
          </template>
        </el-table-column>

        <el-table-column label="证书名称 / 绑定域名" min-width="250">
          <template #default="{ row }">
            <div class="flex items-center gap-2.5 py-0.5">
              <span class="domain-avatar">
                {{ domainInitial(row) }}
              </span>
              <div class="min-w-0">
                <button
                  type="button"
                  class="text-left font-bold text-[#111827] hover:opacity-75 transition-opacity cursor-pointer bg-transparent border-0 p-0 text-[13.5px]"
                  @click="$router.push('/cert/assets/' + row.id)"
                >
                  {{ row.name || primaryDomain(row) }}
                </button>
                <div class="mono text-[11.5px] text-gray-400 truncate">
                  {{ primaryDomain(row) }}
                  <span v-if="domainCount(row) > 1"> +{{ domainCount(row) - 1 }} SAN</span>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="算法" width="85">
          <template #default="{ row }">
            <span class="mono text-xs text-gray-700">{{ row.keytype || 'ECC' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="签发 CA" min-width="140">
          <template #default="{ row }">
            <div class="text-[13px] text-gray-800">{{ brandLabel(row.brand) }}</div>
            <div class="text-[11.5px] text-gray-400">{{ validationText(row.validation) }} · v{{ row.version || 1 }}</div>
          </template>
        </el-table-column>

        <el-table-column label="环境" width="95">
          <template #default="{ row }">
            <span v-if="row.env" class="wb-soft-label">{{ envShortLabel(row.env) }}</span>
            <span v-else class="text-gray-300">—</span>
          </template>
        </el-table-column>

        <el-table-column label="到期日" width="145">
          <template #default="{ row }">
            <template v-if="row.notafter">
              <div class="mono text-[13px] font-medium text-gray-800">{{ formatDay(row.notafter) }}</div>
              <div class="mono text-[11.5px]" :class="daysColorClass(row.notafter)">
                {{ daysText(row.notafter) }}
              </div>
            </template>
            <span v-else class="text-xs text-gray-400">待签发</span>
          </template>
        </el-table-column>

        <el-table-column label="责任人与项目" min-width="165">
          <template #default="{ row }">
            <div class="text-[13px] text-gray-800">{{ row.owner || '待指派' }}</div>
            <div class="text-[11.5px] text-gray-400">{{ row.project || '默认项目组' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="状态与落地" min-width="145">
          <template #default="{ row }">
            <div class="wb-state" :class="assetStateClass(row.assetstatus)">
              {{ assetStateText(row.assetstatus) }}
            </div>
            <div class="text-[11.5px] text-gray-400 mt-0.5">
              <template v-if="row.deploytotal > 0">
                关联 {{ row.deploytotal }} 台{{ row.deployfailed > 0 ? ` · ${row.deployfailed}异常` : '' }}
              </template>
              <template v-else>—</template>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="档案报告" width="185" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex items-center gap-2">
              <button
                type="button"
                class="wb-row-btn"
                @click="$router.push('/cert/assets/' + row.id)"
              >
                <el-icon><Document /></el-icon>
                <span>资产档案</span>
              </button>
              <button
                type="button"
                class="wb-row-link"
                @click="probeAsset(row)"
              >
                核验
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="px-3 py-3.5 flex items-center justify-between">
        <span class="text-xs text-gray-400">
          点击任意证书名称进入完整 X.509 链、关联服务器部署拓扑与历史版本归档
        </span>
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="sizes, prev, pager, next"
          small
          @size-change="loadAssets"
          @current-change="loadAssets"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Search, Plus, Download, Aim, FullScreen, Document } from '@element-plus/icons-vue'
import { call } from '../api'
import { can } from '../store'
import {
  BRAND_MAP,
  ENV_MAP,
  brandLabel,
  envShortLabel,
  parseDomains,
  formatDay,
  calcDaysDiff,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const router = useRouter()
const route = useRoute()

const statusTabs = [
  { label: '全部', value: '' },
  { label: '健康有效', value: 'VALID' },
  { label: '即将到期', value: 'EXPIRING' },
  { label: '部署异常', value: 'DEPLOY_ABNORMAL' },
  { label: '已过期', value: 'EXPIRED' }
]

const loading = ref(false)
const rows = ref([])
const total = ref(0)
const sortKey = ref('notafter_asc')

const query = reactive({
  page: 1,
  size: 10,
  keyword: route.query.keyword ? String(route.query.keyword) : '',
  brand: '',
  assetStatus: route.query.status ? String(route.query.status) : '',
  env: '',
  sortBy: 'notafter',
  asc: true
})

watch(
  () => route.query.keyword,
  (val) => {
    query.keyword = val ? String(val) : ''
    query.page = 1
    loadAssets()
  }
)

const validInPageCount = computed(() => rows.value.filter((r) => r.assetstatus === 'VALID').length)
const riskInPageCount = computed(() => rows.value.filter((r) => r.assetstatus !== 'VALID').length)

function primaryDomain(row) {
  const list = parseDomains(row.domains)
  return list[0] || '-'
}

function domainInitial(row) {
  const dom = primaryDomain(row).replace(/^\*\./, '')
  return (dom[0] || 'C').toUpperCase()
}

function domainCount(row) {
  return parseDomains(row.domains).length
}

function validationText(v) {
  return { CLOUD_DNS: '自动 DNS', MANUAL_DNS: '手动 TXT', AUTO: '免验证' }[v] || v || '-'
}

function assetStateText(st) {
  return (
    {
      VALID: '正常受控',
      EXPIRING: '即将到期',
      EXPIRED: '已过期',
      DEPLOY_ABNORMAL: '部署滞后',
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

function daysText(notafter) {
  const d = calcDaysDiff(notafter)
  if (d === null) return '-'
  if (d < 0) return `已逾期 ${Math.abs(d)} 天`
  if (d === 0) return '今日到期'
  return `剩余 ${d} 天`
}

function daysColorClass(notafter) {
  const d = calcDaysDiff(notafter)
  if (d === null) return 'text-gray-400'
  if (d < 0 || d <= 7) return 'text-red-600 font-semibold'
  if (d <= 30) return 'text-amber-600 font-semibold'
  return 'text-gray-400'
}

async function loadAssets() {
  loading.value = true
  try {
    const res = await call('/cert/assets', {
      method: 'POST',
      body: { ...query }
    })
    rows.value = res?.rows || []
    total.value = res?.total || 0
  } catch {
    // handled in call()
  } finally {
    loading.value = false
  }
}

function switchStatus(val) {
  query.assetStatus = val
  query.page = 1
  loadAssets()
}

function handleSortChange(val) {
  if (val === 'notafter_asc') {
    query.sortBy = 'notafter'
    query.asc = true
  } else if (val === 'notafter_desc') {
    query.sortBy = 'notafter'
    query.asc = false
  } else {
    query.sortBy = 'version'
    query.asc = false
  }
  query.page = 1
  loadAssets()
}

function handleSearch() {
  query.page = 1
  loadAssets()
}

function resetFilters() {
  query.keyword = ''
  query.brand = ''
  query.assetStatus = ''
  query.env = ''
  sortKey.value = 'notafter_asc'
  query.sortBy = 'notafter'
  query.asc = true
  query.page = 1
  loadAssets()
}

function probeAsset(row) {
  const dom = primaryDomain(row).replace(/^\*\./, '')
  router.push({ path: '/probe', query: { tab: 'probe', domain: dom } })
}

function exportCsv() {
  if (!rows.value.length) {
    ElMessage.warning('当前列表暂无可导出的资产记录')
    return
  }
  const headers = [
    '资产ID',
    '证书名称',
    '绑定域名(SAN)',
    '签发品牌',
    '算法',
    '版本',
    '所属项目',
    '运行环境',
    '责任人',
    '资产状态',
    '到期日期',
    '关联部署数',
    '异常部署数'
  ]
  const csvRows = rows.value.map((r) => [
    r.id,
    r.name || '',
    parseDomains(r.domains).join('; '),
    brandLabel(r.brand),
    r.keytype || '',
    'v' + (r.version || 1),
    r.project || '',
    envShortLabel(r.env),
    r.owner || '',
    assetStateText(r.assetstatus),
    formatDay(r.notafter),
    r.deploytotal || 0,
    r.deployfailed || 0
  ])
  const content =
    '\uFEFF' +
    [headers, ...csvRows]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `sslauto-assets-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  ElMessage.success('证书资产台账 CSV 已导出')
}

onMounted(() => {
  loadAssets()
})
</script>

<style scoped>
.domain-avatar {
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: #18181b;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
