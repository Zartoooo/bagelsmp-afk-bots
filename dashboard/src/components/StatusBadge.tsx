import type { BotStatus } from '../lib/types'
import { cn } from '../lib/utils'

const STYLES: Record<BotStatus, { label: string; className: string; dot: string }> = {
  online: {
    label: 'Online',
    className: 'border-success/30 bg-success/10 text-success',
    dot: 'bg-success animate-pulse-dot',
  },
  authenticating: {
    label: 'Authenticating',
    className: 'border-primary/30 bg-primary/10 text-primary',
    dot: 'bg-primary animate-pulse-dot',
  },
  connecting: {
    label: 'Connecting',
    className: 'border-primary/30 bg-primary/10 text-primary',
    dot: 'bg-primary animate-pulse-dot',
  },
  reconnecting: {
    label: 'Reconnecting',
    className: 'border-warning/30 bg-warning/10 text-warning',
    dot: 'bg-warning animate-pulse-dot',
  },
  error: {
    label: 'Error',
    className: 'border-destructive/40 bg-destructive/10 text-destructive',
    dot: 'bg-destructive',
  },
  stopped: {
    label: 'Stopped',
    className: 'border-border bg-muted/40 text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: BotStatus
  className?: string
}) {
  const style = STYLES[status] ?? STYLES.stopped
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        style.className,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {style.label}
    </span>
  )
}
