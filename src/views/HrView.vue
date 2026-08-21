<template>
  <div class="hr-page">
    <div class="hr-header">
      <div>
        <h2 style="margin: 0 0 4px;">HR 助手</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          JD 生成 / 简历筛选 / 入职材料 — 3 大场景一键搞定
        </p>
      </div>
      <el-button :icon="Refresh" @click="loadOptions" :loading="loadingOptions">刷新</el-button>
    </div>

    <el-row :gutter="16">
      <!-- 左:任务配置 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><UserFilled /></el-icon> 任务配置</span>
            </div>
          </template>

          <!-- 任务类型 -->
          <div class="form-item">
            <label class="form-label">任务</label>
            <el-radio-group v-model="task" class="task-group">
              <el-radio-button
                v-for="t in tasks"
                :key="t.code"
                :value="t.code"
              >
                {{ t.label }}
              </el-radio-button>
            </el-radio-group>
            <div class="hint">
              {{ taskHints[task] }}
            </div>
          </div>

          <!-- 动态字段 -->
          <div v-for="field in currentFields" :key="field.key" class="form-item">
            <label class="form-label">
              {{ field.label }}
              <span v-if="field.required" style="color: #f56c6c;">*</span>
            </label>
            <el-input
              v-if="field.type === 'input'"
              v-model="inputs[field.key]"
              :placeholder="field.placeholder || ''"
              :disabled="streaming"
            />
            <el-select
              v-else-if="field.type === 'select'"
              v-model="inputs[field.key]"
              :placeholder="field.placeholder || '请选择'"
              style="width: 100%;"
              :disabled="streaming"
            >
              <el-option
                v-for="opt in getSelectOptions(field.options)"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
            <el-input
              v-else
              v-model="inputs[field.key]"
              type="textarea"
              :rows="field.rows || 4"
              :placeholder="field.placeholder || ''"
              resize="vertical"
              :disabled="streaming"
            />
          </div>

          <el-button
            type="primary"
            :icon="Promotion"
            :loading="streaming"
            :disabled="!canSubmit"
            @click="run"
            style="width: 100%; margin-top: 8px;"
          >
            {{ streaming ? '生成中…' : '开始' }}
          </el-button>

          <el-button
            :icon="Delete"
            :disabled="messages.length === 0 || streaming"
            @click="clearAll"
            style="width: 100%; margin-top: 8px;"
          >
            清空记录
          </el-button>
        </el-card>
      </el-col>

      <!-- 右:结果 -->
      <el-col :xs="24" :md="15" :lg="16">
        <el-card shadow="never" class="qa-card chat-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><ChatDotRound /></el-icon> 生成结果</span>
              <div v-if="lastMeta" class="meta-tags">
                <el-tag size="small" type="info">{{ lastMeta.task_label }}</el-tag>
              </div>
            </div>
          </template>

          <div ref="messageListRef" class="message-list">
            <div v-if="messages.length === 0" class="empty-chat">
              <el-icon :size="48" color="#c0c4cc"><UserFilled /></el-icon>
              <p>还没生成任何内容</p>
              <p style="font-size: 12px;">左侧填字段,点「开始」</p>
            </div>

            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="message"
              :class="{ 'message-user': msg.role === 'user', 'message-ai': msg.role === 'assistant' }"
            >
              <div class="message-avatar">
                <el-avatar v-if="msg.role === 'user'" :size="32">我</el-avatar>
                <el-avatar v-else :size="32" style="background: linear-gradient(135deg, #0ea5e9, #14b8a6);">AI</el-avatar>
              </div>
              <div class="message-body">
                <div v-if="msg.role === 'user'" class="message-content">
                  <div class="meta-line">
                    📝 {{ msg.taskLabel }} · {{ formatTime(msg.ts) }}
                  </div>
                  <div class="params-summary">
                    <div v-for="field in currentFields" :key="field.key">
                      <span class="param-key">{{ field.label }}:</span>
                      <span class="param-val">{{ msg.inputs[field.key] || '(空)' }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="message-content">
                  <div class="meta-line">
                    ✨ {{ msg.taskLabel }} · {{ formatTime(msg.ts) }}
                    <el-button
                      v-if="!msg.streaming && msg.content"
                      link
                      type="primary"
                      size="small"
                      :icon="CopyDocument"
                      style="margin-left: 8px;"
                      @click="copyContent(msg.content)"
                    >
                      复制
                    </el-button>
                  </div>
                  <!-- 流式过程中: 纯文本 -->
                  <pre v-if="msg.streaming" class="raw-text">{{ msg.content }}<span class="cursor-blink">▍</span></pre>
                  <!-- 完成后: 渲染 Markdown -->
                  <template v-else>
                    <template v-for="(block, bi) in parseMd(msg.content)" :key="bi">
                      <pre v-if="block.type === 'code'" class="code-block">
                        <div class="code-block-header">
                          <span class="code-lang">{{ block.lang || 'plain' }}</span>
                          <el-button link size="small" :icon="CopyDocument" @click="copyContent(block.content)">复制</el-button>
                        </div>
                        <code>{{ block.content }}</code>
                      </pre>
                      <div v-else class="markdown-text" v-html="renderMd(block.content)" />
                    </template>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  CopyDocument,
  Delete,
  Promotion,
  Refresh,
  UserFilled,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface FieldDef {
  key: string
  label: string
  type: 'input' | 'textarea' | 'select'
  placeholder?: string
  options?: string  // 特殊值: 'industries' / 'locations' / 'experience_levels'
  required?: boolean
  rows?: number
}

interface TaskDef {
  code: string
  label: string
  fields: FieldDef[]
}

interface Message {
  role: 'user' | 'assistant'
  taskLabel: string
  ts: number
  content: string
  inputs?: Record<string, string>
  streaming?: boolean
}

interface MdBlock {
  type: 'text' | 'code'
  lang?: string
  content: string
}

const loadingOptions = ref(false)
const task = ref<'jd' | 'resume_screen' | 'onboarding'>('jd')
const inputs = reactive<Record<string, string>>({})
const streaming = ref(false)
const messages = ref<Message[]>([])
const messageListRef = ref<HTMLElement>()
const lastMeta = ref<{ task_label: string } | null>(null)

const tasks = ref<TaskDef[]>([])
const industries = ref<string[]>([])
const locations = ref<string[]>([])
const experienceLevels = ref<string[]>([])

const taskHints: Record<string, string> = {
  jd: '填写职位信息,生成完整 JD',
  resume_screen: '粘贴 JD 关键要求和候选人简历,AI 评估匹配度',
  onboarding: '生成新员工入职清单(第一天/第一周/联系人等)',
}

const currentFields = computed<FieldDef[]>(
  () => tasks.value.find((t) => t.code === task.value)?.fields || []
)

const currentTaskLabel = computed<string>(
  () => tasks.value.find((t) => t.code === task.value)?.label || ''
)

// 校验: 必填字段都填了才能提交
const canSubmit = computed<boolean>(() => {
  if (streaming.value) return false
  for (const f of currentFields.value) {
    if (f.required && !(inputs[f.key] || '').trim()) return false
  }
  return true
})

function getSelectOptions(key: string | undefined): string[] {
  if (key === 'industries') return industries.value
  if (key === 'locations') return locations.value
  if (key === 'experience_levels') return experienceLevels.value
  return []
}

// 任务切换时清空字段 + 给 select 默认第一个
watch(task, () => {
  for (const k of Object.keys(inputs)) delete inputs[k]
  for (const f of currentFields.value) {
    if (f.type === 'select') {
      const opts = getSelectOptions(f.options)
      if (opts.length > 0) inputs[f.key] = opts[0]
    } else {
      inputs[f.key] = ''
    }
  }
}, { immediate: true })

async function loadOptions() {
  loadingOptions.value = true
  try {
    const resp = await fetch(`${API_BASE}/api/hr/options`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    tasks.value = data.tasks || []
    industries.value = data.industries || []
    locations.value = data.locations || []
    experienceLevels.value = data.experience_levels || []
    ElMessage.success('配置已加载')
  } catch (e: any) {
    // fallback
    tasks.value = [
      { code: 'jd', label: 'JD 生成', fields: [] },
      { code: 'resume_screen', label: '简历筛选', fields: [] },
      { code: 'onboarding', label: '入职材料', fields: [] },
    ]
    ElMessage.warning(`后端连接失败: ${e.message}`)
  } finally {
    loadingOptions.value = false
  }
}

async function run() {
  if (!canSubmit.value) return

  const snapshot: Record<string, string> = {}
  for (const f of currentFields.value) {
    snapshot[f.key] = inputs[f.key] || ''
  }
  const ts = Date.now()

  // push user + AI 占位
  messages.value.push({ role: 'user', taskLabel: currentTaskLabel.value, ts, content: '', inputs: snapshot })
  messages.value.push({ role: 'assistant', taskLabel: currentTaskLabel.value, ts, content: '', streaming: true })
  const aiIdx = messages.value.length - 1

  streaming.value = true
  scrollToBottom()

  try {
    const resp = await fetch(`${API_BASE}/api/hr/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task.value, inputs: snapshot }),
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
            messages.value[aiIdx].content += event.content
            if (messages.value[aiIdx].content.length % 8 < 2) scrollToBottom()
          } else if (event.type === 'error') {
            ElMessage.error(event.message)
          }
        } catch {
          // skip
        }
      }
    }

    messages.value[aiIdx].streaming = false
  } catch (e: any) {
    messages.value[aiIdx].content = `❌ 请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    messages.value[aiIdx].streaming = false
    ElMessage.error('生成失败')
  } finally {
    streaming.value = false
    scrollToBottom()
  }
}

// 简单的 markdown 解析(标题/列表/段落/代码块)
function parseMd(text: string): MdBlock[] {
  if (!text) return []
  const blocks: MdBlock[] = []
  const regex = /```(\w*)\n?([\s\S]*?)```/g
  let lastIdx = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      const t = text.slice(lastIdx, m.index).trim()
      if (t) blocks.push({ type: 'text', content: t })
    }
    blocks.push({ type: 'code', lang: m[1] || '', content: m[2].trim() })
    lastIdx = regex.lastIndex
  }
  if (lastIdx < text.length) {
    const t = text.slice(lastIdx).trim()
    if (t) blocks.push({ type: 'text', content: t })
  }
  return blocks
}

// 把 markdown 简单转 HTML (标题/粗体/列表/段落)
function renderMd(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    // 标题 # ## ###
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    // 粗体 **xx**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 列表 - xx (注意要把多行识别为同一项)
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    // 换行 → 段落
    .split(/\n\n+/)
    .map((p) => {
      if (p.startsWith('<h') || p.startsWith('<ul>')) return p
      return `<p>${p.replace(/\n/g, '<br>')}</p>`
    })
    .join('\n')
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败')
  )
}

