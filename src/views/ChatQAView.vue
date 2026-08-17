<template>
  <div class="chat-qa-page">
    <div class="chat-qa-header">
      <div>
        <h2 style="margin: 0 0 4px;">智能问答 · RAG</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          上传文档 → 自动切片入库 → 自然语言提问 → 精准回答 + 引用来源
        </p>
      </div>
      <el-button :icon="Refresh" @click="loadDocuments" :loading="loadingDocs">
        刷新知识库
      </el-button>
    </div>

    <el-row :gutter="16">
      <!-- 左: 知识库管理 + 调试面板 -->
      <el-col :xs="24" :md="10" :lg="8">
        <!-- 文档上传 -->
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><UploadFilled /></el-icon> 上传文档</span>
            </div>
          </template>
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :show-file-list="false"
            :accept="'.pdf,.docx,.md,.txt'"
            :on-change="handleFileChange"
          >
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处, 或<em>点击上传</em>
            </div>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF / Word / Markdown / TXT, 单文件 ≤ 20MB
              </div>
            </template>
          </el-upload>

          <div v-if="uploading" style="margin-top: 12px;">
            <el-progress :percentage="uploadProgress" :status="uploadStatus" />
          </div>

          <div v-if="lastUpload" style="margin-top: 12px; padding: 8px 12px; background: #f0f9ff; border-radius: 4px; font-size: 13px;">
            ✅ 「{{ lastUpload.filename }}」入库成功 · {{ lastUpload.chunk_count }} 个切片
          </div>
        </el-card>

        <!-- 知识库列表 -->
        <el-card shadow="never" class="qa-card" style="margin-top: 16px;">
          <template #header>
            <div class="card-header">
              <span><el-icon><Folder /></el-icon> 知识库 ({{ documents.length }})</span>
            </div>
          </template>
          <div v-if="documents.length === 0" style="color: #909399; font-size: 13px; text-align: center; padding: 20px 0;">
            还没上传任何文档
          </div>
          <div v-else class="doc-list">
            <div v-for="doc in documents" :key="doc.doc_id" class="doc-item">
              <div style="flex: 1; min-width: 0;">
                <div class="doc-name" :title="doc.filename">{{ doc.filename }}</div>
                <div class="doc-meta">{{ doc.chunk_count }} chunks · {{ formatBytes(doc.file_size) }}</div>
              </div>
              <el-button
                type="danger"
                link
                size="small"
                @click="handleDelete(doc.doc_id)"
              >
                删除
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 调试面板 -->
        <el-card
          v-if="debugMode && lastSources.length > 0"
          shadow="never"
          class="qa-card"
          style="margin-top: 16px;"
        >
          <template #header>
            <div class="card-header">
              <span>
                <el-icon><DataAnalysis /></el-icon>
                检索调试 ({{ lastSources.length }} hits)
              </span>
              <el-tag size="small" type="info">debug</el-tag>
            </div>
          </template>
          <div class="debug-list">
            <div
              v-for="(src, idx) in lastSources"
              :key="src.chunk_id"
              class="debug-item"
            >
              <div class="debug-item-header">
                <span class="debug-idx">#{{ idx + 1 }}</span>
                <span class="debug-filename">{{ src.filename }}</span>
                <el-tag
                  size="small"
                  :type="scoreType(src.score)"
                  effect="dark"
                >
                  score: {{ src.score.toFixed(4) }}
                </el-tag>
              </div>
              <div class="debug-content">{{ src.content }}</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <!-- 右: 对话区 -->
      <el-col :xs="24" :md="14" :lg="16">
        <el-card shadow="never" class="qa-card chat-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><ChatDotRound /></el-icon> 智能问答</span>
              <div style="display: flex; gap: 8px;">
                <el-switch
                  v-model="debugMode"
                  active-text="调试"
                  inline-prompt
                  size="small"
                />
                <el-button size="small" :icon="Delete" @click="clearChat">清空</el-button>
              </div>
            </div>
          </template>

          <!-- 消息流 -->
          <div ref="messageListRef" class="message-list">
            <div v-if="messages.length === 0" class="empty-chat">
              <el-icon :size="48" color="#c0c4cc"><ChatDotRound /></el-icon>
              <p>开始提问吧，试试：</p>
              <div class="example-questions">
                <el-tag
                  v-for="(q, i) in exampleQuestions"
                  :key="i"
                  class="example-q"
                  effect="plain"
                  @click="askExample(q)"
                >
                  {{ q }}
                </el-tag>
              </div>
            </div>

            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="message"
              :class="{ 'message-user': msg.role === 'user', 'message-ai': msg.role === 'assistant' }"
            >
              <div class="message-avatar">
                <el-avatar v-if="msg.role === 'user'" :size="32">我</el-avatar>
                <el-avatar v-else :size="32" style="background: linear-gradient(135deg, #3b82f6, #6366f1);">AI</el-avatar>
              </div>
              <div class="message-body">
                <div class="message-content">{{ msg.content }}<span v-if="msg.role === 'assistant' && msg.streaming" class="cursor-blink">▍</span></div>
                <div v-if="msg.sources && msg.sources.length > 0" class="message-sources">
                  <div class="sources-label">📚 引用来源</div>
                  <el-tag
                    v-for="(src, j) in msg.sources"
                    :key="j"
                    size="small"
                    type="info"
                    effect="plain"
                    @click="scrollToSource(src)"
                    class="source-tag"
                  >
                    [{{ j + 1 }}] {{ src.filename }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>

          <!-- 输入区 -->
          <div class="input-area">
            <el-input
              v-model="input"
              type="textarea"
              :rows="2"
              placeholder="输入你的问题，Enter 发送，Shift+Enter 换行"
              @keydown.enter.exact.prevent="sendQuestion"
              :disabled="streaming"
              resize="none"
            />
            <el-button
              type="primary"
              :icon="Promotion"
              :loading="streaming"
              :disabled="!input.trim() || streaming"
              @click="sendQuestion"
              style="margin-top: 8px; width: 100%;"
            >
              {{ streaming ? '生成中…' : '发送' }}
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ChatDotRound,
  DataAnalysis,
  Delete,
  Folder,
  Promotion,
  Refresh,
  UploadFilled,
} from '@element-plus/icons-vue'

