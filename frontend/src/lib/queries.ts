'use client';

import { useQuery } from '@tanstack/react-query';
import {
  api,
  fetchAllProducts,
  fetchAudit,
  fetchNotifications,
  fetchOrderStats,
  fetchOrderSummary,
  fetchOrders,
  fetchProducts,
  fetchRecentOrders,
  fetchSettings
} from '@/lib/api';
import type { Order, User } from '@/lib/types';

export function useMe(enabled = true) {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () =>
      api<{
        user: User;
        tenant?: { branding?: { logoUrl?: string; primaryColor?: string } };
      }>('/api/auth/me'),
    enabled,
    retry: false
  });
}

export function useOrderSummary() {
  return useQuery({ queryKey: ['orders', 'summary'], queryFn: fetchOrderSummary });
}

export function useOrderStats(params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['orders', 'stats', params],
    queryFn: () => fetchOrderStats(params)
  });
}

export function useRecentOrders(limit = 6) {
  return useQuery({
    queryKey: ['orders', 'recent', limit],
    queryFn: () => fetchRecentOrders(limit)
  });
}

export function useOrders(params: {
  page?: number;
  limit?: number;
  service?: string;
  status?: string;
  location?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['orders', 'list', params],
    queryFn: () => fetchOrders(params)
  });
}

export function useAllProducts() {
  return useQuery({ queryKey: ['products', 'all'], queryFn: fetchAllProducts });
}

export function useProducts(params: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['products', 'list', params],
    queryFn: () => fetchProducts(params)
  });
}

export function useAgents() {
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => api<string[]>('/api/agents')
  });
}

export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
}

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
}

export function useAudit(limit = 50) {
  return useQuery({ queryKey: ['audit', limit], queryFn: () => fetchAudit(limit) });
}

export type { Order };
