<template>
  <div class="translator-page">
    <div class="translator-header">
      <div>
        <h2 style="margin: 0 0 4px;">智能翻译</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          中英日韩法德西俄阿等 14 种语言 · 支持 IT/法律/医学/商务等专业领域
        </p>
      </div>
    </div>

    <!-- 顶部控制:领域 + 双向语言 -->
    <el-card shadow="never" class="qa-card">
      <el-row :gutter="12" align="middle">
        <el-col :xs="24" :sm="6">
          <label class="form-label">翻译领域</label>
          <el-select v-model="domain" style="width: 100%;">
            <el-option
              v-for="d in domains"
              :key="d.code"
              :label="d.label"
              :value="d.code"
            />
          </el-select>
        </el-col>
        <el-col :xs="11" :sm="7">
          <label class="form-label">源语言</label>
          <el-select v-model="sourceLang" style="width: 100%;" clearable placeholder="自动检测">
            <el-option
              v-for="l in languages"
              :key="l.code"
              :label="l.label"
              :value="l.code"
            />
          </el-select>
        </el-col>
        <el-col :xs="2" :sm="2" style="text-align: center; padding-top: 24px;">
          <el-button :icon="RefreshRight" circle size="small" @click="swapLangs" title="对调" />
        </el-col>
        <el-col :xs="11" :sm="7">
          <label class="form-label">目标语言</label>
          <el-select v-model="targetLang" style="width: 100%;">
            <el-option
              v-for="l in languages"
              :key="l.code"
              :label="l.label"
              :value="l.code"
            />
          </el-select>
        </el-col>
      </el-row>

      <!-- 术语表 (可折叠) -->
      <el-collapse v-model="glossaryOpen" style="margin-top: 12px;">
        <el-collapse-item title="📖 术语表 (强制指定某些词的译法)" name="1">
          <div class="glossary-editor">
            <div v-for="(item, idx) in glossaryPairs" :key="idx" class="glossary-row">
              <el-input
                v-model="item.source"
                placeholder="原文 (如 RAG)"
                size="small"
                style="flex: 1;"
              />
              <span style="margin: 0 8px;">→</span>
              <el-input
                v-model="item.target"
                placeholder="译文 (如 检索增强生成)"
                size="small"
                style="flex: 1;"
              />
              <el-button
                link
                type="danger"
                :icon="Delete"
                size="small"
                @click="glossaryPairs.splice(idx, 1)"
                style="margin-left: 8px;"
              />
            </div>
            <el-button
              :icon="Plus"
              size="small"
              @click="glossaryPairs.push({ source: '', target: '' })"
              style="margin-top: 8px;"
            >
              添加术语
            </el-button>
          </div>
        </el-collapse-item>
      </el-collapse>
    </el-card>

    <!-- 左右对照翻译区 -->
    <el-row :gutter="16" style="margin-top: 16px;">
      <!-- 左:原文 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="qa-card translate-card">
          <template #header>
            <div class="card-header">
              <span>
                <el-icon><EditPen /></el-icon>
                原文
                <span v-if="sourceLang" class="lang-tag">({{ langLabel(sourceLang) }})</span>
                <span v-else class="lang-tag">(自动检测)</span>
              </span>
              <el-button link size="small" :icon="Delete" @click="sourceText = ''" :disabled="streaming">清空</el-button>
            </div>
          </template>
          <el-input
            v-model="sourceText"
            type="textarea"
            :rows="14"
            placeholder="粘贴要翻译的文本...&#10;支持中英日韩等 14 种语言互译"
            resize="none"
            :disabled="streaming"
            @input="charCount = sourceText.length"
          />
          <div class="text-meta">
            {{ sourceText.length }} 字
            <span v-if="sourceText.length > 15000" style="color: #f56c6c;">(超过 15000 字会被截断)</span>
          </div>
        </el-card>
      </el-col>

      <!-- 右:译文 -->
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="qa-card translate-card">
          <template #header>
            <div class="card-header">
              <span>
                <el-icon><Position /></el-icon>
                译文
                <span v-if="targetLang" class="lang-tag">({{ langLabel(targetLang) }})</span>
              </span>
              <div style="display: flex; gap: 8px;">
                <el-tag v-if="streaming" size="small" type="warning">翻译中…</el-tag>
                <el-button
                  v-if="targetText && !streaming"
                  link
                  size="small"
                  :icon="CopyDocument"
                  @click="copyResult"
                >
                  复制
                </el-button>
              </div>
            </div>
          </template>
          <div class="target-area">
            <div v-if="!targetText && !streaming && !errorMsg" class="empty-target">
              <el-icon :size="48" color="#c0c4cc"><Position /></el-icon>
              <p>译文会在这里显示</p>
            </div>
            <div v-else-if="errorMsg" class="error-target">
              ❌ {{ errorMsg }}
            </div>
            <div v-else class="target-text">
              {{ targetText }}<span v-if="streaming" class="cursor-blink">▍</span>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 操作栏 -->
    <div class="action-bar">
      <el-button
        type="primary"
        :icon="Promotion"
        :loading="streaming"
        :disabled="!canTranslate"
        @click="doTranslate"
        size="large"
      >
        {{ streaming ? '翻译中…' : '翻译' }}
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Delete,
  EditPen,
  Plus,
  Position,
  Promotion,
  RefreshRight,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface Language {
  code: string
  label: string
}

