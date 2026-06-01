'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

export function StaffModal({
  open,
  agents,
  onClose,
  onUpdated
}: {
  open: boolean;
  agents: string[];
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  async function addAgent() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await api('/api/agents', { method: 'POST', body: JSON.stringify({ name: trimmed }) });
      setName('');
      await onUpdated();
      showToast(`${trimmed} added`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setBusy(false);
    }
  }

  async function removeAgent(agentName: string) {
    setBusy(true);
    try {
      await api(`/api/agents/${encodeURIComponent(agentName)}`, { method: 'DELETE' });
      await onUpdated();
      showToast(`${agentName} removed`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[600] flex items-end justify-center bg-navy/45 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,520px)] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 bg-navy px-4 py-4 text-white sm:px-6 sm:py-5">
          <p className="font-mono text-[11px] text-brand-light">Staff Management</p>
          <h3 className="text-lg font-semibold">Manage Staff Members</h3>
        </div>
        <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {agents.length ? (
            <ul className="space-y-2">
              {agents.map(a => (
                <li key={a} className="flex items-center justify-between rounded-xl border border-navy/10 bg-surface/50 px-3 py-2 text-sm font-medium">
                  {a}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeAgent(a)}
                    className="text-faint hover:text-red-600"
                    title={`Remove ${a}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-faint">No staff added yet</p>
          )}
        </div>
        <div className="safe-bottom flex shrink-0 flex-col gap-2 border-t border-navy/10 px-4 py-4 sm:flex-row sm:px-6">
          <input
            className="flex-1 rounded-xl border border-navy/15 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="New staff name…"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addAgent()}
          />
          <button
            type="button"
            disabled={busy}
            onClick={addAgent}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
