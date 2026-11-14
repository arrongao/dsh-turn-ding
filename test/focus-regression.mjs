// Reproduces the user's real scenario: the DSH window is FOCUSED and a turn
// finishes in another chat. The badge must appear anyway, then clear when the
// window is left and re-entered.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = path.join(root, 'lib/badge-server.ps1')
const info = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'test', 'target.ps1')], { encoding: 'utf8' })
const [pid, hwnd] = info.trim().split(/\s+/)
console.log('target: pid=' + pid + ' hwnd=' + hwnd)

const shoot = (name) => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'test', 'tray.ps1')], { stdio: 'pipe' })
  fs.copyFileSync(path.join(root, 'test', 'tray.png'), path.join(root, 'test', name))
}

const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
  '-TargetPid', pid, '-SoundEnabled', '0'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdout.setEncoding('utf8')
child.stdout.on('data', (d) => process.stdout.write(`[out] ${d}`))
child.stderr.setEncoding('utf8')
child.stderr.on('data', (d) => process.stdout.write(`[err] ${d}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(6500)
shoot('focus-0-before.png')
console.log('--- notify while focused (the case that failed) ---')
child.stdin.write('notify\n')
await sleep(1500)
shoot('focus-1-after.png')
child.stdin.write('notify\n')
await sleep(1500)
shoot('focus-2-twice.png')
await sleep(1000)
child.stdin.write('clear\n')
await sleep(1000)
child.stdin.write('quit\n')
await sleep(1200)
console.log('done')
