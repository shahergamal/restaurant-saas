'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
const listeners = new Set<(event: string, payload: unknown) => void>();

function connect() {
  if (socket) return socket;
  // Empty NEXT_PUBLIC_WS_URL = same origin (the single-container deploy proxies /ws to the API).
  const url = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';
  const opts = { path: '/ws', withCredentials: true, transports: ['websocket'], reconnectionDelayMax: 10_000 };
  socket = url ? io(url, opts) : io(opts);
  socket.onAny((event: string, payload: unknown) => listeners.forEach((l) => l(event, payload)));
  return socket;
}

/** Live updates: invalidates the affected queries when the API broadcasts a change for this branch. */
export function useRealtime(onEvent?: (event: string, payload: unknown) => void) {
  const qc = useQueryClient();
  useEffect(() => {
    connect();
    const l = (event: string, payload: unknown) => {
      if (event.startsWith('ticket.')) {
        qc.invalidateQueries({ queryKey: ['kitchen'] });
        qc.invalidateQueries({ queryKey: ['orders'] });
        qc.invalidateQueries({ queryKey: ['dashboard'] });
        qc.invalidateQueries({ queryKey: ['notifications'] });
      }
      if (event.startsWith('table.')) {
        qc.invalidateQueries({ queryKey: ['floors'] });
        qc.invalidateQueries({ queryKey: ['table'] });
        qc.invalidateQueries({ queryKey: ['tables-summary'] });
      }
      onEvent?.(event, payload);
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [qc, onEvent]);
}
