<template>
  <div class="card-page">
    <div class="card-header">
      <div>
        <h2 style="margin: 0 0 4px;">名片识别器</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          调用本地 Dify 工作流,识别名片图片或文本中的姓名、电话、邮箱、公司等信息
        </p>
      </div>
      <el-tag v-if="!apiKey" type="warning" effect="light">未配置 API Key</el-tag>
      <el-tag v-else type="success" effect="light">API Key 已就绪</el-tag>
    </div>

    <el-row :gutter="16">
      <!-- 左:输入 -->
      <el-col :xs="24" :md="9" :lg="8">
        <el-card shadow="never" class="qa-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><Postcard /></el-icon> 输入</span>
            </div>
          </template>

          <div class="form-item">
            <label class="form-label">输入类型</label>
            <el-radio-group v-model="inputType">
              <el-radio-button value="image_url">图片 URL</el-radio-button>
              <el-radio-button value="upload">本地上传</el-radio-button>
            </el-radio-group>
          </div>

          <div v-if="inputType === 'image_url'" class="form-item">
            <label class="form-label">名片图片 URL</label>
            <el-input
              v-model="imageUrl"
              placeholder="https://example.com/card.jpg"
              :disabled="loading"
              clearable
            />
            <div v-if="imageUrl" class="preview-wrap">
              <img :src="imageUrl" class="preview-img" alt="preview" referrerpolicy="no-referrer" />
            </div>
          </div>

          <div v-else class="form-item">
            <label class="form-label">名片图片文件</label>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :show-file-list="false"
              :accept="'image/*'"
              :on-change="handleFileChange"
              :disabled="loading"
              drag
            >
              <div v-if="!uploadedFile" class="upload-trigger">
                <el-icon :size="32" color="#909399"><UploadFilled /></el-icon>
                <div class="upload-text">点击或拖拽图片到此处</div>
                <div class="upload-hint">支持 JPG / PNG / WEBP,最大 15MB</div>
              </div>
              <div v-else class="upload-trigger">
                <el-icon :size="32" color="#10b981"><Check /></el-icon>
                <div class="upload-text">{{ uploadedFile.name }}</div>
                <div class="upload-hint">
                  {{ formatBytes(uploadedFile.size) }} · 已上传,file_id: {{ uploadedFile.id.slice(0, 12) }}…
                </div>
              </div>
            </el-upload>
            <div v-if="uploadedFile && uploadedFile.previewUrl" class="preview-wrap">
              <img :src="uploadedFile.previewUrl" class="preview-img" alt="preview" />
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">
              Dify API Key
              <el-tooltip content="Dify 工作流的服务 API 密钥(app- 开头)。仅保存在浏览器,不会上传。" placement="top">
                <el-icon style="margin-left: 4px; color: #909399;"><QuestionFilled /></el-icon>
              </el-tooltip>
            </label>
            <el-input
              v-model="userApiKey"
              type="password"
              show-password
              placeholder="app-xxxxxxxxxxxxxxxxxxxx"
              :disabled="loading"
              clearable
            />
            <div class="hint">
              <span v-if="userApiKey">✅ Key 已输入</span>
              <span v-else-if="envApiKey">✅ 已从 .env.local 读取(无需再填)</span>
              <span v-else>从 Dify 工作室 → 访问 API → 服务 API → 新建密钥 获取</span>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label">
              Dify 工作流输入变量名
              <el-tooltip content="对应 Dify 工作流'开始节点'里的输入变量 key,默认 business_card" placement="top">
                <el-icon style="margin-left: 4px; color: #909399;"><QuestionFilled /></el-icon>
              </el-tooltip>
            </label>
            <el-input v-model="inputKey" placeholder="business_card" :disabled="loading" />
          </div>

          <el-button
            type="primary"
            :icon="Promotion"
            :loading="loading"
            :disabled="!canRun"
            @click="run"
            style="width: 100%;"
          >
            {{ loading ? '识别中…' : '运行工作流' }}
          </el-button>

          <el-button
            :icon="Delete"
            :disabled="!result || loading"
            @click="clear"
            style="width: 100%; margin-top: 8px;"
          >
            清空
          </el-button>
        </el-card>
      </el-col>

      <!-- 右:结果 -->
      <el-col :xs="24" :md="15" :lg="16">
        <el-card shadow="never" class="qa-card result-card">
          <template #header>
            <div class="card-header">
              <span><el-icon><DataAnalysis /></el-icon> 识别结果</span>
              <div v-if="runMeta" class="meta-tags">
                <el-tag size="small" type="info">{{ runMeta.runId.slice(0, 8) }}…</el-tag>
                <el-tag size="small" type="success">{{ runMeta.elapsed }}s</el-tag>
                <el-tag size="small" type="warning">{{ runMeta.tokens }} tokens</el-tag>
              </div>
            </div>
          </template>

          <div v-if="!result" class="empty-result">
            <el-icon :size="48" color="#c0c4cc"><Postcard /></el-icon>
            <p>还没运行</p>
            <p style="font-size: 12px;">左侧填内容,点「运行工作流」</p>
          </div>

          <div v-else>
            <!-- 友好视图:识别出常见字段时 -->
            <div v-if="hasStructuredFields" class="card-fields">
              <el-descriptions :column="2" border>
                <el-descriptions-item v-if="result.name" label="姓名">{{ result.name }}</el-descriptions-item>
                <el-descriptions-item v-if="result.title" label="职位">{{ result.title }}</el-descriptions-item>
                <el-descriptions-item v-if="result.company" label="公司">{{ result.company }}</el-descriptions-item>
                <el-descriptions-item v-if="result.phone" label="电话">{{ result.phone }}</el-descriptions-item>
                <el-descriptions-item v-if="result.email" label="邮箱">{{ result.email }}</el-descriptions-item>
                <el-descriptions-item v-if="result.address" label="地址">{{ result.address }}</el-descriptions-item>
                <el-descriptions-item v-if="result.website" label="网址">
                  <a :href="result.website" target="_blank">{{ result.website }}</a>
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- 原始 JSON -->
            <div class="raw-section">
              <div class="raw-header">
                <span>原始输出 (data.outputs)</span>
                <el-button link size="small" :icon="CopyDocument" @click="copyJson">复制 JSON</el-button>
              </div>
              <pre class="raw-json">{{ formattedJson }}</pre>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadInstance, UploadRawFile } from 'element-plus'
