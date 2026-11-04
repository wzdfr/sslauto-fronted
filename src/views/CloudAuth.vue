<template>
  <div class="space-y-4">
    <!-- 顶部页面栏 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">云 DNS 授权</h1>
        </div>
        <p class="wb-page-sub">
          <span>共 {{ list.length }} 项密钥凭证</span>
          <span class="wb-sep">·</span>
          <span>支撑阿里云、Cloudflare、DNSPod 等 ACME DNS-01 全自动解析验证</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="loadList">
          <el-icon><Refresh /></el-icon>
          <span>刷新</span>
        </button>
        <button
          v-if="can('auth:save')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="openDialog()"
        >
          <el-icon><Plus /></el-icon>
          <span>新增云授权</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- 圆角筛选行 -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="wb-search w-64">
        <el-icon class="text-gray-400"><Search /></el-icon>
        <input
          v-model="keyword"
          type="text"
          placeholder="搜索授权名称、AccessKey 或备注"
        />
      </div>

      <el-select
        v-model="providerFilter"
        placeholder="全部 DNS 服务商"
        clearable
        class="wb-pill-select !w-44"
      >
        <el-option
          v-for="p in PROVIDER_LIST"
          :key="p.value"
          :label="p.label"
          :value="p.value"
        />
      </el-select>
    </div>

    <!-- 授权凭证表格 -->
    <div class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loading" :data="filteredList" empty-text="暂未配置任何云 DNS API 授权凭证">
        <el-table-column label="授权凭证名称" min-width="200">
          <template #default="{ row }">
            <div class="font-bold text-[#111827]">{{ row.name }}</div>
            <div class="text-xs text-gray-400 mt-0.5">{{ row.remark || '用于 ACME DNS-01 自动化解析验证' }}</div>
          </template>
        </el-table-column>

        <el-table-column label="DNS 服务商" width="165">
          <template #default="{ row }">
            <span class="wb-soft-label">{{ providerLabel(row.provider) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="AccessKey / SecretKey (脱敏存储)" min-width="230">
          <template #default="{ row }">
            <div class="mono text-xs text-gray-800">AK: {{ row.accesskey }}</div>
            <div class="mono text-xs text-gray-400 mt-0.5">SK: {{ row.secretkey }}</div>
          </template>
        </el-table-column>

        <el-table-column label="连通性状态" width="130">
          <template #default="{ row }">
            <span
              class="wb-state"
              :class="
                row.status === 'VALID'
                  ? 'wb-state-ok'
                  : row.status === 'INVALID'
                  ? 'wb-state-err'
                  : 'wb-state-neutral'
              "
            >
              {{
                row.status === 'VALID'
                  ? '连通正常'
                  : row.status === 'INVALID'
                  ? '鉴权异常'
                  : '尚未测试'
              }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="最近测试时间" width="180">
          <template #default="{ row }">
            <span class="mono text-xs text-gray-400">{{ formatDate(row.lasttesttime) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="220" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex items-center gap-2">
              <button
                v-if="can('auth:test')"
                type="button"
                class="wb-row-btn"
                :disabled="testingId === row.id"
                @click="testConnectivity(row)"
              >
                {{ testingId === row.id ? '检测中...' : '测试连通性' }}
              </button>
              <button
                v-if="can('auth:save')"
                type="button"
                class="wb-row-link"
                @click="openDialog(row)"
              >
                编辑
              </button>
              <button
                v-if="can('auth:delete')"
                type="button"
                class="wb-row-link wb-row-link-danger"
                @click="deleteAuth(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑授权凭证弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="form.id ? '编辑云 DNS 授权凭证' : '新增云 DNS 授权凭证'"
      width="500px"
    >
      <el-form label-position="top">
        <el-form-item label="授权凭证名称" required>
          <el-input v-model="form.name" placeholder="例如：阿里云 DNS · 生产主账号" />
        </el-form-item>

        <el-form-item label="DNS 云服务厂商" required>
          <el-select v-model="form.provider" class="w-full">
            <el-option
              v-for="p in PROVIDER_LIST"
              :key="p.value"
              :value="p.value"
              :label="p.autoDns ? `${p.label} (支持全自动 DNS-01)` : p.label"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="AccessKey / API Token ID" required>
          <el-input v-model="form.accessKey" class="mono" placeholder="输入最小权限 DNS 解析读写 AccessKey" />
        </el-form-item>

        <el-form-item label="SecretKey / API Secret (加密存储，回显仅保留末4位)" required>
          <el-input
            v-model="form.secretKey"
            type="password"
            show-password
            class="mono"
            :placeholder="form.id ? '重新输入新的 SecretKey 以更新凭证' : '输入对应 SecretKey'"
          />
        </el-form-item>

        <el-form-item label="用途备注">
          <el-input v-model="form.remark" placeholder="例如：承载 *.prod.example.com 自动续期验证" />
        </el-form-item>
      </el-form>

      <template #footer>
        <button type="button" class="wb-btn" @click="dialogVisible = false">取消</button>
        <button
          type="button"
          class="wb-btn wb-btn-primary ml-2"
          :disabled="saving"
          @click="saveAuth"
        >
          {{ saving ? '保存中...' : '保存凭证' }}
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search, FullScreen } from '@element-plus/icons-vue'
import { call } from '../api'
import { can } from '../store'
import {
  PROVIDER_LIST,
  providerLabel,
  formatDate,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const loading = ref(false)
const saving = ref(false)
const testingId = ref(null)
const list = ref([])

const keyword = ref('')
const providerFilter = ref('')

const dialogVisible = ref(false)
const form = reactive({
  id: null,
  name: '',
  provider: 'aliyun',
  accessKey: '',
  secretKey: '',
  remark: ''
})

const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return list.value.filter((item) => {
    if (providerFilter.value && String(item.provider).toLowerCase() !== providerFilter.value) {
      return false
    }
    if (!kw) return true
    return (
      (item.name || '').toLowerCase().includes(kw) ||
      (item.accesskey || '').toLowerCase().includes(kw) ||
      (item.remark || '').toLowerCase().includes(kw)
    )
  })
})

async function loadList() {
  loading.value = true
  try {
    list.value = (await call('/cloud/auth/list')) || []
  } catch {
    // handled in call()
  } finally {
    loading.value = false
  }
}

function openDialog(row = null) {
  if (row) {
    form.id = row.id
    form.name = row.name
    form.provider = String(row.provider || 'aliyun').toLowerCase()
    form.accessKey = row.accesskey || ''
    form.secretKey = ''
    form.remark = row.remark || ''
  } else {
    form.id = null
    form.name = ''
    form.provider = 'aliyun'
    form.accessKey = ''
    form.secretKey = ''
    form.remark = ''
  }
  dialogVisible.value = true
}

async function saveAuth() {
  if (!form.name.trim() || !form.provider || !form.accessKey.trim() || !form.secretKey.trim()) {
    ElMessage.warning('授权名称、厂商、AccessKey 和 SecretKey 均不能为空')
    return
  }
  saving.value = true
  try {
    await call('/cloud/auth/save', {
      method: 'POST',
      body: {
        id: form.id || undefined,
        name: form.name.trim(),
        provider: form.provider.toLowerCase(),
        accessKey: form.accessKey.trim(),
        secretKey: form.secretKey.trim(),
        remark: form.remark.trim()
      }
    })
    ElMessage.success(form.id ? '授权凭证已更新' : '授权凭证已保存')
    dialogVisible.value = false
    await loadList()
  } catch {
    // handled in call()
  } finally {
    saving.value = false
  }
}

async function testConnectivity(row) {
  testingId.value = row.id
  try {
    const msg = await call('/cloud/auth/test', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success(typeof msg === 'string' && msg ? msg : 'DNS API 连通性校验通过')
    await loadList()
  } catch {
    // handled in call()
  } finally {
    testingId.value = null
  }
}

async function deleteAuth(row) {
  await ElMessageBox.confirm(`确认删除云 DNS 授权「${row.name}」吗？`, '删除授权确认', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消'
  })
  try {
    await call('/cloud/auth/delete', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('授权已删除')
    await loadList()
  } catch {
    // handled in call()
  }
}

onMounted(() => {
  loadList()
})
</script>
