<template>
  <div v-loading="loading">
    <div class="page-card" v-if="cert">
      <div class="head">
        <div>
          <div class="title-row">
            <h3 style="margin: 0">{{ cert.name }}</h3>
            <el-tag :type="statusType(cert.assetstatus)" size="small">{{ statusLabel(cert.assetstatus) }}</el-tag>
            <el-tag size="small" type="info">{{ brandLabel(cert.brand) }}</el-tag>
            <el-tag size="small">{{ cert.status }}</el-tag>
            <el-tag size="small" type="warning">v{{ cert.version }}</el-tag>
          </div>
          <div class="domains">
            <el-tag v-for="d in domainList" :key="d" size="small" style="margin-right: 6px">{{ d }}</el-tag>
          </div>
        </div>
        <el-button type="primary" plain @click="editVisible = true">编辑资产归属</el-button>
      </div>

      <el-descriptions title="基本信息" :column="3" border size="small" style="margin-top: 8px">
        <el-descriptions-item label="剩余天数">{{ daysLeft }}</el-descriptions-item>
        <el-descriptions-item label="续期次数">{{ cert.renewcount || 0 }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ fmt(cert.createdat) }}</el-descriptions-item>
        <el-descriptions-item label="项目">{{ cert.project || '-' }}</el-descriptions-item>
        <el-descriptions-item label="环境">{{ cert.env || '-' }}</el-descriptions-item>
        <el-descriptions-item label="负责人">{{ cert.owner || '-' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="3">{{ cert.remark || '-' }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="证书内容" :column="2" border size="small" style="margin-top: 16px" v-if="parsed.subject">
        <el-descriptions-item label="Subject" :span="2">{{ parsed.subject }}</el-descriptions-item>
        <el-descriptions-item label="Issuer" :span="2">{{ parsed.issuer }}</el-descriptions-item>
        <el-descriptions-item label="SAN 域名" :span="2">
          <el-tag v-for="d in parsed.san" :key="d" size="small" style="margin-right: 4px">{{ d }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="序列号">{{ parsed.serialno }}</el-descriptions-item>
        <el-descriptions-item label="签名算法">{{ parsed.signaturealg }}</el-descriptions-item>
        <el-descriptions-item label="公钥算法">{{ parsed.pubkeyalg }}</el-descriptions-item>
        <el-descriptions-item label="SHA-256 指纹" :span="2">
          <span class="mono">{{ parsed.fingerprint }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="生效时间">{{ fmt(parsed.notbefore) }}</el-descriptions-item>
        <el-descriptions-item label="到期时间">{{ fmt(parsed.notafter) }}</el-descriptions-item>
      </el-descriptions>

      <h4 style="margin: 18px 0 8px">部署关系（{{ deploys.length }}）</h4>
      <el-table :data="deploys" size="small" border empty-text="该证书尚未配置自动部署">
        <el-table-column prop="NAME" label="任务名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="SERVERNAME" label="服务器" min-width="140">
          <template #default="{ row }">
            {{ row.SERVERNAME || '-' }}<span v-if="row.IP" class="muted">（{{ row.IP }}）</span>
          </template>
        </el-table-column>
        <el-table-column prop="OS" label="系统" width="90" />
        <el-table-column prop="TARGETPATH" label="部署目标路径" min-width="180" show-overflow-tooltip />
        <el-table-column label="部署状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.STATUS === 'SUCCESS' ? 'success' : row.STATUS === 'FAILED' ? 'danger' : 'info'" size="small">
              {{ row.STATUS }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="已部署版本" width="100">
          <template #default="{ row }">v{{ row.DEPLOYEDVERSION }}</template>
        </el-table-column>
        <el-table-column label="最近部署时间" width="160">
          <template #default="{ row }">{{ fmt(row.LASTDEPLOYTIME) }}</template>
        </el-table-column>
      </el-table>

      <h4 style="margin: 18px 0 8px">版本历史（{{ versions.length }}）</h4>
      <el-table :data="versions" size="small" border>
        <el-table-column prop="VERSION" label="版本" width="70">
          <template #default="{ row }">v{{ row.VERSION }}</template>
        </el-table-column>
        <el-table-column label="来源" width="90">
          <template #default="{ row }">{{ sourceLabel(row.SOURCE) }}</template>
        </el-table-column>
        <el-table-column label="生效时间" width="160">
          <template #default="{ row }">{{ fmt(row.NOTBEFORE) }}</template>
        </el-table-column>
        <el-table-column label="到期时间" width="160">
          <template #default="{ row }">{{ fmt(row.NOTAFTER) }}</template>
        </el-table-column>
        <el-table-column prop="SERIALNO" label="序列号" min-width="180" show-overflow-tooltip />
        <el-table-column prop="SIGNATUREALG" label="签名算法" width="140" show-overflow-tooltip />
        <el-table-column label="指纹" min-width="220" show-overflow-tooltip>
          <template #default="{ row }"><span class="mono">{{ row.FINGERPRINT }}</span></template>
        </el-table-column>
        <el-table-column label="记录时间" width="160">
          <template #default="{ row }">{{ fmt(row.CREATEDAT) }}</template>
        </el-table-column>
      </el-table>

      <h4 style="margin: 18px 0 8px">操作历史（{{ operations.length }}）</h4>
      <el-table :data="operations" size="small" border>
        <el-table-column prop="CREATEDAT" label="时间" width="160">
          <template #default="{ row }">{{ fmt(row.CREATEDAT) }}</template>
        </el-table-column>
        <el-table-column prop="USERNAME" label="操作人" width="100" />
        <el-table-column prop="ACTION" label="动作" width="130" />
        <el-table-column prop="METHOD" label="方法" width="60" />
        <el-table-column label="结果" width="80">
          <template #default="{ row }">
            <el-tag :type="String(row.RESULT).includes('200') ? 'success' : 'danger'" size="small">
              {{ row.RESULT }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="DETAIL" label="详情" min-width="260" show-overflow-tooltip />
      </el-table>
    </div>

    <el-dialog v-model="editVisible" title="编辑资产归属" width="460px">
      <el-form label-width="80px">
        <el-form-item label="项目"><el-input v-model="editForm.project" placeholder="如：门户系统 / 支付网关" /></el-form-item>
        <el-form-item label="环境">
          <el-select v-model="editForm.env" placeholder="选择环境" clearable style="width: 100%">
            <el-option label="生产（prod）" value="prod" />
            <el-option label="预发（staging）" value="staging" />
            <el-option label="测试（test）" value="test" />
            <el-option label="开发（dev）" value="dev" />
          </el-select>
        </el-form-item>
        <el-form-item label="负责人"><el-input v-model="editForm.owner" placeholder="证书责任人" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="editForm.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAsset">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { ElMessage } from 'element-plus'

const route = useRoute()
const certId = route.params.id
const loading = ref(false)
const cert = ref(null)
const parsed = ref({})
const deploys = ref([])
const versions = ref([])
const operations = ref([])
const editVisible = ref(false)
const editForm = reactive({ project: '', env: '', owner: '', remark: '' })

const domainList = computed(() => {
  try { return JSON.parse(cert.value?.domains || '[]') } catch { return [] }
})
function statusLabel(s) {
  return { VALID: '正常', EXPIRING: '即将到期', EXPIRED: '已过期', DEPLOY_ABNORMAL: '部署异常', UNKNOWN: '未知' }[s] || s || '-'
}
function statusType(s) {
  return { VALID: 'success', EXPIRING: 'warning', EXPIRED: 'danger', DEPLOY_ABNORMAL: 'danger', UNKNOWN: 'info' }[s] || 'info'
}
function brandLabel(b) {
  return { INTERNAL: '内置私有CA', LETSENCRYPT: "Let's Encrypt", UPLOAD: '手动上传', ZEROSSL: 'ZeroSSL', GOOGLE: 'Google', LITESSL: 'LiteSSL' }[b] || b
}
function sourceLabel(s) {
  return { APPLY: '申请', RENEW: '续期', UPLOAD: '上传' }[s] || s
}
function fmt(t) {
  if (!t) return '-'
  const d = new Date(t)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const daysLeft = computed(() => {
  const t = parsed.value.notafter || cert.value?.notafter
  if (!t) return '未知'
  const diff = Math.floor((new Date(t) - Date.now()) / 86400000)
  return diff < 0 ? `已过期 ${-diff} 天` : `${diff} 天`
})

async function load() {
  loading.value = true
  try {
    const data = await api('/cert/assetDetail?id=' + certId)
    cert.value = data
    parsed.value = data.parsed || {}
    deploys.value = data.deploys || []
    versions.value = data.versions || []
    operations.value = data.operations || []
    editForm.project = data.project || ''
    editForm.env = data.env || ''
    editForm.owner = data.owner || ''
    editForm.remark = data.remark || ''
  } finally {
    loading.value = false
  }
}
async function saveAsset() {
  await api('/cert/assetSave', { method: 'POST', body: { id: Number(certId), ...editForm } })
  ElMessage.success('已保存')
  editVisible.value = false
  load()
}
onMounted(load)
</script>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; }
.title-row { display: flex; align-items: center; gap: 8px; }
.domains { margin-top: 8px; }
.mono { font-family: monospace; font-size: 12px; }
.muted { color: #909399; font-size: 12px; }
</style>
