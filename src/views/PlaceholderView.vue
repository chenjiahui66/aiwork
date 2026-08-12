<template>
  <el-empty :description="description">
    <template #image>
      <el-icon :size="80" color="#c0c4cc"><component :is="icon" /></el-icon>
    </template>
    <el-button type="primary" plain @click="$router.push('/dashboard')">
      返回工作台
    </el-button>
  </el-empty>
</template>

<script setup lang="ts">
defineProps<{
  description: string
  icon: string
}>()
</script>