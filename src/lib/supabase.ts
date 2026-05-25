import {
  createClient,
  type RealtimeChannel,
  type RealtimeRemoveChannelResponse,
  type SupabaseClient,
} from '@supabase/supabase-js'

export interface MenuItem {
  name: string
  price: number
}

export interface OrderItem {
  name: string
  qty: number
}

export interface OrderRecord {
  id: number
  customer: string
  items: OrderItem[]
  status: string
  created_at: string
}

export interface CreateOrderInput {
  customer: string
  items: OrderItem[]
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const menuItems: MenuItem[] = [
  { name: '宫保鸡丁', price: 38 },
  { name: '鱼香肉丝', price: 32 },
  { name: '可乐鸡翅', price: 28 },
  { name: '西红柿炒蛋', price: 22 },
  { name: '酸辣土豆丝', price: 18 },
  { name: '麻婆豆腐', price: 26 },
  { name: '蒜蓉西兰花', price: 24 },
  { name: '紫菜蛋花汤', price: 16 },
  { name: '米饭', price: 2 },
  { name: '可乐', price: 6 },
]

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null

function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('缺少 Supabase 配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。')
  }

  return supabase
}

function normalizeItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const rawName = 'name' in item ? item.name : ''
      const rawQty = 'qty' in item ? item.qty : 0
      const name = typeof rawName === 'string' ? rawName.trim() : ''
      const qty = Number(rawQty)

      if (!name || !Number.isFinite(qty) || qty <= 0) {
        return null
      }

      return {
        name,
        qty,
      }
    })
    .filter((item): item is OrderItem => item !== null)
}

function normalizeOrder(row: Record<string, unknown>): OrderRecord {
  return {
    id: Number(row.id ?? 0),
    customer: typeof row.customer === 'string' && row.customer.trim() ? row.customer : '匿名顾客',
    items: normalizeItems(row.items),
    status: typeof row.status === 'string' && row.status.trim() ? row.status : 'new',
    created_at:
      typeof row.created_at === 'string' && row.created_at
        ? row.created_at
        : new Date().toISOString(),
  }
}

export async function createOrder(input: CreateOrderInput): Promise<OrderRecord> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('orders')
    .insert({
      customer: input.customer,
      items: input.items,
      status: 'new',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return normalizeOrder(data as Record<string, unknown>)
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })

  if (error) {
    throw error
  }

  return (data ?? []).map((row) => normalizeOrder(row as Record<string, unknown>))
}

export async function updateOrderStatus(id: number, status: string): Promise<OrderRecord> {
  const client = requireSupabase()

  const { data, error } = await client
    .from('orders')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return normalizeOrder(data as Record<string, unknown>)
}

interface OrderSubscriptionHandlers {
  onInsert?: (order: OrderRecord) => void
  onUpdate?: (order: OrderRecord) => void
  onDelete?: (id: number) => void
}

export function subscribeToOrders(
  handlers: OrderSubscriptionHandlers,
): (() => Promise<RealtimeRemoveChannelResponse>) | null {
  if (!supabase) {
    return null
  }

  const channel: RealtimeChannel = supabase
    .channel(`orders-realtime-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
      handlers.onInsert?.(normalizeOrder(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
      handlers.onUpdate?.(normalizeOrder(payload.new as Record<string, unknown>))
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
      handlers.onDelete?.(Number(payload.old.id))
    })
    .subscribe()

  return () => supabase.removeChannel(channel)
}
