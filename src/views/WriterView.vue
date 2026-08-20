<template>
  <div class="writer-page">
    <div class="writer-header">
      <div>
        <h2 style="margin: 0 0 4px;">AI 写作助手</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          邮件 / 周报 / 营销文案 / 演讲稿 — 选择类型,填几个字段,流式生成
        </p>
      </div>
      <el-button :icon="Refresh" @click="loadTypes" :loading="loadingTypes">刷新类型</el-button>
    </div>

    <el-row :gutter="16">
      <!-- 左: 写作配置面板 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><EditPen /></el-icon> 写作配置</span>
            </div>
          </template>

          <!-- 写作类型 -->
          <div class="form-item">
            <label class="form-label">写作类型</label>
            <el-radio-group v-model="writeType" class="type-group">
              <el-radio-button
                v-for="t in writeTypes"
                :key="t.key"
                :value="t.key"
              >
                {{ t.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

          <!-- 动态字段(按类型变化) -->
          <div v-for="field in currentFields" :key="field.key" class="form-item">
            <label class="form-label">{{ field.label }}</label>
            <el-input
              v-if="field.type === 'input'"
              v-model="inputs[field.key]"
              :placeholder="field.placeholder"
            />
            <el-select
              v-else-if="field.type === 'select'"
              v-model="inputs[field.key]"
              :placeholder="field.placeholder || '请选择'"
              style="width: 100%;"
            >
              <el-option
                v-for="opt in field.options"
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
              :placeholder="field.placeholder"
              resize="vertical"
            />
          </div>

          <el-button
            type="primary"
            :icon="Promotion"
            :loading="streaming"
            :disabled="streaming || !canGenerate"
            @click="generate"
            style="width: 100%; margin-top: 8px;"
          >
            {{ streaming ? '生成中…' : '开始生成' }}
          </el-button>

          <el-button
            :icon="Delete"
            :disabled="messages.length === 0"
            @click="clearAll"
            style="width: 100%; margin-top: 8px;"
          >
            清空记录
          </el-button>
        </el-card>
      </el-col>

      <!-- 右: 生成结果 -->
      <el-col :xs="24" :md="15" :lg="16">
        <el-card shadow="never" class="qa-card chat-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><ChatDotRound /></el-icon> 生成结果</span>
              <el-tag v-if="streaming" type="warning" size="small">生成中…</el-tag>
            </div>
          </template>

          <!-- 消息流 -->
          <div ref="messageListRef" class="message-list">
            <div v-if="messages.length === 0" class="empty-chat">
              <el-icon :size="48" color="#c0c4cc"><EditPen /></el-icon>
              <p>还没生成任何内容</p>
              <p style="font-size: 12px; color: #909399;">左侧填字段,点「开始生成」即可</p>
            </div>

            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="message"
              :class="{ 'message-user': msg.role === 'user', 'message-ai': msg.role === 'assistant' }"
            >
              <div class="message-avatar">
                <el-avatar v-if="msg.role === 'user'" :size="32">我</el-avatar>
                <el-avatar v-else :size="32" style="background: linear-gradient(135deg, #10b981, #06b6d4);">AI</el-avatar>
              </div>
              <div class="message-body">
                <!-- user 消息: 显示输入参数摘要 -->
                <div v-if="msg.role === 'user'" class="message-content">
                  <div class="meta-line">
                    📝 {{ msg.typeLabel }} · {{ formatTime(msg.ts) }}
                  </div>
                  <div class="params-summary">
                    <div v-for="field in currentFields" :key="field.key">
                      <span class="param-key">{{ field.label }}:</span>
                      <span class="param-val">{{ msg.inputs[field.key] || '(空)' }}</span>
                    </div>
                  </div>
                </div>

                <!-- AI 消息: 显示生成内容 -->
                <div v-else class="message-content">
                  <div class="meta-line">
                    ✨ {{ msg.typeLabel }} · {{ formatTime(msg.ts) }}
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
                    <el-button
                      v-if="!msg.streaming && msg.content"
                      link
                      type="primary"
                      size="small"
                      :icon="Refresh"
                      style="margin-left: 4px;"
                      @click="regenerate"
                    >
                      重新生成
                    </el-button>
                  </div>
                  <div class="ai-text">{{ msg.content }}<span v-if="msg.streaming" class="cursor-blink">▍</span></div>
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
  EditPen,
  Promotion,
  Refresh,
} from '@element-plus/icons-vue'

const API_BASE = ''

// ===== 类型定义 =====
interface FieldDef {
  key: string
  label: string
  type: 'input' | 'textarea' | 'select'
  placeholder?: string
  options?: string[]
  rows?: number
}

interface WriteTypeDef {
  key: string
  label: string
  fields: FieldDef[]
}

interface Message {
  role: 'user' | 'assistant'
  typeLabel: string
  ts: number
  content: string
  inputs?: Record<string, string>
  streaming?: boolean
}

// ===== 写作类型配置(跟后端 prompts.py 对齐) =====
const writeTypes: WriteTypeDef[] = [
  {
    key: 'email',
    label: '📧 邮件',
    fields: [
      { key: 'tone', label: '语气', type: 'select', options: ['正式', '友好', '简洁', '道歉'], placeholder: '选个语气' },
      { key: 'recipient', label: '收件人', type: 'input', placeholder: '例如:王总 / 张工 / 全组同事' },
      { key: 'requirement', label: '需求描述', type: 'textarea', rows: 4, placeholder: '把想说的写下来,越具体 AI 写得越准' },
    ],
  },
  {
    key: 'weekly_report',
    label: '📋 周报',
    fields: [
      { key: 'raw_notes', label: '本周工作内容(随意)', type: 'textarea', rows: 8, placeholder: '想到啥写啥,AI 会自动整理成结构化周报\n例如:\n- 完成了用户模块的 CRUD\n- 修了 3 个 P1 bug\n- 周三开了一个需求评审会' },
    ],
  },
  {
    key: 'marketing',
    label: '📢 营销文案',
    fields: [
      { key: 'product_info', label: '产品/卖点', type: 'textarea', rows: 4, placeholder: '产品是什么?核心卖点是啥?' },
      { key: 'target_audience', label: '目标用户', type: 'input', placeholder: '例如:25-35 岁职场女性 / 互联网产品经理' },
      { key: 'word_limit', label: '字数', type: 'select', options: ['100字以内', '200-300字', '500字', '800-1000字'] },
    ],
  },
  {
    key: 'speech',
    label: '🎤 演讲稿',
    fields: [
      { key: 'scene', label: '演讲场景', type: 'input', placeholder: '例如:公司年会 / 产品发布会 / 毕业典礼' },
      { key: 'key_points', label: '核心观点', type: 'textarea', rows: 4, placeholder: '想传达哪些核心观点?' },
      { key: 'duration', label: '预计时长', type: 'select', options: ['3分钟', '5分钟', '10分钟', '20分钟'] },
    ],
  },
]

// ===== 状态 =====
const loadingTypes = ref(false)
const writeType = ref<string>('email')
const inputs = reactive<Record<string, string>>({})
const streaming = ref(false)
const messages = ref<Message[]>([])
const messageListRef = ref<HTMLElement>()

// 当前类型的字段定义(动态切换)
const currentFields = computed<FieldDef[]>(
  () => writeTypes.find((t) => t.key === writeType.value)?.fields || []
)

// 当前类型的标签(显示在消息里用)
const currentTypeLabel = computed<string>(
  () => writeTypes.find((t) => t.key === writeType.value)?.label || ''
)

// 校验必填(空字段不通过)
const canGenerate = computed<boolean>(() => {
  for (const f of currentFields.value) {
    if (!(inputs[f.key] || '').trim()) return false
  }
  return !streaming.value
})

// ===== 类型切换时清空字段 =====
watch(writeType, () => {
  for (const k of Object.keys(inputs)) delete inputs[k]
  // 给默认值,免得用户啥也没填就点生成
  for (const f of currentFields.value) {
    if (f.type === 'select' && f.options?.length) {
      inputs[f.key] = f.options[0]
    } else {
      inputs[f.key] = ''
    }
  }
}, { immediate: true })

// ===== 加载写作类型(可选,后端 GET /api/writer/types) =====
async function loadTypes() {
  loadingTypes.value = true
  try {
    const resp = await fetch(`${API_BASE}/api/writer/types`)
    // 这里只看是否通,不影响前端类型列表(前端已硬编码)
    if (!resp.ok) {
      ElMessage.warning(`后端返回 ${resp.status},使用前端默认类型`)
    } else {
      // 真要同步后端类型可以解开:
      // const data = await resp.json()
      // writeTypes.splice(0, writeTypes.length, ...data.types.map(t => ...))
      ElMessage.success('写作类型已就绪')
    }
  } catch (e: any) {
    ElMessage.warning(`后端连接失败: ${e.message}`)
  } finally {
    loadingTypes.value = false
  }
}

// ===== 流式生成 =====
async function generate() {
  if (!canGenerate.value) return

  // 1. push 用户输入
  const snapshot: Record<string, string> = {}
  for (const f of currentFields.value) {
    snapshot[f.key] = inputs[f.key] || ''
  }
  const ts = Date.now()
  messages.value.push({
    role: 'user',
    typeLabel: currentTypeLabel.value,
    ts,
    content: '',
    inputs: snapshot,
  })

  // 2. push AI 占位(流式往里追加)
  messages.value.push({
    role: 'assistant',
    typeLabel: currentTypeLabel.value,
    ts,
    content: '',
    streaming: true,
  })
  const aiMsgIdx = messages.value.length - 1

  streaming.value = true
  scrollToBottom()

  try {
    const resp = await fetch(`${API_BASE}/api/writer/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        write_type: writeType.value,
        inputs: snapshot,
        history: [],  // 写作不需要多轮历史,留空
      }),
    })

    if (!resp.ok || !resp.body) {
      throw new Error(`HTTP ${resp.status}`)
    }

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
          if (event.type === 'token') {
            messages.value[aiMsgIdx].content += event.content
            if (messages.value[aiMsgIdx].content.length % 8 < 2) {
              scrollToBottom()
            }
          } else if (event.type === 'error') {
            ElMessage.error(event.message)
          }
        } catch {
          // 跳过非 JSON 行
        }
      }
    }

    messages.value[aiMsgIdx].streaming = false
  } catch (e: any) {
    messages.value[aiMsgIdx].content = `❌ 请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    messages.value[aiMsgIdx].streaming = false
    ElMessage.error('生成请求失败')
  } finally {
    streaming.value = false
    scrollToBottom()
  }
}

// 重新生成(用同一份 inputs)
async function regenerate() {
  if (streaming.value) return
  // 找到最近一条 user 消息
  let lastUserIdx = -1
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'user') {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx === -1) {
    ElMessage.warning('没有可重新生成的内容')
    return
  }
  // 删掉 user 之后的所有 AI 消息
  messages.value.splice(lastUserIdx + 1)

  const last = messages.value[lastUserIdx]
  // 还原输入框
  if (last.inputs) {
    for (const f of currentFields.value) {
      inputs[f.key] = last.inputs[f.key] || ''
    }
  }
  await generate()
}

function copyContent(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败')
  )
}

function clearAll() {
  messages.value = []
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
  loadTypes()
})
</script>

<style scoped>
.writer-page {
  padding: 0;
}
.writer-header {
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
.type-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 消息流 */
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
  margin: 8px 0 0;
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
  background: linear-gradient(135deg, #10b981, #06b6d4);
  color: #fff;
  border: none;
}
.message-ai .message-content {
  background: #fff;
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
.ai-text {
  white-space: pre-wrap;
  word-break: break-word;
}
.cursor-blink {
  display: inline-block;
  animation: blink 1s steps(2, start) infinite;
  color: #10b981;
  margin-left: 2px;
}
@keyframes blink {
  to {
    visibility: hidden;
  }
}
</style>