/**
 * Standalone harness for the host half: builds a fake Cordis context, imports
 * the plugin, then fires the same event shapes the real host emits.
 */
import { createRequire } from 'node:module'

const module_ = await import('../lib/index.js')
console.log('plugin name:', module_.name)
console.log('exports:', Object.keys(module_))

const handlers = new Map()
const disposers = []
const logs = []

const ctx = {
  logger: {
    info: (...a) => logs.push(['info', ...a]),
    warn: (...a) => logs.push(['warn', ...a]),
  },
  effect(fn) {
    const dispose = fn()
    if (typeof dispose === 'function') disposers.push(dispose)
    return dispose
  },
  on(type, listener) {
    if (!handlers.has(type)) handlers.set(type, [])
    handlers.get(type).push(listener)
  },
}

module_.apply(ctx, { sound: false })
console.log('registered event types:', [...handlers.keys()])

const emit = (session, event) => {
  for (const listener of handlers.get('session/event') ?? []) listener(session, event)
}

const mainSession = { id: 's1', header: { isSeeded: false } }
const subSession = { id: 's2', header: { isSeeded: false, origin: 'subagent', delegationDepth: 1 } }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Every non-completed reason must be ignored, as must subagent sessions.
emit(mainSession, { type: 'turn/end', data: { turn: 1, reason: { kind: 'aborted' } } })
emit(mainSession, { type: 'turn/end', data: { turn: 1, reason: { kind: 'error' } } })
emit(subSession, { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } })
emit(mainSession, { type: 'message/user', data: {} })
console.log('after non-events (count must stay 0):', logs.filter((l) => l[0] === 'warn').length === 0)

await sleep(6000)

for (let i = 0; i < 2; i += 1) {
  emit(mainSession, { type: 'turn/end', data: { turn: i + 1, reason: { kind: 'completed' } } })
  await sleep(400)
}
await sleep(2500)

for (const dispose of disposers) dispose()
await sleep(1500)

console.log('logs:', JSON.stringify(logs))
console.log('OK')