import {
  Check,
  CopyDocument,
  DataAnalysis,
  Delete,
  Postcard,
  Promotion,
  QuestionFilled,
  UploadFilled,
} from '@element-plus/icons-vue'

// 走 vite proxy → http://127.0.0.1
const DIFY_BASE = '/dify-api'
// env 里的 key 仅作"默认值",用户可在 UI 覆盖
const ENV_API_KEY = (import.meta.env.VITE_DIFY_API_KEY as string | undefined) || ''
const STORAGE_KEY = 'dify_api_key'  // sessionStorage key,刷新页面后还在
const userApiKey = ref<string>(sessionStorage.getItem(STORAGE_KEY) || '')
// UI 输入 > env。envApiKey 仅用于显示"已从 .env 读取"
const envApiKey = ENV_API_KEY
const apiKey = computed(() => userApiKey.value.trim() || ENV_API_KEY)
watch(userApiKey, (v) => {
  if (v) sessionStorage.setItem(STORAGE_KEY, v)
  else sessionStorage.removeItem(STORAGE_KEY)
})

interface CardResult {
  name?: string
  title?: string
  company?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  [k: string]: unknown
}

const inputType = ref<'image_url' | 'upload'>('image_url')
const imageUrl = ref('')
const inputKey = ref('business_card') // 工作流"开始节点"输入变量名
const loading = ref(false)
const result = ref<CardResult | null>(null)
const runMeta = ref<{ runId: string; elapsed: number; tokens: number } | null>(null)

// 已上传到 Dify 的文件信息
interface UploadedFile {
  id: string           // Dify upload_file_id
  name: string
  size: number
  previewUrl: string   // 浏览器本地预览
}
const uploadedFile = ref<UploadedFile | null>(null)
const uploadRef = ref<UploadInstance>()

// 整个页面生命周期内使用同一个 user id —— Dify 按 user 隔离文件,upload 和 run 必须一致
// 否则 upload 后 workflow 找不到这个 file_id
const SESSION_USER = `aiwork-${Math.random().toString(36).slice(2, 10)}`