function clearAll() {
  messages.value = []
  lastMeta.value = null
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

onMounted(() => {
  loadOptions()
})
</script>

<style scoped>
.hr-page {
  padding: 0;
}
.hr-header {
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
.meta-tags {
  display: flex;
  gap: 6px;
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
.task-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

/* 消息 */
.chat-card {
  height: calc(100vh - 180px);
  display: flex;
  flex-direction: column;
}
.chat-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 12px;
}
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #fafbfc;
  border-radius: 4px;
}
.empty-chat {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}
.empty-chat p {
  margin: 6px 0 0;
}
.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  align-items: flex-start;
}
.message-user {
  flex-direction: row-reverse;
}
.message-body {
  max-width: 75%;
}
.message-user .message-body {
  text-align: right;
}
.message-content {
  background: #fff;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
  line-height: 1.6;
  text-align: left;
}
.message-user .message-content {
  background: linear-gradient(135deg, #0ea5e9, #14b8a6);
  color: #fff;
  border: none;
}
.meta-line {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}
.message-user .meta-line {
  color: rgba(255, 255, 255, 0.85);
}
.params-summary {
  font-size: 13px;
}
.params-summary > div {
  margin: 2px 0;
}
.param-key {
  opacity: 0.85;
  margin-right: 4px;
}
.param-val {
  font-weight: 500;
}

/* 渲染区 */
.raw-text {
  font-family: 'Consolas', monospace;
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
  color: #0ea5e9;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}
.markdown-text {
  font-size: 14px;
  line-height: 1.7;
}
.markdown-text :deep(h2) {
  font-size: 18px;
  margin: 12px 0 8px;
  border-bottom: 1px solid #e4e7ed;
  padding-bottom: 4px;
}
.markdown-text :deep(h3) {
  font-size: 16px;
  margin: 10px 0 6px;
  color: #14b8a6;
}
.markdown-text :deep(h4) {
  font-size: 14px;
  margin: 8px 0 4px;
  font-weight: 600;
}
.markdown-text :deep(ul) {
  margin: 6px 0;
  padding-left: 22px;
}
.markdown-text :deep(li) {
  margin: 2px 0;
}
.markdown-text :deep(p) {
  margin: 6px 0;
}
.markdown-text :deep(strong) {
  color: #14b8a6;
  font-weight: 600;
}

.code-block {
  background: #1e1e1e;
  border-radius: 6px;
  margin: 10px 0;
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