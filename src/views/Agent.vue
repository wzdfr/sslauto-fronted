<template>
  <div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">服务器总数</div>
        <div class="value">{{ servers.length }}<span class="unit">台</span></div>
      </div>
      <div class="stat-card">
        <div class="label">当前在线</div>
        <div class="value">{{ onlineCount }}<span class="unit">台</span></div>
      </div>
      <div class="stat-card">
        <div class="label">发现站点</div>
        <div class="value">{{ sites.length }}<span class="unit">个</span></div>
      </div>
      <div class="stat-card">
        <div class="label">待接管站点</div>
        <div class="value">{{ pendingSites }}<span class="unit">个</span></div>
      </div>
    </div>

    <div class="page-card">
      <div class="toolbar">
        <el-button type="primary" @click="openWizard">添加服务器</el-button>
        <el-button @click="load">刷新</el-button>
        <el-button @click="openUpgrade">升级 Agent 脚本</el-button>
        <span class="tip">Agent 作业采用长轮询（空闲时最多挂起 15 秒）、心跳 60 秒，90 秒无心跳标记离线；最新脚本 Windows/Linux 2.5，配置读写、站点动作与手动扫描需版本 ≥ 2.2</span>
      </div>

      <el-table :data="servers" v-loading="loading" size="small" empty-text="暂无服务器，点击「添加服务器」接入">
        <el-table-column prop="name" label="服务器名称" width="160" />
        <el-table-column prop="hostname" label="主机名" width="150" />
        <el-table-column prop="ip" label="IP" width="130" />
        <el-table-column prop="os" label="系统" width="110" />
        <el-table-column label="Agent 版本" width="120">
          <template #default="{ row }">
            <el-tag :type="needsUpgrade(row) ? 'warning' : 'success'" size="small">
            v{{ row.agentversion || '未知' }}{{ needsUpgrade(row) ? ' 需升级' : '' }}
          </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ONLINE' ? 'success' : 'info'" size="small">
              {{ row.status === 'ONLINE' ? '在线' : '离线' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后心跳" width="170">
          <template #default="{ row }">{{ fmt(row.lastheartbeat) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="380" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="viewSites(row)">查看站点</el-button>
            <el-button link type="primary" size="small" @click="scanSites(row)">扫描站点</el-button>
            <el-button link type="primary" size="small" @click="openNewConfig(row)">新增配置</el-button>
            <el-dropdown trigger="click" @command="(cmd) => serverAction(row, cmd)">
              <el-button link type="primary" size="small">
                Nginx 服务<el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="reload">重载配置（全部站点）</el-dropdown-item>
                  <el-dropdown-item command="restart">重启 Nginx（全部站点）</el-dropdown-item>
                  <el-dropdown-item command="stop" divided>停止 Nginx（全部站点）</el-dropdown-item>
                  <el-dropdown-item command="start">启动 Nginx</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button link type="danger" size="small" @click="removeServer(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <h3 class="page-title" style="margin-top: 24px">
        站点列表
        <el-tag v-if="selectedServer" size="small" type="info" style="margin-left: 8px">
          {{ selectedServer.name || selectedServer.hostname }}
        </el-tag>
        <el-button v-if="selectedServer" link type="primary" size="small" @click="selectedServer = null; loadSites()">
          显示全部
        </el-button>
      </h3>
      <el-table :data="sites" size="small" empty-text="Agent 上线后会自动识别 Nginx 安装路径并扫描站点配置">
        <el-table-column label="所属服务器" width="140">
          <template #default="{ row }">{{ serverLabel(row.serverid) }}</template>
        </el-table-column>
        <el-table-column prop="name" label="站点" width="180" show-overflow-tooltip />
        <el-table-column prop="domains" label="域名" min-width="190" show-overflow-tooltip />
        <el-table-column prop="webserver" label="Web 服务" width="100" />
        <el-table-column prop="configpath" label="配置文件" min-width="230" show-overflow-tooltip />
        <el-table-column prop="certpath" label="证书路径" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.certpath || '-' }}</template>
        </el-table-column>
        <el-table-column label="接管状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.takenover ? 'success' : 'warning'" size="small">
              {{ row.takenover ? '已接管' : '待接管' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" :disabled="!isNginx(row)" @click="editConfig(row)">
              编辑配置
            </el-button>
            <el-button v-if="!row.takenover" link type="primary" size="small" @click="takeover(row)">接管</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 配置编辑 / 新增 -->
    <el-dialog
      v-model="cfgVisible"
      :title="cfgForm.isNew ? '新增 Nginx 配置' : '在线编辑站点配置'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" size="small">
        <el-form-item label="服务器">
          <el-select v-model="cfgForm.serverId" :disabled="!cfgForm.isNew" style="width: 100%">
            <el-option
              v-for="s in servers"
              :key="s.id"
              :label="(s.name || s.hostname) + (s.ip ? '（' + s.ip + '）' : '')"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="配置文件">
          <el-input v-model="cfgForm.path" placeholder="例如 /etc/nginx/conf.d/example.conf 或 D:\\nginx\\conf\\conf.d\\example.conf" />
        </el-form-item>
      </el-form>
      <el-alert
        v-if="cfgForm.isNew"
        type="warning"
        :closable="false"
        show-icon
        title="新增配置会直接写入服务器（目录不存在时自动创建），保存后自动重载 Nginx，请确认路径与语法正确"
        style="margin-bottom: 12px"
      />
      <div class="cfg-toolbar">
        <el-button v-if="!cfgForm.isNew" size="small" :loading="cfgLoading" @click="loadConfigContent">重新读取</el-button>
        <span class="cfg-status">{{ jobHint }}</span>
      </div>
      <el-input
        v-model="cfgForm.content"
        type="textarea"
        :rows="18"
        spellcheck="false"
        class="cfg-editor"
        placeholder="正在等待 Agent 读取配置..."
      />
      <template #footer>
        <el-button @click="cfgVisible = false">取消</el-button>
        <el-button :loading="cfgSaving" @click="saveConfig(false)">仅保存</el-button>
        <el-button type="primary" :loading="cfgSaving" @click="saveConfig(true)">保存并重载</el-button>
      </template>
    </el-dialog>

    <!-- 已安装服务器升级 Agent 脚本 -->
    <el-dialog v-model="upgradeVisible" title="升级 Agent 脚本" width="680px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="将保留服务器凭证（不会重复注册），只更新脚本并重启服务"
      />
      <div class="upgrade-label">Linux（root）</div>
      <div class="cmd-box">
        <div class="mono">{{ upgradeLinux }}</div>
      </div>
      <el-button size="small" @click="copyText(upgradeLinux)">复制</el-button>

      <div class="upgrade-label" style="margin-top: 20px">Windows（批处理 .bat，所有 Windows 版本）</div>
      <div class="upgrade-box">
        <div class="upgrade-desc">
          Windows 升级与首次安装使用同一个 install.bat：下载后拷到目标服务器，管理员双击运行即可。脚本会自动检测到已有凭证、跳过注册、仅更新 agent.ps1 并重启。
          <br/>不需要 schtasks.exe、不需要 certutil.exe、不需要 PowerShell 执行策略。
        </div>
        <div style="margin-top: 10px">
          <el-button type="primary" size="small" link @click="downloadInstallBat()">
            <el-icon><ArrowDown /></el-icon> 下载 sslauto-install.bat
          </el-button>
        </div>
      </div>

      <template #footer>
        <el-button @click="upgradeVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 添加服务器三步向导 -->
    <el-dialog v-model="wizardVisible" title="添加服务器" width="680px">
      <el-steps :active="step" finish-status="success" align-center style="margin-bottom: 24px">
        <el-step title="服务器信息" />
        <el-step title="安装 Agent" />
        <el-step title="等待连接" />
      </el-steps>

      <div v-if="step === 0">
        <el-form label-width="110px">
          <el-form-item label="服务器名称">
            <el-input v-model="serverName" placeholder="例如：web-prod-01" />
          </el-form-item>
          <el-form-item label="操作系统">
            <el-radio-group v-model="serverOs">
              <el-radio-button value="LINUX">Linux</el-radio-button>
              <el-radio-button value="WINDOWS">Windows</el-radio-button>
            </el-radio-group>
          </el-form-item>
        </el-form>
      </div>

      <div v-else-if="step === 1">
        <!-- ============ Windows: download bat + paste token ============ -->
        <template v-if="serverOs === 'WINDOWS'">
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="Windows 一键安装：下载批处理脚本，在目标服务器上以管理员身份双击运行（令牌 10 分钟内有效且仅可使用一次）"
          />
          <div class="windows-install-box">
            <div class="install-step">
              <div class="step-num">1</div>
              <div class="step-body">
                <div class="step-title">下载安装脚本</div>
                <div class="step-desc">点击右侧按钮下载 install.bat，保存到本地后拷到目标 Windows 服务器（可用 U 盘、远程桌面、浏览器下载等任意方式）</div>
                <el-button type="primary" size="small" link @click="downloadInstallBat()" style="margin-top: 8px">
                  <el-icon><ArrowDown /></el-icon> 下载 sslauto-install.bat
                </el-button>
              </div>
            </div>
            <div class="install-step">
              <div class="step-num">2</div>
              <div class="step-body">
                <div class="step-title">获取注册令牌（仅首次安装需要）</div>
                <div class="step-desc">在 bat 运行过程中会提示你粘贴此令牌，令牌 10 分钟内有效且仅可使用一次</div>
                <div class="mono token-box">{{ wizardToken }}</div>
                <el-button size="small" @click="copyCommand" style="margin-top: 6px">复制令牌</el-button>
              </div>
            </div>
            <div class="install-step">
              <div class="step-num">3</div>
              <div class="step-body">
                <div class="step-title">管理员身份运行 bat</div>
                <div class="step-desc">
                  1) 在目标服务器上右键 install.bat → 以管理员身份运行<br/>
                  2) 如果脚本提示"测试连通性失败"，请确认服务器能访问本平台的 {{ origin }}（出站 HTTP 8088 端口，不需要入站端口）<br/>
                  3) 脚本会自动：连通性测试 → 下载 agent.ps1 → 创建 Startup 自启 → 立即后台拉起 Agent → 等待 8 秒并回显启动日志
                </div>
              </div>
            </div>
          </div>
          <el-alert
            style="margin-top: 12px"
            type="warning"
            :closable="false"
            show-icon
            title="Agent 日志位于 C:\ProgramData\sslauto-agent\agent.log；不需要 schtasks.exe、不需要 certutil.exe，所有 Windows 版本（Server 2008~2022 / Win7~11）均可使用"
          />
        </template>

        <!-- ============ Linux: 粘贴命令 ============ -->
        <template v-else>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="在目标服务器上以 root 执行以下命令（令牌 10 分钟内有效且仅可使用一次）"
          />
          <div class="cmd-box">
            <div class="mono">{{ command }}</div>
          </div>
          <el-button type="primary" size="small" @click="copyCommand">复制命令</el-button>
          <el-alert
            style="margin-top: 16px"
            type="warning"
            :closable="false"
            show-icon
            title="请确保服务器可访问本平台地址；脚本会自动安装 systemd 服务，Agent 启动后自动识别 Nginx 安装路径"
          />
        </template>
      </div>

      <div v-else>
        <div class="waiting">
          <el-icon class="is-loading" :size="22"><Loading /></el-icon>
          <span>等待服务器连接...（Agent 启动后约 10 秒内完成注册）</span>
        </div>
        <el-table v-if="newServers.length" :data="newServers" size="small" style="margin-top: 16px">
          <el-table-column prop="name" label="名称" />
          <el-table-column prop="ip" label="IP" />
          <el-table-column prop="status" label="状态">
            <template #default>
              <el-tag type="success" size="small">已连接</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <template #footer>
        <el-button v-if="step > 0" @click="step--">上一步</el-button>
        <el-button v-if="step === 0" type="primary" :loading="creatingToken" @click="createToken">下一步</el-button>
        <el-button v-if="step === 1" type="primary" @click="startWaiting">我已在服务器执行</el-button>
        <el-button v-if="step === 2" @click="finishWizard">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading, ArrowDown } from '@element-plus/icons-vue'