const hasStructuredFields = computed(() => {
  if (!result.value) return false
  const fields = ['name', 'title', 'company', 'phone', 'email', 'address', 'website']
  return fields.some((f) => result.value![f])
})

const formattedJson = computed(() =>
  result.value ? JSON.stringify(result.value, null, 2) : ''
)

const canRun = computed(() => {
  if (loading.value) return false
  if (!apiKey.value) return false
  if (inputType.value === 'image_url') return !!imageUrl.value.trim()
  return !!uploadedFile.value
})

// 用户选了文件后自动上传到 Dify
async function handleFileChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw as UploadRawFile | undefined
  if (!raw) return
  const key = userApiKey.value.trim() || ENV_API_KEY
  if (!key) {
    ElMessage.error('请先填写 Dify API Key')
    return
  }

  const formData = new FormData()
  formData.append('file', raw)
  formData.append('user', SESSION_USER)

  loading.value = true
  try {
    const resp = await fetch(`${DIFY_BASE}/v1/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: formData,
    })
    const json = await resp.json()
    if (!resp.ok) {
      throw new Error(json.message || json.error || `HTTP ${resp.status}`)
    }
    uploadedFile.value = {
      id: json.id,
      name: uploadFile.name,
      size: raw.size,
      previewUrl: URL.createObjectURL(raw),
    }
    ElMessage.success('文件已上传到 Dify')
  } catch (e: any) {
    uploadedFile.value = null
    ElMessage.error(`上传失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

async function run() {
  if (!canRun.value) return
  loading.value = true
  result.value = null
  runMeta.value = null

  const key = userApiKey.value.trim() || ENV_API_KEY
  const inputVar = inputKey.value || 'business_card'

  // 构造 Dify 文件输入:始终是 list,根据类型给不同 transfer_method
  let fileInput: any[]
  if (inputType.value === 'image_url') {
    fileInput = [
      {
        type: 'image',
        transfer_method: 'remote_url',
        url: imageUrl.value.trim(),
      },
    ]
  } else {
    fileInput = [
      {
        type: 'image',
        transfer_method: 'local_file',
        upload_file_id: uploadedFile.value!.id,
      },
    ]
  }

  try {
    const resp = await fetch(`${DIFY_BASE}/v1/workflows/run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        inputs: { [inputVar]: fileInput },
        response_mode: 'blocking',
        user: SESSION_USER,
      }),
    })

    const json = await resp.json()
    if (!resp.ok) {
      throw new Error(json.message || json.error || `HTTP ${resp.status}`)
    }

    const data = json.data || {}
    result.value = (data.outputs as CardResult) || {}
    runMeta.value = {
      runId: json.workflow_run_id || data.id || '',
      elapsed: data.elapsed_time ?? 0,
      tokens: data.total_tokens ?? 0,
    }
    ElMessage.success('识别完成')
  } catch (e: any) {
    result.value = null
    ElMessage.error(`请求失败: ${e.message}`)
  } finally {
    loading.value = false
  }
}

function clear() {
  result.value = null
  runMeta.value = null
}

function copyJson() {
  if (!result.value) return
  navigator.clipboard.writeText(formattedJson.value).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}
</script>

<style scoped>
.card-page {
  padding: 0;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}
.qa-card {
  border-radius: 8px;
}
.meta-tags {
  display: flex;
  gap: 6px;
}
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
.preview-wrap {
  margin-top: 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 8px;
  text-align: center;
  background: #fafbfc;
}
.preview-img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.upload-trigger {
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.upload-text {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}
.upload-hint {
  font-size: 12px;
  color: #909399;
}
:deep(.el-upload-dragger) {
  padding: 12px;
}
.result-card {
  min-height: 480px;
}
.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 360px;
  color: #909399;
  font-size: 14px;
}
.empty-result p {
  margin: 6px 0 0;
}
.card-fields {
  margin-bottom: 16px;
}
.raw-section {
  background: #fafbfc;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
}
.raw-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 12px;
  color: #606266;
}
.raw-json {
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  color: #303133;
  max-height: 360px;
  overflow-y: auto;
}
code {
  background: #f0f2f5;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
}
</style>
