<template>
  <div class="geo-page">
    <div class="geo-header">
      <div>
        <h2 style="margin: 0 0 4px;">GEO 内容智能体</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          输入选题 → AI 自动完成 选题研究 / 文章生成 / GEO 优化 / 配图 / 多平台发布包
        </p>
      </div>
      <el-tag v-if="finalData" type="success" effect="plain">
        已生成 · 文章 {{ finalData.article.word_count }} 字
      </el-tag>
    </div>

    <el-row :gutter="16">
      <!-- 左:输入区 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><MagicStick /></el-icon> 选题输入</span>
            </div>
          </template>

          <el-form :model="form" label-position="top" size="default">
            <el-form-item label="选题标题">
              <el-input
                v-model="form.title"
                type="textarea"
                :rows="3"
                placeholder="例如：2026 年普通人如何用 AI 做副业"
                :disabled="generating"
                maxlength="200"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="目标平台">
              <el-select v-model="form.platform" :disabled="generating" style="width: 100%">
                <el-option label="微信公众号" value="wechat" />
                <el-option label="小红书" value="xiaohongshu" />
                <el-option label="抖音图文" value="douyin" />
                <el-option label="知乎" value="zhihu" />
                <el-option label="今日头条" value="toutiao" />
              </el-select>
            </el-form-item>

            <el-form-item label="内容风格">
              <el-select v-model="form.style" :disabled="generating" style="width: 100%">
                <el-option label="专业干货" value="professional" />
                <el-option label="个人 IP" value="personal_ip" />
                <el-option label="爆款拆解" value="viral_analysis" />
                <el-option label="故事型" value="story" />
                <el-option label="观点型" value="opinion" />
                <el-option label="教程型" value="tutorial" />
              </el-select>
            </el-form-item>

            <el-button
              type="primary"
              size="large"
              :icon="MagicStick"
              :loading="generating"
              :disabled="!canGenerate"
              style="width: 100%; margin-top: 8px;"
              @click="generate"
            >
              {{ generating ? `生成中 · ${currentStepName}` : '✨ 一键生成 GEO 内容包' }}
            </el-button>
          </el-form>

          <el-alert
            v-if="errorMsg"
            :title="errorMsg"
            type="error"
            :closable="false"
            style="margin-top: 12px;"
            show-icon
          />
        </el-card>

        <!-- 进度面板 -->
        <el-card v-if="generating || steps.length > 0" shadow="never" class="qa-card" style="margin-top: 16px;">
          <template #header>
            <div class="card-header">
              <span><el-icon><Loading /></el-icon> 生成进度</span>
            </div>
          </template>

          <el-steps :active="currentStepIndex" direction="vertical" finish-status="success">
            <el-step
              v-for="(s, idx) in steps"
              :key="idx"
              :title="s.name"
              :status="s.status"
            />
          </el-steps>
        </el-card>
      </el-col>

      <!-- 右:结果区 -->
      <el-col :xs="24" :md="15" :lg="16">
        <div v-if="!finalData" class="empty-state">
          <el-empty description="输入选题后点「一键生成」,AI 会自动跑完 12 步 Agent 流程" />
          <div class="pipeline-hint">
            <el-tag size="small">① 选题研究</el-tag>
            <el-icon><Right /></el-icon>
            <el-tag size="small">② 知识结构</el-tag>
            <el-icon><Right /></el-icon>
            <el-tag size="small">③ 文章生成</el-tag>
            <el-icon><Right /></el-icon>
            <el-tag size="small" type="warning">④ GEO 评分</el-tag>
            <el-icon><Right /></el-icon>
            <el-tag size="small">⑤ 多平台改写</el-tag>
          </div>
        </div>

        <div v-else>
          <!-- 文章正文 -->
          <el-card shadow="never" class="result-card">
            <template #header>
              <div class="card-header">
                <span><el-icon><Document /></el-icon> 文章正文</span>
                <el-button :icon="CopyDocument" size="small" text @click="copyArticle">复制</el-button>
              </div>
            </template>
            <div class="article-content markdown-body" v-html="renderedArticle"></div>
          </el-card>

          <!-- GEO 评分 + AI 搜索模拟 -->
          <el-row :gutter="16" style="margin-top: 16px;">
            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="result-card">
                <template #header>
                  <span><el-icon><Medal /></el-icon> GEO 评分</span>
                </template>
                <div class="score-display">
                  <div class="score-circle" :class="scoreClass">
                    <span class="score-num">{{ finalData.geo_score.total_score }}</span>
                    <span class="score-total">/100</span>
                  </div>
                </div>
                <el-divider />
                <div class="score-dims">
                  <div
                    v-for="dim in finalData.geo_score.dimensions"
                    :key="dim.key"
                    class="dim-row"
                  >
                    <div class="dim-label">{{ dim.name }}</div>
                    <el-progress
                      :percentage="dim.score"
                      :stroke-width="8"
                      :status="dim.score >= 80 ? 'success' : dim.score >= 60 ? '' : 'warning'"
                    />
                  </div>
                </div>
                <el-divider />
                <div class="score-feedback">
                  <p><strong>✅ 优势:</strong></p>
                  <ul>
                    <li v-for="s in finalData.geo_score.strengths" :key="s">{{ s }}</li>
                  </ul>
                  <p><strong>⚠️ 短板:</strong></p>
                  <ul>
                    <li v-for="w in finalData.geo_score.weaknesses" :key="w">{{ w }}</li>
                  </ul>
                </div>
              </el-card>
            </el-col>

            <el-col :xs="24" :md="12">
              <el-card shadow="never" class="result-card">
                <template #header>
                  <span><el-icon><Search /></el-icon> AI 搜索模拟</span>
                </template>
                <div
                  v-for="t in finalData.geo_score.ai_search_test"
                  :key="t.question"
                  class="search-test-item"
                >
                  <div class="test-q">
                    <el-tag
                      :type="t.likelihood === 'high' ? 'success' : t.likelihood === 'medium' ? 'warning' : 'danger'"
                      size="small"
                    >
                      {{ t.likelihood === 'high' ? '高' : t.likelihood === 'medium' ? '中' : '低' }}
                    </el-tag>
                    <span class="q-text">{{ t.question }}</span>
                  </div>
                  <div class="test-reason">📌 {{ t.reason }}</div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <!-- 配图 prompts -->
          <el-card shadow="never" class="result-card" style="margin-top: 16px;">
            <template #header>
              <div class="card-header">
                <span><el-icon><Picture /></el-icon> 配图 Prompts</span>
                <el-tag size="small" type="info">MiniMax 无图像模型 · 复制到 Midjourney/SD</el-tag>
              </div>
            </template>
            <div class="prompt-block">
              <div class="prompt-label">🎨 封面</div>
              <el-input
                :model-value="finalData.images.cover_prompt"
                type="textarea"
                :rows="2"
                readonly
                resize="none"
              />
              <el-button :icon="CopyDocument" size="small" text @click="copyText(finalData.images.cover_prompt)">
                复制
              </el-button>
            </div>
            <div
              v-for="(p, idx) in finalData.images.illustration_prompts"
              :key="idx"
              class="prompt-block"
            >
              <div class="prompt-label">📷 {{ p.section }} — {{ p.info }}</div>
              <el-input :model-value="p.prompt" type="textarea" :rows="2" readonly resize="none" />
              <el-button :icon="CopyDocument" size="small" text @click="copyText(p.prompt)">复制</el-button>
            </div>
          </el-card>

          <!-- 多平台发布包 -->
          <el-card shadow="never" class="result-card" style="margin-top: 16px;">
            <template #header>
              <div class="card-header">
                <span><el-icon><Share /></el-icon> 多平台发布包</span>
              </div>
            </template>
            <el-tabs v-model="activePlatformTab">
              <el-tab-pane label="📱 微信公众号" name="wechat">
                <div class="pack-section">
                  <div class="pack-label">标题</div>
                  <el-input :model-value="finalData.platform_pack.wechat.title" readonly />
                </div>
                <div class="pack-section">
                  <div class="pack-label">GEO 描述</div>
                  <el-input
                    :model-value="finalData.platform_pack.wechat.geo_description"
                    type="textarea"
                    :rows="3"
                    readonly
                  />
                </div>
                <div class="pack-section">
                  <div class="pack-label">摘要</div>
                  <el-input
                    :model-value="finalData.platform_pack.wechat.summary"
                    readonly
                  />
                </div>
              </el-tab-pane>

              <el-tab-pane label="📕 小红书" name="xiaohongshu">
                <div class="pack-section">
                  <div class="pack-label">候选标题 (10 个)</div>
                  <div class="xhs-titles">
                    <div
                      v-for="(t, i) in finalData.platform_pack.xiaohongshu.titles || []"
                      :key="i"
                      class="xhs-title-item"
                    >
                      {{ i + 1 }}. {{ t }}
                    </div>
                  </div>
                </div>
                <div class="pack-section">
                  <div class="pack-label">正文</div>
                  <el-input
                    :model-value="finalData.platform_pack.xiaohongshu.content"
                    type="textarea"
                    :rows="6"
                    readonly
                  />
                </div>
                <div class="pack-section">
                  <div class="pack-label">标签</div>
                  <div class="tags-row">
                    <el-tag
                      v-for="(tag, i) in finalData.platform_pack.xiaohongshu.tags || []"
                      :key="i"
                      type="danger"
                      effect="plain"
                      size="small"
                    >
                      {{ tag }}
                    </el-tag>
                  </div>
                </div>
              </el-tab-pane>

              <el-tab-pane label="🎬 抖音图文" name="douyin">
                <div class="pack-section">
                  <div class="pack-label">标题 + 封面大字</div>
                  <el-input
                    :model-value="finalData.platform_pack.douyin.title + ' / ' + finalData.platform_pack.douyin.cover_text"
                    readonly
                  />
                </div>
                <div class="pack-section">
                  <div class="pack-label">9 宫格</div>
                  <div class="grid-copies">
                    <div
                      v-for="g in finalData.platform_pack.douyin.grid_copies || []"
                      :key="g.index"
                      class="grid-item"
                    >
                      <div class="grid-idx">{{ g.index }}</div>
                      <div class="grid-role">{{ g.role }}</div>
                      <div class="grid-text">{{ g.text }}</div>
                    </div>
                  </div>
                </div>
                <div class="pack-section">
                  <div class="pack-label">文案</div>
                  <el-input
                    :model-value="finalData.platform_pack.douyin.caption"
                    type="textarea"
                    :rows="4"
                    readonly
                  />
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>

          <!-- 选题研究报告 -->
          <el-card shadow="never" class="result-card" style="margin-top: 16px;">
            <template #header>
              <div class="card-header">
                <span><el-icon><DataAnalysis /></el-icon> 选题研究报告</span>
              </div>
            </template>
            <el-collapse v-model="openResearchPanels">
              <el-collapse-item title="🔥 当前热门方向" name="hotspots">
                <ul>
                  <li v-for="(h, i) in finalData.research.hotspots" :key="i">{{ h }}</li>
                </ul>
              </el-collapse-item>
              <el-collapse-item title="❓ 用户高频问题" name="faqs">
                <ul>
                  <li v-for="(f, i) in finalData.research.faqs" :key="i">{{ f }}</li>
                </ul>
              </el-collapse-item>
              <el-collapse-item title="⚠️ 已有内容缺口" name="gaps">
                <ul>
                  <li v-for="(g, i) in finalData.research.gaps" :key="i">{{ g }}</li>
                </ul>
              </el-collapse-item>
              <el-collapse-item title="💡 内容机会" name="opportunities">
                <ul>
                  <li v-for="(o, i) in finalData.research.opportunities" :key="i">{{ o }}</li>
                </ul>
              </el-collapse-item>
              <el-collapse-item title="🏷️ 核心实体" name="entities">
                <div v-for="(items, cat) in finalData.research.entities" :key="cat" class="entity-row">
                  <strong>{{ cat.toUpperCase() }}:</strong>
                  <el-tag
                    v-for="(e, i) in items"
                    :key="i"
                    size="small"
                    effect="plain"
                    style="margin-left: 6px;"
                  >
                    {{ e }}
                  </el-tag>
                </div>
              </el-collapse-item>
            </el-collapse>
          </el-card>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  MagicStick,
  Document,
  Medal,
  Search,
  Picture,
  Share,
  DataAnalysis,
  Loading,
  Right,
  CopyDocument,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface GEOResearch {
  hotspots: string[]
  faqs: string[]
  gaps: string[]
  opportunities: string[]
  entities: Record<string, string[]>
}

