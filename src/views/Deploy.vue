<template>
  <div class="page-card">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新建部署任务</el-button>
      <el-button @click="load">刷新</el-button>
      <span class="tip">任务创建后由 Agent 每 60 秒拉取一次；证书续期后会自动重新下发。</span>
    </div>

    <el-table :data="rows" v-loading="loading" size="small" empty-text="暂无部署任务">
      <el-table-column prop="name" label="任务名称" width="180" />
      <el-table-column label="证书" min-width="200">
        <template #default="{ row }">{{ certLabel(row.certid) }}</template>
      </el-table-column>
      <el-table-column label="服务器" width="180">
        <template #default="{ row }">{{ serverLabel(row.serverid) }}</template>
      </el-table-column>
      <el-table-column prop="targetpath" label="部署路径" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tooltip v-if="row.lastmessage" :content="row.lastmessage" placement="top">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </el-tooltip>
          <el-tag v-else :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="部署版本" width="100">
        <template #default="{ row }">v{{ row.deployedversion || 0 }}</template>
      </el-table-column>
      <el-table-column label="最近部署" width="170">
        <template #default="{ row }">{{ fmt(row.lastdeploytime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openFiles(row)">证书文件</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 查看部署到目标服务器的证书文件 -->
    <el-dialog v-model="filesVisible" title="证书文件" width="760px">
      <el-descriptions v-if="currentTask" :column="2" size="small" border>
        <el-descriptions-item label="任务名称">{{ currentTask.name }}</el-descriptions-item>
        <el-descriptions-item label="目标服务器">{{ serverLabel(currentTask.serverid) }}</el-descriptions-item>
        <el-descriptions-item label="部署状态">
          <el-tag :type="statusType(currentTask.status)" size="small">{{ statusLabel(currentTask.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="部署版本 / 时间">
          v{{ currentTask.deployedversion || 0 }} · {{ fmt(currentTask.lastdeploytime) }}
        </el-descriptions-item>
        <el-descriptions-item label="部署目录" :span="2">
          <span class="mono">{{ filesDir }}</span>
          <el-button link type="primary" size="small" @click="copyText(filesDir)">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="currentTask && currentTask.status !== 'SUCCESS'"
        type="warning"
        :closable="false"
        show-icon
        title="该任务尚未部署成功，下列为部署成功后的文件位置；请先确认 Agent 在线并部署成功"
        style="margin-top: 12px"
      />

      <el-table :data="fileRows" size="small" border style="margin-top: 12px">
        <el-table-column prop="name" label="文件名" width="150" />
        <el-table-column label="完整路径" min-width="260">
          <template #default="{ row }"><span class="mono">{{ row.path }}</span></template>
        </el-table-column>
        <el-table-column prop="usage" label="用途" width="220" />
        <el-table-column label="操作" width="70">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="copyText(row.path)">复制</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="snippet">
        <div class="snippet-title">
          Nginx 配置示例（粘贴到站点 server 块）
          <el-button link type="primary" size="small" @click="copyText(nginxSnippet)">复制</el-button>
        </div>
        <pre class="mono">{{ nginxSnippet }}</pre>
      </div>

      <template #footer>
        <el-button @click="filesVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="visible" :title="form.id ? '编辑部署任务' : '新建部署任务'" width="600px">
      <el-form label-width="110px">
        <el-form-item label="任务名称">
          <el-input v-model="form.name" placeholder="例如：nginx-prod" />
        </el-form-item>
        <el-form-item label="选择证书">
          <el-select v-model="form.certId" placeholder="仅可选择已签发证书" style="width: 100%">
            <el-option
              v-for="c in certs"
              :key="c.id"
              :label="(c.name ? c.name + ' · ' : '') + parseDomains(c.domains).join(', ') + '（v' + (c.version || 1) + '）'"
              :value="c.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="目标服务器">
          <el-select v-model="form.serverId" placeholder="选择已接入 Agent 的服务器" style="width: 100%" @change="onServerChange">
            <el-option
              v-for="s in servers"
              :key="s.id"
              :label="(s.name || s.hostname) + '（' + s.ip + (s.os ? ' · ' + s.os : '') + '）'"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部署路径">
          <el-input v-model="form.targetPath" placeholder="/etc/sslauto/certs 或 C:\\sslauto\\certs" />
        </el-form-item>
        <el-form-item label="重载动作">
          <el-select v-model="form.reloadCmd" style="width: 100%">
            <el-option v-for="a in RELOAD_ACTIONS" :key="a.value" :label="a.label" :value="a.value" />
          </el-select>
          <div class="tip" style="margin-top: 4px">
            Agent 只执行预定义动作，不再接收任意 Shell 命令
          </div>
        </el-form-item>
        <el-alert
          v-if="form.id"
          type="info"
          :closable="false"
          show-icon
          title="修改证书、服务器或部署路径后会自动重置部署版本，Agent 下次心跳将重新部署证书"
        />
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">{{ form.id ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CopyDocument } from '@element-plus/icons-vue'
import { api } from '../api'
import { formatDate } from '../utils'

const rows = ref([])
const certs = ref([])
const servers = ref([])
const loading = ref(false)
const saving = ref(false)
const visible = ref(false)
const form = ref({})

const filesVisible = ref(false)
const currentTask = ref(null)

// Agent 部署时解压生成的固定文件名（certPackage 打包内容）
const CERT_FILES = [
  { name: 'fullchain.pem', usage: '证书链（Nginx ssl_certificate）' },
  { name: 'privkey.pem', usage: '私钥（Nginx ssl_certificate_key）' },
  { name: 'cert.pem', usage: '服务器证书（Apache/IIS 等）' },
  { name: 'chain.pem', usage: '中间证书链' }
]

/** 拼接部署目录与文件名，跟随目标路径的路径分隔符 */
function joinPath(base, name) {
  if (!base) return name
  const sep = base.indexOf('\\') >= 0 ? '\\' : '/'
  return base.replace(/[\\/]+$/, '') + sep + name
}

const filesDir = computed(() => {
  if (!currentTask.value) return ''
  return joinPath(currentTask.value.targetpath || '', String(currentTask.value.certid))
})

const fileRows = computed(() =>
  CERT_FILES.map((f) => ({ ...f, path: joinPath(filesDir.value, f.name) })
))

const nginxSnippet = computed(() =>
  'ssl_certificate     ' + joinPath(filesDir.value, 'fullchain.pem') + ';\n'
  + 'ssl_certificate_key ' + joinPath(filesDir.value, 'privkey.pem') + ';'
)

function openFiles(row) {
  currentTask.value = row
  filesVisible.value = true
}

/** 复制文本（兼容非 HTTPS 环境） */
function copyText(text) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  try {
    document.execCommand('copy')
    ElMessage.success('已复制')
  } catch (e) {
    ElMessage.error('复制失败，请手动选择文本')
  }
  document.body.removeChild(ta)
}

function parseDomains(json) {
  try {
    return JSON.parse(json || '[]')
  } catch (e) {
    return []
  }
}

function certLabel(id) {
  const c = certs.value.find((x) => x.id === id)
  return c ? parseDomains(c.domains).join(', ') : 'ID ' + id
}

function serverLabel(id) {
  const s = servers.value.find((x) => x.id === id)
  return s ? s.name || s.hostname : 'ID ' + id
}

function statusLabel(v) {
  return { PENDING: '待部署', SUCCESS: '成功', FAILED: '失败' }[v] || v
}

function statusType(v) {
  return { PENDING: 'warning', SUCCESS: 'success', FAILED: 'danger' }[v] || 'info'
}

const fmt = formatDate

async function load() {
  loading.value = true
  try {
    const [tasks, certList, serverList] = await Promise.all([
      api('/deploy/list'),
      api('/cert/list?keyword='),
      api('/agent/servers')
    ])
    rows.value = tasks
    certs.value = certList.filter((c) => c.status === 'ISSUED')
    servers.value = serverList
  } finally {
    loading.value = false
  }
}

// Agent 部署后允许执行的重载动作（白名单）
const RELOAD_ACTIONS = [
  { value: 'reload_nginx', label: '重载配置 reload_nginx（推荐）' },
  { value: 'restart_nginx', label: '重启服务 restart_nginx' },
  { value: 'stop_nginx', label: '停止服务 stop_nginx' },
  { value: 'start_nginx', label: '启动服务 start_nginx' },
  { value: 'none', label: '不执行（仅部署证书文件）' }
]

/** 兼容历史自由文本的重载命令，统一映射为白名单动作 */
function normalizeAction(cmd) {
  const v = String(cmd || '').trim().toLowerCase()
  if (RELOAD_ACTIONS.some((a) => a.value === v)) return v
  if (v.indexOf('reload') >= 0) return 'reload_nginx'
  if (v.indexOf('restart') >= 0) return 'restart_nginx'
  if (v.indexOf('stop') >= 0 || v.indexOf('quit') >= 0) return 'stop_nginx'
  if (v.indexOf('start') >= 0) return 'start_nginx'
  return v ? 'none' : 'reload_nginx'
}

function openCreate() {
  form.value = { name: '', certId: null, serverId: null, targetPath: '/etc/sslauto/certs', reloadCmd: 'reload_nginx' }
  visible.value = true
}

/** 编辑已有部署任务 */
function openEdit(row) {
  form.value = {
    id: row.id,
    name: row.name,
    certId: row.certid,
    serverId: row.serverid,
    targetPath: row.targetpath,
    reloadCmd: normalizeAction(row.reloadcmd)
  }
  visible.value = true
}

/** 按服务器操作系统给出默认部署路径 */
function onServerChange(id) {
  const s = servers.value.find((x) => x.id === id)
  const isWindows = s && String(s.os || '').toLowerCase().indexOf('win') >= 0
  if (isWindows) {
    form.value.targetPath = 'C:\\sslauto\\certs'
  } else {
    form.value.targetPath = '/etc/sslauto/certs'
  }
}

async function save() {
  if (!form.value.name || !form.value.certId || !form.value.serverId) {
    ElMessage.warning('任务名称、证书、服务器均不能为空')
    return
  }
  saving.value = true
  try {
    await api('/deploy/save', { method: 'POST', body: form.value })
    ElMessage.success(form.value.id ? '更新成功' : '创建成功')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  await ElMessageBox.confirm('确定删除该部署任务？', '提示', { type: 'warning' })
  try {
    await api('/deploy/delete', { method: 'POST', body: { id: row.id } })
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.tip {
  color: #8a919f;
  font-size: 12px;
}
.mono {
  font-family: Consolas, Menlo, monospace;
  font-size: 12px;
  word-break: break-all;
}
.snippet {
  margin-top: 16px;
  background: #f6f8fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 10px 12px;
}
.snippet-title {
  font-size: 13px;
  color: #606266;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.snippet pre {
  margin: 0;
  white-space: pre-wrap;
  color: #303133;
}
</style>
