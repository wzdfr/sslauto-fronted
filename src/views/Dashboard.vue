<template>
  <div class="workbench-home" v-loading="loading">
    <!-- 中央交互主工作区（对齐参考图 2 中央画布 + 底部悬浮模式栏） -->
    <div class="center-stage">
      <!-- 顶部单行控制条 -->
      <div class="stage-topbar">
        <div class="topbar-pill-banner">
          <span class="banner-text">自动续期窗口 · 到期前 {{ clmPolicy.autoRenewDaysBefore }} 天</span>
          <button
            v-if="can('cert:apply')"
            type="button"
            class="banner-cta"
            @click="router.push('/cert/apply')"
          >
            申请新证书
          </button>
        </div>

        <div class="stage-center-heading">
          <span class="heading-strong">TLS 生命周期中枢</span>
          <span class="heading-sub">多域名 · 多服务器 · 多环境闭环</span>
        </div>

        <div class="stage-right-btns">
          <button type="button" class="wb-btn wb-btn-primary" @click="router.push('/probe')">
            <el-icon><Aim /></el-icon>
            <span>真机拨测</span>
          </button>
          <button type="button" class="wb-btn" @click="loadAll">
            <el-icon><Refresh /></el-icon>
            <span>刷新</span>
          </button>
          <button type="button" class="wb-btn" @click="toggleFullscreen">
            <el-icon><FullScreen /></el-icon>
            <span>{{ isFullscreen ? '退出全屏' : '大屏全屏' }}</span>
          </button>
        </div>
      </div>

      <!-- 主黑板与全景画布容器 -->
      <div class="board-card">
        <!-- 顶部三联中枢黑板区（左：签发机构分布 | 中：深色中枢黑板+倒计时 | 右：近期临期预警） -->
        <div class="blackboard-zone">
          <!-- 左小卡：CA 品牌健康分布 -->
          <div class="side-mini-card">
            <div class="mini-card-title">签发通道分布</div>
            <div class="mini-card-line accent-amber" />
            <div class="mini-list">
              <div v-for="(item, idx) in topBrandRows" :key="item.label" class="mini-row">
                <div class="mini-row-left">
                  <span :class="['mini-dot', idx === 0 ? 'dot-gold' : idx === 1 ? 'dot-silver' : 'dot-bronze']" />
                  <span class="mini-name">{{ item.label }}</span>
                </div>
                <span class="mini-val mono">{{ item.count }} 张</span>
              </div>
              <div v-if="!topBrandRows.length" class="mini-empty">暂无签发证书</div>
            </div>
          </div>

          <!-- 中央深色黑板大屏（致敬参考图 2 的标志性黑板与蓝卡倒计时） -->
          <div class="dark-blackboard">
            <div class="board-col">
              <div class="board-col-title">安全护栏策略</div>
              <div class="board-grid-items">
                <span>1 DNS-01 自动续签</span>
                <span>2 写前配置备份</span>
                <span>3 nginx -t 预检</span>
                <span>4 异常秒级回滚</span>
                <span>5 443 真机核验</span>
                <span>6 RBAC 审计留痕</span>
              </div>
            </div>

            <div class="board-countdown-card">
              <div class="cd-top">{{ nearestCertTitle }}</div>
              <div class="cd-main">
                <span class="cd-prefix">{{ nearestDays !== null && nearestDays < 0 ? '已逾期' : '距最近到期' }}</span>
                <span class="cd-num mono">{{ nearestDays !== null ? Math.abs(nearestDays) : '--' }}</span>
                <span class="cd-unit">天</span>
              </div>
              <div class="cd-foot mono">{{ nearestCertDate }}</div>
            </div>

            <div class="board-col">
              <div class="board-col-title">今日值班焦点</div>
              <div class="board-focus-list">
                <div>30天内临期：{{ s.certExpiring || 0 }} 张</div>
                <div>待验证订单：{{ waitDnsCount }} 笔</div>
                <div>待接管站点：{{ untakenSiteCount }} 个</div>
              </div>
            </div>
          </div>

          <!-- 右小卡：近期到期关注 -->
          <div class="side-mini-card">
            <div class="mini-card-title">近期临期证书</div>
            <div class="mini-card-line accent-red" />
            <div class="mini-list">
              <div
                v-for="cert in watchCerts.slice(0, 3)"
                :key="cert.id"
                class="mini-row clickable"
                @click="router.push('/cert/assets/' + cert.id)"
              >
                <div class="mini-row-left">
                  <span :class="['mini-dot', miniCertDotClass(cert)]" />
                  <span class="mini-name">{{ parseDomains(cert.domains)[0] || cert.name }}</span>
                </div>
                <span class="mini-val mono">{{ miniCertDays(cert) }}</span>
              </div>
              <div v-if="!watchCerts.length" class="mini-empty">当前无纳管资产</div>
            </div>
          </div>
        </div>

        <!-- 值班长席位徽标条 -->
        <div class="operator-podium">
          <div class="podium-badge">
            <span class="podium-dot" />
            <span>{{ currentUser.nickname || currentUser.username || '管理员' }} · {{ currentUser.roleName || '值班中枢' }}</span>
          </div>
        </div>

        <!-- 模式 1：全景矩阵（域名证书座位阵列 + 8 大生命周期闭环） -->
        <template v-if="boardMode === 'matrix'">
          <div v-if="certList.length" class="asset-seat-grid">
            <button
              v-for="item in certList.slice(0, 16)"
              :key="item.id"
              type="button"
              class="seat-card"
              @click="router.push('/cert/assets/' + item.id)"
            >
              <div class="seat-domain">{{ item.name || parseDomains(item.domains)[0] }}</div>
              <div class="seat-desk">
                <span :class="['seat-status-bar', seatBarClass(item)]" />
                <div class="seat-avatar">
                  <span>{{ (parseDomains(item.domains)[0] || 'S').replace(/^\*\./, '').slice(0, 1).toUpperCase() }}</span>
                </div>
                <span class="seat-ver mono">v{{ item.version || 1 }}</span>
              </div>
              <div class="seat-foot mono">
                <span>{{ parseDomains(item.domains)[0] || '-' }}</span>
                <span :class="seatDaysClass(item)">{{ miniCertDays(item) }}</span>
              </div>
            </button>
          </div>

          <!-- 8 大 CLM 能力模块矩阵（资产为空时主展示，有资产时作为底部快捷底座） -->
          <div class="clm-dock-grid">
            <button
              v-for="stage in lifecycleStages"
              :key="stage.step"
              type="button"
              class="clm-dock-card"
              @click="router.push(stage.route)"
            >
              <div class="clm-dock-top">
                <span class="clm-step mono">{{ stage.step }}</span>
                <span class="clm-metric mono">{{ stage.metric }}</span>
              </div>
              <div class="clm-name">{{ stage.name }}</div>
              <div class="clm-desc">{{ stage.desc }}</div>
            </button>
          </div>
        </template>

        <!-- 模式 2：数据分析（1:1 对齐参考图 3 的 5 KPI 卡 + 双柱状图） -->
        <template v-else-if="boardMode === 'analytics'">
          <div class="analytics-kpi-row">
            <div class="ana-kpi-card" @click="router.push('/cert/assets')">
              <div class="ana-kpi-label">受管证书总量</div>
              <div class="ana-kpi-val mono">
                {{ s.certTotal || 0 }}<span class="ana-kpi-sub"> 张</span>
              </div>
              <div class="ana-kpi-foot">已签发有效 {{ s.certIssued || 0 }} 张</div>
            </div>

            <div class="ana-kpi-card" @click="router.push('/cert')">
              <div class="ana-kpi-label">有效签发率</div>
              <div class="ana-kpi-val mono">{{ issuedRate }}%</div>
              <div class="ana-kpi-foot">ACME 与私有 CA 正常率</div>
            </div>

            <div class="ana-kpi-card" @click="router.push('/cert/assets?status=EXPIRING')">
              <div class="ana-kpi-label">30天内临期</div>
              <div :class="['ana-kpi-val mono', (s.certExpiring || 0) > 0 ? 'text-amber-600' : '']">
                {{ s.certExpiring || 0 }}
              </div>
              <div class="ana-kpi-foot">到期前自动发起续签</div>
            </div>

            <div class="ana-kpi-card" @click="router.push('/deploy')">
              <div class="ana-kpi-label">部署达成率</div>
              <div class="ana-kpi-val mono">{{ deployRate }}%</div>
              <div class="ana-kpi-foot">{{ s.deploySuccess || 0 }}/{{ s.deployTotal || 0 }} 节点已对齐</div>
            </div>

            <div class="ana-kpi-card" @click="router.push('/agent')">
              <div class="ana-kpi-label">在线 Agent 节点</div>
              <div class="ana-kpi-val mono">
                {{ s.serverOnline || 0 }}<span class="ana-kpi-sub">/{{ s.serverTotal || 0 }}</span>
              </div>
              <div class="ana-kpi-foot">发现 Web 站点 {{ s.siteTotal || 0 }} 个</div>
            </div>
          </div>

          <div class="analytics-charts-row">
            <!-- 左柱状图：各签发机构证书数量 -->
            <div class="chart-card">
              <div class="chart-head">
                <div class="chart-title">各签发机构 (CA) 资产分布</div>
                <div class="chart-sub">按当前平台已纳管证书品牌统计</div>
              </div>
              <div class="bar-chart-stage">
                <div v-for="b in brandChartBars" :key="b.code" class="bar-col">
                  <div class="bar-track">
                    <div class="bar-fill" :style="{ height: b.heightPct + '%' }">
                      <span class="bar-top-val mono">{{ b.count }}</span>
                    </div>
                  </div>
                  <div class="bar-x-label">{{ b.shortLabel }}</div>
                </div>
              </div>
            </div>

            <!-- 右柱状图：证书剩余有效期分段 -->
            <div class="chart-card">
              <div class="chart-head">
                <div class="chart-title">证书剩余有效期分段统计</div>
                <div class="chart-sub">按到期紧迫度划分生命周期健康区间</div>
              </div>
              <div class="bar-chart-stage">
                <div v-for="seg in expiryChartBars" :key="seg.label" class="bar-col">
                  <div class="bar-track">
                    <div
                      :class="['bar-fill', seg.barClass]"
                      :style="{ height: seg.heightPct + '%' }"
                    >
                      <span class="bar-top-val mono">{{ seg.count }}</span>
                    </div>
                  </div>
                  <div class="bar-x-label">{{ seg.label }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 模式 3：临期与异常重点台账 -->
        <template v-else-if="boardMode === 'expiring'">
          <div class="mode-table-wrap">
            <el-table :data="watchCerts" empty-text="当前无即将到期或异常证书">
              <el-table-column label="证书名称 / 主域名" min-width="210">
                <template #default="{ row }">
                  <div class="font-semibold text-gray-900">{{ row.name || parseDomains(row.domains)[0] }}</div>
                  <div class="mono text-xs text-gray-400 mt-0.5">{{ parseDomains(row.domains)[0] || '-' }}</div>
                </template>
              </el-table-column>
              <el-table-column label="签发 CA / 版本" width="160">
                <template #default="{ row }">
                  <div class="text-gray-800">{{ brandLabel(row.brand) }}</div>
                  <div class="mono text-xs text-gray-400">v{{ row.version || 1 }} · {{ envShortLabel(row.env) }}</div>
                </template>
              </el-table-column>
              <el-table-column label="剩余窗口" width="140">
                <template #default="{ row }">
                  <span :class="['wb-state mono', watchStateClass(row)]">{{ watchStateText(row) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="160" align="right">
                <template #default="{ row }">
                  <div class="inline-flex items-center gap-2">
                    <button
                      v-if="row.status === 'ISSUED' && row.brand !== 'UPLOAD' && can('cert:renew')"
                      type="button"
                      class="wb-row-btn"
                      @click="quickRenew(row)"
                    >
                      立即续期
                    </button>
                    <button
                      type="button"
                      class="wb-row-btn"
                      @click="router.push('/cert/assets/' + row.id)"
                    >
                      资产档案
                    </button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- 模式 4：自动化任务流水 -->
        <template v-else>
          <div class="mode-table-wrap">
            <el-table :data="logs.slice(0, 10)" empty-text="暂无自动化任务执行流水">
              <el-table-column label="执行时间" width="165">
                <template #default="{ row }">
                  <span class="mono text-xs text-gray-500">{{ fmt(row.CREATEDAT) }}</span>
                </template>
              </el-table-column>
              <el-table-column label="模块 / 动作" width="150">
                <template #default="{ row }">
                  <span :class="['wb-state', logStateClass(row.LOGLEVEL, row.ACTION)]">
                    {{ row.BIZTYPE }} · {{ row.ACTION }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="MESSAGE" label="流水说明" min-width="220" show-overflow-tooltip />
            </el-table>
          </div>
        </template>
      </div>

      <!-- 底部悬浮模式切换胶囊（1:1 致敬参考图 2 底部「日常 | 考勤 | 点评 | 成绩 | 排座」） -->
      <div class="floating-dock-wrap">
        <div class="floating-dock">
          <button
            v-for="m in boardModes"
            :key="m.id"
            type="button"
            :class="['dock-btn', { active: boardMode === m.id }]"
            @click="boardMode = m.id"
          >
            {{ m.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 右侧今日值班与待办侧栏（1:1 对齐参考图 2 右侧白底概览栏） -->
    <aside class="right-ops-rail">
      <div class="rail-scroll">
        <!-- 今天日期头 -->
        <div class="rail-section">
          <div class="rail-top-row">
            <span class="rail-kicker">今天</span>
            <button type="button" class="wb-row-btn !h-7" @click="toggleFullscreen">
              <el-icon><FullScreen /></el-icon>
              <span>全屏</span>
            </button>
          </div>
          <div class="rail-date-title">{{ todayFullTitle }}</div>
          <div class="rail-date-sub">TLS 自动化巡检中 · 提前 {{ clmPolicy.autoRenewDaysBefore }} 天续期</div>

          <!-- 三格核心指标胶囊 -->
          <div class="rail-stat-trio">
            <div class="trio-cell" @click="router.push('/cert/assets')">
              <div class="trio-num mono">{{ s.certTotal || 0 }}</div>
              <div class="trio-lbl">在管证书</div>
            </div>
            <div class="trio-cell" @click="router.push('/agent')">
              <div class="trio-num mono">{{ s.serverOnline || 0 }}</div>
              <div class="trio-lbl">在线节点</div>
            </div>
            <div class="trio-cell" @click="router.push('/deploy')">
              <div class="trio-num mono">{{ s.deployTotal || 0 }}</div>
              <div class="trio-lbl">自动部署</div>
            </div>
          </div>
        </div>

        <!-- 部署健康度进度条 -->
        <div class="rail-section">
          <div class="rail-sec-head">
            <span class="rail-sec-title">部署同步状态</span>
            <button type="button" class="rail-link" @click="router.push('/deploy')">去编排</button>
          </div>
          <div class="rail-big-figure mono">
            <strong>{{ s.deploySuccess || 0 }}</strong>
            <span> / {{ s.deployTotal || 0 }} 任务正常</span>
          </div>
          <div class="rail-progress-bar">
            <span class="prog-ok" :style="{ width: deployRate + '%' }" />
            <span v-if="failedDeployCount > 0" class="prog-err" style="width: 12%" />
          </div>
          <div class="rail-sub-note">
            临期 {{ s.certExpiring || 0 }} · 部署异常 {{ failedDeployCount }} · 待接管 {{ untakenSiteCount }}
          </div>

          <!-- 系统自动发现的异常告警快捷处置 -->
          <div v-if="systemAlertItems.length" class="rail-alert-list">
            <div
              v-for="al in systemAlertItems"
              :key="al.key"
              class="rail-alert-item"
              @click="router.push(al.route)"
            >
              <div class="rail-alert-left">
                <span class="alert-avatar">!</span>
                <span class="alert-text">{{ al.shortTitle }}</span>
              </div>
              <span :class="['alert-tag', al.tagClass]">{{ al.badge }}</span>
            </div>
          </div>
        </div>

        <!-- 最近临期提醒 -->
        <div v-if="watchCerts.length" class="rail-section">
          <div class="rail-sec-head">
            <span class="rail-sec-title">优先关注证书</span>
            <button type="button" class="rail-link" @click="router.push('/cert/assets')">全部</button>
          </div>
          <div class="nearest-cert-row">
            <div class="nearest-meta">
              <div class="nearest-name">{{ watchCerts[0].name || parseDomains(watchCerts[0].domains)[0] }}</div>
              <div class="nearest-sub mono">{{ watchStateText(watchCerts[0]) }}</div>
            </div>
            <button
              type="button"
              class="wb-row-btn"
              @click="router.push('/cert/assets/' + watchCerts[0].id)"
            >
              查看档案
            </button>
          </div>
        </div>

        <!-- 值班待办清单 -->
        <div class="rail-section no-border">
          <div class="rail-sec-head">
            <span class="rail-sec-title">待办</span>
          </div>
          <div class="rail-todo-list">
            <div
              v-for="todo in shiftTodos"
              :key="todo.id"
              class="rail-todo-row"
            >
              <label class="rail-todo-label">
                <input
                  type="checkbox"
                  :checked="todo.done"
                  class="todo-checkbox"
                  @change="toggleShiftTodo(todo.id)"
                />
                <span :class="['rail-todo-text', { done: todo.done }]">{{ todo.text }}</span>
              </label>
              <button
                type="button"
                class="todo-del-btn"
                title="移除"
                @click="removeShiftTodo(todo.id)"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部固定新增待办输入框（对齐参考图 2 右下角「添加一件要做的事 +」） -->
      <div class="rail-bottom-add">
        <input
          v-model="railTodoInput"
          type="text"
          class="rail-add-input"
          placeholder="添加一件运维待办..."
          @keyup.enter="submitRailTodo"
        />
        <button type="button" class="rail-add-btn" aria-label="添加待办" @click="submitRailTodo">
          +
        </button>
      </div>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Aim, Refresh, FullScreen } from '@element-plus/icons-vue'
import { api } from '../api'
import {
  can,
  currentUser,
  clmPolicy,
  setSidebarSummary,
  shiftTodos,
  addShiftTodo,
  toggleShiftTodo,
  removeShiftTodo
} from '../store'
import {
  formatDate,
  formatDay,
  parseDomains,
  calcDaysDiff,
  brandLabel,
  envShortLabel,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const router = useRouter()
const loading = ref(false)
const boardMode = ref('matrix')
const railTodoInput = ref('')

const s = ref({})
const logs = ref([])
const certList = ref([])
const deployList = ref([])
const siteList = ref([])
const fmt = formatDate

const boardModes = [
  { id: 'matrix', label: '全景矩阵' },
  { id: 'analytics', label: '态势图表' },
  { id: 'expiring', label: '临期台账' },
  { id: 'logs', label: '任务流水' }
]

const todayFullTitle = computed(() => {
  const d = new Date()
  const weeks = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getMonth() + 1}月${d.getDate()}日 ${weeks[d.getDay()]}`
})

const untakenSiteCount = computed(() => siteList.value.filter((x) => !x.takenover).length)
const failedDeployCount = computed(() => deployList.value.filter((d) => d.status === 'FAILED').length)
const waitDnsCount = computed(() => certList.value.filter((c) => c.status === 'WAIT_DNS').length)
const failedCertCount = computed(() => certList.value.filter((c) => c.status === 'FAILED').length)

const issuedRate = computed(() => {
  const tot = Number(s.value.certTotal || 0)
  if (!tot) return 100
  return Math.round(((Number(s.value.certIssued || 0) / tot) * 100))
})

const deployRate = computed(() => {
  const tot = Number(s.value.deployTotal || 0)
  if (!tot) return 100
  return Math.min(100, Math.round((Number(s.value.deploySuccess || 0) / tot) * 100))
})

const watchCerts = computed(() => {
  const copy = [...certList.value]
  copy.sort((a, b) => {
    const score = (c) => {
      if (c.status === 'FAILED') return -10000
      if (c.status === 'WAIT_DNS') return -5000
      const d = calcDaysDiff(c.notafter)
      return d === null ? 9999 : d
    }
    return score(a) - score(b)
  })
  return copy.slice(0, 8)
})

const nearestCert = computed(() => {
  const issuedWithDate = certList.value
    .filter((c) => c.notafter)
    .sort((a, b) => (calcDaysDiff(a.notafter) ?? 9999) - (calcDaysDiff(b.notafter) ?? 9999))
  return issuedWithDate[0] || null
})

const nearestDays = computed(() =>
  nearestCert.value ? calcDaysDiff(nearestCert.value.notafter) : null
)

const nearestCertTitle = computed(() => {
  if (!nearestCert.value) return '暂无待到期证书'
  return parseDomains(nearestCert.value.domains)[0] || nearestCert.value.name
})

const nearestCertDate = computed(() => {
  if (!nearestCert.value) return '申请或导入证书后自动开启倒计时监控'
  return `${formatDay(nearestCert.value.notafter)} 到期`
})

const topBrandRows = computed(() => {
  const counts = {}
  certList.value.forEach((c) => {
    const key = c.brand || 'LETSENCRYPT'
    counts[key] = (counts[key] || 0) + 1
  })
  return Object.entries(counts)
    .map(([code, count]) => ({ label: brandLabel(code), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
})

const brandChartBars = computed(() => {
  const defs = [
    { code: 'LETSENCRYPT', shortLabel: "Let's Encrypt" },
    { code: 'GOOGLE', shortLabel: 'Google' },
    { code: 'ZEROSSL', shortLabel: 'ZeroSSL' },
    { code: 'LITESSL', shortLabel: 'LiteSSL' },
    { code: 'INTERNAL', shortLabel: '私有 CA' },
    { code: 'UPLOAD', shortLabel: '商业导入' }
  ]
  const counts = defs.map((d) => ({
    ...d,
    count: certList.value.filter((c) => c.brand === d.code).length
  }))
  const max = Math.max(1, ...counts.map((x) => x.count))
  return counts.map((x) => ({
    ...x,
    heightPct: x.count === 0 ? 6 : Math.max(16, Math.round((x.count / max) * 86))
  }))
})

const expiryChartBars = computed(() => {
  const buckets = [
    { label: '≤7天高危', count: 0, barClass: 'bar-danger' },
    { label: '8-30天临期', count: 0, barClass: 'bar-warn' },
    { label: '31-60天', count: 0, barClass: '' },
    { label: '61-90天', count: 0, barClass: '' },
    { label: '>90天长效', count: 0, barClass: '' }
  ]
  certList.value.forEach((c) => {
    const d = calcDaysDiff(c.notafter)
    if (d === null) return
    if (d <= 7) buckets[0].count++
    else if (d <= 30) buckets[1].count++
    else if (d <= 60) buckets[2].count++
    else if (d <= 90) buckets[3].count++
    else buckets[4].count++
  })
  const max = Math.max(1, ...buckets.map((b) => b.count))
  return buckets.map((b) => ({
    ...b,
    heightPct: b.count === 0 ? 6 : Math.max(16, Math.round((b.count / max) * 86))
  }))
})

const systemAlertItems = computed(() => {
  const list = []
  if (failedCertCount.value > 0) {
    list.push({
      key: 'cf',
      shortTitle: `${failedCertCount.value} 张证书签发/续期失败`,
      badge: '续期失败',
      tagClass: 'tag-red',
      route: '/cert'
    })
  }
  if (failedDeployCount.value > 0) {
    list.push({
      key: 'df',
      shortTitle: `${failedDeployCount.value} 个节点部署异常`,
      badge: '部署滞后',
      tagClass: 'tag-amber',
      route: '/deploy'
    })
  }
  if (waitDnsCount.value > 0) {
    list.push({
      key: 'wd',
      shortTitle: `${waitDnsCount.value} 笔订单待配置 TXT`,
      badge: '待验证',
      tagClass: 'tag-blue',
      route: '/cert'
    })
  }
  if (untakenSiteCount.value > 0) {
    list.push({
      key: 'ut',
      shortTitle: `${untakenSiteCount.value} 个扫描站点待接管`,
      badge: '待纳管',
      tagClass: 'tag-amber',
      route: '/agent'
    })
  }
  return list
})

const lifecycleStages = computed(() => [
  {
    step: '01',
    name: '证书资产发现',
    metric: `${s.value.siteTotal || 0} 站点`,
    desc: '扫描公网端口与服务器站点，消除野证书',
    route: '/probe'
  },
  {
    step: '02',
    name: '统一资产档案',
    metric: `${s.value.certTotal || 0} 台账`,
    desc: '汇聚域名、CA、环境与责任人集中治理',
    route: '/cert/assets'
  },
  {
    step: '03',
    name: '自动申请续期',
    metric: `${s.value.certIssued || 0} 有效`,
    desc: 'ACME 自动 DNS-01 验证与提前续签重试',
    route: '/cert'
  },
  {
    step: '04',
    name: '自动部署编排',
    metric: `${s.value.deploySuccess || 0}/${s.value.deployTotal || 0}`,
    desc: '写前快照备份、nginx -t 预检与回滚保护',
    route: '/deploy'
  }
])

function miniCertDays(cert) {
  if (cert.status === 'FAILED') return '异常'
  if (cert.status === 'WAIT_DNS') return '待验证'
  const d = calcDaysDiff(cert.notafter)
  if (d === null) return '-'
  if (d < 0) return `逾期${-d}d`
  return `${d}天`
}

function miniCertDotClass(cert) {
  if (cert.status === 'FAILED') return 'dot-red'
  const d = calcDaysDiff(cert.notafter)
  if (d !== null && d <= 30) return 'dot-amber'
  return 'dot-green'
}

function seatBarClass(cert) {
  if (cert.status === 'FAILED') return 'bar-red'
  if (cert.status === 'WAIT_DNS') return 'bar-amber'
  const d = calcDaysDiff(cert.notafter)
  if (d !== null && d <= 30) return 'bar-amber'
  return 'bar-green'
}

function seatDaysClass(cert) {
  if (cert.status === 'FAILED') return 'text-red-600 font-semibold'
  const d = calcDaysDiff(cert.notafter)
  if (d !== null && d <= 7) return 'text-red-600 font-semibold'
  if (d !== null && d <= 30) return 'text-amber-600 font-semibold'
  return 'text-gray-400'
}

function watchStateClass(row) {
  if (row.status === 'FAILED') return 'wb-state-err'
  if (row.status === 'WAIT_DNS') return 'wb-state-warn'
  const d = calcDaysDiff(row.notafter)
  if (d === null) return 'wb-state-neutral'
  if (d < 0) return 'wb-state-err'
  if (d <= 30) return 'wb-state-warn'
  return 'wb-state-ok'
}

function watchStateText(row) {
  if (row.status === 'FAILED') return '签发/续期失败'
  if (row.status === 'WAIT_DNS') return '等待 DNS 验证'
  const d = calcDaysDiff(row.notafter)
  if (d === null) return row.status
  if (d < 0) return `已过期 ${-d} 天`
  return `剩余 ${d} 天`
}

function logStateClass(level, action) {
  const lv = String(level || '').toUpperCase()
  const act = String(action || '').toUpperCase()
  if (lv === 'ERROR' || act.includes('FAIL')) return 'wb-state-err'
  if (lv === 'WARN') return 'wb-state-warn'
  return 'wb-state-ok'
}

function submitRailTodo() {
  if (!railTodoInput.value.trim()) return
  addShiftTodo(railTodoInput.value)
  railTodoInput.value = ''
}

async function quickRenew(row) {
  await ElMessageBox.confirm(
    `确认立即续期「${row.name || parseDomains(row.domains)[0]}」？续期成功后版本号将自动递增并同步关联服务器。`,
    '立即续期确认',
    { type: 'warning' }
  )
  try {
    await api('/cert/renew', { method: 'POST', body: { id: row.id } })
    ElMessage.success('证书续期成功，关联在线节点已触发同步')
    loadAll()
  } catch (e) {
    ElMessage.error(e.message)
  }
}

async function loadAll() {
  loading.value = true
  try {
    const tasks = [
      api('/dashboard/summary').catch(() => ({})),
      api('/dashboard/logs').catch(() => []),
      can('cert') ? api('/cert/list?keyword=').catch(() => []) : Promise.resolve([]),
      can('deploy') ? api('/deploy/list').catch(() => []) : Promise.resolve([]),
      can('agent') ? api('/agent/sites').catch(() => []) : Promise.resolve([])
    ]
    const [sumData, logData, certsData, deploysData, sitesData] = await Promise.all(tasks)
    s.value = sumData || {}
    setSidebarSummary(s.value)
    logs.value = logData || []
    certList.value = certsData || []
    deployList.value = deploysData || []
    siteList.value = sitesData || []
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.workbench-home {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 292px;
}

@media (max-width: 1200px) {
  .workbench-home {
    grid-template-columns: 1fr;
  }
}

/* 中央交互主工作台 */
.center-stage {
  padding: 18px 22px 26px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
}

.stage-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.topbar-pill-banner {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #eff1f5;
  padding: 4px 5px 4px 12px;
  border-radius: 999px;
}

.banner-text {
  font-size: 12px;
  color: #6b7280;
}

.banner-cta {
  height: 26px;
  padding: 0 11px;
  border-radius: 999px;
  border: none;
  background: var(--wb-primary);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}

.stage-center-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.heading-strong {
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.heading-sub {
  font-size: 12.5px;
  color: #9ca3af;
}

.stage-right-btns {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 主白板卡片 */
.board-card {
  flex: 1;
  background: #ffffff;
  border: 1px solid var(--wb-border);
  border-radius: 20px;
  padding: 20px 22px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* 顶部三联黑板区 */
.blackboard-zone {
  display: grid;
  grid-template-columns: 186px minmax(0, 1fr) 196px;
  gap: 16px;
  align-items: stretch;
}

@media (max-width: 1024px) {
  .blackboard-zone {
    grid-template-columns: 1fr;
  }
}

.side-mini-card {
  border: 1px solid #eceef2;
  border-radius: 14px;
  padding: 12px 14px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
}

.mini-card-title {
  font-size: 12px;
  font-weight: 700;
  color: #111827;
}

.mini-card-line {
  height: 2px;
  border-radius: 2px;
  margin: 6px 0 8px;
}

.accent-amber {
  background: #f59e0b;
}

.accent-red {
  background: #ef4444;
}

.mini-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.mini-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.mini-row.clickable {
  cursor: pointer;
}

.mini-row.clickable:hover .mini-name {
  color: var(--wb-chart);
}

.mini-row-left {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.mini-name {
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-val {
  color: #9ca3af;
  font-size: 11.5px;
  flex-shrink: 0;
}

.mini-empty {
  font-size: 11.5px;
  color: #9ca3af;
  padding: 8px 0;
}

.mini-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

.dot-gold { background: #f59e0b; }
.dot-silver { background: #9ca3af; }
.dot-bronze { background: #d97706; }
.dot-red { background: #ef4444; }
.dot-amber { background: #f59e0b; }
.dot-green { background: #10b981; }

/* 中央深色黑板 */
.dark-blackboard {
  background: #232733;
  color: #e5e7eb;
  border-radius: 16px;
  padding: 12px 16px;
  display: grid;
  grid-template-columns: 1fr 188px 1fr;
  gap: 14px;
  align-items: center;
  box-shadow: 0 6px 18px rgba(17, 24, 39, 0.08);
}

@media (max-width: 760px) {
  .dark-blackboard {
    grid-template-columns: 1fr;
  }
}

.board-col {
  min-width: 0;
}

.board-col-title {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 7px;
}

.board-grid-items {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 8px;
  font-size: 11.5px;
  color: #d1d5db;
}

.board-focus-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 11.5px;
  color: #d1d5db;
}

.board-countdown-card {
  background: var(--wb-board-accent);
  color: #ffffff;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: center;
}

.cd-top {
  font-size: 11px;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cd-main {
  margin: 4px 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.cd-prefix,
.cd-unit {
  font-size: 11px;
  opacity: 0.92;
}

.cd-num {
  font-size: 30px;
  font-weight: 800;
  line-height: 1.05;
}

.cd-foot {
  font-size: 10.5px;
  opacity: 0.85;
}

/* 值班席位条 */
.operator-podium {
  display: flex;
  justify-content: center;
}

.podium-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 16px;
  border-radius: 999px;
  border: 1px solid #eceef2;
  background: #fafbfc;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.podium-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #10b981;
}

/* 资产矩阵座位卡片 */
.asset-seat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(175px, 1fr));
  gap: 12px;
}

.seat-card {
  border: 1px solid #eceef2;
  background: #fcfcfd;
  border-radius: 14px;
  padding: 11px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.seat-card:hover {
  background: #ffffff;
  border-color: #cbd5e1;
  transform: translateY(-1px);
}

.seat-domain {
  font-size: 12.5px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seat-desk {
  background: #ffffff;
  border: 1px solid #eef0f4;
  border-radius: 10px;
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.seat-status-bar {
  width: 14px;
  height: 18px;
  border-radius: 4px;
}

.bar-green { background: #dcfce7; border: 1px solid #86efac; }
.bar-amber { background: #fef3c7; border: 1px solid #fcd34d; }
.bar-red { background: #fee2e2; border: 1px solid #fca5a5; }

.seat-avatar {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #18181b;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.seat-ver {
  font-size: 11px;
  color: #9ca3af;
}

.seat-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.seat-foot > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 4 格 CLM 能力底座 */
.clm-dock-grid {
  margin-top: auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 900px) {
  .clm-dock-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.clm-dock-card {
  border: 1px solid #eef0f4;
  background: #fafbfc;
  border-radius: 12px;
  padding: 12px 14px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clm-dock-card:hover {
  background: #ffffff;
  border-color: #d1d5db;
}

.clm-dock-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.clm-step {
  color: var(--wb-chart);
  font-weight: 700;
}

.clm-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}

.clm-desc {
  margin-top: 2px;
  font-size: 11.5px;
  color: #6b7280;
  line-height: 1.4;
}

/* 数据分析视图（参考图 3 风格） */
.analytics-kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

@media (max-width: 1024px) {
  .analytics-kpi-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.ana-kpi-card {
  border: 1px solid #eceef2;
  background: #ffffff;
  border-radius: 16px;
  padding: 16px 18px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.ana-kpi-card:hover {
  border-color: #cbd5e1;
}

.ana-kpi-label {
  font-size: 12px;
  color: #8c95a4;
}

.ana-kpi-val {
  margin-top: 6px;
  font-size: 26px;
  font-weight: 800;
  color: #111827;
  line-height: 1.15;
}

.ana-kpi-sub {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
}

.ana-kpi-foot {
  margin-top: 6px;
  font-size: 11.5px;
  color: #8c95a4;
}

.analytics-charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

@media (max-width: 900px) {
  .analytics-charts-row {
    grid-template-columns: 1fr;
  }
}

.chart-card {
  border: 1px solid #eceef2;
  background: #ffffff;
  border-radius: 16px;
  padding: 18px 20px;
}

.chart-title {
  font-size: 14.5px;
  font-weight: 700;
  color: #111827;
}

.chart-sub {
  font-size: 12px;
  color: #8c95a4;
  margin-top: 2px;
}

.bar-chart-stage {
  margin-top: 20px;
  height: 180px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(44px, 1fr));
  gap: 12px;
  align-items: end;
  padding-top: 18px;
  border-bottom: 1px solid #f1f3f6;
}

.bar-col {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.bar-track {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar-fill {
  width: 24px;
  background: var(--wb-chart);
  border-radius: 6px 6px 2px 2px;
  position: relative;
  transition: height 0.25s ease;
}

.bar-fill.bar-warn {
  background: #f59e0b;
}

.bar-fill.bar-danger {
  background: #ef4444;
}

.bar-top-val {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11.5px;
  font-weight: 700;
  color: #111827;
}

.bar-x-label {
  font-size: 11.5px;
  color: #6b7280;
  white-space: nowrap;
}

.mode-table-wrap {
  border: 1px solid #f1f3f6;
  border-radius: 14px;
  overflow: hidden;
}

/* 底部悬浮胶囊切换器 */
.floating-dock-wrap {
  display: flex;
  justify-content: center;
}

.floating-dock {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  background: #ffffff;
  border: 1px solid var(--wb-border);
  border-radius: 999px;
  box-shadow: 0 4px 14px rgba(17, 24, 39, 0.06);
}

.dock-btn {
  height: 32px;
  padding: 0 16px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #4b5563;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dock-btn:hover {
  color: #111827;
}

.dock-btn.active {
  background: var(--wb-primary);
  color: #ffffff;
}

/* 右侧今日值班概览栏 */
.right-ops-rail {
  background: #ffffff;
  border-left: 1px solid var(--wb-border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 100vh;
  position: sticky;
  top: 0;
}

@media (max-width: 1200px) {
  .right-ops-rail {
    height: auto;
    position: static;
    border-left: none;
    border-top: 1px solid var(--wb-border);
  }
}

.rail-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 10px;
}

.rail-section {
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid #f2f4f7;
}

.rail-section.no-border {
  border-bottom: none;
  margin-bottom: 0;
}

.rail-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rail-kicker {
  font-size: 12px;
  color: #9ca3af;
}

.rail-date-title {
  margin-top: 4px;
  font-size: 19px;
  font-weight: 800;
  color: #111827;
}

.rail-date-sub {
  margin-top: 2px;
  font-size: 11.5px;
  color: #9ca3af;
}

.rail-stat-trio {
  margin-top: 14px;
  background: #f8f9fb;
  border: 1px solid #eef0f4;
  border-radius: 14px;
  padding: 12px 8px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  text-align: center;
}

.trio-cell {
  cursor: pointer;
  border-right: 1px solid #eceef2;
}

.trio-cell:last-child {
  border-right: none;
}

.trio-num {
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.trio-lbl {
  font-size: 11px;
  color: #8c95a4;
  margin-top: 2px;
}

.rail-sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.rail-sec-title {
  font-size: 12.5px;
  font-weight: 700;
  color: #6b7280;
}

.rail-link {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
}

.rail-link:hover {
  color: #111827;
}

.rail-big-figure strong {
  font-size: 22px;
  font-weight: 800;
  color: #111827;
}

.rail-big-figure span {
  font-size: 12.5px;
  color: #9ca3af;
}

.rail-progress-bar {
  margin-top: 8px;
  height: 6px;
  border-radius: 999px;
  background: #edf0f5;
  display: flex;
  overflow: hidden;
  gap: 2px;
}

.prog-ok {
  background: #18181b;
  border-radius: 999px;
}

.prog-err {
  background: #ef4444;
  border-radius: 999px;
}

.rail-sub-note {
  margin-top: 6px;
  font-size: 11.5px;
  color: #9ca3af;
}

.rail-alert-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rail-alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.rail-alert-left {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.alert-avatar {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #18181b;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.alert-text {
  font-size: 12.5px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.alert-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  flex-shrink: 0;
}

.tag-red { background: #fef2f2; color: #dc2626; }
.tag-amber { background: #fffbeb; color: #d97706; }
.tag-blue { background: #eff6ff; color: #2563eb; }

.nearest-cert-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.nearest-meta {
  min-width: 0;
}

.nearest-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.nearest-sub {
  font-size: 11.5px;
  color: #9ca3af;
  margin-top: 2px;
}

.rail-todo-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.rail-todo-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
}

.rail-todo-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
  font-size: 12.5px;
  color: #374151;
  line-height: 1.45;
}

.rail-todo-text.done {
  color: #9ca3af;
  text-decoration: line-through;
}

.todo-del-btn {
  border: none;
  background: transparent;
  color: #d1d5db;
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.todo-del-btn:hover {
  color: #6b7280;
}

.rail-bottom-add {
  padding: 12px 16px 14px;
  border-top: 1px solid #f2f4f7;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rail-add-input {
  flex: 1;
  height: 36px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid #eceef2;
  background: #f7f8fa;
  font-size: 12.5px;
  outline: none;
}

.rail-add-input:focus {
  background: #ffffff;
  border-color: #d1d5db;
}

.rail-add-btn {
  width: 34px;
  height: 34px;
  border-radius: 999px;
  border: none;
  background: var(--wb-primary);
  color: #ffffff;
  font-size: 18px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
</style>
