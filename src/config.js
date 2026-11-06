const fs = require('fs')
const path = require('path')

const CONFIG_PATH = path.join(__dirname, '..', 'config.json')

const DEFAULTS = {
  server: {
    host: 'bagelsmp.com',
    port: 25565,
    version: false, // false = auto-detect
    auth: 'offline'
  },
  bots: {
    count: 3,
    usernamePrefix: 'afk',
    randomSuffix: 4, // random chars appended to every account name (avoids premium-name kicks)
    password: 'afkpass1'
  },
  chat: {
    echo: false, // repeat other players' chat back
    logAll: true
  },
  antiAfk: {
    enabled: true,
    jumpIntervalMs: 3000,
    afkCommand: '/afk 3',
    afkRefreshMs: 600000 // resend the afk command every 10 min
  },
  shards: {
    enabled: true,
    command: '/shards',
    checkIntervalMs: 60000,
    pattern: 'You have \\u2605\\s*([0-9][0-9.,]*)'
  },
  dashboard: {
    host: '127.0.0.1',
    port: 3000
  },
  viewer: {
    basePort: 3010,
    firstPerson: true,
    viewDistance: 6
  },
  reconnect: {
    enabled: true,
    initialDelayMs: 5000,
    maxDelayMs: 60000
  }
}

function isPlainObject (v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function deepMerge (base, override) {
  const out = Array.isArray(base) ? base.slice() : { ...base }
  if (!isPlainObject(override)) return out
  for (const [key, value] of Object.entries(override)) {
    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value)
    } else if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

function validate (config) {
  const errors = []
  const push = (msg) => errors.push(msg)

  if (!isPlainObject(config)) return ['config must be an object']

  if (!config.server || typeof config.server.host !== 'string' || !config.server.host.trim()) {
    push('server.host must be a non-empty string')
  }
  const serverPort = config.server && Number(config.server.port)
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    push('server.port must be an integer between 1 and 65535')
  }

  const bots = config.bots || {}
  const count = Number(bots.count)
  if (!Number.isInteger(count) || count < 1 || count > 64) {
    push('bots.count must be an integer between 1 and 64')
  }
  if (typeof bots.usernamePrefix !== 'string' || !/^[A-Za-z0-9_]{1,16}$/.test(bots.usernamePrefix || '')) {
    push('bots.usernamePrefix must be 1-16 characters (letters, numbers, underscore)')
  }
  const suffixLen = Number(bots.randomSuffix)
  if (!Number.isInteger(suffixLen) || suffixLen < 0 || suffixLen > 6) {
    push('bots.randomSuffix must be an integer between 0 and 6')
  }
  if (
    typeof bots.usernamePrefix === 'string' &&
    Number.isInteger(count) &&
    Number.isInteger(suffixLen)
  ) {
    const digits = count >= 10 ? 2 : 1
    const length = bots.usernamePrefix.length + (count > 1 ? digits : 0) + (suffixLen > 0 ? 1 + suffixLen : 0)
    if (length > 16) {
      push(`generated usernames would be ${length} characters long (Minecraft limit is 16)`)
    }
  }
  const pw = bots.password
  if (typeof pw !== 'string' || pw.length < 6 || pw.length > 20) {
    push('bots.password must be between 6 and 20 characters long')
  }
  if (typeof pw === 'string' && /\s/.test(pw)) {
    push('bots.password must not contain spaces')
  }

  const dashPort = config.dashboard && Number(config.dashboard.port)
  if (!Number.isInteger(dashPort) || dashPort < 1 || dashPort > 65535) {
    push('dashboard.port must be an integer between 1 and 65535')
  }

  const viewerPort = config.viewer && Number(config.viewer.basePort)
  if (!Number.isInteger(viewerPort) || viewerPort < 1 || viewerPort > 65535) {
    push('viewer.basePort must be an integer between 1 and 65535')
  } else if (config.bots && Number.isInteger(Number(config.bots.count)) && viewerPort + Number(config.bots.count) > 65535) {
    push('viewer.basePort + bots.count exceeds 65535')
  } else if (dashPort && viewerPort === dashPort) {
    push('viewer.basePort must be different from dashboard.port')
  }

  const antiAfk = config.antiAfk || {}
  const jumpMs = Number(antiAfk.jumpIntervalMs)
  if (!Number.isFinite(jumpMs) || jumpMs < 500 || jumpMs > 3600000) {
    push('antiAfk.jumpIntervalMs must be between 500 and 3600000')
  }
  if (antiAfk.afkCommand !== undefined && (typeof antiAfk.afkCommand !== 'string' || !antiAfk.afkCommand.trim().startsWith('/'))) {
    push('antiAfk.afkCommand must be a command starting with "/"')
  }

  const shards = config.shards || {}
  const checkMs = Number(shards.checkIntervalMs)
  if (!Number.isFinite(checkMs) || checkMs < 5000 || checkMs > 3600000) {
    push('shards.checkIntervalMs must be between 5000 and 3600000')
  }
  if (shards.pattern !== undefined) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(shards.pattern)
    } catch (e) {
      push(`shards.pattern is not a valid regular expression: ${e.message}`)
    }
  }

  return errors
}

function load () {
  let raw = null
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    } catch (e) {
      console.error(`[config] Failed to parse config.json (${e.message}), using defaults`)
      raw = null
    }
  }
  const config = deepMerge(DEFAULTS, raw)
  const errors = validate(config)
  if (errors.length) {
    console.error('[config] Invalid config.json:')
    for (const err of errors) console.error(`  - ${err}`)
    throw new Error('Invalid config.json')
  }
  if (!fs.existsSync(CONFIG_PATH)) save(config)
  return config
}

function save (config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8')
}

module.exports = { load, save, validate, DEFAULTS, CONFIG_PATH }
