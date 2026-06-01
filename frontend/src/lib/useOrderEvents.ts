'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';

export function useOrderEvents(enabled = true) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    const es = new EventSource('/api/events/stream', { withCredentials: true });

    es.addEventListener('order.created', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      showToast('New order received');
    });
    es.addEventListener('order.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    });

    es.onerror = () => es.close();
    return () => es.close();
  }, [enabled, queryClient, showToast]);
}
