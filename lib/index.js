/**
 * dsh-turn-ding — host half.
 *
 * Watches `session/event` for completed turns and drives a long-lived PowerShell
 * helper that paints a numeric overlay badge on the DSH taskbar button through
 * `ITaskbarList3.SetOverlayIcon`, optionally playing a sound.
 *
 * The overlay icon is the only channel Windows gives a non-Electron process for
 * a dock badge: the desktop main process exposes no badge IPC to the renderer,
 * and the host runs as a separate Node child process, so Win32 from the host is
 * the right seam.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const name = 'dsh-turn-ding'

const here = dirname(fileURLToPath(import.meta.url))

const DEFAULTS = {
  sound: true,
  soundFile: 'C:\\Windows\\Media\\Windows Notify System Generic.wav',
  badge: true,
  ignoreSubagents: true,
}

const POWERSHELL = 'powershell.exe'

class BadgeServer {
  constructor(options, logger) {
    this.options = options
    this.logger = logger
    this.child = null
    this.count = 0
    this.pending = []
    this.ready = false
    this.broken = false
  }

  /** Launch the helper; failures degrade to "no badge" rather than throwing. */
  start() {
    const script = join(here, 'badge-server.ps1')
    if (!existsSync(script)) {
      this.broken = true
      this.logger.warn('dsh-turn-ding: badge-server.ps1 is missing, badge disabled')
      return
    }

    let child
    try {
      child = spawn(
        POWERSHELL,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
          '-TargetPid', String(process.ppid || 0),
          '-Sound', this.options.soundFile,
          '-SoundEnabled', this.options.sound ? '1' : '0',
          '-BadgeEnabled', this.options.badge ? '1' : '0'],
        { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true },
      )
    } catch (error) {
      this.broken = true
      this.logger.warn(`dsh-turn-ding: could not start the badge helper (${String(error)})`)
      return
    }

    this.child = child
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      for (const raw of String(chunk).split(/\r?\n/)) {
        const line = raw.trim()
        if (!line) continue
        if (line.startsWith('ready')) {
          this.ready = true
          for (const command of this.pending.splice(0)) this.write(command)
          continue
        }
        // The helper owns the authoritative counter: it reports the number it
        // just painted, and tells us when it clears the badge itself.
        const counted = /^notify count=(\d+)$/.exec(line)
        if (counted) {
          this.count = Number(counted[1])
          continue
        }
        if (line === 'autoclear' || line === 'autofade') this.count = 0
      }
    })
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => {
      const text = String(chunk).trim()
      if (text) this.logger.warn(`dsh-turn-ding: badge helper: ${text}`)
    })
    child.on('error', (error) => {
      this.broken = true
      this.logger.warn(`dsh-turn-ding: badge helper failed (${String(error)})`)
    })
    child.on('exit', (code) => {
      this.child = null
      this.ready = false
      if (code !== 0 && code !== null) this.logger.warn(`dsh-turn-ding: badge helper exited with ${code}`)
    })
  }

  write(command) {
    if (!this.child || this.child.killed) return
    if (!this.ready) {
      this.pending.push(command)
      return
    }
    try {
      this.child.stdin.write(`${command}\n`)
    } catch {
      // Helper died mid-write; the next start() call recovers.
    }
  }

  /**
   * A turn finished. `notify` lets the helper decide whether the moment is
   * badge-worthy: it only increments while the DSH window is in the background,
   * so a turn that ends while the user is watching never leaves a stale number.
   */
  bump() {
    if (this.broken) return
    if (!this.child) this.start()
    this.write('notify')
  }

  clear() {
    this.count = 0
    this.write('clear')
  }

  dispose() {
    this.count = 0
    if (!this.child) return
    try {
      this.child.stdin.write('quit\n')
      this.child.stdin.end()
    } catch { /* already gone */ }
    const child = this.child
    this.child = null
    setTimeout(() => {
      if (!child.killed) {
        try { child.kill() } catch { /* already gone */ }
      }
    }, 1500).unref?.()
  }
}

export function apply(ctx, config) {
  const options = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) }
  const logger = ctx.logger ?? console
  const server = new BadgeServer(options, logger)

  ctx.effect(() => {
    server.start()
    return () => server.dispose()
  })

  ctx.on('session/event', (session, event) => {
    if (!event || event.type !== 'turn/end') return
    const reason = event.data?.reason
    if (!reason || reason.kind !== 'completed') return
    if (options.ignoreSubagents && (session?.header?.origin === 'subagent' || (session?.header?.delegationDepth ?? 0) > 0)) return
    server.bump()
  })
}
