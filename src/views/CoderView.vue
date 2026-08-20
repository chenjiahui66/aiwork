<template>
  <div class="coder-page">
    <div class="coder-header">
      <div>
        <h2 style="margin: 0 0 4px;">AI 代码助手</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          解释 / 重构 / 加注释 / 找 Bug / 翻译成其他语言 — 流式输出,带代码块高亮
        </p>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 左:输入配置 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Setting /></el-icon> 任务设置</span>
            </div>
          </template>

          <!-- 任务类型 -->
          <div class="form-item">
            <label class="form-label">任务</label>
            <el-select v-model="task" style="width: 100%;">
              <el-option
                v-for="t in tasks"
                :key="t.code"
                :label="t.label"
                :value="t.code"
              />
            </el-select>
          </div>

          <!-- 源语言 -->
          <div class="form-item">
            <label class="form-label">
              {{ task === 'translate' ? '源语言' : '代码语言' }}
            </label>
            <el-select v-model="language" style="width: 100%;" filterable>
              <el-option
                v-for="l in languages"
                :key="l.code"
                :label="l.label"
                :value="l.code"
              />
            </el-select>
          </div>

          <!-- 目标语言(仅翻译任务) -->
          <div v-if="task === 'translate'" class="form-item">
            <label class="form-label">目标语言</label>
            <el-select v-model="targetLanguage" style="width: 100%;" filterable>
              <el-option
                v-for="l in languages"
                :key="l.code"
                :label="l.label"
                :value="l.code"
              />
            </el-select>
          </div>

          <!-- 代码输入 -->
          <div class="form-item">
            <label class="form-label">
              源码
              <span class="meta-inline">{{ code.length }} 字 · {{ codeLineCount }} 行</span>
            </label>
            <el-input
              v-model="code"
              type="textarea"
              :rows="12"
              placeholder="粘贴代码...&#10;支持 17 种语言: Python / JS / TS / Java / Go / Rust / C / C++ / C# / Ruby / PHP / Swift / Kotlin / Shell / SQL / HTML / CSS"
              resize="vertical"
              :disabled="streaming"
              spellcheck="false"
              class="code-textarea"
            />
          </div>

          <el-button
            type="primary"
            :icon="Promotion"
            :loading="streaming"
            :disabled="!canAnalyze"
            @click="analyze"
            style="width: 100%;"
          >
            {{ streaming ? '分析中…' : '开始分析' }}
          </el-button>

          <el-button
            :icon="Delete"
            :disabled="!code || streaming"
            @click="clearAll"
            style="width: 100%; margin-top: 8px;"
          >
            清空
          </el-button>
        </el-card>
      </el-col>

      <!-- 右:流式输出 -->
      <el-col :xs="24" :md="15" :lg="16">
        <el-card shadow="never" class="qa-card result-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><ChatDotRound /></el-icon> 分析结果</span>
              <div v-if="lastMeta" class="meta-tags">
                <el-tag size="small" type="info">{{ taskLabel(lastMeta.task) }}</el-tag>
                <el-tag size="small">{{ langLabel(lastMeta.language) }}</el-tag>
                <el-tag v-if="lastMeta.target_language" size="small" type="success">
                  → {{ langLabel(lastMeta.target_language) }}
                </el-tag>
                <el-tag size="small">{{ lastMeta.code_lines }} 行</el-tag>
                <el-tag v-if="lastMeta.truncated" size="small" type="warning">已截断</el-tag>
              </div>
            </div>
          </template>

          <div ref="resultRef" class="result-area">
            <div v-if="!result && !streaming && !errorMsg" class="empty-result">
              <el-icon :size="48" color="#c0c4cc"><ChatDotRound /></el-icon>
              <p>还没分析结果</p>
              <p style="font-size: 12px;">左侧选任务、粘代码,点「开始分析」</p>
            </div>
            <div v-else-if="errorMsg" class="error-result">
              ❌ {{ errorMsg }}
            </div>
            <div v-else class="markdown">
              <!-- 流式过程中: 简单文本展示(避免频繁解析 markdown) -->
              <template v-if="streaming">
                <pre class="raw-text">{{ result }}<span class="cursor-blink">▍</span></pre>
              </template>
              <!-- 流结束后: 渲染 markdown 块 -->
              <template v-else>
                <template v-for="(block, idx) in parsedBlocks" :key="idx">
                  <pre v-if="block.type === 'code'" class="code-block">
                    <div class="code-block-header">
                      <span class="code-lang">{{ block.lang || 'plain' }}</span>
                      <el-button
                        link
                        size="small"
                        :icon="CopyDocument"
                        @click="copyCode(block.content)"
                      >
                        复制
                      </el-button>
                    </div>
                    <code>{{ block.content }}</code>
                  </pre>
                  <div v-else class="markdown-text">{{ block.content }}</div>
                </template>
              </template>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  CopyDocument,
  Delete,
  Promotion,
  Setting,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface Language { code: string; label: string }
interface Task { code: string; label: string }
interface Meta {
  task: string
  language: string
  target_language?: string
  code_lines: number
  code_chars: number
  truncated: boolean
}

