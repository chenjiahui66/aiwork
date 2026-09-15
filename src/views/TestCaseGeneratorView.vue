<template>
  <div class="tcg-page">
    <div class="tcg-header">
      <div>
        <h2 style="margin: 0 0 4px;">测试用例生成器</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          把自然语言用例一键转成 pytest 脚本 —— 中间栏看到结构,右边直接拿到可执行 .py
        </p>
      </div>
      <div class="tcg-header__actions">
        <el-input
          v-model="baseUrl"
          size="default"
          style="width: 280px;"
          placeholder="API 基础地址"
        >
          <template #prefix><span style="color: #909399;">BASE_URL</span></template>
        </el-input>
        <el-button :icon="MagicStick" @click="loadSample">加载示例</el-button>
        <el-button type="primary" :icon="Promotion" :loading="loading" @click="generate">
          生成 pytest
        </el-button>
      </div>
    </div>

    <el-row :gutter="16" class="tcg-grid">
      <!-- 左:自然语言输入 -->
      <el-col :xs="24" :md="9">
        <el-card shadow="never" class="tcg-card">
          <template #header>
            <div class="tcg-card__title">
              <el-icon><EditPen /></el-icon>
              <span>自然语言用例</span>
              <el-tag size="small" type="info">支持 Markdown</el-tag>
            </div>
          </template>
          <el-input
            v-model="text"
            type="textarea"
            :rows="20"
            resize="vertical"
            placeholder="用例 1: 用户登录成功&#10;步骤:&#10;  1. POST /api/login body={...}&#10;  2. 断言 status_code == 200"
          />
          <div class="tcg-meta">{{ text.length }} 字符</div>
        </el-card>
      </el-col>

      <!-- 中:解析结果 -->
      <el-col :xs="24" :md="7">
        <el-card shadow="never" class="tcg-card">
          <template #header>
            <div class="tcg-card__title">
              <el-icon><Document /></el-icon>
              <span>解析结果</span>
              <el-tag v-if="cases.length" size="small" type="success">{{ cases.length }} 条用例</el-tag>
              <el-tag v-else size="small" type="info">等待生成</el-tag>
            </div>
          </template>
          <div v-if="!cases.length" class="tcg-empty">
            还没有用例。点上方"生成 pytest"试试。
          </div>
          <el-collapse v-else v-model="activeCases" accordion>
            <el-collapse-item
              v-for="c in cases"
              :key="c.fn_name"
              :name="c.fn_name"
              :title="`${c.title} · ${c.steps.length} 步`"
            >
              <template #title>
                <span class="tcg-fn">{{ c.fn_name }}()</span>
                <span style="margin-left: 8px; color: #909399;">{{ c.title }}</span>
              </template>
              <el-table :data="c.steps" size="small" border>
                <el-table-column prop="method" label="方法" width="80" />
                <el-table-column prop="path" label="路径" />
                <el-table-column label="期望">
                  <template #default="{ row }">
                    <span v-if="row.expect_status">status {{ row.expect_status }}</span>
                    <span v-else-if="row.expect_json">{{ row.expect_json }}</span>
                    <span v-else-if="row.note" style="color: #e6a23c;">{{ row.note }}</span>
                    <span v-else>-</span>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </el-col>

      <!-- 右:pytest 代码 -->
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="tcg-card tcg-card--code">
          <template #header>
            <div class="tcg-card__title">
              <el-icon><Cpu /></el-icon>
              <span>pytest 代码</span>
              <div style="margin-left: auto; display: flex; gap: 8px;">
                <el-button size="small" :icon="DocumentCopy" :disabled="!code" @click="copyCode">
                  复制
                </el-button>
                <el-button size="small" type="primary" :icon="Download" :disabled="!code" @click="downloadCode">
                  下载 .py
                </el-button>
              </div>
            </div>
          </template>
          <pre v-if="code" class="tcg-code"><code>{{ code }}</code></pre>
          <div v-else class="tcg-empty">
            点击"生成 pytest"后这里会显示可执行脚本
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  EditPen, Document, Cpu, DocumentCopy, Download, Promotion, MagicStick,
} from '@element-plus/icons-vue'

interface Step {
  raw: string
  method: string
  path: string
  body: any
  expect_status: number | null
  expect_json: string
  note: string
}

interface Case {
  title: string
  fn_name: string
  base_url: string
  steps: Step[]
}

const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://127.0.0.1:8001'

const text = ref('')
const baseUrl = ref('http://localhost:8000')
const cases = ref<Case[]>([])
const code = ref('')
const loading = ref(false)
const activeCases = ref<string>('')

async function loadSample() {
  try {
    const r = await fetch(`${API_BASE}/api/testcase/sample`)
    const j = await r.json()
    text.value = j.text
    ElMessage.success('已加载示例文本')
  } catch (e) {
    // 后端没起时,直接给一份内置样例
    text.value = `用例 1: 用户登录成功
步骤:
  1. POST /api/login body={"user":"alice","pwd":"123456"}
  2. 断言 status_code == 200
  3. 断言 resp.json().token 非空

用例 2: 登录失败-密码错误
步骤:
  1. POST /api/login body={"user":"alice","pwd":"wrong"}
  2. 断言 status_code == 401`
    ElMessage.warning('后端未连接,已填入内置示例')
  }
}

async function generate() {
  if (!text.value.trim()) {
    ElMessage.warning('请输入测试用例文本')
    return
  }
  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/api/testcase/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.value, base_url: baseUrl.value }),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = await r.json()
    cases.value = j.cases
    code.value = j.pytest_source
    activeCases.value = j.cases[0]?.fn_name || ''
    ElMessage.success(`已解析 ${j.cases.length} 条用例`)
  } catch (e: any) {
    ElMessage.error(`生成失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

async function copyCode() {
  await navigator.clipboard.writeText(code.value)
  ElMessage.success('已复制到剪贴板')
}

function downloadCode() {
  const blob = new Blob([code.value], { type: 'text/x-python' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'test_generated.py'
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(() => {
  loadSample()
})
</script>

<style scoped>
.tcg-page {
  padding: 4px;
}
.tcg-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}
.tcg-header__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}
.tcg-grid {
  align-items: stretch;
}
.tcg-card {
  height: 100%;
  min-height: 520px;
}
.tcg-card__title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}
.tcg-meta {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.tcg-empty {
  padding: 40px 16px;
  text-align: center;
  color: #c0c4cc;
  font-size: 13px;
}
.tcg-fn {
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  color: #2563eb;
}
.tcg-code {
  margin: 0;
  padding: 12px 14px;
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 6px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  max-height: 540px;
  overflow: auto;
  white-space: pre;
}
.tcg-card--code :deep(.el-card__body) {
  padding: 8px;
}
</style>
