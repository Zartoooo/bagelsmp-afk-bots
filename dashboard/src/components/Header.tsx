import { Power, RotateCcw, Square, Star } from 'lucide-react'
import type { Stats } from '../lib/types'
import { formatUptime } from '../lib/format'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

export function Header({
  stats,
  connected,
  busy,
  onAction,
}: {
  stats: Stats
  connected: boolean
  busy: boolean
  onAction: (type: 'start' | 'stop' | 'restart') => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
            <Star className="h-4 w-4 fill-current" />
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-semibold tracking-tight">BagelSMP · AFK Fleet</h1>
            <p className="text-[11px] text-muted-foreground">
              mineflayer control panel
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              'gap-1.5 border-border/70 bg-secondary/60 text-muted-foreground',
              connected ? 'text-success' : 'text-destructive'
            )}
            title={connected ? 'Live stream connected' : 'Live stream disconnected'}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                connected ? 'bg-success animate-pulse-dot' : 'bg-destructive'
              )}
            />
            {connected ? 'Live' : 'Offline'}
          </Badge>

          <span className="hidden text-xs text-muted-foreground md:inline">
            session {formatUptime(stats.uptimeMs)}
          </span>

          <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5"
            disabled={busy}
            onClick={() => onAction('start')}
          >
            <Power className="h-3.5 w-3.5" /> Start
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5"
            disabled={busy}
            onClick={() => onAction('restart')}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Restart
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => onAction('stop')}
          >
            <Square className="h-3.5 w-3.5" /> Stop
          </Button>
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </header>
  )
}
