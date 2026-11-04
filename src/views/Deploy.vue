<template>
  <div class="space-y-4">
    <!-- 顶部页面栏 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">自动部署</h1>
        </div>
        <p class="wb-page-sub">
          <span>共 {{ tasks.length }} 项编排任务</span>
          <span class="wb-sep">·</span>
          <span>写前自动备份原证书与配置</span>
          <span class="wb-sep">·</span>
          <span class="mono">nginx -t 语法预检失败自动回滚</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          <span>刷新状态</span>
        </button>
        <button
          v-if="can('deploy:save')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="openEdit()"
        >
          <el-icon><Plus /></el-icon>
          <span>新建部署编排</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 圆角筛选行 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <div class="wb-search w-64">
          <el-icon class="text-gray-400"><Search /></el-icon>
          <input
            v-model="keyword"
            type="text"
            placeholder="搜索任务、证书、服务器或目录"
          />
        </div>

        <div class="wb-tabs">
          <button
            v-for="tab in statusTabs"
            :key="tab.value"
            type="button"
            class="wb-tab"
            :class="{ active: statusFilter === tab.value }"
            @click="statusFilter = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 自动部署编排白卡表格 -->
    <div class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loading" :data="filteredTasks" empty-text="暂无符合筛选条件的自动部署任务">
        <el-table-column label="部署编排任务" min-width="195">
          <template #default="{ row }">
            <div class="font-bold text-[#111827]">{{ row.name }}</div>
            <div class="mono text-xs text-gray-400 mt-0.5">Task #{{ row.id }}</div>
          </template>
        </el-table-column>

        <el-table-column label="关联证书资产" min-width="215">
          <template #default="{ row }">
            <template v-if="certById(row.certid)">
              <div class="font-medium text-gray-900">{{ certById(row.certid).name }}</div>
              <div class="mono text-xs text-gray-400 mt-0.5">
                {{ firstDomain(certById(row.certid)) }}
              </div>
            </template>
            <span v-else class="text-xs text-gray-400">证书 #{{ row.certid }}</span>
          </template>
        </el-table-column>

        <el-table-column label="目标服务器与落地目录" min-width="230">
          <template #default="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium text-gray-900">{{ serverName(row.serverid) }}</span>
              <span
                class="wb-state !text-[11.5px]"
                :class="serverOnline(row.serverid) ? 'wb-state-ok' : 'wb-state-err'"
              >
                {{ serverOnline(row.serverid) ? '在线' : '离线' }}
              </span>
            </div>
            <div class="wb-meta mt-0.5">
              <span class="mono">{{ row.targetpath }}</span>
              <span class="wb-sep">·</span>
              <span class="mono">{{ row.reloadcmd }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="版本同步进度" width="165">
          <template #default="{ row }">
            <div class="mono text-xs font-semibold text-gray-800">
              线上 v{{ row.deployedversion || 0 }} / 最新 v{{ latestCertVer(row.certid) }}
            </div>
            <div
              v-if="(row.deployedversion || 0) < latestCertVer(row.certid)"
              class="text-[11.5px] text-amber-600 font-medium mt-0.5"
            >
              检测到新版本待下发
            </div>
            <div v-else class="text-[11.5px] text-emerald-600 mt-0.5">版本一致</div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="115">
          <template #default="{ row }">
            <span class="wb-state" :class="deployStateClass(row.status)">
              {{ deployStateText(row.status) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最近下发时间与事务回执" min-width="240">
          <template #default="{ row }">
            <div class="mono text-xs text-gray-400">{{ formatDate(row.lastdeploytime) }}</div>
            <div class="text-xs text-gray-600 mt-0.5 line-clamp-2">{{ row.lastmessage || '—' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="245" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex items-center gap-2">
              <button type="button" class="wb-row-btn" @click="showSnippet(row)">
                路径参考
              </button>
              <button type="button" class="wb-row-btn" @click="verifyOnline(row)">
                真机核验
              </button>
              <button
                v-if="can('deploy:save')"
                type="button"
                class="wb-row-link"
                @click="openEdit(row)"
              >
                编辑
              </button>
              <button
                v-if="can('deploy:delete')"
                type="button"
                class="wb-row-link wb-row-link-danger"
                @click="removeTask(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建/编辑自动部署弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑自动部署编排' : '新建自动部署编排'"
      width="540px"
    >
      <el-form label-position="top">
        <el-form-item label="部署任务名称" required>
          <el-input v-model="form.name" placeholder="例如：核心交易网关-华东节点自动同步" />
        </el-form-item>

        <el-form-item label="选择要下发的受管证书" required>
          <el-select v-model="form.certId" filterable placeholder="搜索并选择已签发证书" class="w-full">
            <el-option
              v-for="c in certList"
              :key="c.id"
              :value="c.id"
              :label="`${c.name} (${firstDomain(c)} · v${c.version || 1})`"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="选择目标 Agent 服务器" required>
          <el-select v-model="form.serverId" filterable placeholder="选择已注册的服务器节点" class="w-full">
            <el-option
              v-for="s in serverList"
              :key="s.id"
              :value="s.id"
              :label="`${s.name} (${s.ip} · ${s.os} · ${s.status === 'ONLINE' ? '在线' : '离线'})`"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="服务器证书落地目录 (Target Path)">
          <el-input v-model="form.targetPath" class="mono" placeholder="/etc/sslauto/certs" />
          <div class="text-[11.5px] text-gray-400 mt-1">
            Agent 将在此目录内生成 <code class="mono">{certId}/fullchain.pem</code> 与 <code class="mono">{certId}/privkey.pem</code>。
          </div>
        </el-form-item>

        <el-form-item label="证书更新后置服务动作">
          <el-select v-model="form.reloadCmd" class="w-full">
            <el-option label="平滑重载 Nginx (nginx -t && nginx -s reload · 推荐)" value="reload_nginx" />
            <el-option label="完整重启 Nginx (restart_nginx)" value="restart_nginx" />
            <el-option label="仅落地证书文件，不触发服务动作 (none)" value="none" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <button type="button" class="wb-btn" @click="dialogVisible = false">取消</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          :disabled="saving"
          @click="saveTask"
        >
          {{ saving ? '保存中...' : form.id ? '保存并触发同步检测' : '创建部署任务' }}
        </button>
      </template>
    </el-dialog>

    <!-- Nginx 配置片段弹窗 -->
    <el-dialog v-model="snippetVisible" title="目标服务器证书路径与 Nginx 配置片段" width="600px">
      <div class="space-y-3">
        <div class="text-xs text-gray-600">
          请在目标服务器的 Nginx 站点配置中引用以下固定路径；后续证书自动续期升版时，Agent 会自动原子替换证书并平滑 reload：
        </div>
        <pre class="mono text-xs bg-[#18181b] text-gray-100 p-4 rounded-xl overflow-x-auto leading-relaxed">{{ snippetCode }}</pre>
      </div>
      <template #footer>
        <button type="button" class="wb-btn" @click="snippetVisible = false">关闭</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          @click="copyToClipboard(snippetCode, 'Nginx 配置片段已复制')"
        >
          复制配置片段
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search, FullScreen } from '@element-plus/icons-vue'
import { call } from '../api'
import { can } from '../store'
import {
  parseDomains,
  formatDate,
  copyToClipboard,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const router = useRouter()

const statusTabs = [
  { label: '全部', value: '' },
  { label: '已生效', value: 'SUCCESS' },
  { label: '待下发', value: 'PENDING' },
  { label: '异常保护', value: 'FAILED' }
]

const loading = ref(false)
const saving = ref(false)
const tasks = ref([])
const certList = ref([])
const serverList = ref([])

const statusFilter = ref('')
const keyword = ref('')

const dialogVisible = ref(false)
const form = reactive({
  id: null,
  name: '',
  certId: null,
  serverId: null,
  targetPath: '/etc/sslauto/certs',
  reloadCmd: 'reload_nginx'
})

const snippetVisible = ref(false)
const snippetCode = ref('')

function certById(id) {
  return certList.value.find((c) => c.id === id)
}

function latestCertVer(id) {
  return certById(id)?.version || 1
}

function firstDomain(cert) {
  if (!cert) return '-'
  return parseDomains(cert.domains)[0] || '-'
}

function serverById(id) {
  return serverList.value.find((s) => s.id === id)
}

function serverName(id) {
  const s = serverById(id)
  return s ? `${s.name} (${s.ip})` : `Server #${id}`
}

function serverOnline(id) {
  return serverById(id)?.status === 'ONLINE'
}

function deployStateText(st) {
  return { SUCCESS: '已同步生效', PENDING: '等待心跳同步', FAILED: '下发异常' }[st] || st
}

function deployStateClass(st) {
  if (st === 'SUCCESS') return 'wb-state-ok'
  if (st === 'PENDING') return 'wb-state-warn'
  return 'wb-state-err'
}

const filteredTasks = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return tasks.value.filter((t) => {
    if (statusFilter.value && t.status !== statusFilter.value) return false
    if (!kw) return true
    const c = certById(t.certid)
    const s = serverById(t.serverid)
    return (
      (t.name || '').toLowerCase().includes(kw) ||
      (t.targetpath || '').toLowerCase().includes(kw) ||
      (c?.name || '').toLowerCase().includes(kw) ||
      (c?.domains || '').toLowerCase().includes(kw) ||
      (s?.name || '').toLowerCase().includes(kw) ||
      (s?.ip || '').toLowerCase().includes(kw)
    )
  })
})

async function loadAll() {
  loading.value = true
  try {
    const [dList, cList, sList] = await Promise.all([
      call('/deploy/list'),
      call('/cert/list?keyword='),
      call('/agent/servers')
    ])
    tasks.value = dList || []
    certList.value = cList || []
    serverList.value = sList || []
  } catch {
    // handled in call()
  } finally {
    loading.value = false
  }
}

function openEdit(row = null) {
  if (row) {
    form.id = row.id
    form.name = row.name
    form.certId = row.certid
    form.serverId = row.serverid
    form.targetPath = row.targetpath || '/etc/sslauto/certs'
    form.reloadCmd = row.reloadcmd || 'reload_nginx'
  } else {
    form.id = null
    form.name = ''
    form.certId = certList.value[0]?.id || null
    form.serverId = serverList.value[0]?.id || null
    form.targetPath = '/etc/sslauto/certs'
    form.reloadCmd = 'reload_nginx'
  }
  dialogVisible.value = true
}

async function saveTask() {
  if (!form.name.trim() || !form.certId || !form.serverId) {
    ElMessage.warning('请填写完整的任务名称、关联证书和目标服务器')
    return
  }
  saving.value = true
  try {
    await call('/deploy/save', {
      method: 'POST',
      body: {
        id: form.id || undefined,
        name: form.name.trim(),
        certId: form.certId,
        serverId: form.serverId,
        targetPath: form.targetPath.trim() || '/etc/sslauto/certs',
        reloadCmd: form.reloadCmd
      }
    })
    ElMessage.success(form.id ? '部署编排已更新' : '自动部署任务已创建')
    dialogVisible.value = false
    await loadAll()
  } catch {
    // handled in call()
  } finally {
    saving.value = false
  }
}

function showSnippet(row) {
  const cert = certById(row.certid)
  const dom = firstDomain(cert).replace(/^\*\./, '')
  const baseDir = (row.targetpath || '/etc/sslauto/certs').replace(/\/$/, '')
  snippetCode.value = [
    `server {`,
    `    listen 443 ssl http2;`,
    `    server_name ${dom};`,
    ``,
    `    ssl_certificate     ${baseDir}/${row.certid}/fullchain.pem;`,
    `    ssl_certificate_key ${baseDir}/${row.certid}/privkey.pem;`,
    `    ssl_protocols       TLSv1.2 TLSv1.3;`,
    `    ssl_session_cache   shared:SSL:10m;`,
    `}`
  ].join('\n')
  snippetVisible.value = true
}

function verifyOnline(row) {
  const cert = certById(row.certid)
  const dom = firstDomain(cert).replace(/^\*\./, '')
  router.push({ path: '/probe', query: { tab: 'probe', domain: dom !== '-' ? dom : '' } })
}

async function removeTask(row) {
  await ElMessageBox.confirm(`确认删除自动部署任务「${row.name}」吗？`, '删除部署任务', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消'
  })
  try {
    await call('/deploy/delete', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('部署任务已删除')
    await loadAll()
  } catch {
    // handled in call()
  }
}

onMounted(() => {
  loadAll()
})
</script>
