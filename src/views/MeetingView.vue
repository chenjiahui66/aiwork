<template>
  <div class="meeting-page">
    <div class="meeting-header">
      <div>
        <h2 style="margin: 0 0 4px;">会议助手</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          浏览器实时录音 / 上传文件 / 粘贴转写 → AI 自动生成会议纪要、待办清单、5 句摘要
        </p>
      </div>
    </div>

    <el-row :gutter="16">
      <!-- 左:输入区 -->
      <el-col :xs="24" :md="10" :lg="9">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Microphone /></el-icon> 会议输入</span>
            </div>
          </template>

          <!-- 录音模式 -->
          <div class="recorder-area">
            <div class="recorder-status">
              <div
                class="recorder-dot"
                :class="{ recording: isRecording }"
              ></div>
              <span class="recorder-text">
                {{ isRecording ? `录音中 · ${formatDuration(recTime)}` : '未录音' }}
              </span>
              <span v-if="!browserSupportsSpeech" class="recorder-warn">
                ⚠️ 当前浏览器不支持语音识别
              </span>
            </div>

            <div class="recorder-buttons">
              <el-button
                v-if="!isRecording"
                type="primary"
                :icon="Microphone"
                @click="startRecording"
                :disabled="!browserSupportsSpeech"
              >
                开始录音
              </el-button>
              <el-button
                v-else
                type="danger"
                :icon="VideoPause"
                @click="stopRecording"
              >
                停止录音
              </el-button>
              <el-button
                :icon="Delete"
                @click="clearTranscript"
                :disabled="isRecording"
              >
                清空
              </el-button>
            </div>
          </div>

          <el-divider><span style="font-size: 12px; color: #909399;">或粘贴 / 输入会议内容</span></el-divider>

          <!-- 文本模式 -->
          <div class="form-item">
            <label class="form-label">会议转写文本</label>
            <el-input
              v-model="transcript"
              type="textarea"
              :rows="10"
              placeholder="把会议内容粘到这里...&#10;可以录音自动填充, 也可以手动粘贴第三方转写结果"
              resize="vertical"
              :disabled="isRecording"
              @input="charCount = transcript.length"
            />
            <div class="text-meta">
              {{ transcript.length }} 字
              <span v-if="transcript.length > 25000" style="color: #f56c6c;">(超过 25000 字会被截断)</span>
            </div>
          </div>

          <!-- 任务类型 -->
          <div class="form-item">
            <label class="form-label">处理类型</label>
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
              {{
                task === 'minutes' ? '完整会议纪要(议题 / 决议 / 行动项)'
                : task === 'todo' ? '只提取待办事项, 按优先级排序'
                : '5 句话以内的精简摘要'
                }}
            </div>
          </div>

          <el-button
            type="primary"
            :icon="MagicStick"
            :loading="streaming"
            :disabled="transcript.trim().length < 10 || streaming"
            @click="process"
            style="width: 100%;"
          >
            {{ streaming ? '生成中…' : '开始处理' }}
          </el-button>
        </el-card>
      </el-col>

      <!-- 右:结果 -->
      <el-col :xs="24" :md="14" :lg="15">
        <el-card shadow="never" class="qa-card result-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Document /></el-icon> 处理结果</span>
              <div v-if="lastMeta" class="meta-tags">
                <el-tag size="small" type="info">{{ lastMeta.task_label }}</el-tag>
                <el-tag size="small">{{ lastMeta.char_count }} 字输入</el-tag>
                <el-tag v-if="lastMeta.truncated" size="small" type="warning">已截断</el-tag>
              </div>
            </div>
          </template>

          <div ref="resultRef" class="result-area">
            <div v-if="!result && !streaming && !errorMsg" class="empty-result">
              <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
              <p>还没处理会议内容</p>
              <p style="font-size: 12px;">左侧录音 或 粘贴文本,点「开始处理」</p>
            </div>
            <div v-else-if="errorMsg" class="error-result">
              ❌ {{ errorMsg }}
            </div>
            <div v-else class="result-content">
              <!-- 流式: 纯文本 -->
              <pre v-if="streaming" class="raw-text">{{ result }}<span class="cursor-blink">▍</span></pre>
              <!-- 完成后: markdown -->
              <template v-else>
                <template v-for="(block, bi) in parsedBlocks" :key="bi">
                  <pre v-if="block.type === 'code'" class="code-block">
                    <div class="code-block-header">
                      <span class="code-lang">{{ block.lang || 'plain' }}</span>
                      <el-button link size="small" :icon="CopyDocument" @click="copyCode(block.content)">复制</el-button>
                    </div>
                    <code>{{ block.content }}</code>
                  </pre>
                  <div v-else class="markdown-text" v-html="renderMd(block.content)" />
                </template>
                <div class="result-actions">
                  <el-button type="primary" :icon="CopyDocument" @click="copyFullResult">复制全部</el-button>
                  <el-button :icon="Download" @click="downloadResult">下载 .md</el-button>
                </div>
              </template>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Delete,
  Document,
  Download,
  MagicStick,
  Microphone,
  VideoPause,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface Task { code: string; label: string }