// API 地址: dev 模式走 vite proxy(/api → 127.0.0.1:8001)
// 生产部署时再改成实际后端地址 + nginx 反代
const API_BASE = ''

// ===== 类型定义 =====
interface DocumentInfo {
  doc_id: string
  filename: string
  file_size: number
  chunk_count: number
  upload_time?: string
}

interface Source {
  chunk_id: string
  doc_id: string
  filename: string
  content: string
  score: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  streaming?: boolean
}

// ===== 状态 =====
const uploadRef = ref()
const messageListRef = ref<HTMLElement>()
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadStatus = ref<'' | 'success' | 'exception'>('')
const lastUpload = ref<{ filename: string; chunk_count: number } | null>(null)

const loadingDocs = ref(false)
const documents = ref<DocumentInfo[]>([])

const input = ref('')
const messages = ref<Message[]>([])
const streaming = ref(false)
const lastSources = ref<Source[]>([])
const debugMode = ref(true)  // 默认开调试,学习期方便

const exampleQuestions = [
  '公司试用期多久？',
  '年假最多能休几天？',
  '差旅报销多久到账？',
]

// ===== 加载文档列表 =====
async function loadDocuments() {
  loadingDocs.value = true
  try {
    const resp = await fetch(`${API_BASE}/api/documents`)
    const data = await resp.json()
    documents.value = data.documents || []
  } catch (e: any) {
    ElMessage.warning(`后端连接失败: ${e.message}。请确认后端服务已启动 (python -m app.main)`)
  } finally {
    loadingDocs.value = false
  }
}

