// End-to-end harness: fake Cordis ctx, real PowerShell helper, real taskbar.
// Proves the whole chain the host will run: turn/end -> notify -> overlay icon.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { apply } from '../lib/index.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const tray = path.join(root, 'test/tray.ps1')
const shoot = (name) => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tray], { stdio: 'pipe' })
  fs.copyFileSync(path.join(root, 'test/tray.png'), path.join(root, 'test', name))
}

const listeners = new Map()
const logs = []
const disposers = []
const ctx = {
  logger: { warn: (m) => logs.push(m), info: (m) => logs.push(m), error: (m) => logs.push(m) },
  on: (type, fn) => { listeners.set(type, fn); return () => listeners.delete(type) },
  effect: (fn) => { const d = fn(); if (typeof d === 'function') disposers.push(d) },
}

apply(ctx, { sound: false })

const fire = (type, data, session = { header: { origin: undefined, delegationDepth: 0 } }) => {
  for (const [, fn] of listeners) fn(session, { type, data })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(7000)
shoot('e2e-0-idle.png')
console.log('step: idle captured')

fire('turn/end', { turn: 1, reason: { kind: 'completed' } })
await sleep(1800)
shoot('e2e-1-one.png')
console.log('step: one turn captured')

fire('turn/end', { turn: 2, reason: { kind: 'completed' } })
await sleep(1500)
shoot('e2e-2-two.png')
console.log('step: two turns captured')

// These must NOT change the badge.
fire('turn/end', { turn: 3, reason: { kind: 'aborted', reason: { kind: 'user' } } })
fire('turn/end', { turn: 4, reason: { kind: 'error' } })
fire('turn/end', { turn: 5, reason: { kind: 'completed' } }, { header: { origin: 'subagent', delegationDepth: 1 } })
await sleep(1200)
shoot('e2e-3-after-filters.png')
console.log('step: filtered events captured')

for (const d of disposers) d()
await sleep(1500)
console.log('logs:', JSON.stringify(logs))
console.log('OK')