interface Meta {
  task: string
  task_label: string
  char_count: number
  truncated: boolean
}
interface MdBlock {
  type: 'text' | 'code'
  lang?: string
  content: string
}

const transcript = ref('')
const charCount = ref(0)
const task = ref<'minutes' | 'todo' | 'summary'>('minutes')
const tasks = ref<Task[]>([])

const streaming = ref(false)
const result = ref('')
const errorMsg = ref('')
const lastMeta = ref<Meta | null>(null)
const resultRef = ref<HTMLElement>()

// 录音状态
const isRecording = ref(false)
const browserSupportsSpeech = ref(true)
const recTime = ref(0)  // 秒
let recTimer: number | null = null
let recognition: any = null

const resultText = computed(() => result.value)

const parsedBlocks = computed<MdBlock[]>(() => parseMd(resultText.value))

// ===== 浏览器原生 STT =====
function initRecognition() {
  // @ts-ignore - 浏览器私有 API
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) {
    browserSupportsSpeech.value = false
    return null
  }
  const rec = new SR()
  rec.continuous = true         // 持续识别
  rec.interimResults = true     // 返回中间结果
  rec.lang = 'zh-CN'             // 中文(支持中英混排)
  rec.maxAlternatives = 1

  let finalTranscript = ''

  rec.onresult = (event: any) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcriptPart = event.results[i][0].transcript
      if (event.results[i].isFinal) {
        finalTranscript += transcriptPart + '\n'
      } else {
        interim += transcriptPart
      }
    }
    // 把最终结果 + 中间结果合并显示
    transcript.value = finalTranscript + interim
    charCount.value = transcript.value.length
  }

  rec.onerror = (e: any) => {
    ElMessage.warning(`录音识别出错: ${e.error}。请检查麦克风权限。`)
    stopRecording()
  }

  rec.onend = () => {
    if (isRecording.value) {
      // 自动重启(浏览器会自动关闭)
      try { rec.start() } catch { /* ignore */ }
    }
  }

  return rec
}

async function startRecording() {
  if (!browserSupportsSpeech.value) {
    ElMessage.warning('当前浏览器不支持语音识别, 请用 Chrome/Edge 或手动粘贴文本')
    return
  }
  if (isRecording.value) return

  try {
    if (!recognition) recognition = initRecognition()
    if (!recognition) return

    recognition.start()
    isRecording.value = true
    recTime.value = 0
    recTimer = window.setInterval(() => recTime.value++, 1000)
    ElMessage.success('开始录音, 请说话...')
  } catch (e: any) {
    ElMessage.error(`无法启动录音: ${e.message}。请允许麦克风权限。`)
  }
}

function stopRecording() {
  isRecording.value = false
  if (recTimer) {
    clearInterval(recTimer)
    recTimer = null
  }
  if (recognition) {
    try { recognition.stop() } catch { /* ignore */ }
  }
}

