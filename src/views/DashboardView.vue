<template>
  <div>
    <!-- 顶部欢迎 banner -->
    <div class="dashboard-hero">
      <h1>👋 你好,{{ user.nickname }}</h1>
      <p>{{ greeting }} · 今天是 {{ today }},祝你工作顺利 🚀</p>
    </div>

    <!-- 4 个数据卡片 -->
    <div class="stat-grid">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-card__icon" :class="`stat-card__icon--${s.color}`">
          <el-icon><component :is="s.icon" /></el-icon>
        </div>
        <div>
          <div class="stat-card__value">{{ s.value }}</div>
          <div class="stat-card__label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- 主体两栏:待办 + 快速入口 -->
    <el-row :gutter="16">
      <el-col :xs="24" :md="14">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="section-title" style="margin: 0;">📌 待办事项</span>
              <el-link type="primary" :underline="false">查看全部</el-link>
            </div>
          </template>
          <el-empty v-if="todos.length === 0" description="今天没有待办,好好休息 ☕" />
          <el-timeline v-else>
            <el-timeline-item
              v-for="t in todos"
              :key="t.id"
              :timestamp="t.time"
              placement="top"
            >
              <el-card shadow="never" style="border: 1px solid #e4e7ed;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span>{{ t.title }}</span>
                  <el-tag size="small" :type="tagType(t.type)">{{ t.type }}</el-tag>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="10">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="section-title" style="margin: 0;">⚡ 快速入口</span>
              <el-link type="primary" :underline="false" @click="$router.push('/apps')">
                查看全部应用 →
              </el-link>
            </div>
          </template>
          <div class="app-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px;">
            <div
              v-for="app in quickApps"
              :key="app.id"
              class="app-card"
              @click="onAppClick(app.id)"
            >
              <div class="app-card__icon" :style="{ background: app.bgGradient }">
                <el-icon><component :is="app.icon" /></el-icon>
              </div>
              <div>
                <h4 class="app-card__name">{{ app.name }}</h4>
                <p class="app-card__desc">{{ app.description }}</p>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/stores/user'
import { mockStats, mockTodos, mockApps } from '@/data/mock'

const router = useRouter()
const userStore = useUserStore()
const user = computed(() => userStore.user)

const today = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
})

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const stats = mockStats
const todos = mockTodos
const quickApps = mockApps.filter((a) => a.status === 'online').slice(0, 4)

function onAppClick(id: string) {
  const app = mockApps.find((a) => a.id === id)
  if (app?.status === 'coming') {
    ElMessage.info('该应用即将上线,敬请期待')
    return
  }
  router.push({ name: 'apps', query: { open: id } })
}

function tagType(type: string): 'primary' | 'success' | 'warning' | 'info' {
  if (type === '审批') return 'warning'
  if (type === 'AI 生成') return 'success'
  return 'info'
}
</script>