interface GEODimension {
  name: string
  key: string
  score: number
  comment: string
}

interface GEOSearchTest {
  question: string
  likelihood: 'high' | 'medium' | 'low'
  reason: string
}

interface GEOScore {
  total_score: number
  dimensions: GEODimension[]
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  ai_search_test: GEOSearchTest[]
}

interface GEOImagePrompt {
  section: string
  info: string
  prompt: string
}

interface GEOImagePack {
  cover_prompt: string
  illustration_prompts: GEOImagePrompt[]
}

interface GEOPlatformPack {
  wechat: any
  xiaohongshu: any
  douyin: any
}

interface GEOArticle {
  title: string
  content: string
  word_count: number
}

interface GEOResult {
  research: GEOResearch
  article: GEOArticle
  geo_score: GEOScore
  images: GEOImagePack
  platform_pack: GEOPlatformPack
}

const form = ref({
  title: '',
  platform: 'wechat',
  style: 'professional',
})

const generating = ref(false)
const errorMsg = ref('')
const steps = ref<{ name: string; status: '' | 'process' | 'finish' | 'error' }[]>([])
const finalData = ref<GEOResult | null>(null)
const activePlatformTab = ref('wechat')
const openResearchPanels = ref(['hotspots', 'faqs'])

const canGenerate = computed(
  () => form.value.title.trim().length >= 2 && !generating.value
)

