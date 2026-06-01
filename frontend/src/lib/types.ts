export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface OrderItem {
  sku?: string;
  name: string;
  brand?: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  service: string;
  customer: string;
  phone: string;
  device: string;
  serial_number?: string;
  amount: number;
  payment: string;
  agent: string;
  location: string;
  status: string;
  date: string;
  notes?: string;
  extras?: Record<string, string>;
  items?: OrderItem[];
}

export interface Product {
  sku: string;
  name: string;
  brand: string;
  category?: string;
  stock: number;
  price: number;
  location?: string;
  status?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  photo?: string;
  role?: string;
  totpEnabled?: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
}

export interface Notification {
  id: number;
  order_id?: string;
  channel: string;
  recipient: string;
  event_type: string;
  message?: string;
  status: string;
  link?: string;
  created_at: string;
}

export interface OrderSummary {
  total: number;
  counts: Record<string, number>;
}

export interface OrderStats {
  total: number;
  revenue: number;
  pending: number;
  completed: number;
  byService: Record<string, { count: number; amount: number }>;
  byPayment: Record<string, { count: number; total: number }>;
}

export interface Customer {
  _id: string;
  phone: string;
  name: string;
  email?: string;
  notes?: string;
  tags?: string[];
  orderCount: number;
  totalSpent: number;
  lastOrderAt?: string;
}

export interface AppSettings {
  default_location?: string;
  warehouse_location?: string;
  low_stock_threshold?: string;
}

export interface AuditEntry {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  user_email: string;
  summary: string;
  created_at: string;
}
