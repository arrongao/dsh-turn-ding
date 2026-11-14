// Verify the ClearOnFocus branch through production code: point the helper at the
// process that currently owns the foreground window (WorkBuddy). Painting a badge
// there must be undone by the 500ms poll loop and reported as `autoclear`.
import { spawn } from 'node:child_process'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = path.join(root, 'lib/badge-server.ps1')
const probe = path.join(root, 'test/fg-probe.ps1')

const out = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probe], { encoding: 'utf8' })
const fgPid = Number(/foreground=0x[0-9A-F]+ pid=(\d+)/.exec(out)?.[1])
console.log('foreground pid =', fgPid)

const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
  '-TargetPid', String(fgPid), '-SoundEnabled', '0', '-ClearOnFocus', '1'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
const lines = []
child.stdout.on('data', (d) => { lines.push(String(d)); process.stdout.write(`[out] ${d}`) })
child.stderr.on('data', (d) => process.stdout.write(`[err] ${d}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(5000)
child.stdin.write('set 4\n')
await sleep(3500)
child.stdin.write('quit\n')
await sleep(1200)
const all = lines.join('')
console.log('---- verdict ----')
console.log('saw set:', /set 4/.test(all))
console.log('saw autoclear:', /autoclear/.test(all))