// ===== 上传 =====
async function handleFileChange(uploadFile: any) {
  const file = uploadFile.raw
  if (!file) return
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('文件超过 20MB')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = ''

  const formData = new FormData()
  formData.append('file', file)

  try {
    // 用 XHR 才能监听 progress
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/api/upload`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        uploadProgress.value = Math.round((e.loaded / e.total) * 100)
      }
    }

    xhr.onload = () => {
      uploading.value = false
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText)
        uploadStatus.value = 'success'
        lastUpload.value = { filename: data.filename, chunk_count: data.chunk_count }
        ElMessage.success(`✅ 入库成功 · ${data.chunk_count} 个切片`)
        loadDocuments()
      } else {
        uploadStatus.value = 'exception'
        try {
          const err = JSON.parse(xhr.responseText)
          ElMessage.error(`上传失败: ${err.detail || xhr.statusText}`)
        } catch {
          ElMessage.error(`上传失败: HTTP ${xhr.status}`)
        }
      }
    }

    xhr.onerror = () => {
      uploading.value = false
      uploadStatus.value = 'exception'
      ElMessage.error('网络错误,请检查后端服务是否运行在 8001 端口')
    }

    xhr.send(formData)
  } catch (e: any) {
    uploading.value = false
    ElMessage.error(`上传异常: ${e.message}`)
  }
}

// ===== 删除文档 =====
async function handleDelete(docId: string) {
  try {
    await ElMessageBox.confirm('确定删除该文档及其所有切片？', '确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await fetch(`${API_BASE}/api/documents/${docId}`, { method: 'DELETE' })
    ElMessage.success('已删除')
    loadDocuments()
  } catch (e: any) {
    ElMessage.error(`删除失败: ${e.message}`)
  }
}

// ===== 对话 =====
async function sendQuestion() {
  const q = input.value.trim()
  if (!q || streaming.value) return

  messages.value.push({ role: 'user', content: q })
  input.value = ''
  scrollToBottom()

  // 加一条 AI 消息, 流式往里追加
  // 用索引访问, 而不是持有对象引用 —— Vue 3 对 push 进去的 plain object
  // 会创建 reactive proxy, 但局部变量 aiMsg 不会自动变 proxy, 直接 mutate 它
  // 可能触发不了响应式更新
  messages.value.push({ role: 'assistant', content: '', streaming: true })
  const aiMsgIdx = messages.value.length - 1
  streaming.value = true
  lastSources.value = []

  // 拿历史
  const history = messages.value
    .filter((m) => !m.streaming)
    .slice(0, -1)  // 排除刚加的 user
    .slice(-6)     // 只带最近 3 轮
    .map((m) => ({ role: m.role, content: m.content }))

  try {
    const resp = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, history }),
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
          if (event.type === 'sources') {
            lastSources.value = event.sources || []
          } else if (event.type === 'token') {
            // 通过数组下标访问, 触发 Vue 响应式更新
            // 关键: 不能用 const aiMsg = {...}; push; mutate aiMsg, 那样可能 mutate 到非 proxy 对象
            messages.value[aiMsgIdx].content += event.content
            // 流式时每隔几个 token 滚一次底, 不要每个都滚(性能差)
            if (messages.value[aiMsgIdx].content.length % 6 < 2) {
              scrollToBottom()
            }
          } else if (event.type === 'error') {
            ElMessage.error(event.message)
          }
        } catch {
          // 解析失败忽略
        }
      }
    }

    messages.value[aiMsgIdx].sources = lastSources.value
    messages.value[aiMsgIdx].streaming = false
  } catch (e: any) {
    messages.value[aiMsgIdx].content = `❌ 请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    messages.value[aiMsgIdx].streaming = false
    ElMessage.error('问答请求失败')
  } finally {
    streaming.value = false
    scrollToBottom()
  }
}

function askExample(q: string) {
  input.value = q
  sendQuestion()
}

function clearChat() {
  messages.value = []
  lastSources.value = []
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}

function scrollToSource(_src: Source) {
  // 简化: 点击引用高亮对应 message
  ElMessage.info('可在此处实现点击跳转到对应 chunk 高亮')
}

// ===== 工具 =====
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function scoreType(score: number): 'success' | 'warning' | 'danger' {
  // 余弦相似度, 越接近 0 越相似
  if (score < 0.5) return 'success'
  if (score < 0.8) return 'warning'
  return 'danger'
}

onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.chat-qa-page {
  padding: 0;
}
.chat-qa-header {
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
.upload-icon {
  font-size: 48px;
  color: #409eff;
  margin-bottom: 8px;
}

.doc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}
.doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8f9fb;
  border-radius: 4px;
  font-size: 13px;
}
.doc-name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.doc-meta {
  color: #909399;
  font-size: 12px;
  margin-top: 2px;
}

.debug-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.debug-item {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px 10px;
  background: #fafbfc;
}
.debug-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  font-size: 12px;
}
.debug-idx {
  font-weight: 600;
  color: #409eff;
}
.debug-filename {
  color: #606266;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.debug-content {
  font-size: 12px;
  color: #303133;
  line-height: 1.5;
  background: #fff;
  padding: 6px 8px;
  border-radius: 3px;
  border: 1px dashed #dcdfe6;
  white-space: pre-wrap;
  word-break: break-word;
}

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
  margin-bottom: 12px;
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
.example-questions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  justify-content: center;
}
.example-q {
  cursor: pointer;
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
  max-width: 70%;
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
  white-space: pre-wrap;
  word-break: break-word;
  text-align: left;
}
.message-user .message-content {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: #fff;
  border: none;
}
.message-ai .message-content {
  background: #fff;
}
.message-sources {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
}
.sources-label {
  font-size: 12px;
  color: #909399;
  margin-right: 4px;
}
.source-tag {
  cursor: pointer;
  font-size: 11px !important;
}
.cursor-blink {
  animation: blink 1s infinite;
  color: #409eff;
}
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.input-area {
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}
</style>