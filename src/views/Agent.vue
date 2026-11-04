<template>
  <div class="space-y-4">
    <!-- 顶部页面栏 + 模式切换器 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">服务器节点</h1>
          <div class="wb-mode-switch">
            <button
              type="button"
              :class="['wb-mode-btn', { active: activePane === 'servers' }]"
              @click="activePane = 'servers'"
            >
              Agent 主机 ({{ servers.length }})
            </button>
            <button
              type="button"
              :class="['wb-mode-btn', { active: activePane === 'sites' }]"
              @click="activePane = 'sites'"
            >
              自动发现站点 ({{ sites.length }})
            </button>
          </div>
        </div>
        <p class="wb-page-sub">
          <span>已纳管主机 {{ servers.length }} 台</span>
          <span class="wb-sep">·</span>
          <span>在线 {{ onlineCount }} 台</span>
          <span class="wb-sep">·</span>
          <span>离线 {{ offlineCount }} 台</span>
          <span class="wb-sep">·</span>
          <span>待接管站点 {{ untakenCount }} 个</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="loadAll">
          <el-icon><Refresh /></el-icon>
          <span>刷新心跳</span>
        </button>
        <button
          v-if="can('agent:token')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="openTokenWizard"
        >
          <el-icon><Plus /></el-icon>
          <span>接入新服务器</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 面板 1：服务器 Agent 节点矩阵 -->
    <div v-if="activePane === 'servers'" class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loading" :data="servers" empty-text="暂未接入任何服务器节点">
        <el-table-column label="服务器名称 / 主机名" min-width="210">
          <template #default="{ row }">
            <div class="font-bold text-[#111827]">{{ row.name }}</div>
            <div class="mono text-xs text-gray-400 mt-0.5">{{ row.hostname || '—' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="IP 与操作系统" min-width="180">
          <template #default="{ row }">
            <div class="mono font-medium text-gray-900">{{ row.ip }}</div>
            <div class="wb-meta mt-0.5">
              <span class="mono">{{ row.os }}</span>
              <span class="wb-sep">·</span>
              <span class="mono">Agent v{{ row.agentversion || '-' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="心跳状态" width="125">
          <template #default="{ row }">
            <span
              class="wb-state"
              :class="row.status === 'ONLINE' ? 'wb-state-ok' : 'wb-state-err'"
            >
              {{ row.status === 'ONLINE' ? '在线运行' : '心跳离线' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最近心跳上报" width="185">
          <template #default="{ row }">
            <span class="mono text-xs text-gray-500">{{ formatDate(row.lastheartbeat) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="节点操作" width="290" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex items-center gap-2">
              <button
                type="button"
                class="wb-row-btn"
                :disabled="scanningServerId === row.id"
                @click="triggerScanSites(row)"
              >
                {{ scanningServerId === row.id ? '扫描中...' : '扫描站点' }}
              </button>

              <el-dropdown
                v-if="can('agent:action') && row.os !== 'WINDOWS'"
                trigger="click"
                @command="(cmd) => runNginxAction(row, cmd)"
              >
                <button type="button" class="wb-row-btn">
                  <span>Nginx 控制</span>
                  <el-icon><ArrowDown /></el-icon>
                </button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="reload_nginx">平滑重载 (reload_nginx)</el-dropdown-item>
                    <el-dropdown-item command="restart_nginx">重启服务 (restart_nginx)</el-dropdown-item>
                    <el-dropdown-item command="start_nginx">启动服务 (start_nginx)</el-dropdown-item>
                    <el-dropdown-item command="stop_nginx" divided>停止服务 (stop_nginx)</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <button
                type="button"
                class="wb-row-link"
                @click="filterByServer(row.id)"
              >
                站点
              </button>

              <button
                v-if="can('agent:delete')"
                type="button"
                class="wb-row-link wb-row-link-danger"
                @click="removeServer(row)"
              >
                移除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 面板 2：自动发现的 Web 站点与在线安全编辑 -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="wb-tabs">
          <button
            type="button"
            class="wb-tab"
            :class="{ active: siteTakeFilter === 'ALL' }"
            @click="siteTakeFilter = 'ALL'"
          >
            全部站点
          </button>
          <button
            type="button"
            class="wb-tab"
            :class="{ active: siteTakeFilter === 'UNTAKEN' }"
            @click="siteTakeFilter = 'UNTAKEN'"
          >
            待接管 ({{ untakenCount }})
          </button>
          <button
            type="button"
            class="wb-tab"
            :class="{ active: siteTakeFilter === 'TAKEN' }"
            @click="siteTakeFilter = 'TAKEN'"
          >
            已纳管
          </button>
        </div>

        <el-select
          v-model="selectedServerId"
          placeholder="全部服务器节点"
          clearable
          class="wb-pill-select !w-52"
          @change="loadSites"
        >
          <el-option
            v-for="s in servers"
            :key="s.id"
            :value="s.id"
            :label="`${s.name} (${s.ip})`"
          />
        </el-select>
      </div>

      <div class="wb-panel overflow-hidden px-3 pt-1">
        <el-table :data="filteredSites" empty-text="当前筛选条件下未发现 Web 站点">
          <el-table-column label="站点标识 / 所属服务器" min-width="200">
            <template #default="{ row }">
              <div class="font-bold text-[#111827]">{{ row.name }}</div>
              <div class="text-xs text-gray-400 mt-0.5">
                {{ serverLabel(row.serverid) }} · <span class="mono">{{ row.webserver }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="监听域名 (server_name)" min-width="210">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-800">{{ formatSiteDomains(row.domains) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="配置文件与当前证书位置" min-width="260">
            <template #default="{ row }">
              <div class="mono text-xs text-gray-700 break-all">配置：{{ row.configpath }}</div>
              <div class="mono text-xs text-gray-400 mt-0.5 break-all">证书：{{ row.certpath || '—' }}</div>
            </template>
          </el-table-column>

          <el-table-column label="纳管状态" width="120">
            <template #default="{ row }">
              <span
                class="wb-state"
                :class="row.takenover === 1 ? 'wb-state-ok' : 'wb-state-warn'"
              >
                {{ row.takenover === 1 ? '已接管' : '未接管' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="最近扫描时间" width="175">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-400">{{ formatDate(row.updatedat) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="220" fixed="right" align="right">
            <template #default="{ row }">
              <div class="inline-flex items-center gap-2">
                <button
                  v-if="row.takenover === 0 && can('agent:takeover')"
                  type="button"
                  class="wb-row-btn"
                  @click="takeoverSite(row)"
                >
                  一键接管
                </button>
                <button
                  v-if="String(row.webserver).toLowerCase() === 'nginx' && can('agent:config')"
                  type="button"
                  class="wb-row-btn"
                  :disabled="readingSiteId === row.id"
                  @click="openConfigEditor(row)"
                >
                  {{ readingSiteId === row.id ? '读取中...' : '在线配置与回滚' }}
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- 接入新服务器 Agent 弹窗 -->
    <el-dialog v-model="tokenVisible" title="接入新服务器 Agent (一键安装引导)" width="620px">
      <div class="space-y-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">目标操作系统</label>
            <div class="wb-mode-switch w-full flex">
              <button
                type="button"
                class="wb-mode-btn flex-1 justify-center"
                :class="{ active: tokenForm.os === 'LINUX' }"
                @click="tokenForm.os = 'LINUX'"
              >
                Linux (Nginx)
              </button>
              <button
                type="button"
                class="wb-mode-btn flex-1 justify-center"
                :class="{ active: tokenForm.os === 'WINDOWS' }"
                @click="tokenForm.os = 'WINDOWS'"
              >
                Windows (IIS)
              </button>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-700 mb-1.5">服务器备注名称</label>
            <div class="flex gap-2">
              <el-input v-model="tokenForm.serverName" placeholder="例如：华南接入层-Nginx03" />
              <button
                type="button"
                class="wb-btn wb-btn-primary"
                :disabled="creatingToken"
                @click="generateToken"
              >
                {{ creatingToken ? '生成中...' : '生成命令' }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="tokenResult" class="space-y-3 pt-3 border-t border-[#f1f3f6]">
          <div class="wb-meta">
            <span>一次性注册令牌：<strong class="mono text-gray-900">{{ tokenResult.token }}</strong></span>
            <span class="wb-sep">·</span>
            <span>有效期至：<span class="mono">{{ formatDate(tokenResult.expiresAt) }}</span></span>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold text-gray-700">在目标服务器以管理员权限执行以下一键安装命令：</span>
              <button
                type="button"
                class="wb-row-link"
                @click="copyToClipboard(tokenResult.command, '安装命令已复制')"
              >
                复制命令
              </button>
            </div>
            <pre class="mono text-xs bg-[#18181b] text-gray-100 p-3.5 rounded-xl overflow-x-auto whitespace-pre-wrap break-all">{{ tokenResult.command }}</pre>
          </div>

          <div
            v-if="tokenForm.os === 'WINDOWS'"
            class="flex items-center justify-between bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-3 text-xs"
          >
            <span class="text-gray-600">兼容旧版 Windows Server 2008 R2 / 2012 环境？可下载图形化批处理安装脚本：</span>
            <button
              type="button"
              class="wb-row-btn"
              @click="download('/agent/installBat', 'sslauto-install.bat')"
            >
              下载 sslauto-install.bat
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <button type="button" class="wb-btn" @click="tokenVisible = false">完成并关闭</button>
      </template>
    </el-dialog>

    <!-- 在线 Nginx 配置编辑弹窗 -->
    <el-dialog
      v-model="cfgVisible"
      :title="`在线编辑站点配置 — ${cfgSite?.configpath || ''}`"
      width="740px"
    >
      <div class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2 text-xs bg-[#f7f8fa] border border-[#eceef2] rounded-xl px-3.5 py-2.5 text-gray-600">
          <span>
            事务安全保护：Agent 写入前自动备份原 <code class="mono">.conf</code> 文件；写入后立即执行 <code class="mono">nginx -t</code>，若语法报错自动回滚原备份。
          </span>
          <el-checkbox v-model="cfgReload">保存校验通过后自动平滑 reload Nginx</el-checkbox>
        </div>

        <el-input
          v-model="cfgContent"
          type="textarea"
          :rows="15"
          class="mono text-xs"
          placeholder="# Nginx server configuration"
        />
      </div>

      <template #footer>
        <button type="button" class="wb-btn" @click="cfgVisible = false">取消</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          :disabled="writingConfig"
          @click="saveConfig"
        >
          {{ writingConfig ? '正在下发...' : `下发事务写入${cfgReload ? '并平滑重载' : ''}` }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, ArrowDown, FullScreen } from '@element-plus/icons-vue'
import { call, download } from '../api'
import { can } from '../store'
import {
  parseDomains,
  formatDate,
  copyToClipboard,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const loading = ref(false)
const activePane = ref('servers')
const servers = ref([])
const sites = ref([])
const selectedServerId = ref(null)
const siteTakeFilter = ref('ALL')

const scanningServerId = ref(null)
const readingSiteId = ref(null)

const tokenVisible = ref(false)
const creatingToken = ref(false)
const tokenResult = ref(null)
const tokenForm = reactive({
  os: 'LINUX',
  serverName: ''
})

const cfgVisible = ref(false)
const writingConfig = ref(false)
const cfgSite = ref(null)
const cfgContent = ref('')
const cfgReload = ref(true)

const onlineCount = computed(() => servers.value.filter((s) => s.status === 'ONLINE').length)
const offlineCount = computed(() => servers.value.filter((s) => s.status !== 'ONLINE').length)
const untakenCount = computed(() => sites.value.filter((s) => s.takenover === 0).length)

const filteredSites = computed(() => {
  return sites.value.filter((s) => {
    if (siteTakeFilter.value === 'UNTAKEN' && s.takenover !== 0) return false
    if (siteTakeFilter.value === 'TAKEN' && s.takenover !== 1) return false
    return true
  })
})

function serverLabel(serverId) {
  const s = servers.value.find((x) => x.id === serverId)
  return s ? s.name : `Server #${serverId}`
}

function formatSiteDomains(raw) {
  const arr = parseDomains(raw)
  return arr.length ? arr.join(', ') : raw || '-'
}

async function pollAgentJob(jobId, maxAttempts = 20) {
  for (let i = 0; i < maxAttempts; i++) {
    const job = await call('/agent/job?id=' + jobId)
    if (job.status === 'SUCCESS') return job
    if (job.status === 'FAILED') {
      throw new Error(job.message || 'Agent 作业执行失败')
    }
    await new Promise((r) => setTimeout(r, 900))
  }
  throw new Error('等待 Agent 执行响应超时')
}

async function loadServers() {
  try {
    servers.value = (await call('/agent/servers')) || []
  } catch {
    // handled in call()
  }
}

async function loadSites() {
  try {
    const q = selectedServerId.value ? `?serverId=${selectedServerId.value}` : ''
    sites.value = (await call('/agent/sites' + q)) || []
  } catch {
    // handled in call()
  }
}

async function loadAll() {
  loading.value = true
  try {
    await Promise.all([loadServers(), loadSites()])
  } finally {
    loading.value = false
  }
}

function filterByServer(serverId) {
  selectedServerId.value = serverId
  activePane.value = 'sites'
  loadSites()
}

async function triggerScanSites(server) {
  scanningServerId.value = server.id
  try {
    const jobId = await call('/agent/scanSites', {
      method: 'POST',
      body: { serverId: server.id }
    })
    const res = await pollAgentJob(jobId)
    ElMessage.success(res.message || '站点扫描已完成并同步')
    await loadSites()
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  } finally {
    scanningServerId.value = null
  }
}

async function runNginxAction(server, action) {
  await ElMessageBox.confirm(
    `Nginx 服务控制动作「${action}」将对服务器「${server.name} (${server.ip})」上的全部站点生效，确认继续吗？`,
    '服务器级服务操作确认',
    { type: 'warning', confirmButtonText: '确认下发', cancelButtonText: '取消' }
  )
  try {
    const jobId = await call('/agent/siteAction', {
      method: 'POST',
      body: { serverId: server.id, action }
    })
    const res = await pollAgentJob(jobId)
    ElMessage.success(res.message || `已成功执行 ${action}`)
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  }
}

async function removeServer(server) {
  await ElMessageBox.confirm(
    `移除服务器「${server.name}」将同时清理其下已上报的站点与自动部署任务，确认继续吗？`,
    '移除服务器确认',
    { type: 'warning', confirmButtonText: '确认移除', cancelButtonText: '取消' }
  )
  try {
    await call('/agent/deleteServer', {
      method: 'POST',
      body: { id: server.id }
    })
    ElMessage.success('服务器已移除')
    await loadAll()
  } catch {
    // handled in call()
  }
}

function openTokenWizard() {
  tokenForm.os = 'LINUX'
  tokenForm.serverName = ''
  tokenResult.value = null
  tokenVisible.value = true
}

async function generateToken() {
  creatingToken.value = true
  try {
    tokenResult.value = await call('/agent/createToken', {
      method: 'POST',
      body: {
        serverName: tokenForm.serverName.trim() || undefined,
        os: tokenForm.os
      }
    })
    ElMessage.success('一次性注册令牌已生成')
  } catch {
    // handled in call()
  } finally {
    creatingToken.value = false
  }
}

async function takeoverSite(site) {
  try {
    await call('/agent/takeoverSite', {
      method: 'POST',
      body: { siteId: site.id }
    })
    ElMessage.success(`站点「${site.name}」已纳入平台接管`)
    await loadSites()
  } catch {
    // handled in call()
  }
}

async function openConfigEditor(site) {
  readingSiteId.value = site.id
  try {
    const jobId = await call('/agent/config/read', {
      method: 'POST',
      body: { siteId: site.id }
    })
    const job = await pollAgentJob(jobId)
    cfgSite.value = site
    cfgContent.value = job.content || ''
    cfgReload.value = true
    cfgVisible.value = true
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  } finally {
    readingSiteId.value = null
  }
}

async function saveConfig() {
  if (!cfgSite.value) return
  if (!cfgContent.value.trim()) {
    ElMessage.warning('配置文件内容不能为空')
    return
  }
  writingConfig.value = true
  try {
    const jobId = await call('/agent/config/write', {
      method: 'POST',
      body: {
        siteId: cfgSite.value.id,
        content: cfgContent.value,
        reload: cfgReload.value
      }
    })
    const job = await pollAgentJob(jobId)
    ElMessage.success(job.message || '配置写入并校验通过')
    cfgVisible.value = false
    await loadSites()
  } catch (e) {
    if (e?.message) ElMessage.error(e.message)
  } finally {
    writingConfig.value = false
  }
}

onMounted(() => {
  loadAll()
})
</script>
