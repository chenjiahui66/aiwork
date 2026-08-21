<template>
  <div class="designer-page">
    <div class="designer-header">
      <div>
        <h2 style="margin: 0 0 4px;">AI 设计助手</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          海报 / Banner / Logo / PPT 封面 — 生成高质量的英文 prompt,可直接粘贴到 Midjourney / 即梦 / 文心一格
        </p>
      </div>
      <el-button :icon="QuestionFilled" @click="showHelp = true">如何使用?</el-button>
    </div>

    <el-row :gutter="16">
      <!-- 左:配置 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><PictureFilled /></el-icon> 设计配置</span>
            </div>
          </template>

          <!-- 设计类型 -->
          <div class="form-item">
            <label class="form-label">设计类型</label>
            <el-radio-group v-model="designType" class="type-group">
              <el-radio-button
                v-for="t in designTypes"
                :key="t.code"
                :value="t.code"
              >
                {{ t.label }}
              </el-radio-button>
            </el-radio-group>
            <div class="hint" v-if="currentMeta">
              📐 比例: <strong>{{ currentMeta.ratio }}</strong> · {{ currentMeta.extra_hint }}
            </div>
          </div>

          <!-- 主题 -->
          <div class="form-item">
            <label class="form-label">主题 / 产品<span style="color: #f56c6c;">*</span></label>
            <el-input
              v-model="subject"
              type="textarea"
              :rows="3"
              placeholder="例:智能写作助手 SaaS 产品&#10;春节促销活动&#10;咖啡店 Logo"
              :disabled="streaming"
            />
          </div>

          <!-- 风格 -->
          <div class="form-item">
            <label class="form-label">风格</label>
            <el-select v-model="style" style="width: 100%;" clearable placeholder="由 AI 决定">
              <el-option
                v-for="s in styles"
                :key="s.value"
                :label="s.label"
                :value="s.value"
              />
            </el-select>
          </div>

          <!-- 配色 -->
          <div class="form-item">
            <label class="form-label">主色调</label>
            <el-select v-model="color" style="width: 100%;" clearable placeholder="由 AI 决定">
              <el-option
                v-for="c in colorPalettes"
                :key="c.value"
                :label="c.label"
                :value="c.value"
              />
            </el-select>
          </div>

          <!-- 场景 + 额外要求 -->
          <div class="form-item">
            <label class="form-label">使用场景(可选)</label>
            <el-input v-model="scene" placeholder="例:微信公众号 / 抖音视频封面" :disabled="streaming" />
          </div>
          <div class="form-item">
            <label class="form-label">额外要求(可选)</label>
            <el-input
              v-model="extra"
              type="textarea"
              :rows="2"
              placeholder="例:主体居中、留白多、避免人物"
              :disabled="streaming"
            />
          </div>

          <el-button
            type="primary"
            :icon="MagicStick"
            :loading="streaming"
            :disabled="!subject.trim() || streaming"
            @click="generate"
            style="width: 100%; margin-top: 8px;"
          >
            {{ streaming ? '生成中…' : '生成 Prompt' }}
          </el-button>

          <el-button
            :icon="Refresh"
            :disabled="streaming"
            @click="reset"
            style="width: 100%; margin-top: 8px;"
          >
            清空重来
          </el-button>
        </el-card>
      </el-col>

      <!-- 右:结果 -->
      <el-col :xs="24" :md="15" :lg="16">
        <el-card shadow="never" class="qa-card result-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><ChatDotRound /></el-icon> 设计 Prompt</span>
              <div v-if="lastMeta" class="meta-tags">
                <el-tag size="small" type="info">{{ lastMeta.design_label }}</el-tag>
                <el-tag size="small" type="success">比例 {{ lastMeta.ratio }}</el-tag>
              </div>
            </div>
          </template>

          <div ref="resultRef" class="result-area">
            <div v-if="!result && !streaming && !errorMsg" class="empty-result">
              <el-icon :size="48" color="#c0c4cc"><PictureFilled /></el-icon>
              <p>还没生成 prompt</p>
              <p style="font-size: 12px;">左侧填主题,点「生成 Prompt」</p>
            </div>
            <div v-else-if="errorMsg" class="error-result">
              ❌ {{ errorMsg }}
            </div>
            <div v-else>
              <!-- 提示横幅 -->
              <el-alert
                type="info"
                show-icon
                :closable="false"
                style="margin-bottom: 12px;"
                title="下方 prompt 可直接复制粘贴到 Midjourney / 即梦 / 文心一格 / DALL-E"
              />

              <!-- 流式过程中: 纯文本 -->
              <pre v-if="streaming" class="raw-text">{{ result }}<span class="cursor-blink">▍</span></pre>

              <!-- 完成后: 解析 markdown -->
              <template v-else>
                <template v-for="(block, bi) in parsedBlocks" :key="bi">
                  <div v-if="block.type === 'text'" class="markdown-text" v-html="renderMd(block.content)" />
                  <pre v-else class="code-block">
                    <div class="code-block-header">
                      <span class="code-lang">{{ block.lang || 'prompt' }}</span>
                      <el-button link size="small" :icon="CopyDocument" @click="copyCode(block.content)">复制 prompt</el-button>
                    </div>
                    <code>{{ block.content }}</code>
                  </pre>
                </template>

                <!-- 一键复制全部 prompt -->
                <div v-if="firstPromptBlock" class="copy-all">
                  <el-button
                    type="primary"
                    size="large"
                    :icon="CopyDocument"
                    @click="copyCode(firstPromptBlock)"
                  >
                    📋 复制英文 Prompt 到剪贴板
                  </el-button>
                  <el-button
                    size="large"
                    :icon="Download"
                    @click="downloadPrompt"
                  >
                    下载为 .md 文件
                  </el-button>
                </div>
              </template>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 使用说明弹窗 -->
    <el-dialog v-model="showHelp" title="💡 如何使用" width="600px">
      <ol style="line-height: 2; padding-left: 20px;">
        <li>左侧选设计类型、填主题、选风格和颜色</li>
        <li>点「生成 Prompt」,AI 会输出专业英文 prompt</li>
        <li>点「复制」按钮,把英文 prompt 复制到剪贴板</li>
        <li>打开任意图像生成工具(Midjourney / 即梦 / 文心一格 / DALL-E)</li>
        <li>粘贴 prompt + 选择 {{ currentMeta?.ratio || '1:1' }} 比例</li>
        <li>点生成,得到专业设计图</li>
      </ol>
      <div class="supported-tools">
        <strong>支持的图像生成工具:</strong>
        <ul style="margin-top: 8px;">
          <li>🟣 Midjourney (最强,推荐)</li>
          <li>🟢 即梦 / 豆包(国产,中文友好)</li>
          <li>🟡 文心一格 / 通义万相(国产)</li>
          <li>🔵 DALL-E 3 / Stable Diffusion(英文)</li>
        </ul>
      </div>
      <template #footer>
        <el-button @click="showHelp = false">知道了</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound,
  CopyDocument,
  Download,
  MagicStick,
  PictureFilled,
  QuestionFilled,
  Refresh,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface DesignType { code: string; label: string; ratio: string; extra_hint: string }
