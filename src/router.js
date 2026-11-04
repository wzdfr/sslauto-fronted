import { createRouter, createWebHashHistory } from 'vue-router'
import { getToken, initRuntimeMode } from './api'
import Layout from './views/Layout.vue'
import Login from './views/Login.vue'
import Dashboard from './views/Dashboard.vue'
import CloudAuth from './views/CloudAuth.vue'
import Certificate from './views/Certificate.vue'
import Apply from './views/Apply.vue'
import Assets from './views/Assets.vue'
import AssetDetail from './views/AssetDetail.vue'
import Deploy from './views/Deploy.vue'
import Agent from './views/Agent.vue'
import Probe from './views/Probe.vue'
import System from './views/System.vue'
import Settings from './views/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: Layout,
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          component: Dashboard,
          meta: { title: '工作台总览' }
        },
        {
          path: 'cert/assets',
          component: Assets,
          meta: { title: '证书资产档案' }
        },
        {
          path: 'cert/assets/:id',
          component: AssetDetail,
          meta: { title: '证书资产详情' }
        },
        {
          path: 'probe',
          component: Probe,
          meta: { title: '真机分析与策略' }
        },
        {
          path: 'cert',
          component: Certificate,
          meta: { title: '证书签发与续期' }
        },
        {
          path: 'cert/apply',
          component: Apply,
          meta: { title: '申请新证书' }
        },
        {
          path: 'deploy',
          component: Deploy,
          meta: { title: '自动部署编排' }
        },
        {
          path: 'agent',
          component: Agent,
          meta: { title: '服务器 Agent' }
        },
        {
          path: 'auth',
          component: CloudAuth,
          meta: { title: '云 DNS 授权' }
        },
        {
          path: 'system',
          component: System,
          meta: { title: '权限与操作审计' }
        },
        {
          path: 'settings',
          component: Settings,
          meta: { title: '工作台设置' }
        }
      ]
    }
  ]
})

router.beforeEach(async (to) => {
  await initRuntimeMode()
  if (to.path !== '/login' && !getToken()) {
    return '/login'
  }
  return true
})

export default router
