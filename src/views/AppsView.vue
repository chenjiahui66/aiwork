<template>
  <div>
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <div>
        <h2 style="margin: 0 0 4px;">AI 应用市场</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          探索企业专属的 AI 生产力工具,助力日常办公提效
        </p>
      </div>
      <el-input
        v-model="search"
        placeholder="搜索应用名称或描述"
        style="width: 260px;"
        clearable
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 分类筛选 -->
    <el-radio-group v-model="category" style="margin-bottom: 20px;">
      <el-radio-button value="">全部</el-radio-button>
      <el-radio-button value="productivity">生产力</el-radio-button>
      <el-radio-button value="communication">沟通协作</el-radio-button>
      <el-radio-button value="data">数据分析</el-radio-button>
      <el-radio-button value="creative">创意设计</el-radio-button>
    </el-radio-group>

    <!-- 应用卡片 -->
    <div v-if="filteredApps.length > 0" class="app-grid">
      <div
        v-for="app in filteredApps"
        :key="app.id"
        class="app-card"
        @click="onAppClick(app)"
      >
        <div class="app-card__icon" :style="{ background: app.bgGradient }">
          <el-icon><component :is="app.icon" /></el-icon>
        </div>
        <div>
          <h4 class="app-card__name">{{ app.name }}</h4>
          <p class="app-card__desc">{{ app.description }}</p>
        </div>
        <div style="margin-top: auto;">
          <span
            v-for="tag in app.tags"
            :key="tag"
            class="app-card__tag"
            :class="{ 'app-card__tag--gray': tag === '即将推出' }"
          >{{ tag }}</span>
        </div>
      </div>
    </div>

    <el-empty v-else description="没找到匹配的应用" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { AiApp } from '@/types'
import { mockApps } from '@/data/mock'

const route = useRoute()
const router = useRouter()
const search = ref('')
const category = ref<string>('')

const filteredApps = computed(() => {
  return mockApps.filter((a) => {
    const matchCat = !category.value || a.category === category.value
    const matchSearch = !search.value ||
      a.name.includes(search.value) ||
      a.description.includes(search.value)
    return matchCat && matchSearch
  })
})

function onAppClick(app: AiApp) {
  if (app.status === 'coming') {
    ElMessage.info(`「${app.name}」即将上线,敬请期待`)
    return
  }
  if (app.status === 'beta') {
    ElMessage.warning(`「${app.name}」正在内测中,请联系管理员开通`)
    return
  }
  // 有 route 字段的真应用,跳过去
  if (app.route) {
    router.push(app.route)
    return
  }
  ElMessage.success(`进入「${app.name}」- 第一期 mock,实际功能开发中`)
}

// 处理从 dashboard 跳转过来的 query.open
if (route.query.open) {
  const target = mockApps.find((a) => a.id === route.query.open)
  if (target) {
    setTimeout(() => onAppClick(target), 300)
  }
}
</script>