interface Domain {
  code: string
  label: string
}

interface GlossaryPair {
  source: string
  target: string
}

const sourceText = ref('')
const targetText = ref('')
const errorMsg = ref('')
const streaming = ref(false)
const charCount = ref(0)

const sourceLang = ref<string>('')        // 空 = 自动检测
const targetLang = ref<string>('en')
const domain = ref<string>('general')

const languages = ref<Language[]>([])
const domains = ref<Domain[]>([])

const glossaryOpen = ref<string[]>([])
const glossaryPairs = ref<GlossaryPair[]>([
  { source: 'RAG', target: '检索增强生成' },
])

// 校验可翻译
const canTranslate = computed<boolean>(() => {
  return sourceText.value.trim().length >= 1 && !!targetLang.value && !streaming.value
})

// 构造后端要的 glossary dict
function buildGlossary(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of glossaryPairs.value) {
    const k = p.source.trim()
    const v = p.target.trim()
    if (k && v) out[k] = v
  }
  return out
}

function langLabel(code: string): string {
  return languages.value.find((l) => l.code === code)?.label || code
}

function swapLangs() {
  if (!sourceLang.value) {
    ElMessage.info('源语言是自动检测,无法对调')
    return
  }
  const tmp = sourceLang.value
  sourceLang.value = targetLang.value
  targetLang.value = tmp
  // 顺手把原文/译文也对调
  const tmpText = sourceText.value
  sourceText.value = targetText.value
  targetText.value = tmpText
}

async function loadOptions() {
  try {
    const resp = await fetch(`${API_BASE}/api/translator/options`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    languages.value = data.languages || []
    domains.value = data.domains || []
  } catch (e: any) {
    // fallback: 用前端硬编码(下面用 ref 兜底)
    languages.value = [
      { code: 'zh', label: '中文(简体)' },
      { code: 'en', label: '英语' },
      { code: 'ja', label: '日语' },
      { code: 'ko', label: '韩语' },
    ]
    domains.value = [
      { code: 'general', label: '通用' },
      { code: 'business', label: '商务' },
      { code: 'it', label: 'IT 技术' },
    ]
    ElMessage.warning(`后端连接失败: ${e.message},使用默认选项`)
  }
}

async function doTranslate() {
  if (!canTranslate.value) return

  const text = sourceText.value.trim()
  const glossary = buildGlossary()

  streaming.value = true
  targetText.value = ''
  errorMsg.value = ''

  try {
    const resp = await fetch(`${API_BASE}/api/translator/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        target_lang: targetLang.value,
        source_lang: sourceLang.value || null,
        domain: domain.value,
        glossary,
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
          if (event.type === 'token') {
            targetText.value += event.content
          } else if (event.type === 'error') {
            errorMsg.value = event.message
          }
          // sources 事件只带 meta, 这里不显示, 想显示可加
        } catch {
          // skip
        }
      }
    }
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    ElMessage.error('翻译请求失败')
  } finally {
    streaming.value = false
  }
}

function copyResult() {
  if (!targetText.value) return
  navigator.clipboard.writeText(targetText.value).then(
    () => ElMessage.success('已复制到剪贴板'),
    () => ElMessage.error('复制失败')
  )
}

onMounted(() => {
  loadOptions()
})
</script>

<style scoped>
.translator-page {
  padding: 0;
}
.translator-header {
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
.lang-tag {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
  margin-left: 6px;
}

/* 表单 */
.form-label {
  display: block;
  font-size: 12px;
  color: #606266;
  margin-bottom: 4px;
}

/* 术语表 */
.glossary-editor {
  padding: 4px 0;
}
.glossary-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

/* 左右对照翻译区 */
.translate-card {
  height: 360px;
  display: flex;
  flex-direction: column;
}
.translate-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 12px;
  min-height: 0;
}
.translate-card :deep(.el-textarea) {
  flex: 1;
  display: flex;
}
.translate-card :deep(.el-textarea__inner) {
  flex: 1;
  resize: none;
}
.text-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  text-align: right;
}

.target-area {
  flex: 1;
  padding: 12px;
  background: #fafbfc;
  border-radius: 4px;
  overflow-y: auto;
  line-height: 1.7;
}
.empty-target {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #909399;
  font-size: 14px;
}
.empty-target p {
  margin-top: 8px;
}
.error-target {
  color: #f56c6c;
  white-space: pre-wrap;
}
.target-text {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 14px;
  color: #303133;
}
.cursor-blink {
  display: inline-block;
  animation: blink 1s steps(2, start) infinite;
  color: #06b6d4;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}

/* 操作栏 */
.action-bar {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}
.action-bar .el-button {
  min-width: 200px;
}
</style>