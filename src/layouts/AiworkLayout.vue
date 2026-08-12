<template>
  <div class="aiwork-layout">
    <!-- 左侧菜单(钉钉风深色) -->
    <aside class="aiwork-sidebar">
        <div class="aiwork-sidebar__logo">
          <span class="logo-mark">A</span>
          <span>AiWork</span>
        </div>
        <el-menu
          class="aiwork-sidebar__menu"
          :default-active="activeMenu"
          background-color="transparent"
          text-color="#c9d1d9"
          active-text-color="#ffffff"
          router
        >
          <el-menu-item
            v-for="item in menuItems"
            :key="item.name"
            :index="item.path"
            :disabled="item.meta?.coming"
          >
            <el-icon><component :is="item.icon" /></el-icon>
            <template #title>
              {{ item.meta?.title }}
              <el-tag v-if="item.meta?.coming" size="small" type="info" effect="dark" style="margin-left: 8px;">
                即将
              </el-tag>
            </template>
          </el-menu-item>
        </el-menu>
      </aside>

    <!-- 主区域 -->
    <div class="aiwork-main">
      <!-- 顶部栏 -->
      <header class="aiwork-topbar">
        <div class="aiwork-topbar__title">{{ currentTitle }}</div>
        <div class="aiwork-topbar__right">
          <a
            class="aiwork-topbar__link"
            :href="publicSiteUrl"
            target="_blank"
            rel="noopener"
          >
            <el-icon><Promotion /></el-icon>
            企业官网
          </a>
          <a
            class="aiwork-topbar__link"
            :href="adminUrl"
            target="_blank"
            rel="noopener"
          >
            <el-icon><Setting /></el-icon>
            管理后台
          </a>
          <el-dropdown trigger="click">
            <div style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <el-avatar :size="32" style="background: linear-gradient(135deg, #2563eb, #7c3aed);">
                {{ userInitial }}
              </el-avatar>
              <span style="font-size: 14px;">{{ user.nickname }}</span>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>{{ user.department }}</el-dropdown-item>
                <el-dropdown-item divided>个人中心</el-dropdown-item>
                <el-dropdown-item>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <!-- 页面内容 -->
      <main class="aiwork-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const user = computed(() => userStore.user)
const userInitial = computed(() => user.value.nickname.slice(0, 1))

// 菜单数据(从 router 动态取)
const menuItems = computed(() => {
  const root = router.options.routes.find((r) => r.path === '/')
  if (!root || !root.children) return []
  return root.children
    .filter((c): c is NonNullable<typeof c> => !!(c.meta && c.name))
    .map((c) => ({
      name: String(c.name),
      path: c.path === 'dashboard' ? '/dashboard' : `/${c.path}`,
      meta: c.meta,
      icon: (c.meta?.icon as string) || 'Menu',
    }))
})

const activeMenu = computed(() => route.path)
const currentTitle = computed(() => (route.meta.title as string) || 'AiWork')

// 外链地址 - 根据当前 host 动态生成,部署到服务器后无需改
const publicSiteUrl = computed(() => {
  const { protocol, host } = window.location
  return `${protocol}//${host}/aitoolshub/`
})
const adminUrl = computed(() => {
  const { protocol, host } = window.location
  return `${protocol}//${host}/aitoolshub-admin/`
})
</script>