<template>
  <div class="workflow-page">
    <div class="workflow-header">
      <div>
        <h2 style="margin: 0 0 4px;">可视化工作流</h2>
        <p style="margin: 0; color: #606266; font-size: 13px;">
          4 个预置工作流 — 一键运行多步骤 AI 流水线, 看每步的中间产物
        </p>
      </div>
    </div>

    <!-- 工作流选择卡片 -->
    <el-row :gutter="16" class="wf-cards">
      <el-col
        v-for="wf in workflows"
        :key="wf.code"
        :xs="24"
        :sm="12"
        :md="6"
      >
        <div
          class="wf-card"
          :class="{ active: selectedCode === wf.code }"
          @click="selectWorkflow(wf)"
        >
          <div class="wf-icon">{{ wf.icon }}</div>
          <div class="wf-name">{{ wf.name }}</div>
          <div class="wf-desc">{{ wf.description }}</div>
          <div class="wf-steps">
            <el-tag
              v-for="(step, i) in wf.steps"
              :key="i"
              size="small"
              :type="getStepType(i)"
              effect="plain"
            >
              {{ step }}
            </el-tag>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 选中的工作流执行区 -->
    <el-card v-if="selectedWf" shadow="never" class="qa-card run-card">
      <template #header>
        <div class="card-header">
          <span>
            <el-icon><Connection /></el-icon>
            {{ selectedWf.icon }} {{ selectedWf.name }}
          </span>
          <el-tag v-if="lastMeta" size="small" type="info">
            {{ lastMeta.name }} · {{ lastMeta.total_steps }} 步
          </el-tag>
        </div>
      </template>

      <el-row :gutter="16">
        <!-- 左:输入 -->
        <el-col :xs="24" :md="10">
          <div class="form-item">
            <label class="form-label">{{ selectedWf.input_label }}</label>
            <el-input
              v-model="input"
              type="textarea"
              :rows="10"
              :placeholder="selectedWf.input_placeholder"
              :disabled="streaming"
              resize="vertical"
            />
            <div class="text-meta">
              {{ input.length }} 字
              <span v-if="input.length < selectedWf.input_min_length" style="color: #f56c6c;">
                (至少 {{ selectedWf.input_min_length }} 字)
              </span>
            </div>
          </div>
          <el-button
            type="primary"
            :icon="VideoPlay"
            :loading="streaming"
            :disabled="input.length < selectedWf.input_min_length || streaming"
            @click="run"
            size="large"
            style="width: 100%;"
          >
            {{ streaming ? '运行中…' : '运行工作流' }}
          </el-button>
        </el-col>

        <!-- 右:执行进度 + 步骤产物 -->
        <el-col :xs="24" :md="14">
          <!-- 步骤进度条 -->
          <div v-if="lastMeta" class="steps-progress">
            <div
              v-for="(step, i) in lastMeta.steps"
              :key="i"
              class="step-item"
              :class="{
                done: completedSteps.has(i),
                active: currentStep === i && streaming,
                pending: !completedSteps.has(i) && currentStep !== i,
              }"
            >
              <div class="step-icon">
                <el-icon v-if="completedSteps.has(i)" :size="14"><Check /></el-icon>
                <el-icon v-else-if="currentStep === i && streaming" class="loading"><Loading /></el-icon>
                <span v-else>{{ i + 1 }}</span>
              </div>
              <div class="step-name">{{ step }}</div>
            </div>
          </div>

          <!-- 错误 -->
          <el-alert
            v-if="errorMsg"
            type="error"
            :title="errorMsg"
            :closable="false"
            show-icon
            style="margin-top: 12px;"
          />

          <!-- 各步骤产物(累积展示) -->
          <div v-if="stepOutputs.length > 0" class="outputs">
            <div
              v-for="out in stepOutputs"
              :key="out.node_id"
              class="output-card"
            >
              <div class="output-header">
                <span class="output-label">{{ out.node_label }}</span>
                <el-tag v-if="!out.streaming" size="small" type="success">完成</el-tag>
                <el-tag v-else size="small" type="warning">生成中</el-tag>
                <el-button
                  v-if="!out.streaming"
                  link
                  size="small"
                  :icon="CopyDocument"
                  style="margin-left: auto;"
                  @click="copyOutput(out.output)"
                >
                  复制
                </el-button>
              </div>
              <pre class="output-text">{{ out.output }}<span v-if="out.streaming" class="cursor-blink">▍</span></pre>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!streaming && stepOutputs.length === 0 && !errorMsg" class="empty-output">
            <el-icon :size="40" color="#c0c4cc"><Connection /></el-icon>
            <p>运行后这里会显示每个步骤的产物</p>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-empty
      v-else
      description="选择上方任一工作流开始"
      style="margin-top: 40px;"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  Connection,
  CopyDocument,
  Loading,
  VideoPlay,
} from '@element-plus/icons-vue'

const API_BASE = ''

interface Workflow {
  code: string
  name: string
  description: string
  icon: string
  input_label: string
  input_placeholder: string
  input_min_length: number
  steps: string[]
}

interface StepOutput {
  node_id: string
  node_label: string
  output: string
  output_key: string
  streaming?: boolean
}

interface Meta {
  name: string
  description: string
  steps: string[]
  total_steps: number
}

const workflows = ref<Workflow[]>([])
const selectedCode = ref<string>('')
const input = ref('')
const streaming = ref(false)
const errorMsg = ref('')