import { api } from '../api'
import { formatDate } from '../utils'

const servers = ref([])
const sites = ref([])
const loading = ref(false)
const selectedServer = ref(null)
const wizardVisible = ref(false)
const step = ref(0)
const serverName = ref('')
const serverOs = ref('LINUX')
const command = ref('')
const wizardToken = ref('')
const upgradeVisible = ref(false)
const origin = window.location.origin
const upgradeLinux = 'curl -fsSL ' + origin + '/api/agent/install.sh | sudo bash -'
const creatingToken = ref(false)
const newServers = ref([])
let pollTimer = null

const cfgVisible = ref(false)
const cfgLoading = ref(false)
const cfgSaving = ref(false)
const cfgForm = ref({ isNew: true, siteId: null, serverId: null, path: '', content: '' })
const jobHint = ref('')

const onlineCount = computed(() => servers.value.filter((s) => s.status === 'ONLINE').length)
const pendingSites = computed(() => sites.value.filter((s) => !s.takenover).length)

const fmt = formatDate

function serverLabel(id) {
  const s = servers.value.find((x) => x.id === id)
  return s ? s.name || s.hostname : 'ID ' + id
}

function isNginx(row) {
  return String(row.webserver || '').toLowerCase() === 'nginx'
}

/** Agent 版本低于 2.2 时不支持受限的配置读写（白名单目录）与站点动作 */
function needsUpgrade(row) {
  return !(Number(row.agentversion || 0) >= 2.2)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 轮询作业结果，直到成功/失败或超时 */
async function pollJob(jobId, timeoutMs = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const job = await api('/agent/job?id=' + jobId)
      jobHint.value = '作业状态：' + (job.status === 'PENDING' ? '等待 Agent 拉取' : job.status === 'PROCESSING' ? 'Agent 执行中' : job.status)
      if (job.status === 'SUCCESS' || job.status === 'FAILED') return job
    } catch (e) {
      return { status: 'FAILED', message: e.message }
    }
    await sleep(1500)
  }
  return { status: 'FAILED', message: '等待 Agent 响应超时，请确认服务器在线（Agent 长轮询空闲时最多挂起 15 秒，心跳 60 秒）；若 Agent 版本为 1.x/2.2，请先在「升级 Agent 脚本」执行升级' }
}

