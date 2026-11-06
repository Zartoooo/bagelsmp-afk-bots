const { Fleet } = require('./src/manager')
const { createServer } = require('./src/server')

const fleet = new Fleet()
const server = createServer(fleet)

const COLORS = { info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m', cmd: '\x1b[35m', debug: '\x1b[90m' }
const RESET = '\x1b[0m'

fleet.on('log', (entry) => {
  const color = COLORS[entry.level] || ''
  const time = new Date(entry.time).toTimeString().slice(0, 8)
  console.log(`${color}[${time}] ${entry.level.toUpperCase().padEnd(5)}${RESET} ${entry.message}`)
})

const { host, port } = fleet.config.dashboard

server.listen(port, host, () => {
  console.log('')
  console.log('  ┌──────────────────────────────────────────────┐')
  console.log('  │  BagelSMP AFK Fleet                         │')
  console.log(`  │  Dashboard  http://localhost:${port}/`.padEnd(49) + '│')
  console.log(`  │  Viewers    ports ${fleet.config.viewer.basePort}+ (${fleet.bots.length} bot(s))`.padEnd(49) + '│')
  console.log('  └──────────────────────────────────────────────┘')
  console.log('')
  fleet.startAll()
})

let shuttingDown = false
function shutdown (signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`\n[${signal}] Stopping bots...`)
  fleet.stopAll()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('uncaughtException', (err) => {
  console.error('[fatal]', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[fatal] unhandled rejection:', err)
})