const lastMeta = ref<Meta | null>(null)
const stepOutputs = reactive<StepOutput[]>([])
const currentStep = ref(-1)
const completedSteps = reactive<Set<number>>(new Set())

const selectedWf = computed(() =>
  workflows.value.find((w) => w.code === selectedCode.value)
)

// 步骤 tag 颜色: 已完成=success, 进行中=warning, 未开始=info
function getStepType(i: number): 'success' | 'warning' | 'info' {
  if (completedSteps.has(i)) return 'success'
  if (currentStep.value === i && streaming.value) return 'warning'
  return 'info'
}

function selectWorkflow(wf: Workflow) {
  if (streaming.value) {
    ElMessage.warning('工作流运行中, 请先停止或等待完成')
    return
  }
  selectedCode.value = wf.code
  input.value = ''
  errorMsg.value = ''
  stepOutputs.splice(0)
  lastMeta.value = null
  currentStep.value = -1
  completedSteps.clear()
}

function copyOutput(content: string) {
  navigator.clipboard.writeText(content).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}

async function loadList() {
  try {
    const resp = await fetch(`${API_BASE}/api/workflow/list`)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    workflows.value = data.workflows || []
    // 默认选中第一个
    if (workflows.value.length > 0) {
      selectedCode.value = workflows.value[0].code
    }
  } catch (e: any) {
    ElMessage.warning(`加载工作流列表失败: ${e.message}`)
  }
}

async function run() {
  if (!selectedWf.value) return
  if (input.value.length < selectedWf.value.input_min_length) {
    ElMessage.warning('输入太短')
    return
  }
  streaming.value = true
  errorMsg.value = ''
  stepOutputs.splice(0)
  completedSteps.clear()
  currentStep.value = 0
  lastMeta.value = null

  try {
    const resp = await fetch(`${API_BASE}/api/workflow/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workflow_code: selectedCode.value,
        input: input.value,
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

          if (event.type === 'workflow_meta') {
            lastMeta.value = event
          } else if (event.type === 'node_start') {
            // 新节点开始, push 占位
            stepOutputs.push({
              node_id: event.node_id,
              node_label: event.node_label,
              output: '',
              output_key: '',
              streaming: true,
            })
          } else if (event.type === 'token') {
            // 往最后一个节点追加
            const last = stepOutputs[stepOutputs.length - 1]
            if (last) last.output += event.content
          } else if (event.type === 'node_end') {
            // 节点完成: 标完成 + 切到下一步
            const last = stepOutputs[stepOutputs.length - 1]
            if (last) {
              last.output = event.output
              last.output_key = event.output_key
              last.streaming = false
            }
            // 标当前步骤完成
            const idx = lastMeta.value ? lastMeta.value.steps.findIndex(
              (s: string) => s === event.node_label || event.node_label.includes(s.replace(/^[^ ]+ /, ''))
            ) : currentStep.value
            if (idx >= 0) {
              completedSteps.add(idx)
              currentStep.value = idx + 1
            }
          } else if (event.type === 'done') {
            currentStep.value = -1
          } else if (event.type === 'error') {
            errorMsg.value = event.message
          }
        } catch { /* skip */ }
      }
    }
  } catch (e: any) {
    errorMsg.value = `请求失败: ${e.message}\n\n请确认后端服务已启动`
    ElMessage.error('运行失败')
  } finally {
    streaming.value = false
    currentStep.value = -1
  }
}

onMounted(() => {
  loadList()
})
</script>

<style scoped>
.workflow-page {
  padding: 0;
}
.workflow-header {
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

/* 工作流卡片 */
.wf-cards {
  margin-bottom: 16px;
}
.wf-card {
  background: linear-gradient(135deg, #fff, #f8f9fb);
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.3s;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.wf-card:hover {
  border-color: #6366f1;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}
.wf-card.active {
  border-color: #6366f1;
  background: linear-gradient(135deg, #eef2ff, #fff);
}
.wf-icon {
  font-size: 32px;
}
.wf-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}
.wf-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.wf-steps {
  margin-top: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 执行面板 */
.run-card {
  margin-top: 0;
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
.text-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  text-align: right;
}

/* 步骤进度 */
.steps-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fafbfc;
  border-radius: 6px;
  margin-bottom: 12px;
}
.step-item {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  font-size: 12px;
  color: #909399;
  position: relative;
}
.step-item:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 14px;
  left: 28px;
  right: 0;
  height: 2px;
  background: #e4e7ed;
  z-index: 0;
}
.step-item.done:not(:last-child)::after {
  background: #67c23a;
}
.step-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e4e7ed;
  color: #909399;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  z-index: 1;
  flex-shrink: 0;
}
.step-item.done .step-icon {
  background: #67c23a;
  color: #fff;
}
.step-item.active .step-icon {
  background: #e6a23c;
  color: #fff;
}
.step-item.active .loading {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.step-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.step-item.done .step-name,
.step-item.active .step-name {
  color: #303133;
  font-weight: 500;
}

/* 步骤产物 */
.outputs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.output-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}
.output-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  font-size: 13px;
  font-weight: 500;
}
.output-label {
  color: #303133;
}
.output-text {
  padding: 12px 14px;
  margin: 0;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 320px;
  overflow-y: auto;
  background: #fff;
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

/* 空状态 */
.empty-output {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
  font-size: 13px;
}
.empty-output p {
  margin-top: 8px;
}
</style>