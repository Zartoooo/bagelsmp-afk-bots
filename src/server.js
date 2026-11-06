const path = require('path')
const fs = require('fs')
const http = require('http')
const express = require('express')

const DIST = path.join(__dirname, '..', 'dashboard', 'dist')

function createServer (fleet) {
  const app = express()
  app.use(express.json({ limit: '256kb' }))

  // ------------------------------------------------------------------ state
  app.get('/api/state', (req, res) => {
    res.json(fleet.snapshot())
  })

  app.get('/api/logs', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 120, 400)
    res.json({ logs: fleet.logs.slice(-limit) })
  })

  // ----------------------------------------------------------------- config
  app.get('/api/config', (req, res) => {
    res.json({ config: fleet.config })
  })

  app.put('/api/config', (req, res) => {
    const result = fleet.applyConfig(req.body && req.body.config ? req.body.config : req.body, {
      restart: Boolean(req.body && req.body.restart)
    })
    if (result.errors && result.errors.length) {
      return res.status(400).json({ errors: result.errors })
    }
    res.json({ config: fleet.config })
  })

  // ---------------------------------------------------------------- actions
  app.post('/api/action', (req, res) => {
    const { type, id } = req.body || {}
    if (type === 'start') {
      if (id === undefined || id === null) fleet.startAll()
      else fleet.getBot(id)?.start()
    } else if (type === 'stop') {
      if (id === undefined || id === null) fleet.stopAll()
      else fleet.getBot(id)?.stop()
    } else if (type === 'restart') {
      if (id === undefined || id === null) fleet.restartAll()
      else fleet.getBot(id)?.restart()
    } else {
      return res.status(400).json({ error: 'Unknown action type' })
    }
    setTimeout(() => res.json({ ok: true, state: fleet.snapshot() }), 250)
  })

  app.post('/api/bots/:id/chat', (req, res) => {
    const bot = fleet.getBot(req.params.id)
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    const message = String((req.body && req.body.message) || '').trim()
    if (!message) return res.status(400).json({ error: 'Message is required' })
    bot.chat(message)
    res.json({ ok: true })
  })

  // ------------------------------------------------------------- live stream
  app.get('/api/stream', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    res.flushHeaders?.()
    res.write(`event: state\ndata: ${JSON.stringify(fleet.snapshot())}\n\n`)

    const onUpdate = () => res.write(`event: state\ndata: ${JSON.stringify(fleet.snapshot())}\n\n`)
    const onLog = (entry) => res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`)

    fleet.on('update', onUpdate)
    fleet.on('log', onLog)
    const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000)

    req.on('close', () => {
      clearInterval(keepAlive)
      fleet.off('update', onUpdate)
      fleet.off('log', onLog)
    })
  })

  // --------------------------------------------------------------- dashboard
  if (fs.existsSync(DIST)) {
    app.use(express.static(DIST))
    app.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(DIST, 'index.html'))
    })
  } else {
    app.get('/', (req, res) => {
      res.status(200).send(
        '<h1>Dashboard not built</h1><p>Run <code>npm run build:dashboard</code> first, or use the API at <code>/api/state</code>.</p>'
      )
    })
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[api]', err)
    res.status(500).json({ error: err.message })
  })

  const server = http.createServer(app)
  return server
}

module.exports = { createServer }