async function load() {
  loading.value = true
  try {
    servers.value = await api('/agent/servers')
    await loadSites()
  } finally {
    loading.value = false
  }
}

async function loadSites() {
  const query = selectedServer.value ? '?serverId=' + selectedServer.value.id : ''
  sites.value = await api('/agent/sites' + query)
}

function viewSites(row) {
  selectedServer.value = row
  loadSites()
}

function openWizard() {
  step.value = 0
  serverName.value = ''
  serverOs.value = 'LINUX'
  command.value = ''
  newServers.value = []
  wizardVisible.value = true
}

async function createToken() {
  if (!serverName.value.trim()) {
    ElMessage.warning('请输入服务器名称')
    return
  }
  creatingToken.value = true
  try {
    const data = await api('/agent/createToken', { method: 'POST', body: { serverName: serverName.value.trim(), os: serverOs.value } })
    command.value = data.command || ''
    wizardToken.value = data.token || ''
    step.value = 1
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    creatingToken.value = false
  }
}

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(command.value)
    ElMessage.success('已复制')
  } catch (e) {
    ElMessage.warning('复制失败，请手动选择文本复制')
  }
}

function startWaiting() {
  step.value = 2
  pollConnect()
}

function openUpgrade() {
  upgradeVisible.value = true
}

