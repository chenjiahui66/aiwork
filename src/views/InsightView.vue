<template>
  <div class="insight-page">
    <div class="insight-header">
      <div>
        <h2 style="margin: 0 0 4px;">数据洞察</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          用自然语言提问 — AI 自动生成 SQL、查数据库、出图表(只读,安全)
        </p>
      </div>
      <el-button :icon="QuestionFilled" @click="showSchema = true">查看数据 Schema</el-button>
    </div>

    <!-- 提问区 -->
    <el-card shadow="never" class="qa-card">
      <el-input
        v-model="question"
        type="textarea"
        :rows="3"
        placeholder="试试这些例子:&#10;每个产品的总销售额是多少?&#10;哪个区域的销量最高?&#10;按部门统计员工人数&#10;近 3 个月的销售趋势"
        resize="none"
        :disabled="streaming"
        @keydown.enter.exact.prevent="doQuery"
      />
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <el-button
          type="primary"
          :icon="Search"
          :loading="streaming"
          :disabled="!canQuery"
          @click="doQuery"
          size="large"
        >
          {{ streaming ? '分析中…' : '查询' }}
        </el-button>
        <el-button :icon="Delete" :disabled="streaming" @click="clearAll">清空</el-button>
      </div>

      <!-- 示例问题 chips -->
      <div class="examples">
        <span class="examples-label">点一下试试:</span>
        <el-tag
          v-for="(ex, i) in exampleQuestions"
          :key="i"
          class="example-chip"
          effect="plain"
          @click="useExample(ex)"
        >
          {{ ex }}
        </el-tag>
      </div>
    </el-card>

    <!-- 状态消息流(token 类型的事件) -->
    <el-card v-if="logs.length > 0 || streaming" shadow="never" class="qa-card" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span><el-icon><Operation /></el-icon> 执行过程</span>
        </div>
      </template>
      <div class="log-area">
        <div v-for="(log, idx) in logs" :key="idx" class="log-line">
          <span v-if="log.type === 'sql'" class="sql-code">{{ log.content }}</span>
          <span v-else class="text-text">{{ log.content }}</span>
        </div>
        <div v-if="streaming" class="log-line">
          <span class="text-text">...</span>
          <span class="cursor-blink">▍</span>
        </div>
      </div>
    </el-card>

    <!-- 错误 -->
    <el-alert
      v-if="errorMsg"
      type="error"
      :title="errorMsg"
      show-icon
      :closable="false"
      style="margin-top: 16px;"
    />

    <!-- SQL + 结果区 -->
    <el-card v-if="lastResult" shadow="never" class="qa-card" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span><el-icon><DataLine /></el-icon> 查询结果</span>
          <el-tag size="small" type="info">{{ lastResult.row_count }} 行</el-tag>
        </div>
      </template>

      <!-- 折叠 SQL -->
      <el-collapse v-model="sqlOpen">
        <el-collapse-item title="🔍 查看 SQL 语句" name="1">
          <pre class="sql-pre">{{ lastResult.sql }}</pre>
        </el-collapse-item>
      </el-collapse>

      <!-- 图表 -->
      <div v-if="lastResult.chart.echarts_option" class="chart-wrapper">
        <v-chart
          class="chart"
          :option="lastResult.chart.echarts_option"
          autoresize
        />
      </div>
      <el-alert
        v-else
        type="info"
        :title="lastResult.chart.message || '该查询以表格形式展示'"
        :closable="false"
        show-icon
      />

      <!-- 数据表格 -->
      <div class="table-wrapper">
        <el-table
          :data="lastResult.rows"
          stripe
          size="small"
          max-height="400"
          style="width: 100%;"
        >
          <el-table-column
            v-for="(col, idx) in lastResult.columns"
            :key="idx"
            :prop="String(idx)"
            :label="col"
            min-width="100"
          >
            <template #default="{ row }">
              {{ formatCell(row[String(idx)]) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- Schema 说明弹窗 -->
    <el-dialog
      v-model="showSchema"
      title="📊 演示数据库 Schema"
      width="700px"
      :close-on-click-modal="false"
    >
      <pre class="schema-pre">{{ schemaText }}</pre>
      <template #footer>
        <el-button @click="showSchema = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { ElMessage } from 'element-plus'
import {
  DataLine,
  Delete,
  Operation,
  QuestionFilled,
  Search,
} from '@element-plus/icons-vue'

// 注册 ECharts 组件
use([CanvasRenderer, BarChart, LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const API_BASE = ''

interface Meta {
  sql: string
  columns: string[]
  rows: any[][]
  row_count: number
  chart: {
    chart_type: 'bar' | 'line' | 'pie' | 'table'
    echarts_option: any
    columns: string[]
    rows: any[][]
    message?: string
  }
}

const question = ref('')
const streaming = ref(false)
const logs = ref<{ type: 'text' | 'sql'; content: string }[]>([])
const errorMsg = ref('')
const lastResult = ref<Meta | null>(null)
const showSchema = ref(false)
const schemaText = ref('')
const sqlOpen = ref<string[]>([])

const canQuery = computed(() => question.value.trim().length >= 2 && !streaming.value)

const exampleQuestions = [
  '每个产品的总销售额',
  '哪个区域销量最高',
  '按部门统计员工人数',
  '近 3 个月销售趋势',
]

function useExample(q: string) {
  question.value = q
}

async function loadSchema() {
  try {
    const resp = await fetch(`${API_BASE}/api/insight/schema`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    schemaText.value = data.schema || ''
  } catch (e: any) {
    schemaText.value = `后端连接失败: ${e.message}\n\n请确认后端已启动。`
  }
}

async function doQuery() {
  if (!canQuery.value) return
  streaming.value = true
  logs.value = []
  errorMsg.value = ''
  lastResult.value = null

  try {
    const resp = await fetch(`${API_BASE}/api/insight/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.value }),
    })
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let sqlLineBuf = ''  // 累积 SQL 行(代码块)

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const event = JSON.parse(line.slice(6))

          if (event.type === 'token') {
            const c: string = event.content
            // 检测 SQL 代码块
            if (c.includes('```sql')) {
              const before = c.split('```sql')[0]
              const after = c.split('```sql')[1] || ''
              if (before) logs.value.push({ type: 'text', content: before })
              if (after.includes('```')) {
                const sqlPart = after.split('```')[0]
                logs.value.push({ type: 'sql', content: '```sql\n' + sqlPart + '\n```' })
                const tail = after.split('```').slice(1).join('```')
                if (tail) logs.value.push({ type: 'text', content: tail })
              } else {
                sqlLineBuf = after  // 进入累积状态
              }
            } else if (sqlLineBuf) {
              if (c.includes('```')) {
                const sqlPart = sqlLineBuf + c.split('```')[0]
                logs.value.push({ type: 'sql', content: '```sql\n' + sqlPart + '\n```' })
                const tail = c.split('```').slice(1).join('```')
                sqlLineBuf = ''
                if (tail) logs.value.push({ type: 'text', content: tail })
              } else {
                sqlLineBuf += c
              }
            } else {
              logs.value.push({ type: 'text', content: c })
            }
          } else if (event.type === 'sources') {
            if (event.meta) lastResult.value = event.meta as Meta
          } else if (event.type === 'error') {
            errorMsg.value = event.message
          }
        } catch {
          // skip
        }
      }
    }
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    ElMessage.error('数据查询失败')
  } finally {
    streaming.value = false
  }
}

function clearAll() {
  question.value = ''
  logs.value = []
  errorMsg.value = ''
  lastResult.value = null
}

function formatCell(v: any): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    // 整数不加 .0
    if (Number.isInteger(v)) return v.toString()
    return v.toFixed(2)
  }
  return String(v)
}