interface MarkdownBlock {
  type: 'text' | 'code'
  lang?: string
  content: string
}

const tasks = ref<Task[]>([])
const languages = ref<Language[]>([])

const task = ref<string>('explain')
const language = ref<string>('python')
const targetLanguage = ref<string>('javascript')
const code = ref<string>('')

const streaming = ref(false)
const result = ref('')
const errorMsg = ref('')
const lastMeta = ref<Meta | null>(null)
const resultRef = ref<HTMLElement>()

// 行数统计
const codeLineCount = computed(() => (code.value ? code.value.split('\n').length : 0))

// 是否能分析
const canAnalyze = computed<boolean>(() => {
  if (!code.value.trim() || streaming.value) return false
  if (task.value === 'translate' && !targetLanguage.value) return false
  return true
})

// 解析 markdown 流结束后的内容(把 ```lang...``` 切成块)
const parsedBlocks = computed<MarkdownBlock[]>(() => {
  const text = result.value
  if (!text) return []

  const blocks: MarkdownBlock[] = []
  // 匹配 ```lang\n...\n``` 或 ```\n...\n```
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // 前面的普通文本
    if (match.index > lastIdx) {
      const textPart = text.slice(lastIdx, match.index).trim()
      if (textPart) blocks.push({ type: 'text', content: textPart })
    }
    // 代码块
    blocks.push({
      type: 'code',
      lang: match[1] || '',
      content: (match[2] || '').trim(),
    })
    lastIdx = regex.lastIndex
  }

  // 剩余的文本
  if (lastIdx < text.length) {
    const textPart = text.slice(lastIdx).trim()
    if (textPart) blocks.push({ type: 'text', content: textPart })
  }

  return blocks
})

function taskLabel(t: string): string {
  return tasks.value.find((x) => x.code === t)?.label || t
}

function langLabel(code: string): string {
  return languages.value.find((l) => l.code === code)?.label || code
}

function copyCode(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制代码'),
    () => ElMessage.error('复制失败')
  )
}

async function loadOptions() {
  try {
    const resp = await fetch(`${API_BASE}/api/coder/options`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    tasks.value = data.tasks || []
    languages.value = data.languages || []
  } catch (e: any) {
    // fallback
    tasks.value = [
      { code: 'explain', label: '解释代码' },
      { code: 'refactor', label: '重构代码' },
      { code: 'comment', label: '添加注释' },
      { code: 'debug', label: '查找 Bug' },
      { code: 'translate', label: '翻译成其他语言' },
    ]
    languages.value = [
      { code: 'python', label: 'Python' },
      { code: 'javascript', label: 'JavaScript' },
      { code: 'typescript', label: 'TypeScript' },
      { code: 'java', label: 'Java' },
      { code: 'go', label: 'Go' },
    ]
    ElMessage.warning(`后端连接失败: ${e.message},使用默认选项`)
  }
}

async function analyze() {
  if (!canAnalyze.value) return

  streaming.value = true
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null

  try {
    const resp = await fetch(`${API_BASE}/api/coder/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: task.value,
        code: code.value,
        language: language.value,
        target_language: task.value === 'translate' ? targetLanguage.value : null,
      }),
    })

    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
          if (event.type === 'sources') {
            if (event.meta) lastMeta.value = event.meta
          } else if (event.type === 'token') {
            result.value += event.content
            // 流式时不解析 markdown, 直接当 plain text 渲染, 性能更好
            scrollToBottom()
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
    ElMessage.error('代码分析失败')
  } finally {
    streaming.value = false
  }
}

function clearAll() {
  code.value = ''
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null
}

function scrollToBottom() {
  nextTick(() => {
    if (resultRef.value) {
      resultRef.value.scrollTop = resultRef.value.scrollHeight
    }
  })
}

onMounted(() => {
  loadOptions()
})
</script>

<style scoped>
.coder-page {
  padding: 0;
}
.coder-header {
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
.meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* 表单 */
.form-item {
  margin-bottom: 14px;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}
.meta-inline {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
  margin-left: 8px;
}
.code-textarea :deep(.el-textarea__inner) {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #1e1e1e;
  color: #d4d4d4;
}

/* 结果区 */
.result-card {
  height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
}
.result-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 12px;
  min-height: 0;
}
.result-area {
  flex: 1;
  padding: 16px;
  background: #fafbfc;
  border-radius: 4px;
  overflow-y: auto;
  line-height: 1.7;
}
.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}
.empty-result p {
  margin: 6px 0 0;
}
.error-result {
  color: #f56c6c;
  white-space: pre-wrap;
}

/* 流式原始 */
.raw-text {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
  margin: 0;
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

/* 解析后的 markdown */
.markdown {
  font-size: 14px;
  color: #303133;
}
.markdown-text {
  white-space: pre-wrap;
  margin-bottom: 12px;
}
.code-block {
  background: #1e1e1e;
  border-radius: 6px;
  margin: 12px 0;
  overflow: hidden;
}
.code-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #2d2d2d;
  color: #ccc;
  font-size: 12px;
}
.code-lang {
  font-family: 'Consolas', monospace;
}
.code-block code {
  display: block;
  padding: 12px;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre;
  overflow-x: auto;
}
</style>