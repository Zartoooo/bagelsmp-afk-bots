export type BotStatus =
  | 'stopped'
  | 'connecting'
  | 'authenticating'
  | 'online'
  | 'reconnecting'
  | 'error'

export interface ChatMessage {
  username: string
  message: string
  time: number
}

export interface Position {
  x: number
  y: number
  z: number
}

export interface BotState {
  id: number
  username: string
  status: BotStatus
  authed: boolean
  shards: number | null
  shardsRaw: string | null
  shardsUpdatedAt: number | null
  ping: number | null
  uptimeMs: number
  position: Position | null
  version: string | null
  viewerUrl: string
  viewerPort: number
  viewerUp: boolean
  lastChat: ChatMessage | null
  chat: ChatMessage[]
  lastError: string | null
  antiAfk: {
    enabled: boolean
    jumpIntervalMs: number
    afkCommand: string
    active: boolean
  }
}

export interface ServerConfig {
  host: string
  port: number
  version: string | boolean
  auth: string
}

export interface Config {
  server: ServerConfig
  bots: {
    count: number
    usernamePrefix: string
    randomSuffix: number
    password: string
  }
  chat: {
    echo: boolean
    logAll: boolean
  }
  antiAfk: {
    enabled: boolean
    jumpIntervalMs: number
    afkCommand: string
    afkRefreshMs: number
  }
  shards: {
    enabled: boolean
    command: string
    checkIntervalMs: number
    pattern: string
  }
  dashboard: {
    host: string
    port: number
  }
  viewer: {
    basePort: number
    firstPerson: boolean
    viewDistance: number
  }
  reconnect: {
    enabled: boolean
    initialDelayMs: number
    maxDelayMs: number
  }
}

export interface Stats {
  total: number
  connected: number
  online: number
  shards: number
  shardsKnown: number
  avgPing: number | null
  uptimeMs: number
}

export type LogLevel = 'info' | 'warn' | 'error' | 'cmd' | 'debug'

export interface LogEntry {
  level: LogLevel | string
  message: string
  slot?: number | null
  username?: string
  time: number
}

export interface FleetState {
  bots: BotState[]
  stats: Stats
  config: Config
  logs: LogEntry[]
  serverTime: number
}
