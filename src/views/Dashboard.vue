<template>
  <div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="label">证书总数</div>
        <div class="value">{{ s.certTotal || 0 }}<span class="unit">张</span></div>
      </div>
      <div class="stat-card">
        <div class="label">已签发</div>
        <div class="value">{{ s.certIssued || 0 }}<span class="unit">张</span></div>
      </div>
      <div class="stat-card">
        <div class="label">30 天内到期</div>
        <div class="value" :style="{ color: s.certExpiring ? '#f56c6c' : '#1677ff' }">
          {{ s.certExpiring || 0 }}<span class="unit">张</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="label">在线服务器</div>
        <div class="value">{{ s.serverOnline || 0 }}<span class="unit">/ {{ s.serverTotal || 0 }}</span></div>
      </div>
      <div class="stat-card">
        <div class="label">发现站点</div>
        <div class="value">{{ s.siteTotal || 0 }}<span class="unit">个</span></div>
      </div>
      <div class="stat-card">
        <div class="label">部署任务</div>
        <div class="value">{{ s.deploySuccess || 0 }}<span class="unit">/ {{ s.deployTotal || 0 }}</span></div>
      </div>
    </div>

    <div class="page-card">
      <h3 class="page-title">最近操作</h3>
      <el-table :data="logs" size="small" empty-text="暂无记录">
        <el-table-column prop="CREATEDAT" label="时间" width="180">
          <template #default="{ row }">{{ fmt(row.CREATEDAT) }}</template>
        </el-table-column>
        <el-table-column prop="BIZTYPE" label="类型" width="100" />
        <el-table-column prop="ACTION" label="动作" width="140" />
        <el-table-column prop="MESSAGE" label="说明" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../api'
import { formatDate } from '../utils'

const s = ref({})
const logs = ref([])

const fmt = formatDate

onMounted(async () => {
  s.value = await api('/dashboard/summary')
  logs.value = await api('/dashboard/logs')
})
</script>
