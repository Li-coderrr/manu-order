<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { createOrder, isSupabaseConfigured, menuItems, type OrderItem } from '@/lib/supabase'

const customer = ref('老婆')
const submitting = ref(false)
const quantities = reactive<Record<string, number>>(
  Object.fromEntries(menuItems.map((item) => [item.name, 0])),
)

const selectedItems = computed<OrderItem[]>(() =>
  menuItems
    .map((item) => ({
      name: item.name,
      qty: quantities[item.name] ?? 0,
    }))
    .filter((item) => item.qty > 0),
)

const totalQuantity = computed(() => selectedItems.value.reduce((sum, item) => sum + item.qty, 0))
const totalPrice = computed(() =>
  menuItems.reduce((sum, item) => sum + item.price * (quantities[item.name] ?? 0), 0),
)

function changeQty(name: string, delta: number) {
  const nextValue = (quantities[name] ?? 0) + delta
  quantities[name] = Math.max(0, nextValue)
}

function resetForm() {
  customer.value = '老婆'

  for (const item of menuItems) {
    quantities[item.name] = 0
  }
}

async function submitOrder() {
  if (!isSupabaseConfigured) {
    ElMessage.error('请先配置 Supabase 环境变量。')
    return
  }

  if (selectedItems.value.length === 0) {
    ElMessage.warning('请至少选择一个菜品。')
    return
  }

  submitting.value = true

  try {
    await createOrder({
      customer: customer.value.trim() || '老婆',
      items: selectedItems.value,
    })
    ElMessage.success('下单成功，接单端会实时收到。')
    resetForm()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '下单失败，请稍后重试。')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page-shell">
    <section class="hero-card">
      <div>
        <p class="eyebrow">Today's Menu</p>
        <h1>老婆，今天想吃什么？</h1>
        <p class="hero-copy">想吃什么直接点，提交后会实时同步到接单页。</p>
      </div>
      <RouterLink class="ghost-link" to="/admin">去接单页</RouterLink>
    </section>

    <el-alert
      v-if="!isSupabaseConfigured"
      title="未配置 Supabase"
      type="warning"
      :closable="false"
      description="请在项目根目录配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。"
      show-icon
    />

    <section class="content-stack">
      <el-card shadow="never" class="panel-card">
        <template #header>
          <div class="panel-header">
            <span>顾客信息</span>
            <el-tag type="info" effect="plain">可修改</el-tag>
          </div>
        </template>

        <el-input
          v-model="customer"
          size="large"
          placeholder="例如：老婆 / 2号桌 / 小王"
          maxlength="20"
          clearable
        />
      </el-card>

      <div class="menu-grid">
        <el-card v-for="item in menuItems" :key="item.name" shadow="hover" class="dish-card">
          <div class="dish-main">
            <div>
              <h2>{{ item.name }}</h2>
              <p class="dish-price">¥{{ item.price }}</p>
            </div>

            <div class="qty-control">
              <el-button circle size="large" @click="changeQty(item.name, -1)">-</el-button>
              <strong>{{ quantities[item.name] }}</strong>
              <el-button circle size="large" type="primary" @click="changeQty(item.name, 1)">+</el-button>
            </div>
          </div>
        </el-card>
      </div>
    </section>

    <footer class="sticky-footer">
      <div class="summary-block">
        <p>已选 {{ totalQuantity }} 份</p>
        <strong>合计 ¥{{ totalPrice }}</strong>
      </div>
      <el-button
        type="primary"
        size="large"
        class="submit-button"
        :loading="submitting"
        :disabled="selectedItems.length === 0"
        @click="submitOrder"
      >
        提交订单
      </el-button>
    </footer>
  </div>
</template>
