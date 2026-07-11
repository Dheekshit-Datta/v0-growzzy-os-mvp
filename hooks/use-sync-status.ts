'use client';

import { useState, useEffect, useCallback } from 'react';

interface SyncConnection {
  id: string;
  platform: string;
  account_name: string;
  status: string;
  last_synced_at: string | null;
}

interface SyncStatus {
  connections: SyncConnection[];
  lastSyncTime: string | null;
  nextSyncTime: string;
  isSyncing: boolean;
}

export function useSyncStatus(userId: string | null) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sync status
  const fetchSyncStatus = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/sync/status?userId=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch sync status');
      const data = await response.json();
      setSyncStatus(data);
      setError(null);
    } catch (err: any) {
      console.error('[v0] Sync status fetch error:', err);
      setError(err.message);
    }
  }, [userId]);

  // Trigger manual sync
  const triggerSync = useCallback(async () => {
    if (!userId || isSyncing) return;

    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to trigger sync');
      
      const data = await response.json();
      console.log('[v0] Manual sync result:', data);

      // Refresh sync status
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchSyncStatus();
    } catch (err: any) {
      console.error('[v0] Manual sync error:', err);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, [userId, isSyncing, fetchSyncStatus]);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchSyncStatus();
    const interval = setInterval(fetchSyncStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchSyncStatus]);

  return {
    syncStatus,
    isSyncing,
    error,
    triggerSync,
    refetch: fetchSyncStatus,
  };
}

export function formatLastSync(lastSyncTime: string | null): string {
  if (!lastSyncTime) return 'Never';

  const date = new Date(lastSyncTime);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return `${Math.floor(diffMins / 1440)}d ago`;
}
