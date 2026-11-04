<template>
  <div class="space-y-4">
    <!-- 顶部页面标题 + 嵌入式胶囊模式切换器（1:1 对齐参考图 3「成绩分析」顶栏） -->
    <div class="wb-page-head">
      <div class="wb-page-title-group">
        <div class="wb-page-title-row">
          <h1 class="wb-page-title">态势与真机核验</h1>
          <div class="wb-mode-switch" role="tablist">
            <button
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'analytics' }]"
              @click="activeTab = 'analytics'"
            >
              全量态势与对比
            </button>
            <button
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'probe' }]"
              @click="activeTab = 'probe'"
            >
              单域/批量真机拨测
            </button>
            <button
              type="button"
              :class="['wb-mode-btn', { active: activeTab === 'policy' }]"
              @click="activeTab = 'policy'"
            >
              告警与升级策略
            </button>
          </div>
        </div>
        <p class="wb-page-sub">
          <span>{{ todayDay }}</span>
          <span class="wb-sep">·</span>
          <span>已纳管 {{ summary.certTotal || 0 }} 张证书</span>
          <span class="wb-sep">·</span>
          <span>在线服务器 {{ summary.serverOnline || 0 }}/{{ summary.serverTotal || 0 }} 台</span>
        </p>
      </div>

      <div class="wb-page-actions">
        <button type="button" class="wb-btn" @click="loadOverview">
          <el-icon><Refresh /></el-icon>
          <span>刷新数据</span>
        </button>
        <button
          type="button"
          class="wb-btn wb-btn-primary"
          @click="activeTab = 'probe'"
        >
          <el-icon><Aim /></el-icon>
          <span>发起真机探测</span>
        </button>
        <button type="button" class="wb-btn" @click="toggleFullscreen">
          <el-icon><FullScreen /></el-icon>
          <span>{{ isFullscreen ? '退出全屏' : '全屏' }}</span>
        </button>
      </div>
    </div>

    <!-- =====================================================
         Tab 1: 全量态势与对比（1:1 对齐参考图 3：5 KPI 卡 + 双柱状图 + 对比明细表）
         ===================================================== -->
    <template v-if="activeTab === 'analytics'">
      <!-- 5 格大圆角核心指标卡 -->
      <div class="kpi-five-grid" v-loading="loadingOverview">
        <div class="kpi-card">
          <div class="kpi-lbl">受管证书总数</div>
          <div class="kpi-num mono">
            {{ summary.certTotal || 0 }}<span class="kpi-unit"> / 张</span>
          </div>
          <div class="kpi-delta text-emerald-600">有效签发 {{ summary.certIssued || 0 }} 张</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-lbl">最短剩余天数</div>
          <div class="kpi-num mono">{{ minRemainingDays !== null ? minRemainingDays : '--' }}</div>
          <div class="kpi-delta text-gray-400 truncate">{{ minRemainingDomain }}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-lbl">健康有效率</div>
          <div class="kpi-num mono">{{ healthyRate }}%</div>
          <div :class="['kpi-delta', (summary.certExpiring || 0) > 0 ? 'text-red-500' : 'text-emerald-600']">
            {{ (summary.certExpiring || 0) > 0 ? `↓ ${summary.certExpiring} 张 30 天内临期` : '全量处于安全周期' }}
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-lbl">自动部署达成率</div>
          <div class="kpi-num mono">{{ deploySuccessRate }}%</div>
          <div class="kpi-delta text-gray-400">
            {{ summary.deploySuccess || 0 }}/{{ summary.deployTotal || 0 }} 个下发任务一致
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-lbl">Agent 在线率</div>
          <div class="kpi-num mono">{{ serverOnlineRate }}%</div>
          <div class="kpi-delta text-gray-400">越大说明集群心跳越稳定</div>
        </div>
      </div>

      <!-- 双列高清柱状图卡片（1:1 复刻参考图 3 的蓝柱、Y 轴刻度与达标参考红线） -->
      <div class="charts-two-grid">
        <!-- 左图：各签发机构有效率 / 占比 -->
        <div class="wb-panel p-6">
          <div class="font-bold text-[15px] text-[#111827]">各签发机构 (CA) 有效覆盖率</div>
          <div class="text-xs text-gray-400 mt-0.5">有效签发数 ÷ 该品牌总数；红线为 80% 健康基准线</div>

          <div class="vchart-wrap">
            <div class="vchart-yaxis mono">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>
            <div class="vchart-plot">
              <div class="vchart-gridline" style="bottom: 100%" />
              <div class="vchart-gridline" style="bottom: 75%" />
              <div class="vchart-threshold" style="bottom: 80%">
                <span class="threshold-lbl">基准</span>
              </div>
              <div class="vchart-gridline" style="bottom: 50%" />
              <div class="vchart-gridline" style="bottom: 25%" />
              <div class="vchart-gridline" style="bottom: 0%" />

              <div class="vchart-bars">
                <div v-for="item in caRateBars" :key="item.code" class="vbar-item">
                  <div class="vbar-col-wrap">
                    <div class="vbar-rect" :style="{ height: Math.max(4, item.pct) + '%' }">
                      <span class="vbar-val mono">{{ item.pct }}%</span>
                    </div>
                  </div>
                  <span class="vbar-label">{{ item.label }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 右图：证书剩余有效期天数分布 -->
        <div class="wb-panel p-6">
          <div class="font-bold text-[15px] text-[#111827]">证书剩余有效期分段</div>
          <div class="text-xs text-gray-400 mt-0.5">按到期剩余天数统计，柱上为对应证书张数</div>

          <div class="vchart-wrap">
            <div class="vchart-yaxis mono">
              <span>{{ expiryMaxScale }}</span>
              <span>{{ Math.round(expiryMaxScale * 0.75) }}</span>
              <span>{{ Math.round(expiryMaxScale * 0.5) }}</span>
              <span>{{ Math.round(expiryMaxScale * 0.25) }}</span>
              <span>0</span>
            </div>
            <div class="vchart-plot">
              <div class="vchart-gridline" style="bottom: 100%" />
              <div class="vchart-gridline" style="bottom: 75%" />
              <div class="vchart-gridline" style="bottom: 50%" />
              <div class="vchart-gridline" style="bottom: 25%" />
              <div class="vchart-gridline" style="bottom: 0%" />

              <div class="vchart-bars">
                <div v-for="seg in expirySegmentBars" :key="seg.label" class="vbar-item">
                  <div class="vbar-col-wrap">
                    <div
                      :class="['vbar-rect', seg.colorClass]"
                      :style="{ height: seg.heightPct + '%' }"
                    >
                      <span class="vbar-val mono">{{ seg.count }}</span>
                    </div>
                  </div>
                  <span class="vbar-label mono">{{ seg.label }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span class="inline-flex items-center gap-1.5"><i class="legend-dot bg-red-500" /> 高危临期段</span>
            <span class="inline-flex items-center gap-1.5"><i class="legend-dot bg-amber-500" /> 续期窗口段</span>
            <span class="inline-flex items-center gap-1.5"><i class="legend-dot bg-[#1d6bf3]" /> 健康安全段</span>
          </div>
        </div>
      </div>

      <!-- 底部全宽资产健康与部署一致性明细表 -->
      <div class="wb-panel p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div class="font-bold text-[15px] text-[#111827]">证书生命周期与部署版本对比明细</div>
            <div class="text-xs text-gray-400 mt-0.5">
              绿色代表健康受控，橙红标注临期或待同步节点；点击任意行右侧「真机核验」可实时比对公网 443 握手证书
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div class="flex flex-wrap items-center gap-3">
            <div class="wb-search w-56">
              <el-icon class="text-gray-400"><Search /></el-icon>
              <input v-model="tableKw" type="text" placeholder="搜索域名 / 证书名称..." />
            </div>

            <div class="wb-mode-switch">
              <button
                type="button"
                :class="['wb-mode-btn', { active: tableQuickFilter === 'ALL' }]"
                @click="tableQuickFilter = 'ALL'"
              >
                全部 {{ certList.length }}
              </button>
              <button
                type="button"
                :class="['wb-mode-btn', { active: tableQuickFilter === 'OK' }]"
                @click="tableQuickFilter = 'OK'"
              >
                <span class="text-emerald-600">健康 {{ healthyCount }}</span>
              </button>
              <button
                type="button"
                :class="['wb-mode-btn', { active: tableQuickFilter === 'RISK' }]"
                @click="tableQuickFilter = 'RISK'"
              >
                <span class="text-red-500">临期/异常 {{ riskCount }}</span>
              </button>
            </div>
          </div>

          <span class="text-xs text-gray-400 mono">
            自动续期阈值：≤ {{ clmPolicy.autoRenewDaysBefore }} 天
          </span>
        </div>

        <el-table :data="filteredAnalyticsCerts" empty-text="当前暂无证书数据">
          <el-table-column label="顺位" width="80">
            <template #default="{ $index }">
              <span class="font-semibold text-gray-700 mono">#{{ $index + 1 }}</span>
            </template>
          </el-table-column>

          <el-table-column label="证书名称 / 主域名" min-width="220">
            <template #default="{ row }">
              <div class="flex items-center gap-2">
                <span class="font-bold text-[#111827]">{{ row.name || parseDomains(row.domains)[0] }}</span>
                <span class="mono text-xs text-gray-400">{{ parseDomains(row.domains)[0] }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="CA 品牌" width="135">
            <template #default="{ row }">{{ brandLabel(row.brand) }}</template>
          </el-table-column>

          <el-table-column label="算法" width="85">
            <template #default="{ row }">
              <span class="mono">{{ row.keytype || 'ECC' }}</span>
            </template>
          </el-table-column>

          <el-table-column label="当前版本" width="95" align="right">
            <template #default="{ row }">
              <span class="mono font-bold text-[#111827]">v{{ row.version || 1 }}</span>
            </template>
          </el-table-column>

          <el-table-column label="剩余天数" width="120" align="right">
            <template #default="{ row }">
              <span
                class="mono font-bold"
                :class="
                  (calcDaysDiff(row.notafter) ?? 999) <= 30 ? 'text-red-500' : 'text-emerald-600'
                "
              >
                {{ calcDaysDiff(row.notafter) !== null ? calcDaysDiff(row.notafter) + ' 天' : '—' }}
              </span>
            </template>
          </el-table-column>

          <el-table-column label="到期日期" width="130" align="right">
            <template #default="{ row }">
              <span class="mono text-gray-500">{{ fmtDay(row.notafter) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="180" align="right">
            <template #default="{ row }">
              <div class="inline-flex items-center gap-2">
                <button type="button" class="wb-row-btn" @click="quickProbeFromRow(row)">
                  真机核验
                </button>
                <button
                  type="button"
                  class="wb-row-link"
                  @click="router.push('/cert/assets/' + row.id)"
                >
                  档案
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <!-- =====================================================
         Tab 2: 单域/批量真机 TLS 握手拨测与未知资产发现
         ===================================================== -->
    <template v-else-if="activeTab === 'probe'">
      <section class="wb-panel p-6">
        <div class="font-bold text-[15px] text-[#111827]">公网域名与端口 TLS 实时握手探测</div>
        <div class="text-xs text-gray-400 mt-1 mb-4">
          直接向目标端点发起带 SNI 的真实 TLS 握手，核验线上证书链、SAN 域名匹配与 SHA-256 指纹一致性，杜绝“文件已更新但线上仍旧证书”
        </div>

        <div class="flex flex-col sm:flex-row gap-3">
          <el-input
            v-model="targetInput"
            size="large"
            placeholder="输入单个或多个域名（支持 host:port，多个用逗号或空格分隔，如 letsencrypt.org, cloudflare.com:443）"
            clearable
            @keyup.enter="runBatchProbe"
          />
          <button
            type="button"
            class="wb-btn wb-btn-primary !h-10 !px-6"
            :disabled="probing"
            @click="runBatchProbe"
          >
            {{ probing ? '握手中...' : '立即握手核验' }}
          </button>
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <span class="text-xs text-gray-400">快速测试公网端点：</span>
          <button
            v-for="item in presetHosts"
            :key="item"
            type="button"
            class="wb-row-btn mono"
            @click="probeSingle(item)"
          >
            {{ item }}
          </button>
        </div>
      </section>

      <section class="wb-panel overflow-hidden px-3 pt-1">
        <div class="px-3 py-3.5 border-b border-[#f1f3f6] flex items-center justify-between">
          <div>
            <span class="font-bold text-sm text-[#111827]">探测与台账比对结果 ({{ results.length }})</span>
          </div>
          <button v-if="results.length" type="button" class="wb-row-link" @click="results = []">
            清空结果
          </button>
        </div>

        <el-table :data="results" v-loading="probing" empty-text="输入域名或点击上方示例端点开始实时 TLS 握手检测">
          <el-table-column label="探测目标端点" width="205">
            <template #default="{ row }">
              <div class="mono font-bold text-[#111827]">{{ row.hostname }}:{{ row.port }}</div>
              <div class="wb-meta" v-if="!row.error">
                <span class="mono">{{ row.protocol }}</span>
                <span class="wb-sep">·</span>
                <span>{{ row.domainMatched ? 'SAN 匹配通过' : '域名不匹配' }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="签发 CA / Subject" min-width="220">
            <template #default="{ row }">
              <template v-if="row.error">
                <span class="wb-state wb-state-err">{{ row.error }}</span>
              </template>
              <template v-else>
                <div class="font-medium text-gray-900">{{ row.issuerOrg }} ({{ row.issuerCN }})</div>
                <div class="wb-meta mono">
                  <span>CN={{ row.subjectCN }}</span>
                  <span class="wb-sep">·</span>
                  <span>{{ (row.sans || []).length }} SAN</span>
                </div>
              </template>
            </template>
          </el-table-column>

          <el-table-column label="线上实际有效期" width="165">
            <template #default="{ row }">
              <template v-if="!row.error">
                <div :class="['wb-state mono', row.daysRemaining <= 0 ? 'wb-state-err' : row.daysRemaining <= 30 ? 'wb-state-warn' : 'wb-state-ok']">
                  {{ row.daysRemaining < 0 ? `已过期 ${-row.daysRemaining}d` : `剩余 ${row.daysRemaining} 天` }}
                </div>
                <div class="mono text-xs text-gray-400">{{ fmtDay(row.validTo) }} 到期</div>
              </template>
              <span v-else>—</span>
            </template>
          </el-table-column>

          <el-table-column label="台账纳管与部署一致性" min-width="220">
            <template #default="{ row }">
              <template v-if="row.error">—</template>
              <template v-else-if="row.inventoryMatch">
                <div v-if="row.inventoryMatch.fingerprintConsistent" class="wb-state wb-state-ok">
                  已纳管 · 线上指纹与 v{{ row.inventoryMatch.version }} 一致
                </div>
                <div v-else class="wb-state wb-state-warn">
                  已纳管 ({{ row.inventoryMatch.certName }}) · 指纹不一致
                </div>
                <div class="text-xs text-gray-400">
                  {{ row.inventoryMatch.fingerprintConsistent ? '部署已生效' : '目标 Nginx/LB 可能未重载最新证书' }}
                </div>
              </template>
              <template v-else>
                <div class="wb-state wb-state-neutral">未知外部证书（未纳管）</div>
                <div class="text-xs text-gray-400">可一键发起申请纳入统一监控</div>
              </template>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="175" align="right">
            <template #default="{ row }">
              <div v-if="!row.error" class="inline-flex items-center gap-2">
                <button type="button" class="wb-row-btn" @click="inspectDrawer(row)">
                  链详情
                </button>
                <button
                  v-if="!row.inventoryMatch && can('cert:apply')"
                  type="button"
                  class="wb-row-link"
                  @click="adoptDomain(row)"
                >
                  纳管申请
                </button>
                <button
                  v-else-if="row.inventoryMatch"
                  type="button"
                  class="wb-row-link"
                  @click="router.push('/cert/assets/' + row.inventoryMatch.certId)"
                >
                  资产档案
                </button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </section>
    </template>

    <!-- =====================================================
         Tab 3: 失败告警与多级升级治理策略
         ===================================================== -->
    <template v-else>
      <section class="wb-panel">
        <div class="wb-panel-header">
          <div>
            <h2 class="wb-panel-title">证书生命周期告警与多级升级策略</h2>
            <div class="wb-panel-sub">让续期失败、部署异常、指纹不一致与临期风险在用户感知前提前暴露并闭环升级</div>
          </div>
          <button type="button" class="wb-btn wb-btn-primary" @click="savePolicy">
            保存治理策略
          </button>
        </div>

        <div class="wb-panel-body grid grid-cols-1 lg:grid-cols-2 gap-7">
          <div class="space-y-4">
            <div class="font-bold text-sm text-[#111827]">01. 自动续期与部署安全护栏</div>

            <div class="flex items-center justify-between gap-4 py-3 border-b border-[#f1f3f6]">
              <div>
                <div class="text-[13.5px] font-semibold text-[#111827]">提前自动续期窗口（天）</div>
                <div class="text-xs text-gray-400 mt-0.5">公信 90 天证书建议提前 30 天启动自动续期重试</div>
              </div>
              <el-input-number v-model="draft.autoRenewDaysBefore" :min="7" :max="60" />
            </div>

            <div class="flex items-center justify-between gap-4 py-3 border-b border-[#f1f3f6]">
              <div>
                <div class="text-[13.5px] font-semibold text-[#111827]">部署后自动执行线上 TLS 握手核验</div>
                <div class="text-xs text-gray-400 mt-0.5">校验公网实际返回证书 SHA-256 指纹与最新版本一致</div>
              </div>
              <el-switch v-model="draft.postDeployVerify" />
            </div>

            <div class="flex items-center justify-between gap-4 py-3">
              <div>
                <div class="text-[13.5px] font-semibold text-[#111827]">Nginx 语法校验失败自动回滚事务</div>
                <div class="text-xs text-gray-400 mt-0.5">写入前创建快照，nginx -t 报错立即还原旧配置防止服务中断</div>
              </div>
              <el-switch v-model="draft.autoRollbackOnNginxFail" />
            </div>
          </div>

          <div class="space-y-4">
            <div class="font-bold text-sm text-[#111827]">02. 分级告警升级矩阵与通知渠道</div>

            <div class="bg-[#f7f8fa] border border-[#eceef2] rounded-xl p-4 space-y-2.5 text-xs text-gray-700">
              <div class="flex items-baseline gap-2.5">
                <span class="wb-state wb-state-neutral mono">P2 预警</span>
                <span>剩余 ≤ {{ draft.warnDaysThreshold }} 天 或 发现未接管站点 → 通知证书归属责任人</span>
              </div>
              <div class="flex items-baseline gap-2.5">
                <span class="wb-state wb-state-warn mono">P1 告警</span>
                <span>自动续期首次失败 或 部署任务版本滞后 → 推送 SRE 值班群 Webhook</span>
              </div>
              <div class="flex items-baseline gap-2.5">
                <span class="wb-state wb-state-err mono">P0 升级</span>
                <span>剩余 ≤ {{ draft.urgentDaysThreshold }} 天仍未续期成功 → 升级至 {{ draft.escalationOwner }}</span>
              </div>
            </div>

            <div class="flex flex-wrap gap-4 pt-1">
              <el-checkbox v-model="draft.channels.webhook">飞书 / 企微 / 钉钉 Webhook</el-checkbox>
              <el-checkbox v-model="draft.channels.email">责任人邮件日报</el-checkbox>
              <el-checkbox v-model="draft.channels.smsEscalation">P0 紧急语音/短信升级</el-checkbox>
            </div>

            <div>
              <div class="text-xs font-semibold text-gray-700 mb-1.5">告警 Webhook 接收地址</div>
              <el-input v-model="draft.webhookUrl" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- 线上证书链详情弹窗 -->
    <el-dialog v-model="detailVisible" title="线上实际生效 X.509 证书链详情" width="640px">
      <el-descriptions v-if="activeResult" :column="2" border size="small">
        <el-descriptions-item label="目标主机" :span="2">
          <span class="mono">{{ activeResult.hostname }}:{{ activeResult.port }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="协商协议">{{ activeResult.protocol }}</el-descriptions-item>
        <el-descriptions-item label="加密套件">
          <span class="mono">{{ activeResult.cipher }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="Subject CN">{{ activeResult.subjectCN }}</el-descriptions-item>
        <el-descriptions-item label="签发机构">{{ activeResult.issuerOrg }} ({{ activeResult.issuerCN }})</el-descriptions-item>
        <el-descriptions-item label="生效时间">{{ fmt(activeResult.validFrom) }}</el-descriptions-item>
        <el-descriptions-item label="到期时间">{{ fmt(activeResult.validTo) }}</el-descriptions-item>
        <el-descriptions-item label="序列号" :span="2">
          <span class="mono">{{ activeResult.serialNumber }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="SHA-256 指纹" :span="2">
          <span class="mono">{{ activeResult.fingerprint }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="SAN 覆盖域名" :span="2">
          <div class="mono text-xs leading-relaxed">{{ (activeResult.sans || []).join(', ') }}</div>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <button type="button" class="wb-btn" @click="detailVisible = false">关闭</button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Aim, Refresh, FullScreen, Search } from '@element-plus/icons-vue'
import { api, isSandboxMode } from '../api'
import { can, clmPolicy, saveClmPolicy } from '../store'
import {
  formatDate,
  formatDay,
  parseDomains,
  calcDaysDiff,
  brandLabel,
  isFullscreen,
  toggleFullscreen
} from '../utils'

const router = useRouter()
const route = useRoute()

const activeTab = ref(
  route.query.domain || route.query.tab === 'probe' ? 'probe' : 'analytics'
)

const loadingOverview = ref(false)
const summary = ref({})
const certList = ref([])
const tableKw = ref('')
const tableQuickFilter = ref('ALL')

const targetInput = ref(
  route.query.domain
    ? String(route.query.domain)
    : isSandboxMode.value
    ? 'letsencrypt.org, pay.yinhecloud.cn, sso.yinhecloud.cn'
    : 'letsencrypt.org, cloudflare.com'
)
const probing = ref(false)
const results = ref([])
const detailVisible = ref(false)
const activeResult = ref(null)

const draft = reactive(JSON.parse(JSON.stringify(clmPolicy.value)))

const fmt = formatDate
const fmtDay = formatDay
const todayDay = computed(() => new Date().toISOString().slice(0, 10))

const presetHosts = computed(() =>
  isSandboxMode.value
    ? ['letsencrypt.org', 'cloudflare.com', 'pay.yinhecloud.cn', 'sso.yinhecloud.cn']
    : ['letsencrypt.org', 'cloudflare.com', 'github.com', 'www.baidu.com']
)

const healthyRate = computed(() => {
  const tot = Number(summary.value.certTotal || 0)
  if (!tot) return 100
  const issued = Number(summary.value.certIssued || 0)
  return Math.round((issued / tot) * 1000) / 10
})

const deploySuccessRate = computed(() => {
  const tot = Number(summary.value.deployTotal || 0)
  if (!tot) return 100
  return Math.round((Number(summary.value.deploySuccess || 0) / tot) * 1000) / 10
})

const serverOnlineRate = computed(() => {
  const tot = Number(summary.value.serverTotal || 0)
  if (!tot) return 100
  return Math.round((Number(summary.value.serverOnline || 0) / tot) * 1000) / 10
})

const minRemainingCert = computed(() => {
  const withDates = certList.value
    .filter((c) => c.notafter)
    .sort((a, b) => (calcDaysDiff(a.notafter) ?? 9999) - (calcDaysDiff(b.notafter) ?? 9999))
  return withDates[0] || null
})

const minRemainingDays = computed(() =>
  minRemainingCert.value ? calcDaysDiff(minRemainingCert.value.notafter) : null
)

const minRemainingDomain = computed(() =>
  minRemainingCert.value
    ? parseDomains(minRemainingCert.value.domains)[0] || minRemainingCert.value.name
    : '暂无到期证书'
)

const caRateBars = computed(() => {
  const brands = [
    { code: 'LETSENCRYPT', label: "Let's Encrypt" },
    { code: 'GOOGLE', label: 'Google' },
    { code: 'ZEROSSL', label: 'ZeroSSL' },
    { code: 'LITESSL', label: 'LiteSSL' },
    { code: 'INTERNAL', label: '私有 CA' },
    { code: 'UPLOAD', label: '商业导入' }
  ]
  return brands.map((b) => {
    const all = certList.value.filter((c) => c.brand === b.code)
    const ok = all.filter((c) => c.status === 'ISSUED').length
    const pct = all.length ? Math.round((ok / all.length) * 100) : 0
    return { ...b, pct }
  })
})

const expirySegmentRaw = computed(() => {
  const segs = [
    { label: '≤7天', count: 0, colorClass: '!bg-red-500' },
    { label: '8-30天', count: 0, colorClass: '!bg-amber-500' },
    { label: '31-60天', count: 0, colorClass: '' },
    { label: '61-90天', count: 0, colorClass: '' },
    { label: '>90天', count: 0, colorClass: '' }
  ]
  certList.value.forEach((c) => {
    const d = calcDaysDiff(c.notafter)
    if (d === null) return
    if (d <= 7) segs[0].count++
    else if (d <= 30) segs[1].count++
    else if (d <= 60) segs[2].count++
    else if (d <= 90) segs[3].count++
    else segs[4].count++
  })
  return segs
})

const expiryMaxScale = computed(() => {
  const maxVal = Math.max(4, ...expirySegmentRaw.value.map((x) => x.count))
  return Math.ceil(maxVal / 4) * 4
})

const expirySegmentBars = computed(() =>
  expirySegmentRaw.value.map((s) => ({
    ...s,
    heightPct: s.count === 0 ? 4 : Math.round((s.count / expiryMaxScale.value) * 100)
  }))
)

const healthyCount = computed(
  () =>
    certList.value.filter(
      (c) => c.status === 'ISSUED' && (calcDaysDiff(c.notafter) ?? 999) > 30
    ).length
)

const riskCount = computed(() => certList.value.length - healthyCount.value)

const filteredAnalyticsCerts = computed(() => {
  const kw = tableKw.value.trim().toLowerCase()
  return certList.value.filter((c) => {
    const isHealthy = c.status === 'ISSUED' && (calcDaysDiff(c.notafter) ?? 999) > 30
    if (tableQuickFilter.value === 'OK' && !isHealthy) return false
    if (tableQuickFilter.value === 'RISK' && isHealthy) return false
    if (!kw) return true
    return (
      (c.name || '').toLowerCase().includes(kw) ||
      (c.domains || '').toLowerCase().includes(kw)
    )
  })
})

async function loadOverview() {
  loadingOverview.value = true
  try {
    const [sum, certs] = await Promise.all([
      api('/dashboard/summary').catch(() => ({})),
      can('cert') ? api('/cert/list?keyword=').catch(() => []) : Promise.resolve([])
    ])
    summary.value = sum || {}
    certList.value = certs || []
  } finally {
    loadingOverview.value = false
  }
}

function quickProbeFromRow(row) {
  const dom = (parseDomains(row.domains)[0] || '').replace(/^\*\./, '')
  if (!dom) return
  targetInput.value = dom
  activeTab.value = 'probe'
  runBatchProbe()
}

function parseTargetToken(token) {
  const clean = token.trim().replace(/^https?:\/\//i, '').split('/')[0]
  if (!clean) return null
  const parts = clean.split(':')
  return {
    hostname: parts[0],
    port: parts[1] ? Number(parts[1]) || 443 : 443
  }
}

async function probeEndpoint(hostname, port = 443) {
  try {
    return await api('/probe/tls', {
      method: 'POST',
      body: { hostname, port }
    })
  } catch (e) {
    return {
      hostname,
      port,
      error: e.message || 'TLS 握手探测失败'
    }
  }
}

async function runBatchProbe() {
  const tokens = targetInput.value
    .split(/[\s,;]+/)
    .map(parseTargetToken)
    .filter(Boolean)
  if (!tokens.length) {
    ElMessage.warning('请输入至少一个待探测域名')
    return
  }
  probing.value = true
  try {
    results.value = await Promise.all(
      tokens.slice(0, 8).map((t) => probeEndpoint(t.hostname, t.port))
    )
  } finally {
    probing.value = false
  }
}

async function probeSingle(host) {
  targetInput.value = host
  await runBatchProbe()
}

function inspectDrawer(row) {
  activeResult.value = row
  detailVisible.value = true
}

function adoptDomain(row) {
  router.push({ path: '/cert/apply', query: { domain: row.hostname } })
}

function savePolicy() {
  saveClmPolicy(JSON.parse(JSON.stringify(draft)))
  ElMessage.success('生命周期告警与安全回滚策略已保存生效')
}

onMounted(() => {
  loadOverview()
  if (route.query.domain) {
    runBatchProbe()
  }
})
</script>

<style scoped>
.kpi-five-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 14px;
}

@media (max-width: 1100px) {
  .kpi-five-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.kpi-card {
  background: #ffffff;
  border: 1px solid var(--wb-border);
  border-radius: 16px;
  padding: 18px 20px;
}

.kpi-lbl {
  font-size: 12px;
  color: #8c95a4;
}

.kpi-num {
  margin-top: 8px;
  font-size: 28px;
  font-weight: 800;
  color: #111827;
  line-height: 1.15;
}

.kpi-unit {
  font-size: 13px;
  font-weight: 500;
  color: #9ca3af;
}

.kpi-delta {
  margin-top: 8px;
  font-size: 12px;
}

.charts-two-grid {
  display: grid;
  grid-template-columns: 1.12fr 1fr;
  gap: 14px;
}

@media (max-width: 960px) {
  .charts-two-grid {
    grid-template-columns: 1fr;
  }
}

/* 柱状图（复刻参考图 3 视觉） */
.vchart-wrap {
  margin-top: 22px;
  height: 210px;
  display: grid;
  grid-template-columns: 38px 1fr;
  gap: 8px;
}

.vchart-yaxis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 24px;
  font-size: 11px;
  color: #9ca3af;
  text-align: right;
}

.vchart-plot {
  position: relative;
  margin-bottom: 24px;
}

.vchart-gridline {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #f1f3f6;
}

.vchart-threshold {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: #fca5a5;
  z-index: 2;
}

.threshold-lbl {
  position: absolute;
  left: -30px;
  top: -8px;
  font-size: 10px;
  color: #ef4444;
}

.vchart-bars {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
  gap: 10px;
  z-index: 3;
}

.vbar-item {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vbar-col-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.vbar-rect {
  width: 24px;
  background: var(--wb-chart);
  border-radius: 5px 5px 0 0;
  position: relative;
  transition: height 0.25s ease;
}

.vbar-val {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11.5px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
}

.vbar-label {
  position: absolute;
  bottom: -22px;
  font-size: 11.5px;
  color: #6b7280;
  white-space: nowrap;
}

.legend-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 2px;
}
</style>
