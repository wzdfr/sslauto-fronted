<template>
  <div class="page-card">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增授权</el-button>
      <el-button @click="load">刷新</el-button>
      <span class="tip">支持阿里云 / Cloudflare 自动 DNS 验证；其余厂商可保存凭证用于记录。</span>
    </div>

    <el-table :data="rows" v-loading="loading" size="small" empty-text="暂无授权">
      <el-table-column prop="name" label="授权名称" width="180" />
      <el-table-column prop="provider" label="云厂商" width="130">
        <template #default="{ row }">{{ providerLabel(row.provider) }}</template>
      </el-table-column>
      <el-table-column prop="accesskey" label="AccessKey" show-overflow-tooltip />
      <el-table-column prop="status" label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'VALID' ? 'success' : row.status === 'INVALID' ? 'danger' : 'info'" size="small">
            {{ row.status === 'VALID' ? '有效' : row.status === 'INVALID' ? '无效' : '未测试' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lasttesttime" label="最近测试" width="170">
        <template #default="{ row }">{{ fmt(row.lasttesttime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="test(row)">连通测试</el-button>
          <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="form.id ? '编辑授权' : '新增授权'" width="560px">
      <el-form label-width="110px">
        <el-form-item label="云厂商">
          <div class="provider-grid">
            <div
              v-for="p in providers"
              :key="p.value"
              class="provider-card"
              :class="{ active: form.provider === p.value }"
              @click="form.provider = p.value"
            >
              {{ p.label }}
            </div>
          </div>
        </el-form-item>
        <el-form-item label="授权名称">
          <el-input v-model="form.name" placeholder="例如：阿里云-生产账号" />
        </el-form-item>
        <el-form-item label="AccessKey ID">
          <el-input v-model="form.accessKey" />
        </el-form-item>
        <el-form-item label="AccessKey Secret">
          <el-input v-model="form.secretKey" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { formatDate } from '../utils'

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const visible = ref(false)
const form = ref({})

const providers = [
  { value: 'aliyun', label: '阿里云' },
  { value: 'tencent', label: '腾讯云' },
  { value: 'huawei', label: '华为云' },
  { value: 'baidu', label: '百度云' },
  { value: 'volcengine', label: '火山引擎' },
  { value: 'cloudflare', label: 'Cloudflare' },
  { value: 'qiniu', label: '七牛云' },
  { value: 'leidian', label: '雷池 WAF' },
  { value: 'west', label: '西部数码' },
  { value: 'godaddy', label: 'GoDaddy' },
  { value: 'namecheap', label: 'Namecheap' },
  { value: 'ns1', label: 'NS1' }
]

function providerLabel(v) {
  const p = providers.find((x) => x.value === v)
  return p ? p.label : v
}

const fmt = formatDate

async function load() {
  loading.value = true
  try {
    rows.value = await api('/cloud/auth/list')
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = { provider: 'aliyun', name: '', accessKey: '', secretKey: '' }
  visible.value = true
}

function openEdit(row) {
  form.value = {
    id: row.id,
    provider: row.provider,
    name: row.name,
    accessKey: row.accesskey,
    secretKey: row.secretkey
  }
  visible.value = true
}

async function save() {
  if (!form.value.name || !form.value.accessKey || !form.value.secretKey) {
    ElMessage.warning('请填写完整信息')
    return
  }
  saving.value = true
  try {
    await api('/cloud/auth/save', { method: 'POST', body: form.value })
    ElMessage.success('保存成功')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function test(row) {
  const loadingMsg = ElMessage({ message: '正在测试连通性...', duration: 0 })
  try {
    const result = await api('/cloud/auth/test', { method: 'POST', body: { id: row.id } })
    loadingMsg.close()
    ElMessage.success(result)
    load()
  } catch (e) {
    loadingMsg.close()
    ElMessage.error(e.message)
    load()
  }
}

async function remove(row) {
  await ElMessageBox.confirm('确定删除授权「' + row.name + '」？', '提示', { type: 'warning' })
  try {
    await api('/cloud/auth/delete', { method: 'POST', body: { id: row.id } })
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(load)
</script>

<style scoped>
.provider-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  width: 100%;
}
.provider-card {
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  padding: 10px 6px;
  text-align: center;
  font-size: 13px;
  cursor: pointer;
}
.provider-card.active {
  border-color: #1677ff;
  color: #1677ff;
  background: #f0f7ff;
}
.tip {
  color: #8a919f;
  font-size: 12px;
}
</style>
