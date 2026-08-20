<template>
  <div class="summarizer-page">
    <div class="summarizer-header">
      <div>
        <h2 style="margin: 0 0 4px;">文档摘要</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          贴一段长文 / 从知识库挑一篇文档 — 流式生成短摘要、要点列表或 TL;DR
        </p>
      </div>
    </div>

    <el-tabs v-model="inputMode" class="input-tabs">
      <!-- 模式 1: 从知识库选文档 -->
      <el-tab-pane label="📚 从知识库选文档" name="doc">
        <el-row :gutter="16">
          <el-col :xs="24" :md="10">
            <el-card shadow="never" class="qa-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Folder /></el-icon> 选一篇文档</span>
                  <el-button link size="small" :icon="Refresh" @click="loadDocs">刷新</el-button>
                </div>
              </template>
              <div v-if="documents.length === 0" style="color: #909399; font-size: 13px; text-align: center; padding: 30px 0;">
                知识库里还没有文档,<el-link type="primary" @click="$router.push('/apps/chat-qa')">先去上传</el-link>
              </div>
              <div v-else class="doc-list">
                <div
                  v-for="doc in documents"
                  :key="doc.doc_id"
                  class="doc-item"
                  :class="{ active: selectedDocId === doc.doc_id }"
                  @click="selectedDocId = doc.doc_id"
                >
                  <div style="flex: 1; min-width: 0;">
                    <div class="doc-name" :title="doc.filename">{{ doc.filename }}</div>
                    <div class="doc-meta">{{ doc.chunk_count }} 个切片 · {{ formatBytes(doc.file_size) }}</div>
                  </div>
                  <el-icon v-if="selectedDocId === doc.doc_id" color="#10b981"><Check /></el-icon>
                </div>
              </div>
            </el-card>
          </el-col>

          <el-col :xs="24" :md="14">
            <el-card shadow="never" class="qa-card">
              <template #header>
                <div class="card-header">
                  <span><el-icon><Setting /></el-icon> 摘要设置</span>
                </div>
              </template>
              <div class="form-item">
                <label class="form-label">摘要类型</label>
                <el-radio-group v-model="summaryType">
                  <el-radio-button value="short">短摘要</el-radio-button>
                  <el-radio-button value="key_points">要点列表</el-radio-button>
                  <el-radio-button value="tldr">TL;DR</el-radio-button>
                </el-radio-group>
                <div class="hint">
                  {{
                    summaryType === 'short' ? '1-3 句话概括全文核心内容'
                    : summaryType === 'key_points' ? '提取 3-7 条关键要点(Markdown 列表)'
                    : '不超过 100 字的"太长不看"摘要'
                  }}
                </div>
              </div>
              <el-button
                type="primary"
                :icon="MagicStick"
                :loading="streaming"
                :disabled="!selectedDocId || streaming"
                @click="summarizeFromDoc"
                style="width: 100%;"
              >
                {{ streaming ? '生成中…' : '生成摘要' }}
              </el-button>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>

      <!-- 模式 2: 直接粘贴文本 -->
      <el-tab-pane label="📝 粘贴文本" name="text">
        <el-card shadow="never" class="qa-card">
          <el-input
            v-model="rawText"
            type="textarea"
            :rows="10"
            placeholder="把要摘要的长文粘到这里...\n支持中文、英文、混排\n超过 30000 字会自动截断"
            resize="vertical"
            :disabled="streaming"
          />
          <div class="text-meta">
            {{ rawText.length }} 字
            <span v-if="rawText.length > 30000" style="color: #f56c6c;"> (超过 30000 字会被截断)</span>
          </div>

          <div class="form-item" style="margin-top: 16px;">
            <label class="form-label">摘要类型</label>
            <el-radio-group v-model="summaryType">
              <el-radio-button value="short">短摘要</el-radio-button>
              <el-radio-button value="key_points">要点列表</el-radio-button>
              <el-radio-button value="tldr">TL;DR</el-radio-button>
            </el-radio-group>
          </div>

          <el-button
            type="primary"
            :icon="MagicStick"
            :loading="streaming"
            :disabled="rawText.trim().length < 10 || streaming"
            @click="summarizeFromText"
            style="width: 100%; margin-top: 8px;"
          >
            {{ streaming ? '生成中…' : '生成摘要' }}
          </el-button>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <!-- 结果区(两种模式共用) -->
    <el-card shadow="never" class="qa-card chat-card" style="margin-top: 16px;">
      <template #header>
        <div class="card-header">
          <span><el-icon><Document /></el-icon> 摘要结果</span>
          <div v-if="lastMeta" class="meta-tags">
            <el-tag size="small" type="info">{{ typeLabel(lastMeta.summary_type) }}</el-tag>
            <el-tag v-if="lastMeta.filename" size="small" type="success">{{ lastMeta.filename }}</el-tag>
            <el-tag size="small">{{ lastMeta.char_count }} 字输入</el-tag>
            <el-tag v-if="lastMeta.truncated" size="small" type="warning">已截断</el-tag>
          </div>
        </div>
      </template>

      <div class="result-area">
        <div v-if="!result && !streaming && !errorMsg" class="empty-result">
          <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
          <p>还没生成摘要</p>
        </div>
        <div v-else-if="errorMsg" class="error-result">
          ❌ {{ errorMsg }}
        </div>
        <div v-else class="result-text">
          {{ result }}<span v-if="streaming" class="cursor-blink">▍</span>
          <el-button
            v-if="!streaming && result"
            link
            type="primary"
            size="small"
            :icon="CopyDocument"
            style="margin-left: 12px;"
            @click="copyResult"
          >
            复制
          </el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  CopyDocument,
  Document,
  Folder,
  MagicStick,
  Refresh,
  Setting,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface DocumentInfo {
  doc_id: string
  filename: string
  file_size: number
  chunk_count: number
}

