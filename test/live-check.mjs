// Proof on the RESTARTED app's new window handle. ClearOnFocus is disabled here so
// the badge is not wiped the instant the poll notices DSH owns the foreground;
// this isolates "can we paint on the new hwnd" from "the auto-clear policy".
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = path.join(root, 'lib/badge-server.ps1')
const info = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'test', 'target.ps1')], { encoding: 'utf8' })
const [pid, hwnd] = info.trim().split(/\s+/)
console.log('live target: pid=' + pid + ' hwnd=' + hwnd)

const shoot = (name) => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'test', 'tray.ps1')], { stdio: 'pipe' })
  fs.copyFileSync(path.join(root, 'test', 'tray.png'), path.join(root, 'test', name))
}

const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
  '-TargetPid', pid, '-SoundEnabled', '0', '-ClearOnFocus', '0'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdout.setEncoding('utf8')
child.stdout.on('data', (d) => process.stdout.write(`[out] ${d}`))
child.stderr.on('data', (d) => process.stdout.write(`[err] ${d}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(6000)
shoot('live-0-clear.png')
child.stdin.write('set 9\n')
await sleep(1800)
shoot('live-9.png')
child.stdin.write('clear\n')
await sleep(1300)
shoot('live-1-cleared.png')
child.stdin.write('quit\n')
await sleep(1200)
console.log('done')
