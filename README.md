# BagelSMP · AFK Fleet

Mineflayer bot fleet + local control panel. N bots connect to the server,
register/login on the cracked (AuthMe) auth system, run `/afk 3` and jump every
3 seconds to stay online — and you watch all of it from a shadcn dashboard.

## Quick start

```bash
npm install
npm run build:dashboard   # builds the shadcn dashboard (dashboard/dist)
npm start                 # starts bots + dashboard on http://localhost:3000
```

Dashboard: **http://localhost:3000**
Each bot also streams its own first-person screen on port `3010 + slot`
(those iframes are embedded in the dashboard).

## Configuration — `config.json`

Created with defaults on the first run; editable from the **Settings** tab
(validated, saved straight back to the file).

| Key | Default | Meaning |
| --- | --- | --- |
| `server.host` / `server.port` | `bagelsmp.com` / `25565` | target server |
| `server.version` | `false` | Minecraft version, `false` = auto-detect |
| `server.auth` | `offline` | `offline` = cracked, `microsoft` = premium |
| `bots.count` | `3` | **number of bot accounts** (1–64) |
| `bots.usernamePrefix` | `afk` | names become `afk1_xxxx`, `afk2_xxxx`, … |
| `bots.randomSuffix` | `4` | random chars so names never hit reserved premium names (`0` = fixed names) |
| `bots.password` | `afkpass1` | **login password, 6–20 characters** — used for `/register <pw> <pw>` and `/login <pw>` |
| `antiAfk.enabled` | `true` | jump every `antiAfk.jumpIntervalMs` |
| `antiAfk.jumpIntervalMs` | `3000` | **anti-AFK jump interval (ms)** |
| `antiAfk.afkCommand` | `/afk 3` | sent once the bot has a session, refreshed every `afkRefreshMs` |
| `shards.enabled` / `checkIntervalMs` | `true` / `60000` | polls `/shards` and parses `You have ★1.` |
| `shards.pattern` | `You have ★\s*([0-9][0-9.,]*)` | capture group 1 = balance |
| `dashboard.port` | `3000` | control panel port |
| `viewer.basePort` | `3010` | bot *i* uses `basePort + i` |
| `reconnect.*` | 5 s → 60 s | exponential backoff |

Account names are persisted in **`accounts.json`** so a restart logs back into
the *same* accounts instead of registering new ones (the server rate-limits
new accounts per IP).

## Dashboard

- **Overview** – fleet stats (online count, total ★ shards, ping, uptime), a card
  per bot with its **live screen**, shard balance, ping, position, uptime, last
  chat, a command box, restart / full-screen buttons. Global **live screens**
  toggle (max 12 WebGL contexts).
- **Settings** – everything above, with validation (password 6–20 chars,
  username length, ports) and *restart fleet after save*.
- **Logs** – live SSE log stream with level filters.
- Header: Start / Restart / Stop the whole fleet, live connection indicator.

## API

`GET /api/state` · `GET /api/logs` · `GET|PUT /api/config` ·
`POST /api/action` `{type:"start|stop|restart", id?}` ·
`POST /api/bots/:id/chat` `{message}` · `GET /api/stream` (SSE)

## Dev

```bash
npm run dev:dashboard     # Vite dev server on :5173, proxies /api to :3000
```