onMounted(() => {
  loadSchema()
})
</script>

<style scoped>
.insight-page {
  padding: 0;
}
.insight-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.qa-card {
  border-radius: 8px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

/* 示例 */
.examples {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.examples-label {
  font-size: 12px;
  color: #909399;
  margin-right: 4px;
}
.example-chip {
  cursor: pointer;
}

/* 日志 */
.log-area {
  font-size: 13px;
  line-height: 1.7;
}
.log-line {
  margin-bottom: 4px;
}
.text-text {
  white-space: pre-wrap;
  color: #303133;
}
.sql-code {
  display: block;
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  white-space: pre-wrap;
}
.cursor-blink {
  display: inline-block;
  animation: blink 1s steps(2, start) infinite;
  color: #6366f1;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}

/* SQL 折叠区 */
.sql-pre {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 12px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  margin: 0;
}

/* 图表 */
.chart-wrapper {
  width: 100%;
  height: 400px;
  margin: 16px 0;
}
.chart {
  width: 100%;
  height: 100%;
}

/* 表格 */
.table-wrapper {
  margin-top: 16px;
}

/* Schema 弹窗 */
.schema-pre {
  background: #f8f9fb;
  padding: 16px;
  border-radius: 4px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  max-height: 60vh;
  overflow-y: auto;
}
</style>