import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Gauge,
  Layers,
  RefreshCw,
  Signal,
  Star,
  MonitorPlay,
  X,
} from 'lucide-react'
import type { FleetState, LogEntry } from './lib/types'
import { api, openStream } from './lib/api'
import { formatUptime } from './lib/format'
import { Header } from './components/Header'
import { StatCard } from './components/StatCard'
import { BotCard } from './components/BotCard'
import { SettingsForm } from './components/SettingsForm'
import { LogsPanel } from './components/LogsPanel'
import { StatusBadge } from './components/StatusBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { Switch } from './components/ui/switch'
import { Label } from './components/ui/label'
import { Button } from './components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import { viewerSrc } from './lib/api'

/** Browsers only allow a handful of live WebGL contexts at once. */
const MAX_LIVE_SCREENS = 12

export default function App() {
  const [state, setState] = useState<FleetState | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab, setTab] = useState('overview')
  const [showScreens, setShowScreens] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    api
      .state()
      .then((initial) => {
        setState(initial)
        setLogs(initial.logs)
        setLoadError(null)
      })
      .catch((err) => setLoadError(err.message))

    const close = openStream({
      onState: (next) => {
        setState(next)
        setLoadError(null)
      },
      onLog: (entry) => setLogs((prev) => [...prev, entry].slice(-400)),
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
    })
    return close
  }, [])

  const runAction = useCallback(
    async (type: 'start' | 'stop' | 'restart', id?: number) => {
      setBusy(true)
      try {
        const result = await api.action(type, id)
        if (result?.state) setState(result.state)
      } catch (err) {
        setLoadError((err as Error).message)
      } finally {
        setTimeout(() => setBusy(false), 400)
      }
    },
    []
  )

  const sendCommand = useCallback(async (id: number, message: string) => {
    try {
      await api.sendCommand(id, message)
    } catch (err) {
      setLoadError((err as Error).message)
    }
  }, [])

  const saveConfig = useCallback(async (config: FleetState['config'], restart: boolean) => {
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveConfig(config, restart)
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }, [])

  const stats = state?.stats
  const bots = state?.bots ?? []
  const expandedBot = useMemo(
    () => bots.find((b) => b.id === expanded) ?? null,
    [bots, expanded]
  )

  const screensShown = Math.min(bots.filter((b) => b.viewerUp).length, MAX_LIVE_SCREENS)

  if (!state) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {loadError ? `Cannot reach the API: ${loadError}` : 'Connecting to fleet…'}
        </p>
        <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header stats={state.stats} connected={connected} busy={busy} onAction={runAction} />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6">
        <Tabs value={tab} onValueChange={setTab} className="gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="h-9">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <Gauge className="h-3.5 w-3.5" /> Overview
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs">
                <Layers className="h-3.5 w-3.5" /> Settings
              </TabsTrigger>
              <TabsTrigger value="logs" className="gap-1.5 text-xs">
                <Signal className="h-3.5 w-3.5" /> Logs
              </TabsTrigger>
            </TabsList>

            {loadError ? (
              <p className="max-w-[50%] truncate text-xs text-destructive" title={loadError}>
                {loadError}
              </p>
            ) : null}
          </div>

          {/* ------------------------------------------------------------ overview */}
          <TabsContent value="overview" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Bots online"
                icon={<Signal className="h-4 w-4" />}
                tone="success"
                value={`${state.stats.online} / ${state.stats.total}`}
                hint={`${state.stats.connected} connected to ${state.config.server.host}`}
              />
              <StatCard
                label="Fleet shards"
                icon={<Star className="h-4 w-4 fill-current" />}
                tone="primary"
                value={`★ ${state.stats.shards.toLocaleString('en-US')}`}
                hint={
                  state.stats.shardsKnown
                    ? `from ${state.stats.shardsKnown} account${state.stats.shardsKnown === 1 ? '' : 's'}`
                    : 'waiting for /shards responses'
                }
              />
              <StatCard
                label="Average ping"
                icon={<RefreshCw className="h-4 w-4" />}
                value={state.stats.avgPing !== null ? `${state.stats.avgPing} ms` : '—'}
                hint={`protocol ${state.bots[0]?.version ?? '—'}`}
              />
              <StatCard
                label="Session uptime"
                icon={<MonitorPlay className="h-4 w-4" />}
                value={formatUptime(state.stats.uptimeMs)}
                hint={`dashboard :${state.config.dashboard.port}`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Switch id="live-screens" checked={showScreens} onCheckedChange={setShowScreens} />
                <Label htmlFor="live-screens" className="text-xs text-muted-foreground">
                  Live screens ({screensShown} shown, max {MAX_LIVE_SCREENS})
                </Label>
              </div>
              <p className="text-[11px] text-muted-foreground">
                anti-AFK:{' '}
                <span className="text-foreground">
                  {state.config.antiAfk.afkCommand} · jump every{' '}
                  {state.config.antiAfk.jumpIntervalMs / 1000}s
                </span>{' '}
                · shard poll:{' '}
                <span className="text-foreground">
                  {state.config.shards.command} every{' '}
                  {state.config.shards.checkIntervalMs / 1000}s
                </span>
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bots.map((bot, index) => (
                <BotCard
                  key={bot.id}
                  bot={bot}
                  showScreen={showScreens && index < MAX_LIVE_SCREENS}
                  onExpand={(b) => setExpanded(b.id)}
                  onAction={runAction}
                  onCommand={sendCommand}
                />
              ))}
            </div>
          </TabsContent>

          {/* ----------------------------------------------------------- settings */}
          <TabsContent value="settings">
            <SettingsForm
              config={state.config}
              onSave={saveConfig}
              saving={saving}
              saveError={saveError}
            />
          </TabsContent>

          {/* --------------------------------------------------------------- logs */}
          <TabsContent value="logs" className="h-[calc(100vh-220px)]">
            <LogsPanel logs={logs} />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-border/70 py-4 text-center text-[11px] text-muted-foreground">
        bagelsmp-afk-bots · {state.stats.total} slot{state.stats.total === 1 ? '' : 's'} ·
        viewers on ports {state.config.viewer.basePort}+
      </footer>

      {/* --------------------------------------------------------- fullscreen view */}
      <Dialog open={expandedBot !== null} onOpenChange={(open) => !open && setExpanded(null)}>
        <DialogContent className="max-w-5xl border-border/70 bg-background/95 p-0">
          <DialogHeader className="flex-row items-center justify-between space-y-0 border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-sm">
                {expandedBot?.username ?? 'Screen'}
              </DialogTitle>
              {expandedBot ? <StatusBadge status={expandedBot.status} /> : null}
            </div>
            <DialogDescription className="text-xs">
              {expandedBot ? `viewer port ${expandedBot.viewerPort}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="aspect-video w-full bg-black">
            {expandedBot?.viewerUp ? (
              <iframe
                src={viewerSrc(expandedBot.viewerPort, expandedBot.viewerUrl)}
                title={`${expandedBot.username} full screen`}
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Screen unavailable
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
            <div className="flex gap-4 text-muted-foreground">
              <span>
                shards{' '}
                <span className="text-primary">
                  ★ {expandedBot?.shards !== null && expandedBot !== null ? expandedBot.shards : '—'}
                </span>
              </span>
              <span>ping {expandedBot?.ping ?? '—'} ms</span>
              <span>uptime {formatUptime(expandedBot?.uptimeMs ?? 0)}</span>
            </div>
            <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => setExpanded(null)}>
              <X className="h-3.5 w-3.5" /> Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
