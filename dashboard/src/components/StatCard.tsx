import type { ReactNode } from 'react'
import { Card, CardContent } from './ui/card'
import { cn } from '../lib/utils'

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: ReactNode
  tone?: 'default' | 'primary' | 'success'
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight tabular">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
            tone === 'primary' && 'border-primary/30 bg-primary/10 text-primary',
            tone === 'success' && 'border-success/30 bg-success/10 text-success',
            tone === 'default' && 'border-border bg-secondary text-muted-foreground'
          )}
        >
          {icon}
        </div>
      </CardContent>
    </Card>
  )
}