function clearTranscript() {
  transcript.value = ''
  charCount.value = 0
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`
}

// ===== Markdown 渲染 =====
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

function renderMd(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 复选框 - [ ] 或 - [x]
    .replace(/^- \[ \] (.+)$/gm, '<li class="todo">☐ $1</li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="todo done">☑ $1</li>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .split(/\n\n+/)
    .map((p) => p.startsWith('<h') || p.startsWith('<ul>') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function copyCode(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}

function copyFullResult() {
  if (!result.value) return
  navigator.clipboard.writeText(result.value).then(
    () => ElMessage.success('全部已复制'),
    () => ElMessage.error('复制失败')
  )
}

function downloadResult() {
  if (!result.value) {
    ElMessage.warning('还没生成内容')
    return
  }
  const blob = new Blob([
    `# ${lastMeta.value?.task_label || '会议结果'}\n\n`,
    `> 由 AiWork 会议助手生成\n`,
    `> 时间: ${new Date().toLocaleString()}\n\n`,
    `---\n\n`,
    result.value,
  ], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `meeting-${task.value}-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已下载 .md 文件')
}

// ===== 后端调用 =====
async function loadOptions() {
  try {
    const resp = await fetch(`${API_BASE}/api/meeting/options`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    tasks.value = data.tasks || []
  } catch (e: any) {
    tasks.value = [
      { code: 'minutes', label: '会议纪要' },
      { code: 'todo', label: '待办清单' },
      { code: 'summary', label: '5 句摘要' },
    ]
    ElMessage.warning(`后端连接失败: ${e.message}`)
  }
}

async function process() {
  if (transcript.value.trim().length < 10) {
    ElMessage.warning('请先录音或粘贴会议内容')
    return
  }
  if (isRecording.value) stopRecording()

  streaming.value = true
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null

  try {
    const resp = await fetch(`${API_BASE}/api/meeting/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task: task.value,
        transcript: transcript.value,
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
            scrollToBottom()
          } else if (event.type === 'error') {
            errorMsg.value = event.message
          }
        } catch { /* skip */ }
      }
    }
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    ElMessage.error('会议处理失败')
  } finally {
    streaming.value = false
  }
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
  // 检测浏览器支持
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SR) browserSupportsSpeech.value = false
})

onUnmounted(() => {
  stopRecording()
})
</script>

<style scoped>
.meeting-page {
  padding: 0;
}
.meeting-header {
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

/* 录音区 */
.recorder-area {
  padding: 16px;
  background: linear-gradient(135deg, #f8f9fb, #fafbfc);
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}
.recorder-status {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.recorder-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dcdfe6;
  transition: all 0.3s;
}
.recorder-dot.recording {
  background: #f56c6c;
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(245, 108, 108, 0); }
  100% { box-shadow: 0 0 0 0 rgba(245, 108, 108, 0); }
}
.recorder-text {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}
.recorder-warn {
  font-size: 12px;
  color: #e6a23c;
  margin-left: 8px;
}
.recorder-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.recorder-buttons .el-button {
  flex: 1;
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
.text-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  text-align: right;
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
  min-height: 0;
  padding: 12px;
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
  min-height: 200px;
  color: #909399;
  font-size: 14px;
}
.empty-result p {
  margin-top: 8px;
}
.error-result {
  color: #f56c6c;
  white-space: pre-wrap;
}

/* 流式 */
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
  color: #8b5cf6;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}

/* markdown */
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
  color: #8b5cf6;
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
.markdown-text :deep(li.todo) {
  list-style: none;
  margin-left: -22px;
}
.markdown-text :deep(li.todo.done) {
  color: #67c23a;
  text-decoration: line-through;
}
.markdown-text :deep(p) {
  margin: 6px 0;
}
.markdown-text :deep(strong) {
  color: #8b5cf6;
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
  white-space: pre-wrap;
}

.result-actions {
  margin-top: 16px;
  padding: 12px;
  background: linear-gradient(135deg, #f5f3ff, #fff);
  border: 1px dashed #8b5cf6;
  border-radius: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>