interface Option { value: string; label: string }

interface Meta {
  design_type: string
  design_label: string
  ratio: string
  extra_hint: string
}

interface MdBlock {
  type: 'text' | 'code'
  lang?: string
  content: string
}

const designType = ref('poster')
const subject = ref('')
const style = ref('')
const color = ref('')
const scene = ref('')
const extra = ref('')

const designTypes = ref<DesignType[]>([])
const styles = ref<Option[]>([])
const colorPalettes = ref<Option[]>([])

const streaming = ref(false)
const result = ref('')
const errorMsg = ref('')
const lastMeta = ref<Meta | null>(null)
const showHelp = ref(false)
const resultRef = ref<HTMLElement>()

const currentMeta = computed(() =>
  designTypes.value.find((t) => t.code === designType.value)
)

const parsedBlocks = computed<MdBlock[]>(() => parseMd(resultText.value))

const resultText = computed(() => result.value)

// 找到第一个代码块(英文 prompt)
const firstPromptBlock = computed(() => {
  for (const b of parsedBlocks.value) {
    if (b.type === 'code') return b.content
  }
  return null
})

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
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .split(/\n\n+/)
    .map((p) => p.startsWith('<h') || p.startsWith('<ul>') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

function copyCode(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制到剪贴板,可粘贴到 Midjourney / 即梦 等工具'),
    () => ElMessage.error('复制失败')
  )
}

