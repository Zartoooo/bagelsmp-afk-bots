import { useEffect, useState } from 'react'
import { Eye, EyeOff, Save, ShieldCheck } from 'lucide-react'
import type { Config } from '../lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { Separator } from './ui/separator'
import { Badge } from './ui/badge'

type FieldProps = {
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}

function Field({ label, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 bg-background/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

function num(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function SettingsForm({
  config,
  onSave,
  saving,
  saveError,
}: {
  config: Config
  onSave: (config: Config, restart: boolean) => void
  saving: boolean
  saveError: string | null
}) {
  const [draft, setDraft] = useState<Config>(config)
  const [restartAfter, setRestartAfter] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    setDraft(config)
    setTouched(false)
  }, [config])

  const patch = (updater: (next: Config) => Config) => setDraft((prev) => updater({ ...prev }))

  const password = draft.bots.password
  const passwordError =
    touched && (password.length < 6 || password.length > 20)
      ? 'Password must be between 6 and 20 characters'
      : undefined

  const dirty = JSON.stringify(draft) !== JSON.stringify(config)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (password.length < 6 || password.length > 20) return
    onSave(draft, restartAfter)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Configuration</h2>
          <p className="text-xs text-muted-foreground">
            Saved to <code className="text-primary/90">config.json</code> on the server.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="restart-after" className="text-xs text-muted-foreground">
              Restart fleet after save
            </Label>
            <Switch id="restart-after" checked={restartAfter} onCheckedChange={setRestartAfter} />
          </div>
          <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={saving || !dirty}>
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {saveError}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Server</CardTitle>
            <CardDescription className="text-xs">Where the bots connect.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Host">
                <Input
                  value={draft.server.host}
                  onChange={(e) =>
                    patch((c) => ({ ...c, server: { ...c.server, host: e.target.value } }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Port">
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={draft.server.port}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      server: { ...c.server, port: num(e.target.value) },
                    }))
                  }
                  className="h-9"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Version" hint="auto-detect when empty">
                <Input
                  value={draft.server.version === false ? '' : String(draft.server.version)}
                  placeholder="auto"
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      server: {
                        ...c.server,
                        version: e.target.value.trim() === '' ? false : e.target.value.trim(),
                      },
                    }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Auth mode" hint="cracked servers use offline">
                <select
                  value={draft.server.auth}
                  onChange={(e) =>
                    patch((c) => ({ ...c, server: { ...c.server, auth: e.target.value } }))
                  }
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="offline">offline (cracked)</option>
                  <option value="microsoft">microsoft (premium)</option>
                </select>
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              Bot accounts
              <Badge variant="outline" className="text-[10px]">
                {draft.bots.count} bot{draft.bots.count === 1 ? '' : 's'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              Accounts are named{' '}
              <code className="text-primary/90">
                {draft.bots.usernamePrefix}
                {draft.bots.count > 1 ? '1…' : ''}
                {draft.bots.randomSuffix > 0 ? '_…' : ''}
              </code>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Number of accounts" hint="1 – 64">
                <Input
                  type="number"
                  min={1}
                  max={64}
                  value={draft.bots.count}
                  onChange={(e) =>
                    patch((c) => ({ ...c, bots: { ...c.bots, count: num(e.target.value) } }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Username prefix" hint="1–16 chars, A–Z 0–9 _">
                <Input
                  value={draft.bots.usernamePrefix}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      bots: { ...c.bots, usernamePrefix: e.target.value },
                    }))
                  }
                  className="h-9"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Random name suffix"
                hint="avoids reserved (premium) names — e.g. afk1_x9k2"
              >
                <Input
                  type="number"
                  min={0}
                  max={6}
                  value={draft.bots.randomSuffix}
                  onChange={(e) =>
                    patch((c) => ({ ...c, bots: { ...c.bots, randomSuffix: num(e.target.value) } }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Preview">
                <Input
                  readOnly
                  value={`${draft.bots.usernamePrefix}${draft.bots.count > 1 ? '1' : ''}${
                    draft.bots.randomSuffix > 0
                      ? '_' + 'x'.repeat(draft.bots.randomSuffix)
                      : ''
                  }`}
                  className="h-9 text-muted-foreground"
                />
              </Field>
            </div>
            <Field
              label="Login password"
              hint="Used for /register <password> <password> and /login. Must be 6–20 characters."
              error={passwordError}
            >
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  maxLength={20}
                  onChange={(e) => {
                    setTouched(true)
                    patch((c) => ({ ...c, bots: { ...c.bots, password: e.target.value } }))
                  }}
                  className="h-9 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-9 w-9 text-muted-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </Field>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Length {password.length}/20 · {password.length >= 6 ? 'valid' : 'too short'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Anti-AFK</CardTitle>
            <CardDescription className="text-xs">
              Runs right after the bot gets a session.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SwitchRow
              label="Jump periodically"
              hint={`Keeps the bot physically moving every ${
                draft.antiAfk.jumpIntervalMs / 1000
              }s`}
              checked={draft.antiAfk.enabled}
              onChange={(v) => patch((c) => ({ ...c, antiAfk: { ...c.antiAfk, enabled: v } }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field label="AFK command" hint="sent on session + refresh">
                <Input
                  value={draft.antiAfk.afkCommand}
                  onChange={(e) =>
                    patch((c) => ({ ...c, antiAfk: { ...c.antiAfk, afkCommand: e.target.value } }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Jump every (seconds)">
                <Input
                  type="number"
                  min={1}
                  value={draft.antiAfk.jumpIntervalMs / 1000}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      antiAfk: { ...c.antiAfk, jumpIntervalMs: num(e.target.value) * 1000 },
                    }))
                  }
                  className="h-9"
                />
              </Field>
            </div>
            <Field label="Refresh AFK command every (minutes)" hint="0 disables the refresh">
              <Input
                type="number"
                min={0}
                value={Math.round(draft.antiAfk.afkRefreshMs / 60000)}
                onChange={(e) =>
                  patch((c) => ({
                    ...c,
                    antiAfk: { ...c.antiAfk, afkRefreshMs: num(e.target.value) * 60000 },
                  }))
                }
                className="h-9"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Shard balance</CardTitle>
            <CardDescription className="text-xs">
              Polled from chat with <code className="text-primary/90">/shards</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SwitchRow
              label="Poll shard balance"
              hint={`Every ${draft.shards.checkIntervalMs / 1000}s`}
              checked={draft.shards.enabled}
              onChange={(v) => patch((c) => ({ ...c, shards: { ...c.shards, enabled: v } }))}
            />
            <div className="grid grid-cols-[120px_1fr] gap-3">
              <Field label="Command">
                <Input
                  value={draft.shards.command}
                  onChange={(e) =>
                    patch((c) => ({ ...c, shards: { ...c.shards, command: e.target.value } }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Chat pattern" hint="capture group 1 = amount">
                <Input
                  value={draft.shards.pattern}
                  onChange={(e) =>
                    patch((c) => ({ ...c, shards: { ...c.shards, pattern: e.target.value } }))
                  }
                  className="h-9 font-mono text-xs"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Dashboard &amp; screens</CardTitle>
            <CardDescription className="text-xs">
              Each bot hosts its own prismarine-viewer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dashboard port">
                <Input
                  type="number"
                  value={draft.dashboard.port}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      dashboard: { ...c.dashboard, port: num(e.target.value) },
                    }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="First viewer port" hint={`bots use +0…+${draft.bots.count - 1}`}>
                <Input
                  type="number"
                  value={draft.viewer.basePort}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      viewer: { ...c.viewer, basePort: num(e.target.value) },
                    }))
                  }
                  className="h-9"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="View distance" hint="chunks">
                <Input
                  type="number"
                  min={2}
                  max={16}
                  value={draft.viewer.viewDistance}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      viewer: { ...c.viewer, viewDistance: num(e.target.value) },
                    }))
                  }
                  className="h-9"
                />
              </Field>
              <div className="flex items-end pb-1">
                <SwitchRow
                  label="First person"
                  checked={draft.viewer.firstPerson}
                  onChange={(v) =>
                    patch((c) => ({ ...c, viewer: { ...c.viewer, firstPerson: v } }))
                  }
                />
              </div>
            </div>
            <Separator />
            <SwitchRow
              label="Auto reconnect"
              hint={`Retries after ${draft.reconnect.initialDelayMs / 1000}s, capped at ${
                draft.reconnect.maxDelayMs / 1000
              }s`}
              checked={draft.reconnect.enabled}
              onChange={(v) => patch((c) => ({ ...c, reconnect: { ...c.reconnect, enabled: v } }))}
            />
            <SwitchRow
              label="Echo chat"
              hint="Bots repeat other players' chat (off by default)"
              checked={draft.chat.echo}
              onChange={(v) => patch((c) => ({ ...c, chat: { ...c.chat, echo: v } }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Lifecycle</CardTitle>
            <CardDescription className="text-xs">Reconnect backoff and chat logging.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First retry (seconds)">
                <Input
                  type="number"
                  min={1}
                  value={draft.reconnect.initialDelayMs / 1000}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      reconnect: { ...c.reconnect, initialDelayMs: num(e.target.value) * 1000 },
                    }))
                  }
                  className="h-9"
                />
              </Field>
              <Field label="Max retry (seconds)">
                <Input
                  type="number"
                  min={1}
                  value={draft.reconnect.maxDelayMs / 1000}
                  onChange={(e) =>
                    patch((c) => ({
                      ...c,
                      reconnect: { ...c.reconnect, maxDelayMs: num(e.target.value) * 1000 },
                    }))
                  }
                  className="h-9"
                />
              </Field>
            </div>
            <SwitchRow
              label="Log every chat message"
              checked={draft.chat.logAll}
              onChange={(v) => patch((c) => ({ ...c, chat: { ...c.chat, logAll: v } }))}
            />
            <p className="text-[11px] text-muted-foreground">
              {dirty ? 'Unsaved changes — press “Save changes” to apply.' : 'All changes saved.'}
            </p>
          </CardContent>
        </Card>
      </div>
    </form>
  )
}
