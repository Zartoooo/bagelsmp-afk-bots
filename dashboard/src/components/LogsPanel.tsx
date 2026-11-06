import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { LogEntry } from '../lib/types'
import { formatClock } from '../lib/format'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { cn } from '../lib/utils'

const LEVEL_STYLES: Record<string, string> = {
  info: 'text-muted-foreground',
  cmd: 'text-primary',
  warn: 'text-warning',
  error: 'text-destructive',
  debug: 'text-muted-foreground/60',
}

export function LogsPanel({ logs }: { logs: LogEntry[] }) {
  const [filter, setFilter] = useState<'all' | 'cmd' | 'warn' | 'error'>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const visible = logs.filter((entry) => {
    if (filter === 'all') return true
    if (filter === 'warn') return entry.level === 'warn' || entry.level === 'error'
    return entry.level === filter
  })

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [visible.length, autoScroll])

  return (
    <Card className="flex h-full min-h-[480px] flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-sm">Fleet log</CardTitle>
          <CardDescription className="text-xs">
            {logs.length} event{logs.length === 1 ? '' : 's'} buffered
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'cmd', 'warn', 'error'] as const).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? 'secondary' : 'ghost'}
              className="h-7 px-2.5 text-xs capitalize"
              onClick={() => setFilter(key)}
            >
              {key}
            </Button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7"
            title={autoScroll ? 'Auto-scroll on' : 'Auto-scroll off'}
            onClick={() => setAutoScroll((v) => !v)}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                autoScroll ? 'bg-success animate-pulse-dot' : 'bg-muted-foreground'
              )}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent
        className="flex-1 overflow-y-auto rounded-b-lg bg-black/30 px-3 py-2 font-mono text-[12px] leading-relaxed"
        onWheel={() => setAutoScroll(false)}
      >
        {visible.length === 0 ? (
          <p className="py-6 text-center text-muted-foreground">No log entries.</p>
        ) : (
          visible.map((entry, index) => (
            <div key={`${entry.time}-${index}`} className="flex gap-2 py-0.5">
              <span className="shrink-0 text-muted-foreground/50">{formatClock(entry.time)}</span>
              <Badge
                variant="outline"
                className={cn(
                  'h-4 shrink-0 px-1 py-0 text-[9px] uppercase',
                  entry.level === 'error' && 'border-destructive/40 text-destructive',
                  entry.level === 'warn' && 'border-warning/40 text-warning',
                  entry.level === 'cmd' && 'border-primary/40 text-primary'
                )}
              >
                {entry.level}
              </Badge>
              <span className={cn('break-all', LEVEL_STYLES[entry.level] ?? 'text-foreground')}>
                {entry.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </CardContent>
    </Card>
  )
}