interface SummaryMeta {
  char_count: number
  truncated: boolean
  doc_id?: string
  filename?: string
  summary_type: string
}

const inputMode = ref<'doc' | 'text'>('doc')
const documents = ref<DocumentInfo[]>([])
const selectedDocId = ref<string>('')
const rawText = ref<string>('')
const summaryType = ref<'short' | 'key_points' | 'tldr'>('short')

const streaming = ref(false)
const result = ref('')
const errorMsg = ref('')
const lastMeta = ref<SummaryMeta | null>(null)

// 加载知识库文档列表
async function loadDocs() {
  try {
    const resp = await fetch(`${API_BASE}/api/documents`)
    const data = await resp.json()
    documents.value = data.documents || []
  } catch (e: any) {
    ElMessage.warning(`后端连接失败: ${e.message}`)
  }
}

// ========== 文档模式 ==========
async function summarizeFromDoc() {
  if (!selectedDocId.value) {
    ElMessage.warning('请先选一篇文档')
    return
  }
  await runSummarize(async () => {
    const resp = await fetch(`${API_BASE}/api/summarizer/document`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doc_id: selectedDocId.value,
        summary_type: summaryType.value,
      }),
    })
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
    await consumeStream(resp.body)
  })
}

// ========== 文本模式 ==========
async function summarizeFromText() {
  const text = rawText.value.trim()
  if (text.length < 10) {
    ElMessage.warning('文本太短, 至少 10 个字')
    return
  }
  await runSummarize(async () => {
    const resp = await fetch(`${API_BASE}/api/summarizer/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        summary_type: summaryType.value,
      }),
    })
    if (!resp.ok || !resp.body) throw new Error(`HTTP ${resp.status}`)
    await consumeStream(resp.body)
  })
}

// ========== 通用 SSE 消费 ==========
async function runSummarize(fn: () => Promise<void>) {
  streaming.value = true
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null

  try {
    await fn()
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    ElMessage.error('摘要请求失败')
  } finally {
    streaming.value = false
  }
}

async function consumeStream(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
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
          // 摘要的 sources 事件里塞的是 meta
          if (event.meta) lastMeta.value = event.meta
        } else if (event.type === 'token') {
          result.value += event.content
        } else if (event.type === 'error') {
          errorMsg.value = event.message
        }
      } catch {
        // skip
      }
    }
  }
}

function copyResult() {
  if (!result.value) return
  navigator.clipboard.writeText(result.value).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败')
  )
}

function typeLabel(t: string): string {
  return { short: '短摘要', key_points: '要点列表', tldr: 'TL;DR' }[t] || t
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

onMounted(() => {
  loadDocs()
})
</script>

<style scoped>
.summarizer-page {
  padding: 0;
}
.summarizer-header {
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
.input-tabs {
  margin-bottom: 0;
}

/* 表单 */
.form-item {
  margin-bottom: 12px;
}
.form-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 6px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.text-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  text-align: right;
}

/* 文档列表 */
.doc-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}
.doc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #f8f9fb;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.2s;
}
.doc-item:hover {
  background: #f0f4f8;
}
.doc-item.active {
  background: #f0f9ff;
  border-color: #10b981;
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

/* 结果区 */
.meta-tags {
  display: flex;
  gap: 6px;
}
.result-area {
  min-height: 200px;
  padding: 16px;
  background: #fafbfc;
  border-radius: 4px;
  line-height: 1.7;
}
.empty-result,
.error-result {
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
  align-items: flex-start;
  text-align: left;
}
.result-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  color: #303133;
}
.cursor-blink {
  display: inline-block;
  animation: blink 1s steps(2, start) infinite;
  color: #10b981;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}
</style>