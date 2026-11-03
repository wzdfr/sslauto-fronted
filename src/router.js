import { createRouter, createWebHashHistory } from 'vue-router'
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
import System from './views/System.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/login', component: Login },
    {
      path: '/',
      component: Layout,
      children: [
        { path: '', redirect: '/dashboard' },
        { path: 'dashboard', component: Dashboard, meta: { title: '首页概览' } },
        { path: 'auth', component: CloudAuth, meta: { title: '云服务授权' } },
        { path: 'cert', component: Certificate, meta: { title: '证书管理' } },
        { path: 'cert/apply', component: Apply, meta: { title: '申请证书' } },
        { path: 'cert/assets', component: Assets, meta: { title: '证书资产中心' } },
        { path: 'cert/assets/:id', component: AssetDetail, meta: { title: '证书资产详情' } },
        { path: 'deploy', component: Deploy, meta: { title: '自动部署' } },
        { path: 'agent', component: Agent, meta: { title: '服务器 Agent' } },
        { path: 'system', component: System, meta: { title: '系统管理' } }
      ]
    }
  ]
})

export default router
