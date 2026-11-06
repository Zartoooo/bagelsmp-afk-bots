import type { Config, FleetState, LogEntry } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = Array.isArray(data?.errors)
      ? data.errors.join('\n')
      : data?.error || `Request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export const api = {
  state: () => request<FleetState>('/api/state'),
  logs: (limit = 200) => request<{ logs: LogEntry[] }>(`/api/logs?limit=${limit}`),
  saveConfig: (config: Config, restart: boolean) =>
    request<{ config: Config }>('/api/config', {
      method: 'PUT',
      body: JSON.stringify({ config, restart }),
    }),
  action: (type: 'start' | 'stop' | 'restart', id?: number) =>
    request<{ ok: boolean; state?: FleetState }>('/api/action', {
      method: 'POST',
      body: JSON.stringify(id === undefined ? { type } : { type, id }),
    }),
  sendCommand: (id: number, message: string) =>
    request<{ ok: boolean }>(`/api/bots/${id}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
}

export interface StreamHandlers {
  onState: (state: FleetState) => void
  onLog: (entry: LogEntry) => void
  onOpen: () => void
  onError: () => void
}

export function openStream(handlers: StreamHandlers): () => void {
  const source = new EventSource('/api/stream')

  source.addEventListener('state', (event) => {
    try {
      handlers.onState(JSON.parse((event as MessageEvent).data))
    } catch {
      /* ignore malformed payload */
    }
  })
  source.addEventListener('log', (event) => {
    try {
      handlers.onLog(JSON.parse((event as MessageEvent).data))
    } catch {
      /* ignore malformed payload */
    }
  })
  source.onopen = handlers.onOpen
  source.onerror = handlers.onError

  return () => source.close()
}

/** The viewer runs on its own port; rebuild the URL for the host the dashboard is viewed from. */
export function viewerSrc(viewerPort: number, fallback: string) {
  try {
    const host = window.location.hostname
    if (host) return `http://${host}:${viewerPort}/`
  } catch {
    /* non-browser */
  }
  return fallback
}
