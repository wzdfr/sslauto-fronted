<template>
  <div class="page-card">
    <el-tabs v-model="tab">
      <!-- 用户管理 -->
      <el-tab-pane v-if="can('system:user')" label="用户管理" name="user">
        <div class="toolbar">
          <el-button type="primary" @click="openUser()">新建用户</el-button>
          <el-input
            v-model="keyword"
            placeholder="搜索用户名/昵称"
            clearable
            style="width: 220px"
            @keyup.enter="loadUsers"
            @clear="loadUsers"
          />
          <el-button @click="loadUsers">搜索</el-button>
          <span class="tip">超级管理员账号不可禁用或删除；系统至少保留一个超级管理员</span>
        </div>

        <el-table :data="users" v-loading="loadingUsers" size="small" empty-text="暂无用户">
          <el-table-column prop="username" label="用户名" width="160" />
          <el-table-column prop="nickname" label="昵称" width="160" />
          <el-table-column label="角色" width="150">
            <template #default="{ row }">
              <el-tag size="small" effect="plain">{{ row.roleName || '未分配' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'DISABLED' ? 'info' : 'success'" size="small">
                {{ row.status === 'DISABLED' ? '已禁用' : '正常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="180">
            <template #default="{ row }">{{ fmt(row.createdat) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openUser(row)">编辑</el-button>
              <el-button link type="primary" size="small" @click="openReset(row)">重置密码</el-button>
              <el-button link type="danger" size="small" @click="removeUser(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 角色管理 -->
      <el-tab-pane v-if="can('system:role')" label="角色管理" name="role">
        <div class="toolbar">
          <el-button type="primary" @click="openRole()">新建角色</el-button>
          <el-button @click="loadRoles">刷新</el-button>
          <span class="tip">角色决定可见菜单；内置超级管理员不可删除</span>
        </div>

        <el-table :data="roles" v-loading="loadingRoles" size="small" empty-text="暂无角色">
          <el-table-column prop="code" label="角色编码" width="140" />
          <el-table-column prop="name" label="角色名称" width="160" />
          <el-table-column prop="description" label="描述" show-overflow-tooltip />
          <el-table-column label="权限" min-width="220">
            <template #default="{ row }">
              <el-tag v-for="p in permList(row)" :key="p" size="small" style="margin: 1px 4px 1px 0">
                {{ permLabel(p) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openRole(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="removeRole(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- 操作日志 -->
      <el-tab-pane v-if="can('system:log')" label="操作日志" name="log">
        <div class="toolbar">
          <el-select v-model="logQuery.module" placeholder="全部模块" clearable style="width: 150px">
            <el-option v-for="m in moduleOptions" :key="m.value" :label="m.label" :value="m.value" />
          </el-select>
          <el-input v-model="logQuery.username" placeholder="用户名" clearable style="width: 140px" />
          <el-select v-model="logQuery.result" placeholder="全部结果" clearable style="width: 120px">
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAIL" />
          </el-select>
          <el-input
            v-model="logQuery.keyword"
            placeholder="对象/详情/信息关键字"
            clearable
            style="width: 180px"
            @keyup.enter="searchLogs"
            @clear="searchLogs"
          />
          <el-date-picker
            v-model="logQuery.range"
            type="datetimerange"
            value-format="YYYY-MM-DD HH:mm:ss"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 350px"
          />
          <el-button type="primary" @click="searchLogs">查询</el-button>
          <el-button @click="resetLogs">重置</el-button>
        </div>

        <el-table :data="logs" v-loading="loadingLogs" size="small" empty-text="暂无操作日志">
          <el-table-column label="时间" width="170">
            <template #default="{ row }">{{ fmt(row.createdat) }}</template>
          </el-table-column>
          <el-table-column prop="username" label="操作人" width="110" />
          <el-table-column prop="role" label="角色" width="110" />
          <el-table-column label="模块" width="100">
            <template #default="{ row }">{{ moduleLabel(row.module) }}</template>
          </el-table-column>
          <el-table-column prop="action" label="操作" width="150" />
          <el-table-column prop="method" label="方式" width="80" />
          <el-table-column prop="target" label="对象" min-width="140" show-overflow-tooltip />
          <el-table-column prop="detail" label="详情" min-width="180" show-overflow-tooltip />
          <el-table-column prop="ip" label="IP" width="130" />
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag :type="row.result === 'SUCCESS' ? 'success' : 'danger'" size="small">
                {{ row.result === 'SUCCESS' ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="message" label="信息" min-width="140" show-overflow-tooltip />
          <el-table-column label="耗时" width="90">
            <template #default="{ row }">{{ row.costms == null ? '-' : row.costms + ' ms' }}</template>
          </el-table-column>
        </el-table>

        <div class="pager">
          <el-pagination
            background
            layout="total, sizes, prev, pager, next"
            :total="logTotal"
            :current-page="logQuery.page"
            :page-size="logQuery.size"
            :page-sizes="[10, 20, 50, 100]"
            @current-change="onLogPage"
            @size-change="onLogSize"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 用户弹窗 -->
    <el-dialog v-model="userVisible" :title="userForm.id ? '编辑用户' : '新建用户'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="用户名">
          <el-input v-model="userForm.username" :disabled="!!userForm.id" placeholder="登录账号，如 ops01" />
        </el-form-item>
        <el-form-item v-if="!userForm.id" label="密码">
          <el-input v-model="userForm.password" type="password" placeholder="至少 6 位" />
        </el-form-item>
        <el-form-item label="昵称">
          <el-input v-model="userForm.nickname" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.roleid" style="width: 100%" placeholder="选择角色">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="userForm.status">
            <el-radio-button value="ACTIVE">正常</el-radio-button>
            <el-radio-button value="DISABLED">禁用</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">保存</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="resetVisible" title="重置密码" width="460px">
      <el-alert type="warning" :closable="false" show-icon :title="'将重置用户「' + resetForm.username + '」的密码，重置后该用户需重新登录'" />
      <el-form label-width="80px" style="margin-top: 16px">
        <el-form-item label="新密码">
          <el-input v-model="resetForm.password" type="password" placeholder="至少 6 位" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doReset">确定</el-button>
      </template>
    </el-dialog>

    <!-- 角色弹窗 -->
    <el-dialog v-model="roleVisible" :title="roleForm.id ? '编辑角色' : '新建角色'" width="680px">
      <el-form label-width="90px">
        <el-form-item label="角色编码">
          <el-input v-model="roleForm.code" :disabled="roleForm.code === 'super'" placeholder="英文标识，如 ops" />
        </el-form-item>
        <el-form-item label="角色名称">
          <el-input v-model="roleForm.name" placeholder="如：运维管理员" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="roleForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="操作权限">
          <div class="perm-groups">
            <div v-for="g in permissionGroups" :key="g.module" class="perm-group">
              <div class="perm-group-head">
                <el-checkbox
                  :model-value="isModuleAll(g)"
                  :indeterminate="isModuleSome(g)"
                  @change="(v) => toggleModule(g, v)"
                >
                  {{ g.label }}
                </el-checkbox>
                <span class="perm-module">{{ g.module }}</span>
              </div>
              <el-checkbox-group v-model="roleForm.permissions" class="perm-items">
                <el-checkbox v-for="it in g.items" :key="it.key" :value="it.key">{{ it.label }}</el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api } from '../api'
import { can } from '../store'
import { formatDate } from '../utils'

/** 日志模块筛选（与后端权限目录的模块编码一致） */
const MODULE_OPTIONS = [
  { value: 'dashboard', label: '首页概览' },
  { value: 'auth', label: '云服务授权' },
  { value: 'cert', label: '证书管理' },
  { value: 'deploy', label: '自动部署' },
  { value: 'agent', label: '服务器 Agent' },
  { value: 'system', label: '系统管理' }
]

const tab = ref('user')
const keyword = ref('')
const users = ref([])
const roles = ref([])
const permissionGroups = ref([])
const loadingUsers = ref(false)
const loadingRoles = ref(false)
const saving = ref(false)

const userVisible = ref(false)
const userForm = ref({})
const resetVisible = ref(false)
const resetForm = ref({})
const roleVisible = ref(false)
const roleForm = ref({})

const logs = ref([])
const logTotal = ref(0)
const loadingLogs = ref(false)
const moduleOptions = MODULE_OPTIONS
const logQuery = ref({
  module: '',
  username: '',
  result: '',
  keyword: '',
  range: null,
  page: 1,
  size: 20
})

const fmt = formatDate

function permList(row) {
  return (row.permissions || '').split(',').filter((x) => x)
}

function permLabel(key) {
  for (const g of permissionGroups.value) {
    const item = (g.items || []).find((x) => x.key === key)
    if (item) {
      return g.label + ' - ' + item.label
    }
  }
  return key
}

function isModuleAll(group) {
  const items = group.items || []
  if (!items.length) {
    return false
  }
  return items.every((x) => roleForm.value.permissions.indexOf(x.key) >= 0)
}

function isModuleSome(group) {
  const items = group.items || []
  const selected = items.filter((x) => roleForm.value.permissions.indexOf(x.key) >= 0).length
  return selected > 0 && selected < items.length
}

function toggleModule(group, checked) {
  const items = group.items || []
  const current = roleForm.value.permissions || []
  if (checked) {
    items.forEach((x) => {
      if (current.indexOf(x.key) < 0) {
        current.push(x.key)
      }
    })
  } else {
    roleForm.value.permissions = current.filter((key) => !items.some((x) => x.key === key))
    return
  }
  roleForm.value.permissions = current
}

function moduleLabel(value) {
  const m = MODULE_OPTIONS.find((x) => x.value === value)
  return m ? m.label : value || '-'
}

async function loadUsers() {
  loadingUsers.value = true
  try {
    users.value = await api('/system/users?keyword=' + encodeURIComponent(keyword.value || ''))
  } finally {
    loadingUsers.value = false
  }
}

async function loadRoles() {
  loadingRoles.value = true
  try {
    roles.value = await api('/system/roles')
  } finally {
    loadingRoles.value = false
  }
}

async function loadPermissions() {
  if (!can('system:role')) {
    return
  }
  permissionGroups.value = await api('/system/permissions')
}

async function searchLogs() {
  if (!can('system:log')) {
    return
  }
  loadingLogs.value = true
  try {
    const q = logQuery.value
    const body = {
      module: q.module || null,
      username: q.username || null,
      result: q.result || null,
      keyword: q.keyword || null,
      page: q.page,
      size: q.size
    }
    if (q.range && q.range.length === 2) {
      body.start = q.range[0]
      body.end = q.range[1]
    }
    const data = await api('/system/logs', { method: 'POST', body })
    logs.value = data.rows || []
    logTotal.value = data.total || 0
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    loadingLogs.value = false
  }
}

function resetLogs() {
  logQuery.value = { module: '', username: '', result: '', keyword: '', range: null, page: 1, size: 20 }
  searchLogs()
}

function onLogPage(page) {
  logQuery.value.page = page
  searchLogs()
}

function onLogSize(size) {
  logQuery.value.size = size
  logQuery.value.page = 1
  searchLogs()
}

function openUser(row) {
  userForm.value = row
    ? { id: row.id, username: row.username, nickname: row.nickname, roleid: row.roleid, status: row.status || 'ACTIVE' }
    : { id: null, username: '', password: '', nickname: '', roleid: null, status: 'ACTIVE' }
  userVisible.value = true
}

async function saveUser() {
  const f = userForm.value
  if (!f.id && (!f.username || !f.password)) {
    ElMessage.warning('用户名和密码不能为空')
    return
  }
  if (!f.roleid) {
    ElMessage.warning('请选择角色')
    return
  }
  saving.value = true
  try {
    await api('/system/user/save', { method: 'POST', body: f })
    ElMessage.success('保存成功')
    userVisible.value = false
    loadUsers()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

function openReset(row) {
  resetForm.value = { id: row.id, username: row.username, password: '' }
  resetVisible.value = true
}

async function doReset() {
  if (!resetForm.value.password || resetForm.value.password.length < 6) {
    ElMessage.warning('新密码至少 6 位')
    return
  }
  saving.value = true
  try {
    await api('/system/user/resetPassword', { method: 'POST', body: resetForm.value })
    ElMessage.success('密码已重置')
    resetVisible.value = false
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function removeUser(row) {
  await ElMessageBox.confirm('确定删除用户「' + row.username + '」？', '提示', { type: 'warning' })
  try {
    await api('/system/user/delete', { method: 'POST', body: { id: row.id } })
    ElMessage.success('已删除')
    loadUsers()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

function openRole(row) {
  roleForm.value = row
    ? { id: row.id, code: row.code, name: row.name, description: row.description, permissions: permList(row) }
    : { id: null, code: '', name: '', description: '', permissions: [] }
  roleVisible.value = true
}

async function saveRole() {
  const f = roleForm.value
  if (!f.code || !f.name) {
    ElMessage.warning('角色编码和名称不能为空')
    return
  }
  saving.value = true
  try {
    await api('/system/role/save', { method: 'POST', body: f })
    ElMessage.success('保存成功')
    roleVisible.value = false
    loadRoles()
  } catch (e) {
    ElMessage.error(e.message)
  } finally {
    saving.value = false
  }
}

async function removeRole(row) {
  await ElMessageBox.confirm('确定删除角色「' + row.name + '」？', '提示', { type: 'warning' })
  try {
    await api('/system/role/delete', { method: 'POST', body: { id: row.id } })
    ElMessage.success('已删除')
    loadRoles()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

onMounted(() => {
  if (can('system:user')) {
    loadUsers()
  }
  if (can('system:user') || can('system:role')) {
    loadRoles()
  }
  loadPermissions()
  if (can('system:log')) {
    searchLogs()
  }
  if (!can('system:user')) {
    tab.value = can('system:role') ? 'role' : 'log'
  }
})
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.tip {
  color: #8a919f;
  font-size: 12px;
}
.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.perm-groups {
  width: 100%;
}
.perm-group {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
  background: #fafbfc;
}
.perm-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.perm-module {
  color: #a8abb2;
  font-size: 12px;
}
.perm-items {
  padding-left: 8px;
}
</style>
