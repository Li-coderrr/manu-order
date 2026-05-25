<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import {
  fetchOrders,
  isSupabaseConfigured,
  subscribeToOrders,
  updateOrderStatus,
  type OrderRecord,
} from '@/lib/supabase'

const orders = ref<OrderRecord[]>([])
const loading = ref(false)
const completingIds = ref<number[]>([])
const soundReady = ref(false)

let cleanupRealtime: (() => Promise<unknown>) | null = null
let audioContext: AudioContext | null = null

const activeOrders = computed(() => orders.value.filter((order) => order.status !== 'done'))
const completedOrders = computed(() => orders.value.filter((order) => order.status === 'done'))

function sortOrders(list: OrderRecord[]) {
  return [...list].sort((a, b) => {
    const dateDelta = new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (dateDelta !== 0) {
      return dateDelta
    }

    return b.id - a.id
  })
}

function upsertOrder(nextOrder: OrderRecord) {
  const nextList = [...orders.value]
  const index = nextList.findIndex((order) => order.id === nextOrder.id)

  if (index >= 0) {
    nextList[index] = nextOrder
  } else {
    nextList.unshift(nextOrder)
  }

  orders.value = sortOrders(nextList)
}

function removeOrder(id: number) {
  orders.value = orders.value.filter((order) => order.id !== id)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

async function loadOrders() {
  if (!isSupabaseConfigured) {
    return
  }

  loading.value = true

  try {
    orders.value = sortOrders(await fetchOrders())
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '订单加载失败。')
  } finally {
    loading.value = false
  }
}

async function enableSound() {
  const AudioContextClass = window.AudioContext

  if (!AudioContextClass) {
    ElMessage.warning('当前浏览器不支持声音提醒。')
    return
  }

  audioContext ??= new AudioContextClass()

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    soundReady.value = true
    ElMessage.success('声音提醒已启用。')
  } catch {
    ElMessage.warning('声音提醒需要先与页面交互一次。')
  }
}

function playAlert() {
  if (!audioContext || audioContext.state !== 'running') {
    return
  }

  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  const startAt = audioContext.currentTime

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(880, startAt)
  oscillator.frequency.linearRampToValueAtTime(660, startAt + 0.25)

  gainNode.gain.setValueAtTime(0.001, startAt)
  gainNode.gain.exponentialRampToValueAtTime(0.18, startAt + 0.03)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + 0.35)

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.start(startAt)
  oscillator.stop(startAt + 0.36)
}

async function completeOrder(id: number) {
  if (!isSupabaseConfigured) {
    ElMessage.error('请先配置 Supabase 环境变量。')
    return
  }

  completingIds.value = [...completingIds.value, id]

  try {
    const updated = await updateOrderStatus(id, 'done')
    upsertOrder(updated)
    ElMessage.success(`订单 #${id} 已完成。`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新订单失败。')
  } finally {
    completingIds.value = completingIds.value.filter((item) => item !== id)
  }
}

onMounted(async () => {
  await loadOrders()

  cleanupRealtime = subscribeToOrders({
    onInsert: (order) => {
      upsertOrder(order)
      playAlert()
      ElNotification({
        title: '新订单',
        message: `${order.customer} 提交了 ${order.items.length} 个菜品`,
        type: 'success',
      })
    },
    onUpdate: (order) => {
      upsertOrder(order)
    },
    onDelete: (id) => {
      removeOrder(id)
    },
  })
})

onUnmounted(() => {
  if (cleanupRealtime) {
    void cleanupRealtime()
  }
})
</script>

<template>
  <div class="page-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Kitchen Console</p>
        <h1>接单</h1>
        <p class="hero-copy">实时监听 orders，新订单置顶，可直接完成订单。</p>
      </div>
      <RouterLink class="ghost-link" to="/order">去点菜页</RouterLink>
    </section>

    <el-alert
      v-if="!isSupabaseConfigured"
      title="未配置 Supabase"
      type="warning"
      :closable="false"
      description="请在项目根目录配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。"
      show-icon
    />

    <div class="toolbar-card">
      <div class="toolbar-meta">
        <el-tag type="danger" effect="dark">待处理 {{ activeOrders.length }}</el-tag>
        <el-tag type="success" effect="plain">已完成 {{ completedOrders.length }}</el-tag>
      </div>

      <div class="toolbar-actions">
        <el-button plain :loading="loading" @click="loadOrders">刷新</el-button>
        <el-button type="primary" plain @click="enableSound">
          {{ soundReady ? '声音已开启' : '开启声音提醒' }}
        </el-button>
      </div>
    </div>

    <section class="content-stack">
      <el-empty v-if="!loading && orders.length === 0" description="暂无订单" />

      <div v-else class="order-list">
        <el-card v-for="order in orders" :key="order.id" shadow="hover" class="order-card">
          <div class="order-topline">
            <div>
              <p class="order-id">订单 #{{ order.id }}</p>
              <h2>{{ order.customer }}</h2>
            </div>

            <div class="order-meta">
              <el-tag :type="order.status === 'done' ? 'success' : 'danger'">
                {{ order.status === 'done' ? '已完成' : '新订单' }}
              </el-tag>
              <span>{{ formatTime(order.created_at) }}</span>
            </div>
          </div>

          <ul class="item-list">
            <li v-for="item in order.items" :key="`${order.id}-${item.name}`">
              <span>{{ item.name }}</span>
              <strong>x{{ item.qty }}</strong>
            </li>
          </ul>

          <div class="order-actions">
            <el-button
              v-if="order.status !== 'done'"
              type="success"
              size="large"
              :loading="completingIds.includes(order.id)"
              @click="completeOrder(order.id)"
            >
              完成订单
            </el-button>
          </div>
        </el-card>
      </div>
    </section>
  </div>
</template>
