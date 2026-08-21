import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

import AiworkLayout from '@/layouts/AiworkLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AiworkLayout,
    redirect: { name: 'dashboard' },
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '工作台', icon: 'Odometer' },
      },
      {
        path: 'apps',
        name: 'apps',
        component: () => import('@/views/AppsView.vue'),
        meta: { title: 'AI 应用', icon: 'Grid' },
      },
      {
        path: 'apps/chat-qa',
        name: 'chat-qa',
        component: () => import('@/views/ChatQAView.vue'),
        meta: { title: '智能问答', icon: 'ChatDotRound' },
      },
      {
        path: 'apps/ai-writing',
        name: 'ai-writing',
        component: () => import('@/views/WriterView.vue'),
        meta: { title: 'AI 写作助手', icon: 'EditPen' },
      },
      {
        path: 'apps/summarizer',
        name: 'summarizer',
        component: () => import('@/views/SummarizerView.vue'),
        meta: { title: '文档摘要', icon: 'Document' },
      },
      {
        path: 'apps/translator',
        name: 'translator',
        component: () => import('@/views/TranslatorView.vue'),
        meta: { title: '智能翻译', icon: 'RefreshRight' },
      },
      {
        path: 'apps/coder',
        name: 'coder',
        component: () => import('@/views/CoderView.vue'),
        meta: { title: 'AI 代码助手', icon: 'Cpu' },
      },
      {
        path: 'apps/insight',
        name: 'insight',
        component: () => import('@/views/InsightView.vue'),
        meta: { title: '数据洞察', icon: 'DataLine' },
      },
      {
        path: 'apps/hr',
        name: 'hr',
        component: () => import('@/views/HrView.vue'),
        meta: { title: 'HR 助手', icon: 'UserFilled' },
      },
      {
        path: 'apps/designer',
        name: 'designer',
        component: () => import('@/views/DesignerView.vue'),
        meta: { title: 'AI 设计助手', icon: 'PictureFilled' },
      },
      {
        path: 'apps/meeting',
        name: 'meeting',
        component: () => import('@/views/MeetingView.vue'),
        meta: { title: '会议助手', icon: 'Microphone' },
      },
      {
        path: 'knowledge',
        name: 'knowledge',
        component: () => import('@/views/KnowledgeView.vue'),
        meta: { title: '知识库', icon: 'Reading', coming: true },
      },
      {
        path: 'agents',
        name: 'agents',
        component: () => import('@/views/AgentsView.vue'),
        meta: { title: '智能体编排', icon: 'Connection', coming: true },
      },
      {
        path: 'analytics',
        name: 'analytics',
        component: () => import('@/views/AnalyticsView.vue'),
        meta: { title: '数据看板', icon: 'DataAnalysis', coming: true },
      },
      {
        path: 'settings',
        name: 'settings',
        component: () => import('@/views/SettingsView.vue'),
        meta: { title: '设置', icon: 'Setting', coming: true },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  const t = to.meta.title as string | undefined
  document.title = t ? `${t} · AiWork` : 'AiWork · 企业 AI 生产力平台'
})

export default router