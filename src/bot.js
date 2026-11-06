const { EventEmitter } = require('events')
const net = require('net')
const mineflayer = require('mineflayer')
const { mineflayer: mineflayerViewer } = require('prismarine-viewer')
const accounts = require('./accounts')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function waitPortFree (port, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve) => {
    const attempt = () => {
      const server = net.createServer()
      server.once('error', () => {
        if (Date.now() > deadline) return resolve(false)
        setTimeout(attempt, 500)
      })
      server.once('listening', () => server.close(() => resolve(true)))
      server.listen(port, '0.0.0.0')
    }
    attempt()
  })
}

function padIndex (index, count) {
  return count >= 10 ? String(index + 1).padStart(2, '0') : String(index + 1)
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

function randomString (length) {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return out
}

function kickText (reason, depth = 0) {
  if (depth > 8) return ''
  if (reason === null || reason === undefined) return ''
  if (typeof reason === 'string') {
    const trimmed = reason.trim()
    if (depth === 0 && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
      try {
        return kickText(JSON.parse(trimmed), depth + 1)
      } catch (e) {
        /* not JSON after all */
      }
    }
    return reason
  }
  if (Array.isArray(reason)) return reason.map((part) => kickText(part, depth + 1)).join('')
  if (typeof reason === 'object') {
    const parts = [reason.text, reason.with, reason.extra]
      .filter((part) => part !== undefined)
      .map((part) => kickText(part, depth + 1))
    return parts.join('').trim() || JSON.stringify(reason)
  }
  return String(reason)
}

/**
 * A single managed AFK bot: connects, registers/logs in on cracked servers,
 * activates anti-AFK (/afk 3 + periodic jumps), polls its shard balance and
 * exposes a prismarine-viewer "screen" on its own port.
 */
class AfkBot extends EventEmitter {
  constructor (index, getConfig) {
    super()
    this.index = index
    this.getConfig = getConfig
    this.config = getConfig()

    this.status = 'stopped' // stopped | connecting | authenticating | online | reconnecting | error
    this.bot = null
    this.viewerPort = null
    this.viewerUp = false
    this.stopped = true
    this.authed = false
    this.authMode = null
    this.authAttempts = 0
    this.authCooldownUntil = 0
    this.lastAuthActionAt = 0
    this.lastRejectLogAt = 0
    this.shards = null
    this.shardsUpdatedAt = null
    this.ping = null
    this.spawnedAt = null
    this.lastChat = null
    this.chatHistory = []
    this.reconnectAttempt = 0
    this.reconnectTimer = null
    this.timers = []
    this.lastError = null

    this.refreshIdentity()
  }

  refreshIdentity () {
    this.config = this.getConfig()
    const { count, usernamePrefix } = this.config.bots
    const base = count > 1
      ? `${usernamePrefix}${padIndex(this.index, count)}`
      : usernamePrefix
    this.usernameBase = base

    // Reuse the persisted account name: restarting must not create new accounts.
    if (!this.username || !this.username.startsWith(base)) {
      const stored = accounts.get(this.index)
      const storedMatches =
        typeof stored === 'string' && (stored === base || stored.startsWith(base + '_'))
      this.username = storedMatches ? stored : this.generateUsername()
      accounts.set(this.index, this.username)
    }

    this.viewerPort = this.config.viewer.basePort + this.index
    this.viewerUrl = `http://${this.config.dashboard.host === '0.0.0.0' ? 'localhost' : this.config.dashboard.host}:${this.viewerPort}/`
  }

  generateUsername () {
    const suffixLen = Number(this.config.bots.randomSuffix) || 0
    if (suffixLen <= 0) return this.usernameBase
    this.randomPart = randomString(suffixLen)
    return `${this.usernameBase}_${this.randomPart}`
  }

  /** The server refused the name (premium account) -> pick a fresh one. */
  rotateIdentity () {
    const suffixLen = Number(this.config.bots.randomSuffix) || 0
    if (suffixLen <= 0) return false
    const next = this.generateUsername()
    this.log('warn', `Username "${this.username}" is reserved, retrying as "${next}"`)
    this.username = next
    accounts.set(this.index, next)
    return true
  }

  // ---------------------------------------------------------------- lifecycle

  start () {
    if (!this.stopped) return
    this.stopped = false
    this.reconnectAttempt = 0
    this.connect()
  }

  connect () {
    if (this.stopped) return
    this.config = this.getConfig()
    this.refreshIdentity()
    this.lastError = null
    this.setStatus('connecting')

    const { host, port, version, auth } = this.config.server
    let bot
    try {
      bot = mineflayer.createBot({
        host,
        port: Number(port),
        username: this.username,
        auth: auth === 'microsoft' ? 'microsoft' : 'offline',
        version: version === false || version === 'auto' ? false : version,
        hideErrors: true,
        checkTimeoutInterval: 60000
      })
    } catch (e) {
      this.log('error', `Failed to create bot: ${e.message}`)
      this.scheduleReconnect()
      return
    }

    this.bot = bot
    bot._afkSlot = this.index

    bot.on('login', () => {
      this.log('info', `Session established with ${host}:${port}`)
      this.ping = bot.ping !== undefined ? bot.ping : null
    })

    bot.on('spawn', () => {
      this.spawnedAt = Date.now()
      this.reconnectAttempt = 0
      this.log('info', `Spawned in world as ${this.username}`)
      if (this.seenAuthPrompt === undefined) this.seenAuthPrompt = false
      this.startViewer(bot)
      // The register/login prompt usually arrives before the spawn packet.
      this.ensureAuth()
      this.setInterval(() => {
        if (!this.authed) this.ensureAuth()
      }, 5000)
      // Some cracked servers never prompt -> assume no auth is required.
      this.setTimeout(() => {
        if (!this.authed && this.authAttempts === 0 && this.seenAuthPrompt === false) {
          this.log('info', 'No authentication prompt detected, continuing')
          this.onAuthenticated()
        }
      }, 12000)
    })

    bot.on('messagestr', (message, position, json, sender) => {
      this.onMessage(String(message), sender || null)
      if (
        this.config.chat.echo &&
        sender &&
        sender !== bot.username &&
        !String(message).trim().startsWith('>')
      ) {
        this.chat(String(message))
      }
    })

    bot.on('kicked', (reason) => {
      const text = kickText(reason)
      this.log('warn', `Kicked: ${text}`)
      this.lastError = text
      if (/paid minecraft account|reserved for its owner|belongs to a paid/i.test(text)) {
        this.rotateIdentity()
      }
    })

    bot.on('error', (err) => {
      this.lastError = err && err.message ? err.message : String(err)
      this.log('error', `Error: ${this.lastError}`)
    })

    bot.on('end', (reason) => {
      if (this.stopped) return
      this.log('warn', `Connection closed${reason ? ` (${reason})` : ''}`)
      this.teardownSession()
      this.scheduleReconnect()
    })
  }

  stop () {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.clearTimers()
    const bot = this.bot
    this.closeViewer(bot)
    this.bot = null
    if (bot) {
      try { bot.quit('afk bot stopped') } catch (e) { /* ignore */ }
      try { bot.end('afk bot stopped') } catch (e) { /* ignore */ }
    }
    this.authed = false
    this.authMode = null
    this.seenAuthPrompt = undefined
    this.setStatus('stopped')
    this.log('info', 'Stopped')
  }

  restart () {
    this.stop()
    setTimeout(() => this.start(), 500)
  }

  scheduleReconnect () {
    if (this.stopped || !this.config.reconnect.enabled) {
      if (!this.stopped) this.setStatus('error')
      return
    }
    const { initialDelayMs, maxDelayMs } = this.config.reconnect
    const delay = Math.min(initialDelayMs * Math.pow(2, this.reconnectAttempt), maxDelayMs)
    this.reconnectAttempt += 1
    this.setStatus('reconnecting')
    this.log('info', `Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempt})`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  teardownSession () {
    this.clearTimers()
    this.closeViewer()
    this.authed = false
    this.authMode = null
    this.seenAuthPrompt = undefined
    this.authAttempts = 0
    this.authCooldownUntil = 0
    this.lastAuthActionAt = 0
    this.spawnedAt = null
    this.bot = null
    if (this.status !== 'reconnecting' && this.status !== 'stopped') this.setStatus('reconnecting')
  }

  // ------------------------------------------------------------------ session

  onMessage (message) {
    if (!message) return

    if (this.config.chat.logAll) {
      this.pushChat('server', message)
    }

    // ---- authentication on cracked (AuthMe style) servers
    if (!this.authed) this.handleAuthMessage(message)

    // ---- the server refused one of our commands (lobby restrictions, ...)
    if (
      /you can not use that here|unknown (?:command|or incomplete)|you must (?:be|join)|not (?:allowed|permitted)/i.test(
        message
      )
    ) {
      const now = Date.now()
      if (now - (this.lastRejectLogAt || 0) > 15000) {
        this.lastRejectLogAt = now
        this.log('warn', `Server refused a command: ${message}`)
      }
    }

    // ---- shard balance
    if (this.config.shards.enabled) {
      try {
        const match = message.match(new RegExp(this.config.shards.pattern))
        if (match) {
          const raw = match[1]
          const value = Number(String(raw).replace(/,/g, ''))
          if (Number.isFinite(value)) {
            const changed = this.shards !== value
            this.shards = value
            this.shardsRaw = raw
            this.shardsUpdatedAt = Date.now()
            if (changed) this.log('info', `Shard balance: \u2605 ${raw}`)
            this.emitUpdate()
          }
        }
      } catch (e) { /* invalid pattern is caught by config validation */ }
    }

    this.emitUpdateThrottled()
  }

  /**
   * Small AuthMe-style state machine: register by default, fall back to login
   * if the account already exists (and the other way around).
   */
  handleAuthMessage (message) {
    const lower = message.toLowerCase()
    const attempted = this.authAttempts > 0

    // 0) the server is rate limiting us -> back off instead of hammering
    if (/too many|rate ?limit|try again later/.test(lower)) {
      const cooling = this.authCooldownUntil && Date.now() < this.authCooldownUntil
      this.authCooldownUntil = Date.now() + 60000
      if (!cooling) this.log('warn', 'Server is rate limiting authentication, backing off 60s')
      return
    }

    // 1) the command we sent was rejected -> flip to the other mode
    if (
      attempted &&
      this.authMode === 'register' &&
      /already registered|already have an (?:account|alias)/.test(lower)
    ) {
      this.authMode = 'login'
      this.log('warn', 'Account already exists on this server, logging in instead')
      this.sendLogin()
      return
    }
    if (
      attempted &&
      this.authMode === 'login' &&
      /not registered|register (?:first|an account)|no account|unknown or incomplete/.test(lower)
    ) {
      this.authMode = 'register'
      this.log('warn', 'Account does not exist yet, registering instead')
      this.sendRegister()
      return
    }

    // 2) success - only trusted once we actually sent something
    if (
      attempted &&
      !/already registered|not registered/.test(lower) &&
      /registered|logged in|welcome back|authentication (?:complete|successful)/.test(lower)
    ) {
      this.onAuthenticated()
      return
    }

    // 3) the server is asking us to authenticate (before we sent anything)
    if (!attempted) {
      if (/\/register/.test(message)) {
        this.seenAuthPrompt = true
        this.authMode = this.authMode || 'register'
        this.setStatus('authenticating')
        this.ensureAuth()
      } else if (/\/login/.test(lower)) {
        this.seenAuthPrompt = true
        this.authMode = this.authMode || 'login'
        this.setStatus('authenticating')
        this.ensureAuth()
      }
    }
  }

  ensureAuth () {
    if (this.authed || !this.authMode) return
    if (this.authCooldownUntil) {
      if (Date.now() < this.authCooldownUntil) return
      // cooldown over -> give the server another chance
      this.authCooldownUntil = 0
      this.authAttempts = 0
      this.lastAuthActionAt = 0
    }
    const bot = this.bot
    if (!bot || !bot.entity) return // wait until we are actually in the world
    if (this.authMode === 'login') this.sendLogin()
    else this.sendRegister()
  }

  sendRegister () {
    const now = Date.now()
    if (now - this.lastAuthActionAt < 3000 || this.authAttempts >= 8) return
    this.lastAuthActionAt = now
    this.authAttempts += 1
    this.setStatus('authenticating')
    this.log('info', `Registering account (\u2605) /register ${'*'.repeat(this.config.bots.password.length)} ${'*'.repeat(this.config.bots.password.length)}`)
    this.chat(`/register ${this.config.bots.password} ${this.config.bots.password}`)
  }

  sendLogin () {
    const now = Date.now()
    if (now - this.lastAuthActionAt < 3000 || this.authAttempts >= 8) return
    this.lastAuthActionAt = now
    this.authAttempts += 1
    this.setStatus('authenticating')
    this.log('info', 'Logging in to existing account')
    this.chat(`/login ${this.config.bots.password}`)
  }

  onAuthenticated () {
    if (this.authed) return
    this.authed = true
    this.authAttempts = 0
    this.setStatus('online')
    this.log('info', 'Authenticated, starting anti-AFK routine')
    this.activateAntiAfk()
  }

  activateAntiAfk () {
    const cfg = this.config.antiAfk

    // 1) ask the server's AFK plugin to keep us flagged as away
    if (cfg.afkCommand) {
      this.chat(cfg.afkCommand)
      if (cfg.afkRefreshMs > 0) {
        this.setInterval(() => this.chat(cfg.afkCommand), cfg.afkRefreshMs, 'afk-refresh')
      }
    }

    // 2) keep physically moving so idle-kick plugins never trigger
    if (cfg.enabled) {
      this.setInterval(() => this.jump(), cfg.jumpIntervalMs, 'jump')
      this.jump()
    }

    // 3) poll the shard balance
    if (this.config.shards.enabled) {
      this.setInterval(() => this.requestShards(), this.config.shards.checkIntervalMs, 'shards')
      this.requestShards()
    }

    this.emitUpdate()
  }

  jump () {
    const bot = this.bot
    if (!bot || !bot.entity) return
    try {
      bot.setControlState('jump', true)
      setTimeout(() => {
        try { if (this.bot === bot) bot.clearControlState('jump') } catch (e) { /* ignore */ }
      }, 250)
    } catch (e) { /* ignore */ }
  }

  requestShards () {
    if (!this.authed) return
    this.chat(this.config.shards.command)
  }

  chat (message) {
    const bot = this.bot
    if (!bot) return
    try {
      bot.chat(message)
      if (message.startsWith('/')) {
        const password = this.config.bots.password
        const masked = message.split(password).join('*'.repeat(password.length))
        this.log('cmd', `> ${masked}`)
      }
    } catch (e) {
      this.log('error', `Failed to send "${message}": ${e.message}`)
    }
  }

  // ------------------------------------------------------------------- viewer

  async startViewer (bot) {
    if (this.viewerUp || this.stopped) return
    const port = this.viewerPort
    const free = await waitPortFree(port)
    if (!free || this.stopped || this.bot !== bot) {
      if (!free) this.log('warn', `Viewer port ${port} is busy, screen unavailable`)
      return
    }
    try {
      mineflayerViewer(bot, {
        port,
        firstPerson: this.config.viewer.firstPerson,
        viewDistance: this.config.viewer.viewDistance
      })
      this.viewerUp = true
      this.log('info', `Live screen available on port ${port}`)
      this.emitUpdate()
    } catch (e) {
      this.log('error', `Viewer failed: ${e.message}`)
    }
  }

  closeViewer (bot = this.bot) {
    if (this.viewerUp && bot && bot.viewer && typeof bot.viewer.close === 'function') {
      try { bot.viewer.close() } catch (e) { /* ignore */ }
    }
    this.viewerUp = false
  }

  // ------------------------------------------------------------------- helper

  setInterval (fn, ms, name) {
    const id = setInterval(fn, ms)
    this.timers.push({ type: 'interval', id, name })
    return id
  }

  setTimeout (fn, ms) {
    const id = setTimeout(fn, ms)
    this.timers.push({ type: 'timeout', id })
    return id
  }

  clearTimers () {
    for (const timer of this.timers) {
      clearInterval(timer.id)
      clearTimeout(timer.id)
    }
    this.timers = []
  }

  setStatus (status) {
    if (this.status === status) return
    this.status = status
    this.emitUpdate()
  }

  pushChat (username, message) {
    this.chatHistory.push({ username, message, time: Date.now() })
    if (this.chatHistory.length > 150) this.chatHistory.shift()
    this.lastChat = { username, message, time: Date.now() }
    if (username !== 'server') this.emitUpdateThrottled()
  }

  log (level, message) {
    this.emit('log', { slot: this.index, username: this.username, level, message, time: Date.now() })
  }

  emitUpdate () {
    this.emit('update', this.snapshot())
  }

  emitUpdateThrottled () {
    if (this._updateQueued) return
    this._updateQueued = true
    setTimeout(() => {
      this._updateQueued = false
      this.emitUpdate()
    }, 500)
  }

  snapshot () {
    const bot = this.bot
    let position = null
    if (bot && bot.entity && bot.entity.position) {
      const p = bot.entity.position
      position = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, z: Math.round(p.z * 10) / 10 }
    }
    return {
      id: this.index,
      username: this.username,
      status: this.status,
      authed: this.authed,
      shards: this.shards,
      shardsRaw: this.shardsRaw !== undefined ? this.shardsRaw : null,
      shardsUpdatedAt: this.shardsUpdatedAt,
      ping: bot && bot.ping !== undefined ? bot.ping : this.ping,
      uptimeMs: this.spawnedAt ? Date.now() - this.spawnedAt : 0,
      position,
      version: bot ? bot.version : null,
      viewerUrl: this.viewerUrl,
      viewerPort: this.viewerPort,
      viewerUp: this.viewerUp,
      lastChat: this.lastChat,
      chat: this.chatHistory.slice(-60),
      lastError: this.lastError,
      antiAfk: {
        enabled: this.config.antiAfk.enabled,
        jumpIntervalMs: this.config.antiAfk.jumpIntervalMs,
        afkCommand: this.config.antiAfk.afkCommand,
        active: this.authed
      }
    }
  }
}

module.exports = { AfkBot }