async function downloadInstallBat() {
  // Download through fetch + Blob: guarantees real script bytes and lets us
  // surface an explicit error instead of silently saving a 0-byte .bat file.
  const url = origin + '/api/agent/installBat'
  try {
    const resp = await fetch(url, { credentials: 'same-origin' })
    if (!resp.ok) throw new Error('HTTP ' + resp.status)
    const text = await resp.text()
    if (!text || text.length < 200) throw new Error('脚本内容为空（' + text.length + ' 字节）')
    const blob = new Blob([text], { type: 'application/octet-stream' })
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = 'sslauto-install.bat'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objUrl), 2000)
    ElMessage.success('已下载 sslauto-install.bat（' + blob.size + ' 字节）')
  } catch (e) {
    ElMessage.error('下载失败：' + e.message)
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch (e) {
    ElMessage.warning('复制失败，请手动选择文本复制')
  }
}

/** 轮询直到目标服务器出现在列表中 */
async function pollConnect() {
  clearTimeout(pollTimer)
  try {
    const list = await api('/agent/servers')
    const matched = list.filter((s) => s.name === serverName.value.trim())
    if (matched.length) {
      newServers.value = matched
      servers.value = list
      ElMessage.success('服务器已连接')
      return
    }
  } catch (e) {
    /* 忽略，继续轮询 */
  }
  pollTimer = setTimeout(pollConnect, 3000)
}

