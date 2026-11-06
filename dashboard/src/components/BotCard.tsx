import { useState } from 'react'
import { Maximize2, RotateCcw, Send, Star, Wifi, MapPin, Timer, Zap } from 'lucide-react'
import type { BotState } from '../lib/types'
import { viewerSrc } from '../lib/api'
import { formatClock, formatPosition, formatShards, formatUptime } from '../lib/format'
import { StatusBadge } from './StatusBadge'
import { Card, CardContent, CardHeader } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

function initials(name: string) {
  return name.slice(0, 2).toUpperCase()
}

function Metric({
  icon,
  label,
  value,
  title,
}: {
  icon: React.ReactNode
  label: string
  value: string
  title?: string
}) {
  return (
    <div className="rounded-md border border-border/70 bg-background/40 px-2.5 py-2" title={title}>
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold tabular" title={value}>
        {value}
      </div>
    </div>
  )
}

export function BotCard({
  bot,
  showScreen,
  onExpand,
  onAction,
  onCommand,
}: {
  bot: BotState
  showScreen: boolean
  onExpand: (bot: BotState) => void
  onAction: (type: 'start' | 'stop' | 'restart', id: number) => void
  onCommand: (id: number, message: string) => void
}) {
  const [command, setCommand] = useState('')
  const online = bot.status === 'online'
  const screenReady = showScreen && bot.viewerUp && online

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = command.trim()
    if (!value) return
    onCommand(bot.id, value)
    setCommand('')
  }

  return (
    <Card className="flex flex-col overflow-hidden transition-colors hover:border-primary/30">
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold',
              online
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-border bg-secondary text-muted-foreground'
            )}
          >
            {initials(bot.username)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold">{bot.username}</p>
              {bot.antiAfk.active ? (
                <Badge
                  variant="outline"
                  className="hidden gap-1 border-primary/30 bg-primary/10 text-primary sm:inline-flex"
                  title={`${bot.antiAfk.afkCommand} · jump every ${(
                    bot.antiAfk.jumpIntervalMs / 1000
                  ).toFixed(0)}s`}
                >
                  <Zap className="h-2.5 w-2.5" /> AFK
                </Badge>
              ) : null}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {bot.version ? `MC ${bot.version}` : 'waiting for session'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusBadge status={bot.status} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric
            icon={<Star className="h-3 w-3 text-primary" />}
            label="Shards"
            value={formatShards(bot.shards)}
            title={bot.shardsUpdatedAt ? `Updated ${formatClock(bot.shardsUpdatedAt)}` : 'Not polled yet'}
          />
          <Metric
            icon={<Wifi className="h-3 w-3" />}
            label="Ping"
            value={bot.ping && bot.ping > 0 ? `${bot.ping} ms` : '—'}
          />
          <Metric
            icon={<Timer className="h-3 w-3" />}
            label="Uptime"
            value={formatUptime(bot.uptimeMs)}
          />
          <Metric
            icon={<MapPin className="h-3 w-3" />}
            label="Position"
            value={formatPosition(bot.position)}
          />
        </div>

        {/* live screen */}
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-black/60">
          {screenReady ? (
            <iframe
              key={`${bot.id}-${bot.viewerPort}`}
              src={viewerSrc(bot.viewerPort, bot.viewerUrl)}
              title={`${bot.username} screen`}
              className="h-full w-full border-0"
              loading="lazy"
              allow="autoplay"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--primary)/0.08),transparent_70%)] text-center">
              <p className="text-xs text-muted-foreground">
                {bot.viewerUp
                  ? showScreen
                    ? 'Waiting for the bot to spawn…'
                    : 'Screen hidden'
                  : 'Screen unavailable'}
              </p>
              {bot.lastError && !bot.viewerUp ? (
                <p className="max-w-[90%] truncate text-[11px] text-destructive/80">
                  {bot.lastError}
                </p>
              ) : null}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-2 py-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-white/70">
              {bot.username} · live
            </span>
            <span className="text-[10px] text-white/50">:{bot.viewerPort}</span>
          </div>
        </div>

        {/* last chat */}
        <div className="flex items-center gap-2 rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            chat
          </span>
          <p className="truncate text-xs text-muted-foreground">
            {bot.lastChat ? (
              <>
                <span className="text-foreground">
                  {bot.lastChat.username === 'server' ? '»' : `${bot.lastChat.username}:`}
                </span>{' '}
                {bot.lastChat.message}
              </>
            ) : (
              'no messages yet'
            )}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-2">
          <form onSubmit={submit} className="flex flex-1 items-center gap-2">
            <Input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Send command…"
              className="h-8 flex-1 text-xs"
              disabled={!online}
            />
            <Button
              type="submit"
              size="icon"
              variant="secondary"
              className="h-8 w-8"
              disabled={!online || !command.trim()}
              title="Send to bot"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            title="Open full screen"
            onClick={() => onExpand(bot)}
            disabled={!bot.viewerUp}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="secondary"
            className="h-8 w-8"
            title="Restart bot"
            onClick={() => onAction('restart', bot.id)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