function downloadPrompt() {
  if (!firstPromptBlock.value) {
    ElMessage.warning('还没生成 prompt')
    return
  }
  const blob = new Blob([
    `# AI 设计 Prompt - ${lastMeta.value?.design_label || designType.value}\n\n`,
    `${subject.value}\n\n`,
    `---\n\n`,
    `## English Prompt\n\n`,
    `\`\`\`\n${firstPromptBlock.value}\n\`\`\`\n\n`,
    `## 元信息\n\n`,
    `- 设计类型: ${lastMeta.value?.design_label}\n`,
    `- 比例: ${lastMeta.value?.ratio}\n`,
    `- 主题: ${subject.value}\n`,
    `- 风格: ${style.value || 'AI 决定'}\n`,
    `- 配色: ${color.value || 'AI 决定'}\n`,
    `- 场景: ${scene.value || '通用'}\n`,
  ], { type: 'text/markdown' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `design-${Date.now()}.md`
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已下载 .md 文件')
}

async function loadOptions() {
  try {
    const resp = await fetch(`${API_BASE}/api/designer/options`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    designTypes.value = data.design_types || []
    styles.value = data.styles || []
    colorPalettes.value = data.color_palettes || []
  } catch (e: any) {
    designTypes.value = [
      { code: 'poster', label: '海报', ratio: '9:16', extra_hint: '竖版' },
      { code: 'banner', label: '横幅', ratio: '16:9', extra_hint: '横版' },
      { code: 'logo', label: 'Logo', ratio: '1:1', extra_hint: '方形' },
    ]
    styles.value = [{ value: '', label: '由 AI 决定' }]
    colorPalettes.value = [{ value: '', label: '由 AI 决定' }]
    ElMessage.warning(`后端连接失败: ${e.message}`)
  }
}

async function generate() {
  if (!subject.value.trim()) {
    ElMessage.warning('请填写主题/产品')
    return
  }
  streaming.value = true
  result.value = ''
  errorMsg.value = ''
  lastMeta.value = null

  try {
    const resp = await fetch(`${API_BASE}/api/designer/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        design_type: designType.value,
        subject: subject.value,
        style: style.value || null,
        color: color.value || null,
        scene: scene.value || null,
        extra: extra.value || null,
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
        } catch {
          // skip
        }
      }
    }
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动: cd D:\\project\\MVPdemo\\aiwork-backend && python -m app.main`
    ElMessage.error('生成失败')
  } finally {
    streaming.value = false
  }
}

function reset() {
  subject.value = ''
  scene.value = ''
  extra.value = ''
  style.value = ''
  color.value = ''
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
.designer-page {
  padding: 0;
}
.designer-header {
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
.type-group {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  padding: 6px 10px;
  background: #f0f9ff;
  border-radius: 4px;
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
  color: #f43f5e;
  margin-left: 2px;
}
@keyframes blink {
  to { visibility: hidden; }
}

/* markdown 渲染 */
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
  color: #f43f5e;
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
  color: #f43f5e;
  font-weight: 600;
}

/* 代码块(prompt) */
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
  padding: 14px;
  color: #d4d4d4;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

/* 一键复制区 */
.copy-all {
  margin-top: 16px;
  padding: 16px;
  background: linear-gradient(135deg, #fff5f5, #fff);
  border: 1px dashed #f43f5e;
  border-radius: 6px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

/* 帮助弹窗 */
.supported-tools {
  margin-top: 16px;
  padding: 12px;
  background: #fafbfc;
  border-radius: 4px;
  font-size: 14px;
}
</style>