function finishWizard() {
  wizardVisible.value = false
  clearTimeout(pollTimer)
  load()
}

async function takeover(row) {
  try {
    await api('/agent/takeoverSite', { method: 'POST', body: { siteId: row.id } })
    ElMessage.success('已接管站点')
    loadSites()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function removeServer(row) {
  await ElMessageBox.confirm('删除服务器将同时移除其站点与部署任务，确认？', '提示', { type: 'warning' })
  try {
    await api('/agent/deleteServer', { method: 'POST', body: { id: row.id } })
    ElMessage.success('删除成功')
    if (selectedServer.value && selectedServer.value.id === row.id) {
      selectedServer.value = null
    }
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

// ---------------- 配置编辑 ----------------
async function editConfig(row) {
  cfgForm.value = { isNew: false, siteId: row.id, serverId: row.serverid, path: row.configpath, content: '' }
  jobHint.value = ''
  cfgVisible.value = true
  await loadConfigContent()
}

async function loadConfigContent() {
  cfgLoading.value = true
  jobHint.value = '正在读取配置...'
  try {
    const jobId = await api('/agent/config/read', { method: 'POST', body: { siteId: cfgForm.value.siteId } })
    const job = await pollJob(jobId)
    if (job.status === 'SUCCESS') {
      cfgForm.value.content = job.content || ''
      jobHint.value = '配置已读取（' + (job.path || cfgForm.value.path) + '）'
    } else {
      jobHint.value = '读取失败：' + (job.message || '未知错误')
      ElMessage.error(jobHint.value)
    }
  } catch (e) {
    jobHint.value = '读取失败：' + e.message
    ElMessage.error(e.message)
  } finally {
    cfgLoading.value = false
  }
}

function openNewConfig(server) {
  const sample = sites.value.find((s) => s.serverid === server.id && isNginx(s))
  let path = ''
  if (sample && sample.configpath) {
    const idx = Math.max(sample.configpath.lastIndexOf('/'), sample.configpath.lastIndexOf('\\'))
    path = sample.configpath.slice(0, idx + 1) + 'new-site.conf'
  } else {
    const isWin = String(server.os || '').toLowerCase().indexOf('win') >= 0
    path = isWin ? 'C:\\nginx\\conf\\conf.d\\new-site.conf' : '/etc/nginx/conf.d/new-site.conf'
  }
  cfgForm.value = {
    isNew: true,
    siteId: null,
    serverId: server.id,
    path,
    content: [
      'server {',
      '    listen 443 ssl;',
      '    server_name example.com;',
      '',
      '    ssl_certificate     /etc/sslauto/certs/<证书ID>/fullchain.pem;',
      '    ssl_certificate_key /etc/sslauto/certs/<证书ID>/privkey.pem;',
      '',
      '    location / {',
      '        proxy_pass http://127.0.0.1:8080;',
      '    }',
      '}',
      ''
    ].join('\n')
  }
  jobHint.value = ''
  cfgVisible.value = true
}

async function saveConfig(reload) {
  if (!cfgForm.value.serverId || !cfgForm.value.path || !cfgForm.value.content) {
    ElMessage.warning('服务器、配置路径与内容均不能为空')
    return
  }
  cfgSaving.value = true
  jobHint.value = reload ? '正在写入并重载...' : '正在写入...'
  try {
    const jobId = await api('/agent/config/write', {
      method: 'POST',
      body: {
        siteId: cfgForm.value.siteId,
        serverId: cfgForm.value.serverId,
        path: cfgForm.value.path,
        content: cfgForm.value.content,
        reload
      }
    })
    const job = await pollJob(jobId)
    if (job.status === 'SUCCESS') {
      ElMessage.success(reload ? '配置已保存并重载' : '配置已保存')
      cfgVisible.value = false
      load()
    } else {
      jobHint.value = '保存失败：' + (job.message || '未知错误')
      ElMessage.error(jobHint.value)
    }
  } catch (e) {
    jobHint.value = '保存失败：' + e.message
    ElMessage.error(e.message)
  } finally {
    cfgSaving.value = false
  }
}

// ---------------- 服务器级动作（作用于该服务器上全部站点） ----------------
const actionLabels = { reload: '重载', restart: '重启', stop: '停止', start: '启动' }

async function scanSites(row) {
  const loadingMsg = ElMessage({ message: '已通知 Agent 扫描站点，等待结果...', type: 'info', duration: 0 })
  try {
    const jobId = await api('/agent/scanSites', { method: 'POST', body: { serverId: row.id } })
    const job = await pollJob(jobId)
    if (job.status === 'SUCCESS') {
      ElMessage.success('站点扫描完成')
      loadSites()
    } else {
      ElMessage.error('扫描失败：' + (job.message || '未知错误'))
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loadingMsg.close()
  }
}

async function serverAction(row, action) {
  if (action === 'restart' || action === 'stop') {
    await ElMessageBox.confirm(
      '将对服务器「' + (row.name || row.hostname) + '」上的 Nginx 执行「' + actionLabels[action]
      + '」操作，会影响该服务器上的所有站点，确认继续？',
      '提示',
      { type: 'warning' }
    )
  }
  const loadingMsg = ElMessage({ message: '已下发「' + actionLabels[action] + '」任务，等待 Agent 执行...', type: 'info', duration: 0 })
  try {
    const jobId = await api('/agent/siteAction', { method: 'POST', body: { serverId: row.id, action } })
    const job = await pollJob(jobId)
    if (job.status === 'SUCCESS') {
      ElMessage.success('Nginx ' + actionLabels[action] + '成功')
    } else {
      ElMessage.error('执行失败：' + (job.message || '未知错误'))
    }
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loadingMsg.close()
  }
}

// 后台静默刷新，保证 Agent 升级 / 心跳上报后版本与在线状态及时更新
async function refreshQuiet() {
  try {
    servers.value = await api('/agent/servers')
    await loadSites()
  } catch (e) {
    /* 忽略轮询失败 */
  }
}

let refreshTimer = null
function scheduleRefresh() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(async () => {
    await refreshQuiet()
    scheduleRefresh()
  }, 30000)
}

onMounted(() => {
  load()
  scheduleRefresh()
})
onUnmounted(() => {
  clearTimeout(pollTimer)
  clearTimeout(refreshTimer)
})
</script>

<style scoped>
.tip {
  color: #8a919f;
  font-size: 12px;
}
.cmd-box {
  background: #f5f7fb;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 14px;
  margin: 12px 0;
  user-select: all;
}
.windows-install-box {
  margin: 14px 0 4px;
}
.install-step {
  display: flex;
  gap: 14px;
  padding: 14px;
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 10px;
}
.step-num {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #1677ff;
  color: #fff;
  font-weight: 600;
  font-size: 13px;
  line-height: 26px;
  text-align: center;
}
.step-body {
  flex: 1;
  min-width: 0;
}
.step-title {
  font-weight: 600;
  font-size: 13px;
  color: #1f2329;
  margin-bottom: 4px;
}
.step-desc {
  font-size: 12.5px;
  color: #5a6373;
  line-height: 1.65;
}
.token-box {
  margin-top: 8px;
  background: #fff;
  border: 1px solid #d9e0ec;
  border-radius: 5px;
  padding: 8px 10px;
  font-size: 13px;
  word-break: break-all;
  color: #1677ff;
  user-select: all;
}
.upgrade-box {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 14px;
  margin-top: 8px;
}
.upgrade-desc {
  font-size: 12.5px;
  color: #5a6373;
  line-height: 1.7;
}
.upgrade-label {
  margin-top: 18px;
  font-size: 13px;
  font-weight: 600;
  color: #1f2329;
}
.waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1677ff;
  padding: 16px 0;
}
.cfg-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.cfg-status {
  color: #8a919f;
  font-size: 12px;
}
.cfg-editor :deep(.el-textarea__inner) {
  font-family: Menlo, Consolas, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  background: #fbfcfe;
}
</style>
