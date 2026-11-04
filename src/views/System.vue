<template>
  <div class="space-y-4">
    <!-- 顶部页面栏 + 模式切换器 -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">权限与审计</h1>
          <div class="wb-mode-switch">
            <button
              v-if="can('system:user')"
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'users' }]"
              @click="switchTab('users')"
            >
              平台账号
            </button>
            <button
              v-if="can('system:role')"
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'roles' }]"
              @click="switchTab('roles')"
            >
              RBAC 角色矩阵
            </button>
            <button
              v-if="can('system:log')"
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'logs' }]"
              @click="switchTab('logs')"
            >
              操作审计日志
            </button>
          </div>
        </div>
        <p class="wb-page-sub">
          <span>多角色细粒度权限治理与全生命周期操作留痕</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button
          v-if="activeTab === 'users' && can('system:user')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="openUserModal()"
        >
          <el-icon><Plus /></el-icon>
          <span>新建账号</span>
        </button>
        <button
          v-if="activeTab === 'roles' && can('system:role')"
          type="button"
          class="wb-btn wb-btn-primary"
          @click="openRoleModal()"
        >
          <el-icon><Plus /></el-icon>
          <span>新建角色</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- Tab 1: 平台账号管理 -->
    <template v-if="activeTab === 'users' && can('system:user')">
      <div class="flex items-center gap-3">
        <div class="wb-search w-64">
          <el-icon class="text-gray-400"><Search /></el-icon>
          <input
            v-model="userKeyword"
            type="text"
            placeholder="搜索用户名或显示姓名"
            @keyup.enter="loadUsers"
          />
        </div>
        <button type="button" class="wb-btn" @click="loadUsers">查询</button>
      </div>

      <div class="wb-panel overflow-hidden px-3 pt-1">
        <el-table v-loading="loadingUsers" :data="users" empty-text="暂无账号记录">
          <el-table-column label="登录账号 / 姓名" min-width="200">
            <template #default="{ row }">
              <div class="font-bold text-[#111827]">{{ row.nickname || row.username }}</div>
              <div class="mono text-xs text-gray-400 mt-0.5">@{{ row.username }}</div>
            </template>
          </el-table-column>

          <el-table-column label="绑定角色" min-width="160">
            <template #default="{ row }">
              <span class="wb-soft-label">{{ row.roleName || '未分配角色' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="账号状态" width="120">
            <template #default="{ row }">
              <span
                class="wb-state"
                :class="row.status === 'ACTIVE' ? 'wb-state-ok' : 'wb-state-err'"
              >
                {{ row.status === 'ACTIVE' ? '正常启用' : '已禁用' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="创建时间" width="180">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-400">{{ formatDate(row.createdat) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="220" fixed="right" align="right">
            <template #default="{ row }">
              <div class="inline-flex items-center gap-2">
                <button type="button" class="wb-row-btn" @click="openUserModal(row)">
                  编辑
                </button>
                <button type="button" class="wb-row-link" @click="openResetPwd(row)">
                  重置密码
                </button>
                <button
                  v-if="row.username !== 'admin'"
                  type="button"
                  class="wb-row-link wb-row-link-danger"
                  @click="deleteUser(row)"
                >
                  删除
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- Tab 2: RBAC 角色与权限矩阵 -->
    <div v-if="activeTab === 'roles' && can('system:role')" class="wb-panel overflow-hidden px-3 pt-1">
      <el-table v-loading="loadingRoles" :data="roles" empty-text="暂无角色定义">
        <el-table-column label="角色名称 / 编码" min-width="200">
          <template #default="{ row }">
            <div class="font-bold text-[#111827]">{{ row.name }}</div>
            <div class="mono text-xs text-gray-400 mt-0.5">{{ row.code }}</div>
          </template>
        </el-table-column>

        <el-table-column label="职责描述" prop="description" min-width="240" />

        <el-table-column label="已授权细粒度权限" width="180">
          <template #default="{ row }">
            <span v-if="row.code === 'super'" class="wb-state wb-state-ok">内置超级权限</span>
            <span v-else class="mono text-xs font-semibold text-gray-800">
              {{ countPerms(row.permissions) }} 项接口与操作权限
            </span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <span class="mono text-xs text-gray-400">{{ formatDate(row.createdat) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="170" fixed="right" align="right">
          <template #default="{ row }">
            <div class="inline-flex items-center gap-2">
              <button type="button" class="wb-row-btn" @click="openRoleModal(row)">
                配置权限矩阵
              </button>
              <button
                v-if="row.code !== 'super'"
                type="button"
                class="wb-row-link wb-row-link-danger"
                @click="deleteRole(row)"
              >
                删除
              </button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Tab 3: 操作审计日志 -->
    <template v-if="activeTab === 'logs' && can('system:log')">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="wb-search w-60">
            <el-icon class="text-gray-400"><Search /></el-icon>
            <input
              v-model="logQuery.keyword"
              type="text"
              placeholder="搜索目标域名、动作或详情"
              @keyup.enter="searchLogs"
            />
          </div>

          <el-select
            v-model="logQuery.module"
            placeholder="全部模块"
            clearable
            class="wb-pill-select !w-36"
            @change="searchLogs"
          >
            <el-option label="证书管理 (cert)" value="cert" />
            <el-option label="自动部署 (deploy)" value="deploy" />
            <el-option label="Agent 管控 (agent)" value="agent" />
            <el-option label="云授权 (auth)" value="auth" />
            <el-option label="系统治理 (system)" value="system" />
          </el-select>

          <el-select
            v-model="logQuery.result"
            placeholder="执行结果"
            clearable
            class="wb-pill-select !w-32"
            @change="searchLogs"
          >
            <el-option label="成功" value="SUCCESS" />
            <el-option label="失败" value="FAIL" />
          </el-select>

          <button type="button" class="wb-btn" @click="searchLogs">筛选</button>
          <button
            v-if="logQuery.module || logQuery.result || logQuery.keyword"
            type="button"
            class="wb-row-link"
            @click="resetLogQuery"
          >
            重置
          </button>
        </div>
      </div>

      <div class="wb-panel overflow-hidden px-3 pt-1">
        <el-table v-loading="loadingLogs" :data="logRows" empty-text="暂无操作审计日志">
          <el-table-column label="时间" width="175">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-500">{{ formatDate(row.createdat) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作人 / 角色" width="150">
            <template #default="{ row }">
              <div class="font-medium text-gray-900">{{ row.username }}</div>
              <div class="mono text-[11px] text-gray-400">{{ row.role || '-' }} · {{ row.ip }}</div>
            </template>
          </el-table-column>

          <el-table-column label="模块 / 动作" width="165">
            <template #default="{ row }">
              <div class="mono text-xs font-semibold text-gray-800">{{ row.action }}</div>
              <div class="mono text-[11px] text-gray-400">{{ row.module }} · {{ row.method }}</div>
            </template>
          </el-table-column>

          <el-table-column label="操作目标对象" min-width="190">
            <template #default="{ row }">
              <span class="mono text-xs text-gray-800 break-all">{{ row.target || '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="变更详情与回执" min-width="240">
            <template #default="{ row }">
              <span class="text-xs text-gray-500">{{ row.detail || row.message || '—' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="结果 / 耗时" width="130" align="right">
            <template #default="{ row }">
              <div
                class="wb-state justify-end"
                :class="row.result === 'SUCCESS' ? 'wb-state-ok' : 'wb-state-err'"
              >
                {{ row.result === 'SUCCESS' ? '成功' : '失败' }}
              </div>
              <div class="mono text-[11px] text-gray-400">{{ row.costms || 0 }} ms</div>
            </template>
          </el-table-column>
        </el-table>

        <div class="px-3 py-3.5 flex items-center justify-between">
          <span class="text-xs text-gray-400">共记录 {{ logTotal }} 条合规审计事件</span>
          <el-pagination
            v-model:current-page="logQuery.page"
            v-model:page-size="logQuery.size"
            :total="logTotal"
            :page-sizes="[20, 50, 100]"
            layout="sizes, prev, pager, next"
            small
            @size-change="loadLogs"
            @current-change="loadLogs"
          />
        </div>
      </div>
    </template>

    <!-- 新建/编辑账号弹窗 -->
    <el-dialog
      v-model="userVisible"
      :title="userForm.id ? '编辑账号角色与状态' : '新建平台运维/审计账号'"
      width="460px"
    >
      <el-form label-position="top">
        <el-form-item v-if="!userForm.id" label="登录用户名" required>
          <el-input v-model="userForm.username" class="mono" placeholder="例如：sre_wang" />
        </el-form-item>
        <el-form-item v-if="!userForm.id" label="初始登录密码 (至少 6 位)" required>
          <el-input v-model="userForm.password" type="password" show-password placeholder="设置初始密码" />
        </el-form-item>
        <el-form-item label="显示姓名 / 岗位标识">
          <el-input v-model="userForm.nickname" placeholder="例如：SRE 值班 · 王工" />
        </el-form-item>
        <el-form-item label="分配 RBAC 角色" required>
          <el-select v-model="userForm.roleid" class="w-full" placeholder="请选择角色">
            <el-option v-for="r in roles" :key="r.id" :value="r.id" :label="`${r.name} (${r.code})`" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-select v-model="userForm.status" class="w-full">
            <el-option label="正常启用 (ACTIVE)" value="ACTIVE" />
            <el-option label="停用封禁 (DISABLED)" value="DISABLED" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="userVisible = false">取消</button>
        <button type="button" class="wb-btn wb-btn-primary ml-2" @click="saveUser">
          保存账号
        </button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog v-model="pwdVisible" title="重置账号登录密码" width="420px">
      <el-form label-position="top">
        <div class="text-xs text-gray-600 mb-3">
          正在为账号 <strong class="mono text-gray-900">{{ pwdTarget?.username }}</strong> 重置密码：
        </div>
        <el-form-item label="新登录密码 (至少 6 位)" required>
          <el-input v-model="newPassword" type="password" show-password placeholder="请输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="pwdVisible = false">取消</button>
        <button type="button" class="wb-btn wb-btn-primary ml-2" @click="confirmResetPwd">
          确认重置
        </button>
      </template>
    </el-dialog>

    <!-- 配置角色权限矩阵弹窗 -->
    <el-dialog
      v-model="roleVisible"
      :title="roleForm.id ? `编辑角色权限矩阵 — ${roleForm.name}` : '新建自定义 RBAC 角色'"
      width="680px"
    >
      <el-form label-position="top">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <el-form-item label="角色编码 (Code)" required>
            <el-input
              v-model="roleForm.code"
              :disabled="roleForm.code === 'super'"
              class="mono"
              placeholder="例如：biz_ops"
            />
          </el-form-item>
          <el-form-item label="角色中文名称" required>
            <el-input v-model="roleForm.name" placeholder="例如：业务线证书管理员" />
          </el-form-item>
        </div>

        <el-form-item label="角色职责说明">
          <el-input v-model="roleForm.description" placeholder="说明该角色允许操作的范围" />
        </el-form-item>

        <el-form-item label="细粒度功能与接口权限勾选">
          <div class="w-full border border-[#eceef2] rounded-xl divide-y divide-[#f1f3f6] bg-[#fafbfc]">
            <div
              v-for="group in permCatalog"
              :key="group.module"
              class="p-3 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div class="w-32 shrink-0 font-bold text-xs text-gray-800">
                {{ group.label }}
              </div>
              <el-checkbox-group v-model="roleForm.permissions" class="flex flex-wrap gap-x-4 gap-y-1">
                <el-checkbox
                  v-for="item in group.items"
                  :key="item.key"
                  :value="item.key"
                  :disabled="roleForm.code === 'super'"
                >
                  <span class="text-xs">{{ item.label }}</span>
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <button type="button" class="wb-btn" @click="roleVisible = false">取消</button>
        <button type="button" class="wb-btn wb-btn-primary ml-2" @click="saveRole">
          保存角色权限
        </button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, FullScreen } from '@element-plus/icons-vue'
import { call } from '../api'
import { can } from '../store'
import { formatDate, isFullscreen, toggleFullscreen } from '../utils'

const defaultTab = can('system:user') ? 'users' : can('system:role') ? 'roles' : 'logs'
const activeTab = ref(defaultTab)

const loadingUsers = ref(false)
const userKeyword = ref('')
const users = ref([])
const userVisible = ref(false)
const userForm = reactive({
  id: null,
  username: '',
  password: '',
  nickname: '',
  roleid: null,
  status: 'ACTIVE'
})

const pwdVisible = ref(false)
const pwdTarget = ref(null)
const newPassword = ref('')

const loadingRoles = ref(false)
const roles = ref([])
const permCatalog = ref([])
const roleVisible = ref(false)
const roleForm = reactive({
  id: null,
  code: '',
  name: '',
  description: '',
  permissions: []
})

const loadingLogs = ref(false)
const logRows = ref([])
const logTotal = ref(0)
const logQuery = reactive({
  page: 1,
  size: 20,
  module: '',
  username: '',
  result: '',
  keyword: ''
})

function countPerms(permStr) {
  if (!permStr) return 0
  return String(permStr)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length
}

async function loadUsers() {
  if (!can('system:user')) return
  loadingUsers.value = true
  try {
    users.value =
      (await call('/system/users?keyword=' + encodeURIComponent(userKeyword.value.trim()))) || []
    if (!roles.value.length) {
      roles.value = (await call('/system/roles')) || []
    }
  } catch {
    // handled in call()
  } finally {
    loadingUsers.value = false
  }
}

async function loadRoles() {
  if (!can('system:role') && !can('system:user')) return
  loadingRoles.value = true
  try {
    roles.value = (await call('/system/roles')) || []
    if (can('system:role') && !permCatalog.value.length) {
      permCatalog.value = (await call('/system/permissions')) || []
    }
  } catch {
    // handled in call()
  } finally {
    loadingRoles.value = false
  }
}

async function loadLogs() {
  if (!can('system:log')) return
  loadingLogs.value = true
  try {
    const res = await call('/system/logs', {
      method: 'POST',
      body: { ...logQuery }
    })
    logRows.value = res?.rows || []
    logTotal.value = res?.total || 0
  } catch {
    // handled in call()
  } finally {
    loadingLogs.value = false
  }
}

function switchTab(tab) {
  activeTab.value = tab
  if (tab === 'users') loadUsers()
  if (tab === 'roles') loadRoles()
  if (tab === 'logs') loadLogs()
}

function openUserModal(row = null) {
  if (row) {
    userForm.id = row.id
    userForm.username = row.username
    userForm.password = ''
    userForm.nickname = row.nickname || ''
    userForm.roleid = row.roleid
    userForm.status = row.status || 'ACTIVE'
  } else {
    userForm.id = null
    userForm.username = ''
    userForm.password = ''
    userForm.nickname = ''
    userForm.roleid = roles.value[0]?.id || null
    userForm.status = 'ACTIVE'
  }
  userVisible.value = true
}

async function saveUser() {
  if (!userForm.roleid) {
    ElMessage.warning('请为用户分配角色')
    return
  }
  if (!userForm.id && (!userForm.username.trim() || !userForm.password)) {
    ElMessage.warning('请填写登录用户名与初始密码')
    return
  }
  try {
    await call('/system/user/save', {
      method: 'POST',
      body: {
        id: userForm.id || undefined,
        username: userForm.username.trim(),
        password: userForm.password || undefined,
        nickname: userForm.nickname.trim(),
        roleid: userForm.roleid,
        status: userForm.status
      }
    })
    ElMessage.success(userForm.id ? '用户已更新' : '新账号已创建')
    userVisible.value = false
    await loadUsers()
  } catch {
    // handled in call()
  }
}

function openResetPwd(row) {
  pwdTarget.value = row
  newPassword.value = ''
  pwdVisible.value = true
}

async function confirmResetPwd() {
  if (!newPassword.value || newPassword.value.length < 6) {
    ElMessage.warning('新密码长度至少 6 位')
    return
  }
  try {
    await call('/system/user/resetPassword', {
      method: 'POST',
      body: { id: pwdTarget.value.id, password: newPassword.value }
    })
    ElMessage.success('密码重置成功')
    pwdVisible.value = false
  } catch {
    // handled in call()
  }
}

async function deleteUser(row) {
  await ElMessageBox.confirm(`确认删除账号「${row.username}」吗？`, '删除账号确认', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消'
  })
  try {
    await call('/system/user/delete', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('账号已删除')
    await loadUsers()
  } catch {
    // handled in call()
  }
}

async function openRoleModal(row = null) {
  if (!permCatalog.value.length) {
    try {
      permCatalog.value = (await call('/system/permissions')) || []
    } catch {
      // handled in call()
    }
  }
  if (row) {
    roleForm.id = row.id
    roleForm.code = row.code
    roleForm.name = row.name
    roleForm.description = row.description || ''
    roleForm.permissions = row.permissions
      ? String(row.permissions)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  } else {
    roleForm.id = null
    roleForm.code = ''
    roleForm.name = ''
    roleForm.description = ''
    roleForm.permissions = ['dashboard:view', 'cert:view']
  }
  roleVisible.value = true
}

async function saveRole() {
  if (!roleForm.code.trim() || !roleForm.name.trim()) {
    ElMessage.warning('请填写角色编码和名称')
    return
  }
  try {
    await call('/system/role/save', {
      method: 'POST',
      body: {
        id: roleForm.id || undefined,
        code: roleForm.code.trim(),
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permissions: roleForm.permissions
      }
    })
    ElMessage.success('角色权限矩阵已保存')
    roleVisible.value = false
    await loadRoles()
  } catch {
    // handled in call()
  }
}

async function deleteRole(row) {
  await ElMessageBox.confirm(`确认删除角色「${row.name}」吗？`, '删除角色确认', {
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消'
  })
  try {
    await call('/system/role/delete', {
      method: 'POST',
      body: { id: row.id }
    })
    ElMessage.success('角色已删除')
    await loadRoles()
  } catch {
    // handled in call()
  }
}

function searchLogs() {
  logQuery.page = 1
  loadLogs()
}

function resetLogQuery() {
  logQuery.module = ''
  logQuery.username = ''
  logQuery.result = ''
  logQuery.keyword = ''
  logQuery.page = 1
  loadLogs()
}

onMounted(() => {
  switchTab(activeTab.value)
})
</script>
