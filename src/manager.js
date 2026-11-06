const { EventEmitter } = require('events')
const { AfkBot } = require('./bot')
const configStore = require('./config')

const LOG_BUFFER = 400

class Fleet extends EventEmitter {
  constructor () {
    super()
    this.config = configStore.load()
    this.bots = []
    this.logs = []
    this.startedAt = Date.now()
    this.resize(this.config.bots.count)
  }

  getConfig = () => this.config

  resize (count) {
    count = Number(count)
    while (this.bots.length > count) {
      const bot = this.bots.pop()
      bot.removeAllListeners()
      bot.stop()
      this.log('info', `Removed slot ${bot.username}`)
    }
    while (this.bots.length < count) {
      const index = this.bots.length
      const bot = new AfkBot(index, this.getConfig)
      bot.on('log', (entry) => this.log(entry.level, `[${entry.username}] ${entry.message}`, entry.slot))
      bot.on('update', () => this.emit('update'))
      this.bots.push(bot)
      this.log('info', `Created slot ${bot.username}`)
    }
    this.emit('update')
  }

  startAll () {
    for (const bot of this.bots) bot.start()
  }

  stopAll () {
    for (const bot of this.bots) bot.stop()
  }

  restartAll () {
    for (const bot of this.bots) bot.restart()
  }

  getBot (id) {
    const index = Number(id)
    if (!Number.isInteger(index)) return null
    return this.bots.find((b) => b.index === index) || null
  }

  applyConfig (next, { restart = false } = {}) {
    const errors = configStore.validate(next)
    if (errors.length) return { errors }

    const prev = this.config
    this.config = next
    configStore.save(next)

    const serverChanged = JSON.stringify(prev.server) !== JSON.stringify(next.server)
    const botsChanged = JSON.stringify(prev.bots) !== JSON.stringify(next.bots)
    const afkChanged = JSON.stringify(prev.antiAfk) !== JSON.stringify(next.antiAfk)

    if (next.bots.count !== this.bots.length) this.resize(next.bots.count)
    for (const bot of this.bots) bot.refreshIdentity()

    if (restart || serverChanged || botsChanged || afkChanged) {
      this.log('info', 'Config changed, restarting the fleet')
      this.restartAll()
    }

    this.emit('update')
    return { errors: [], config: this.config }
  }

  log (level, message, slot = null) {
    const entry = { level, message, slot, time: Date.now() }
    this.logs.push(entry)
    if (this.logs.length > LOG_BUFFER) this.logs.splice(0, this.logs.length - LOG_BUFFER)
    this.emit('log', entry)
  }

  stats () {
    const bots = this.bots.map((b) => b.snapshot())
    const online = bots.filter((b) => b.status === 'online').length
    const connected = bots.filter((b) => b.status !== 'stopped').length
    const pings = bots.filter((b) => typeof b.ping === 'number' && b.ping > 0).map((b) => b.ping)
    const shards = bots.reduce((sum, b) => sum + (typeof b.shards === 'number' ? b.shards : 0), 0)
    const known = bots.filter((b) => typeof b.shards === 'number').length
    return {
      total: bots.length,
      connected,
      online,
      shards,
      shardsKnown: known,
      avgPing: pings.length ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : null,
      uptimeMs: Date.now() - this.startedAt
    }
  }

  snapshot () {
    return {
      bots: this.bots.map((b) => b.snapshot()),
      stats: this.stats(),
      config: this.config,
      logs: this.logs.slice(-120),
      serverTime: Date.now()
    }
  }
}

module.exports = { Fleet }
