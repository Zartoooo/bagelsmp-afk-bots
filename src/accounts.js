const fs = require('fs')
const path = require('path')

/**
 * Account names must stay stable across restarts, otherwise every restart
 * registers a brand new account and the server starts rate limiting the IP.
 */
const FILE = path.join(__dirname, '..', 'accounts.json')

let cache = null

function load () {
  if (cache) return cache
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    cache = parsed && typeof parsed === 'object' ? parsed : {}
  } catch (e) {
    cache = {}
  }
  return cache
}

function persist () {
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2) + '\n', 'utf8')
  } catch (e) {
    console.error(`[accounts] Could not write accounts.json: ${e.message}`)
  }
}

function get (slot) {
  const value = load()[String(slot)]
  return typeof value === 'string' && value ? value : null
}

function set (slot, username) {
  load()[String(slot)] = username
  persist()
}

module.exports = { get, set }