const currentStepIndex = computed(() => steps.value.filter((s) => s.status === 'finish').length)
const currentStepName = computed(() => {
  const p = steps.value.find((s) => s.status === 'process')
  return p ? p.name : ''
})

const scoreClass = computed(() => {
  if (!finalData.value) return ''
  const s = finalData.value.geo_score.total_score
  if (s >= 80) return 'score-high'
  if (s >= 60) return 'score-mid'
  return 'score-low'
})

// 简易 markdown 渲染 (粗体 + 标题 + 列表)
function renderMarkdown(md: string): string {
  let html = md
    .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n- /g, '</p><ul><li>')
    .replace(/<\/li>\n- /g, '</li><li>')
  if (!html.startsWith('<')) html = '<p>' + html
  return html
}

const renderedArticle = computed(() => {
  if (!finalData.value) return ''
  return renderMarkdown(finalData.value.article.content)
})

async function generate() {
  if (!canGenerate.value) {
    ElMessage.warning('请输入至少 2 个字的选题')
    return
  }
  generating.value = true
  errorMsg.value = ''
  finalData.value = null
  steps.value = [
    { name: '① 选题研究', status: '' },
    { name: '② 构建知识结构', status: '' },
    { name: '③ AI 生成文章', status: '' },
    { name: '④ 配图 Prompt', status: '' },
    { name: '⑤ GEO 评分 + AI 搜索模拟', status: '' },
    { name: '⑥ 多平台改写', status: '' },
  ]

  try {
    const resp = await fetch(`${API_BASE}/api/geo/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.value.title.trim(),
        platform: form.value.platform,
        style: form.value.style,
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
          const ev = JSON.parse(line.slice(6))
          handleEvent(ev)
        } catch {
          /* skip */
        }
      }
    }
  } catch (e: any) {
    errorMsg.value = `生成失败: ${e.message}`
    ElMessage.error(errorMsg.value)
  } finally {
    generating.value = false
  }
}

function handleEvent(ev: any) {
  if (ev.type === 'step') {
    const idx = ev.step - 1
    if (idx >= 0 && idx < steps.value.length) {
      steps.value[idx].status = ev.status === 'done' ? 'finish' : 'process'
    }
  } else if (ev.type === 'final') {
    finalData.value = ev.data
    ElMessage.success('GEO 内容包生成完成')
  } else if (ev.type === 'error') {
    errorMsg.value = ev.message
    ElMessage.error(ev.message)
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.warning('复制失败')
  }
}

async function copyArticle() {
  if (finalData.value) {
    await copyText(finalData.value.article.content)
  }
}
</script>

<style scoped>
.geo-page {
  padding: 0;
}
.geo-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.qa-card {
  border-radius: 8px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}
.empty-state {
  text-align: center;
  padding: 48px 24px;
  background: #fafbfc;
  border-radius: 8px;
}
.pipeline-hint {
  margin-top: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.result-card {
  border-radius: 8px;
}
.article-content {
  max-height: 500px;
  overflow-y: auto;
  line-height: 1.7;
  font-size: 14px;
}
.article-content :deep(h1) {
  font-size: 20px;
  margin: 16px 0 8px;
}
.article-content :deep(h2) {
  font-size: 17px;
  margin: 14px 0 6px;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 4px;
}
.article-content :deep(h3) {
  font-size: 15px;
  margin: 10px 0 4px;
}
.article-content :deep(p) {
  margin: 8px 0;
}
.article-content :deep(strong) {
  color: #2563eb;
}
.score-display {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}
.score-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
}
.score-high {
  background: linear-gradient(135deg, #10b981, #06b6d4);
}
.score-mid {
  background: linear-gradient(135deg, #f59e0b, #eab308);
}
.score-low {
  background: linear-gradient(135deg, #ef4444, #f97316);
}
.score-num {
  font-size: 36px;
}
.score-total {
  font-size: 14px;
  opacity: 0.85;
}
.dim-row {
  margin-bottom: 8px;
}
.dim-label {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}
.score-feedback {
  font-size: 13px;
  line-height: 1.7;
}
.score-feedback ul {
  margin: 4px 0 12px;
  padding-left: 20px;
}
.search-test-item {
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
}
.search-test-item:last-child {
  border-bottom: none;
}
.test-q {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.q-text {
  font-size: 13px;
  font-weight: 500;
}
.test-reason {
  font-size: 12px;
  color: #909399;
  padding-left: 8px;
  border-left: 2px solid #e4e7ed;
}
.prompt-block {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e4e7ed;
}
.prompt-block:last-child {
  border-bottom: none;
}
.prompt-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #303133;
}
.pack-section {
  margin-bottom: 12px;
}
.pack-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 4px;
}
.xhs-titles {
  background: #fafbfc;
  padding: 8px 12px;
  border-radius: 4px;
}
.xhs-title-item {
  padding: 4px 0;
  font-size: 13px;
}
.tags-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.grid-copies {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.grid-item {
  background: #fafbfc;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px;
  text-align: center;
}
.grid-idx {
  font-size: 18px;
  font-weight: bold;
  color: #ec4899;
}
.grid-role {
  font-size: 11px;
  color: #909399;
  margin: 2px 0;
}
.grid-text {
  font-size: 12px;
  color: #303133;
}
.entity-row {
  padding: 4px 0;
}
</style>