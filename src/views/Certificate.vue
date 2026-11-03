<template>
  <div class="page-card cert-page">
    <div class="toolbar">
      <el-button type="primary" @click="openApply">
        <el-icon><Plus /></el-icon> 申请证书
      </el-button>
      <el-button @click="openUpload()">
        <el-icon><Upload /></el-icon> 上传证书
      </el-button>
      <el-input v-model="keyword" placeholder="搜索名称/域名/备注" style="width: 220px" clearable @change="reloadFirstPage">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="brandFilter" placeholder="类型" clearable style="width: 150px" @change="reloadFirstPage">
        <el-option v-for="(label, val) in brands" :key="val" :label="label" :value="val" />
      </el-select>
      <el-select v-model="statusFilter" placeholder="状态" clearable style="width: 140px" @change="reloadFirstPage">
        <el-option label="已签发" value="ISSUED" />
        <el-option label="待验证" value="WAIT_DNS" />
        <el-option label="处理中" value="PENDING" />
        <el-option label="签发中" value="ISSUING" />
        <el-option label="签发失败" value="FAILED" />
      </el-select>
      <el-select v-model="expiryFilter" placeholder="到期时间" clearable style="width: 170px" @change="reloadFirstPage">
        <el-option label="30 天内到期（即将过期）" value="MONTH" />
        <el-option label="90 天内到期" value="QUARTER" />
        <el-option label="已过期" value="EXPIRED" />
      </el-select>
      <el-button @click="load">
        <el-icon><Refresh /></el-icon> 刷新
      </el-button>
      <div class="toolbar-right">
        <span class="tip">Let's Encrypt / ZeroSSL / Google / LiteSSL 自动签发，内置 CA 离线可用</span>
      </div>
    </div>

    <el-table :data="rows" v-loading="loading" size="default" empty-text="暂无证书">
      <el-table-column label="名称" width="170" show-overflow-tooltip>
        <template #default="{ row }">
          <span>{{ row.name || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="域名" min-width="240">
        <template #default="{ row }">
          <div class="domain-list">
            <div v-for="d in parseDomains(row.domains)" :key="d" class="domain-tag-wrap">
              <el-tag v-if="d.startsWith('*.')" type="warning" size="small" effect="plain">通配符</el-tag>
              <span class="domain-name">{{ d }}</span>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="brand" label="品牌" width="100">
        <template #default="{ row }">
          <span class="brand-label">{{ brandLabel(row.brand) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="keytype" label="密钥" width="70" />
      <el-table-column prop="status" label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" size="small" effect="light">
            <el-icon v-if="row.status === 'ISSUED'"><CircleCheck /></el-icon>
            <el-icon v-else-if="row.status === 'WAIT_DNS'"><Loading /></el-icon>
            <el-icon v-else-if="row.status === 'FAILED'"><CircleClose /></el-icon>
            <el-icon v-else><InfoFilled /></el-icon>
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="到期时间" width="170">
        <template #default="{ row }">
          <div v-if="row.notafter" class="expiry-cell">
            <div>{{ fmt(row.notafter) }}</div>
            <div :class="['remain', remainClass(row.notafter)]">{{ remainDays(row.notafter) }}</div>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'ISSUED'">
            <el-button link type="primary" size="small" @click="openDownload(row)">
              <el-icon><Download /></el-icon> 下载
            </el-button>
            <el-button  v-if="row.brand != 'UPLOAD'" link type="primary" size="small" @click="renew(row)">
              <el-icon><Refresh /></el-icon> 续期
            </el-button>
          </template>
          <el-button
            v-if="row.brand === 'UPLOAD'"
            link
            type="primary"
            size="small"
            @click="openUpload(row)"
          >
            <el-icon><Upload /></el-icon> 更新文件
          </el-button>
          <el-button
            v-if="row.status === 'WAIT_DNS'"
            link
            type="warning"
            size="small"
            @click="showDns(row)"
          >
            <el-icon><Key /></el-icon> 配置 DNS
          </el-button>
          <el-button
            v-if="row.status === 'FAILED' || row.status === 'PENDING'"
            link
            type="primary"
            size="small"
            @click="retry(row)"
          >
            <el-icon><RefreshRight /></el-icon> 重试
          </el-button>
          <el-button link type="info" size="small" @click="showDetail(row)">
            <el-icon><View /></el-icon> 详情
          </el-button>
          <el-button link type="danger" size="small" @click="remove(row)">
            <el-icon><Delete /></el-icon> 删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        background
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        :current-page="page"
        :page-size="size"
        :page-sizes="[10, 20, 50]"
        @current-change="onPageChange"
        @size-change="onSizeChange"
      />
    </div>

    <!-- DNS 验证引导弹窗 -->
    <el-dialog v-model="dnsVisible" width="720px" :close-on-click-modal="false" class="dns-dialog">
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">DNS 验证配置</span>
          <span class="dialog-sub">请按照以下步骤在您的域名解析平台完成配置</span>
        </div>
      </template>

      <div class="dns-guide">
        <el-steps :active="currentStep" finish-status="success" align-center simple>
          <el-step title="查看记录" />
          <el-step title="添加到 DNS" />
          <el-step title="验证生效" />
        </el-steps>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="dns-alert"
        title="不同 DNS 服务商的字段名称可能不同，参考下方对照表格填写："
      />

      <el-table :data="dnsRows" size="default" stripe class="dns-table">
        <el-table-column label="主机记录" width="260">
          <template #default="{ row }">
            <div class="dns-field">
              <div class="dns-label">主机记录</div>
              <div class="dns-value-wrap">
                <span class="dns-value mono">{{ row.recordName }}</span>
                <el-button link type="primary" size="small" @click="copyText(row.recordName)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
              <div class="dns-hint">完整的验证名称</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag type="primary" size="small" effect="light">TXT</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="记录值">
          <template #default="{ row }">
            <div class="dns-field">
              <div class="dns-label">记录值</div>
              <div class="dns-value-wrap">
                <span class="dns-value mono">{{ row.txtValue }}</span>
                <el-button link type="primary" size="small" @click="copyText(row.txtValue)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
              <div class="dns-hint">需要完整复制，不要修改</div>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="dns-mapping">
        <div class="mapping-title">DNS 服务商字段对照</div>
        <div class="mapping-grid">
          <div class="mapping-item">
            <span class="mapping-label">阿里云 DNS</span>
            <span>主机记录 = 主机记录</span>
          </div>
          <div class="mapping-item">
            <span class="mapping-label">腾讯云 DNSPod</span>
            <span>主机记录 = 主机记录</span>
          </div>
          <div class="mapping-item">
            <span class="mapping-label">Cloudflare</span>
            <span>主机记录 = Name</span>
          </div>
          <div class="mapping-item">
            <span class="mapping-label">华为云 DNS</span>
            <span>主机记录 = 主机</span>
          </div>
        </div>
        <div class="mapping-tip">
          <el-icon><InfoFilled /></el-icon>
          如果 DNS 平台会自动追加主域名（如 Cloudflare），主机记录中只需要填 <code>_acme-challenge</code> 或 <code>_acme-challenge.demo</code> 部分
        </div>
      </div>

      <el-alert
        type="warning"
        :closable="false"
        show-icon
        class="dns-alert"
        title="DNS 传播通常需要 1-10 分钟，部分可能更久。请等待生效后再点击「立即验证」"
      />

      <template #footer>
        <el-button @click="dnsVisible = false">稍后验证</el-button>
        <el-button type="primary" :loading="verifying" @click="verifyDns">
          <el-icon><CircleCheck /></el-icon> 立即验证
        </el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" width="560px" class="detail-dialog">
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">证书详情</span>
        </div>
      </template>
      <div v-if="currentDetail" class="detail-content">
        <el-descriptions :column="2" border size="default">
          <el-descriptions-item label="名称" :span="2">{{ currentDetail.name || '-' }}</el-descriptions-item>
          <el-descriptions-item label="域名" :span="2">
            <div v-for="d in parseDomains(currentDetail.domains)" :key="d">{{ d }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="品牌">{{ brandLabel(currentDetail.brand) }}</el-descriptions-item>
          <el-descriptions-item label="密钥算法">{{ currentDetail.keytype }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(currentDetail.status) }}</el-descriptions-item>
          <el-descriptions-item label="版本号">v{{ currentDetail.version }}</el-descriptions-item>
          <el-descriptions-item label="序列号" :span="2" class="mono">{{ currentDetail.serialno || '-' }}</el-descriptions-item>
          <el-descriptions-item label="指纹" :span="2" class="mono">{{ currentDetail.fingerprint || '-' }}</el-descriptions-item>
          <el-descriptions-item label="生效时间">{{ fmt(currentDetail.notbefore) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="到期时间">{{ fmt(currentDetail.notafter) || '-' }}</el-descriptions-item>
          <el-descriptions-item label="续期次数">{{ currentDetail.renewcount }} 次</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ fmt(currentDetail.createdat) }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ currentDetail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="currentDetail.status === 'FAILED' && currentDetail.remark" class="detail-error">
          <el-alert type="error" :closable="false" show-icon :title="currentDetail.remark" />
        </div>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
        <el-button
          v-if="currentDetail && currentDetail.status === 'ISSUED'"
          type="primary"
          @click="openDownload(currentDetail)"
        >
          下载证书
        </el-button>
      </template>
    </el-dialog>

    <!-- 下载证书格式选择弹窗 -->
    <el-dialog v-model="downloadVisible" width="680px" class="download-dialog" :close-on-click-modal="true">
      <template #header>
        <div class="dialog-header">
          <span class="dialog-title">下载证书</span>
          <span class="dialog-sub">为 <b>{{ currentDownloadDomains }}</b> 选择适合您服务器的格式</span>
        </div>
      </template>
      <el-alert type="info" :closable="false" show-icon class="dl-alert"
        title="不同服务器需要不同格式：Nginx/Apache 用 PEM，Tomcat/IIS 用 PFX/P12，JKS 给 Java 用。不确定选哪个？参考下方说明。" />
      <table class="dl-table">
        <thead>
          <tr>
            <th style="width: 140px">服务器类型</th>
            <th style="width: 100px">证书格式</th>
            <th>包含文件</th>
            <th style="width: 80px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Nginx</strong></td>
            <td><el-tag size="small" effect="plain">PEM / KEY</el-tag></td>
            <td>server.pem（fullchain）、server.key（私钥）</td>
            <td><el-button link type="primary" size="small" @click="doDownload('nginx')">下载</el-button></td>
          </tr>
          <tr>
            <td><strong>Apache httpd</strong></td>
            <td><el-tag size="small" effect="plain">CRT / KEY</el-tag></td>
            <td>server.crt、ca_bundle.crt、server.key</td>
            <td><el-button link type="primary" size="small" @click="doDownload('apache')">下载</el-button></td>
          </tr>
          <tr>
            <td><strong>Tomcat</strong></td>
            <td><el-tag size="small" effect="plain">PFX / P12</el-tag></td>
            <td>keystore.pfx（包含证书链 + 私钥），默认密码 changeit</td>
            <td><el-button link type="primary" size="small" @click="downloadPfx('tomcat')">下载</el-button></td>
          </tr>
          <tr>
            <td><strong>IIS / Windows</strong></td>
            <td><el-tag size="small" effect="plain">PFX / P12</el-tag></td>
            <td>cert.pfx（包含证书链 + 私钥），默认密码 changeit</td>
            <td><el-button link type="primary" size="small" @click="downloadPfx('iis')">下载</el-button></td>
          </tr>
          <tr>
            <td><strong>JKS (Java)</strong></td>
            <td><el-tag size="small" effect="plain">JKS</el-tag></td>
            <td>keystore.jks（包含证书链 + 私钥），默认密码 changeit</td>
            <td><el-button link type="primary" size="small" @click="downloadPfx('jks')">下载</el-button></td>
          </tr>
          <tr>
            <td><strong>原始文件 (PEM)</strong></td>
            <td><el-tag size="small" effect="plain">ZIP</el-tag></td>
            <td>cert.pem / chain.pem / fullchain.pem / privkey.pem</td>
            <td><el-button link type="primary" size="small" @click="doDownload('zip')">下载</el-button></td>
          </tr>
          <tr v-if="currentDownloadCert && currentDownloadCert.brand === 'INTERNAL'">
            <td><strong>内置根 CA</strong></td>
            <td><el-tag size="small" effect="plain">CRT</el-tag></td>
            <td>root-ca.crt（导入系统信任存储后，浏览器不再警告）</td>
            <td><el-button link type="primary" size="small" @click="doDownload('root')">下载</el-button></td>
          </tr>
        </tbody>
      </table>

      <el-divider />
      <div class="dl-help">
        <div class="help-title"><el-icon><InfoFilled /></el-icon> 部署参考</div>
        <div class="help-content">
          <p><strong>Nginx：</strong><code>ssl_certificate server.pem; ssl_certificate_key server.key;</code></p>
          <p><strong>Apache：</strong><code>SSLCertificateFile server.crt<br>SSLCertificateKeyFile server.key<br>SSLCertificateChainFile ca_bundle.crt</code></p>
          <p><strong>Tomcat：</strong><code>connector port="443" keystoreFile="keystore.pfx" keystorePass="changeit" keystoreType="PKCS12"</code></p>
          <p><strong>PFX 密码：</strong>Tomcat/IIS/JKS 默认密码 <code>changeit</code>，可在下载时指定</p>
        </div>
      </div>
    </el-dialog>

    <!-- 上传证书弹窗（第三方付费证书导入） -->
    <el-dialog v-model="uploadVisible" :title="uploadForm.id ? '更新证书文件' : '上传证书'" width="620px" :close-on-click-modal="false">
      <el-alert
        type="info" :closable="false" show-icon class="dl-alert"
        title="用于导入在其他 CA（如 DigiCert、Sectigo、阿里云等）购买的证书。上传后可统一管理，并直接关联自动部署任务，到期前重新上传即可自动下发到服务器。"
      />
      <el-form label-width="96px">
        <el-form-item label="证书名称">
          <el-input v-model="uploadForm.name" placeholder="如：公司官网、客户A系统（便于识别）" />
        </el-form-item>
        <el-form-item label="导入方式">
          <el-radio-group v-model="uploadMode" :disabled="!!uploadForm.id">
            <el-radio-button value="pem">证书 + 私钥（PEM）</el-radio-button>
            <el-radio-button value="pfx">PFX / P12</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="uploadMode === 'pem'">
          <el-form-item label="证书文件" required>
            <div class="file-row">
              <el-button size="small" @click="pickFile('cert')">选择文件</el-button>
              <span class="file-name">{{ fileNames.cert || '未选择（.pem / .crt / .cer）' }}</span>
            </div>
          </el-form-item>
          <el-form-item label="私钥文件" required>
            <div class="file-row">
              <el-button size="small" @click="pickFile('key')">选择文件</el-button>
              <span class="file-name">{{ fileNames.key || '未选择（.key / .pem）' }}</span>
            </div>
          </el-form-item>
          <el-form-item label="中间证书">
            <div class="file-row">
              <el-button size="small" @click="pickFile('chain')">选择文件</el-button>
              <span class="file-name">{{ fileNames.chain || '可选（ca_bundle.crt / chain.pem）' }}</span>
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="PFX 文件" required>
            <div class="file-row">
              <el-button size="small" @click="pickFile('pfx')">选择文件</el-button>
              <span class="file-name">{{ fileNames.pfx || '未选择（.pfx / .p12）' }}</span>
            </div>
          </el-form-item>
          <el-form-item label="PFX 密码">
            <el-input v-model="uploadForm.pfxPassword" placeholder="导入用密码，默认 changeit" show-password />
          </el-form-item>
        </template>

        <el-form-item label="备注">
          <el-input v-model="uploadForm.remark" placeholder="如：购买于 DigiCert，2027-01 到期" />
        </el-form-item>
      </el-form>

      <input ref="fileCert" type="file" accept=".pem,.crt,.cer" style="display: none" @change="onFile('cert', $event)" />
      <input ref="fileKey" type="file" accept=".key,.pem" style="display: none" @change="onFile('key', $event)" />
      <input ref="fileChain" type="file" accept=".pem,.crt,.cer" style="display: none" @change="onFile('chain', $event)" />
      <input ref="filePfx" type="file" accept=".pfx,.p12" style="display: none" @change="onFile('pfx', $event)" />

      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">
          {{ uploadForm.id ? '更新证书' : '上传' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Search, Refresh, Download, Key, CircleCheck, CircleClose, Loading,
  InfoFilled, Delete, View, RefreshRight, CopyDocument, Upload
} from '@element-plus/icons-vue'
import { api, download } from '../api'
import { formatDate } from '../utils'

const router = useRouter()
const rows = ref([])
const keyword = ref('')
const loading = ref(false)
const brandFilter = ref('')
const statusFilter = ref('')
const expiryFilter = ref('')
const page = ref(1)
const size = ref(10)
const total = ref(0)
const dnsVisible = ref(false)
const verifying = ref(false)
const dnsRows = ref([])
const currentDns = ref(null)
const detailVisible = ref(false)
const currentDetail = ref(null)
const downloadVisible = ref(false)
const currentDownloadCert = ref(null)
const uploadVisible = ref(false)
const uploading = ref(false)
const uploadMode = ref('pem')
const uploadForm = ref({})
const fileNames = ref({})
const fileContents = ref({})
const fileCert = ref(null)
const fileKey = ref(null)
const fileChain = ref(null)
const filePfx = ref(null)
const currentDownloadDomains = computed(() => {
  if (!currentDownloadCert.value) return ''
  try { return JSON.parse(currentDownloadCert.value.domains).join(', ') }
  catch (e) { return currentDownloadCert.value.domains }
})

const currentStep = computed(() => {
  if (!dnsRows.value.length) return 0
  return 2
})

const brands = {
  INTERNAL: '内置 CA',
  LETSENCRYPT: "Let's Encrypt",
  ZEROSSL: 'ZeroSSL',
  GOOGLE: 'Google',
  LITESSL: 'LiteSSL',
  UPLOAD: '手动上传'
}

function brandLabel(v) { return brands[v] || v }

function statusLabel(v) {
  return { ISSUED: '已签发', WAIT_DNS: '待验证', PENDING: '处理中', ISSUING: '签发中', FAILED: '签发失败' }[v] || v
}

function statusType(v) {
  return { ISSUED: 'success', WAIT_DNS: 'warning', PENDING: 'info', ISSUING: 'info', FAILED: 'danger' }[v] || 'info'
}

function remainClass(v) {
  const days = Math.floor((new Date(v).getTime() - Date.now()) / 86400000)
  if (days <= 7) return 'danger'
  if (days <= 30) return 'warning'
  return 'success'
}

function parseDomains(json) {
  try { return JSON.parse(json || '[]') } catch (e) { return [] }
}

const fmt = formatDate

function remainDays(v) {
  if (!v) return '-'
  const date = typeof v === 'number' ? new Date(v < 1e11 ? v * 1000 : v) : new Date(String(v).replace(' ', 'T'))
  if (isNaN(date.getTime())) return '-'
  const days = Math.floor((date.getTime() - Date.now()) / 86400000)
  return days > 0 ? days + ' 天后过期' : '已过期'
}

async function load() {
  loading.value = true
  try {
    const data = await api('/cert/page', {
      method: 'POST',
      body: {
        page: page.value,
        size: size.value,
        keyword: keyword.value || '',
        brand: brandFilter.value || '',
        status: statusFilter.value || '',
        expiry: expiryFilter.value || ''
      }
    })
    rows.value = data.rows || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

function reloadFirstPage() {
  page.value = 1
  load()
}

function onPageChange(p) {
  page.value = p
  load()
}

function onSizeChange(s) {
  size.value = s
  page.value = 1
  load()
}

function openApply() {
  router.push('/cert/apply')
}

function showDns(row) {
  currentDns.value = row
  dnsRows.value = []
  try {
    const snapshot = JSON.parse(row.dnsrecords || '{}')
    const list = (snapshot.challenges || []).map((c) => ({
      recordName: c.recordName,
      txtValue: c.txtValue,
      type: 'TXT'
    }))
    dnsRows.value = list
  } catch (e) {
    dnsRows.value = []
  }
  dnsVisible.value = true
}

function showDetail(row) {
  currentDetail.value = row
  detailVisible.value = true
}

async function verifyDns() {
  if (!currentDns.value) return
  verifying.value = true
  try {
    await api('/cert/verifyDns', { method: 'POST', body: { id: currentDns.value.id } })
    ElMessage.success('DNS 验证通过，证书签发成功！')
    dnsVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    verifying.value = false
  }
}

async function retry(row) {
  await ElMessageBox.confirm(
    `确认重试签发证书「${parseDomains(row.domains).join(', ')}」？`,
    '重试签发',
    { type: 'warning', confirmButtonText: '确认重试', cancelButtonText: '取消' }
  )
  try {
    const cert = await api('/cert/retry', { method: 'POST', body: { id: row.id } })
    ElMessage.success(cert.status === 'ISSUED' ? '证书签发成功' : '重试已创建，请继续配置 DNS')
    load()
    if (cert.status === 'WAIT_DNS' && cert.dnsrecords) {
      const challenges = cert.dnsrecords.challenges || []
      dnsRows.value = challenges.map(c => ({
        recordName: c.recordName,
        txtValue: c.txtValue,
        type: 'TXT'
      }))
      currentDns.value = cert
      dnsVisible.value = true
    }
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function renew(row) {
  await ElMessageBox.confirm('确认续期该证书？续期后版本号会增加', '提示', { type: 'warning' })
  try {
    await api('/cert/renew', { method: 'POST', body: { id: row.id } })
    ElMessage.success('续期成功')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function remove(row) {
  await ElMessageBox.confirm('删除证书后关联部署任务也会被删除，确认？', '提示', { type: 'warning' })
  try {
    await api('/cert/delete', { method: 'POST', body: { id: row.id } })
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openDownload(row) {
  currentDownloadCert.value = row
  downloadVisible.value = true
}

function doDownload(type) {
  if (!currentDownloadCert.value) return
  download('/cert/download?id=' + currentDownloadCert.value.id + '&type=' + type)
}

function downloadPfx(type) {
  if (!currentDownloadCert.value) return
  download('/cert/download?id=' + currentDownloadCert.value.id + '&type=' + type + '&password=changeit')
}

// ========== 上传证书 ==========
function openUpload(row) {
  uploadForm.value = row
    ? { id: row.id, name: row.name || '', remark: row.remark || '' }
    : { name: '', remark: '', pfxPassword: 'changeit' }
  uploadMode.value = 'pem'
  fileNames.value = {}
  fileContents.value = {}
  uploadVisible.value = true
}

function pickFile(kind) {
  const map = { cert: fileCert, key: fileKey, chain: fileChain, pfx: filePfx }
  if (map[kind].value) map[kind].value.click()
}

async function onFile(kind, e) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  try {
    const content = kind === 'pfx' ? await toBase64(f) : await f.text()
    fileContents.value = { ...fileContents.value, [kind]: content }
    fileNames.value = { ...fileNames.value, [kind]: f.name }
  } catch (err) {
    ElMessage.error('读取文件失败：' + err.message)
  }
  e.target.value = ''
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function submitUpload() {
  const f = uploadForm.value
  if (!f.name) {
    ElMessage.warning('请填写证书名称')
    return
  }
  const body = { id: f.id || null, name: f.name, remark: f.remark || '' }
  if (uploadMode.value === 'pem') {
    if (!fileContents.value.cert || !fileContents.value.key) {
      ElMessage.warning('请选择证书文件与私钥文件')
      return
    }
    body.cert = fileContents.value.cert
    body.key = fileContents.value.key
    body.chain = fileContents.value.chain || ''
  } else {
    if (!fileContents.value.pfx) {
      ElMessage.warning('请选择 PFX / P12 文件')
      return
    }
    body.pfx = fileContents.value.pfx
    body.pfxPassword = f.pfxPassword || 'changeit'
  }
  uploading.value = true
  try {
    await api('/cert/upload', { method: 'POST', body })
    ElMessage.success(f.id ? '证书已更新，关联部署任务将自动重新下发' : '证书上传成功')
    uploadVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    uploading.value = false
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch (e) {
    // 降级方案
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      ElMessage.success('已复制到剪贴板')
    } catch (err) {
      ElMessage.error('复制失败，请手动选择复制')
    }
    document.body.removeChild(textarea)
  }
}

onMounted(load)
</script>

<style scoped>
.cert-page { padding: 20px; }

.toolbar {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.toolbar-right { margin-left: auto; }
.tip { color: #8a919f; font-size: 12px; }

.pager { display: flex; justify-content: flex-end; margin-top: 16px; }

.domain-list { display: flex; flex-direction: column; gap: 2px; }
.domain-tag-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.domain-name { font-size: 13px; font-family: 'SFMono-Regular', Consolas, monospace; }

.expiry-cell { font-size: 13px; }
.expiry-cell .remain { font-size: 12px; }
.expiry-cell .remain.success { color: #52c41a; }
.expiry-cell .remain.warning { color: #faad14; }
.expiry-cell .remain.danger { color: #ff4d4f; }

.mono { font-family: 'SFMono-Regular', Consolas, monospace; word-break: break-all; font-size: 12px; }

/* ==================== DNS 验证弹窗 ==================== */
.dns-dialog .dialog-header { margin-bottom: 16px; }

.dns-guide { margin-bottom: 20px; }
.dns-alert { margin: 12px 0; }

.dns-table { border-radius: 8px; overflow: hidden; }
.dns-field { display: flex; flex-direction: column; gap: 4px; }
.dns-label { font-size: 12px; color: #8a919f; }
.dns-value-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
}
.dns-value {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: #1f2329;
  word-break: break-all;
  flex: 1;
}
.dns-hint { font-size: 11px; color: #c0c4cc; }

.dns-mapping {
  margin-top: 16px;
  padding: 14px;
  background: #f5f7fa;
  border-radius: 8px;
}
.mapping-title {
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
  margin-bottom: 10px;
}
.mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}
.mapping-item {
  font-size: 12px;
  color: #606266;
  display: flex;
  gap: 8px;
}
.mapping-label {
  font-weight: 500;
  color: #1f2329;
  min-width: 80px;
}
.mapping-tip {
  margin-top: 10px;
  padding: 8px 12px;
  background: #fff7e6;
  border-left: 3px solid #faad14;
  border-radius: 4px;
  font-size: 12px;
  color: #8a6d3b;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}
.mapping-tip code {
  background: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  color: #d63384;
}

/* ==================== 详情弹窗 ==================== */
.detail-content { padding-top: 8px; }
.detail-error { margin-top: 16px; }

/* ============ 下载弹窗 ============ */
.download-dialog .dialog-header { margin-bottom: 12px; }
.download-dialog .dl-alert { margin-bottom: 16px; }

.dl-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dl-table th {
  text-align: left;
  padding: 10px 12px;
  background: #f5f7fa;
  color: #606266;
  font-weight: 600;
  border-bottom: 1px solid #ebeef5;
}
.dl-table td {
  padding: 12px;
  border-bottom: 1px solid #f0f2f5;
  color: #303133;
}
.dl-table tbody tr:hover {
  background: #f9fafb;
}
.dl-table code {
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  color: #d63384;
}

.dl-help {
  background: #f9fafb;
  padding: 14px;
  border-radius: 8px;
}
.help-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #1f2329;
  margin-bottom: 8px;
}
.help-content p {
  margin: 4px 0;
  font-size: 12px;
  color: #606266;
  line-height: 1.6;
}

/* ============ 上传证书 ============ */
.file-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-name {
  font-size: 12px;
  color: #8a919f;
  word-break: break-all;
}
</style>
