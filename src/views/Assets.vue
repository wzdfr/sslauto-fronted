<template>
  <div>
    <div class="page-card">
      <div class="toolbar">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索域名 / 证书名称 / 项目 / 负责人"
          clearable
          style="width: 300px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-select v-model="filters.brand" placeholder="签发机构" clearable style="width: 150px" @change="search">
          <el-option label="内置私有CA" value="INTERNAL" />
          <el-option label="Let's Encrypt" value="LETSENCRYPT" />
          <el-option label="手动上传" value="UPLOAD" />
        </el-select>
        <el-select v-model="filters.assetStatus" placeholder="资产状态" clearable style="width: 150px" @change="search">
          <el-option label="正常" value="VALID" />
          <el-option label="即将到期" value="EXPIRING" />
          <el-option label="已过期" value="EXPIRED" />
          <el-option label="部署异常" value="DEPLOY_ABNORMAL" />
          <el-option label="未知状态" value="UNKNOWN" />
        </el-select>
        <el-button type="primary" @click="search">查询</el-button>
        <el-button @click="reset">重置</el-button>
      </div>

      <el-table :data="rows" v-loading="loading" size="small" empty-text="暂无证书资产" @sort-change="onSort">
        <el-table-column prop="name" label="证书名称" min-width="150" show-overflow-tooltip />
        <el-table-column label="域名" min-width="200">
          <template #default="{ row }">
            <el-tag v-for="d in parseDomains(row.domains).slice(0, 2)" :key="d" size="small" style="margin-right:4px">
              {{ d }}
            </el-tag>
            <span v-if="parseDomains(row.domains).length > 2" class="muted">+{{ parseDomains(row.domains).length - 2 }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="brand" label="签发机构" width="120">
          <template #default="{ row }">{{ brandLabel(row.brand) }}</template>
        </el-table-column>
        <el-table-column label="资产状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.assetstatus)" size="small">{{ statusLabel(row.assetstatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="有效期至" width="160" sortable="custom" prop="notafter">
          <template #default="{ row }">{{ fmt(row.notafter) }}</template>
        </el-table-column>
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <span :style="{ color: daysColor(row) }">{{ daysLeft(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="部署" width="110">
          <template #default="{ row }">
            <span v-if="row.deploytotal > 0">
              {{ row.deploytotal }} 个任务
              <el-tag v-if="row.deployfailed > 0" type="danger" size="small">{{ row.deployfailed }} 失败</el-tag>
            </span>
            <span v-else class="muted">未部署</span>
          </template>
        </el-table-column>
        <el-table-column prop="project" label="项目" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.project || '-' }}</template>
        </el-table-column>
        <el-table-column prop="env" label="环境" width="80">
          <template #default="{ row }">{{ row.env || '-' }}</template>
        </el-table-column>
        <el-table-column prop="owner" label="负责人" width="100">
          <template #default="{ row }">{{ row.owner || '-' }}</template>
        </el-table-column>
        <el-table-column prop="version" label="版本" width="70" sortable="custom" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push('/cert/assets/' + row.id)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        :current-page="page"
        :page-size="size"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 12px"
        @current-change="(p) => { page = p; load() }"
        @size-change="(s) => { size = s; search() }"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '../api'

const rows = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(10)
const loading = ref(false)
const filters = reactive({ keyword: '', brand: '', assetStatus: '' })
const sortBy = ref('notafter')
const asc = ref(true)

function parseDomains(s) {
  try { return JSON.parse(s || '[]') } catch { return [] }
}
function brandLabel(b) {
  return { INTERNAL: '内置私有CA', LETSENCRYPT: "Let's Encrypt", UPLOAD: '手动上传', ZEROSSL: 'ZeroSSL', GOOGLE: 'Google', LITESSL: 'LiteSSL' }[b] || b
}
function statusLabel(s) {
  return { VALID: '正常', EXPIRING: '即将到期', EXPIRED: '已过期', DEPLOY_ABNORMAL: '部署异常', UNKNOWN: '未知' }[s] || s
}
function statusType(s) {
  return { VALID: 'success', EXPIRING: 'warning', EXPIRED: 'danger', DEPLOY_ABNORMAL: 'danger', UNKNOWN: 'info' }[s] || 'info'
}
function fmt(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function daysLeft(row) {
  if (!row.notafter) return '未知'
  const diff = Math.floor((new Date(row.notafter) - Date.now()) / 86400000)
  if (diff < 0) return `过期 ${-diff} 天`
  return `${diff} 天`
}
function daysColor(row) {
  if (!row.notafter) return '#909399'
  const diff = Math.floor((new Date(row.notafter) - Date.now()) / 86400000)
  if (diff < 0) return '#F56C6C'
  if (diff < 15) return '#E6A23C'
  return '#67C23A'
}

async function load() {
  loading.value = true
  try {
    const data = await api('/cert/assets', {
      method: 'POST',
      body: { page: page.value, size: size.value, ...filters, sortBy: sortBy.value, asc: asc.value }
    })
    rows.value = data.rows || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}
function search() { page.value = 1; load() }
function reset() {
  filters.keyword = ''
  filters.brand = ''
  filters.assetStatus = ''
  search()
}
function onSort({ prop, order }) {
  if (!order) return
  sortBy.value = prop
  asc.value = order === 'ascending'
  load()
}

onMounted(load)
</script>

<style scoped>
.toolbar { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.muted { color: #909399; font-size: 12px; }
</style>
