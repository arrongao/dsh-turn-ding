// Clean visual proof: badge on the REAL DSH taskbar button.
// Diffs a badged capture against a cleared capture so the taskbar clock cannot fake a hit.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = path.join(root, 'lib/badge-server.ps1')
const tray = path.join(root, 'test/tray.ps1')

const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetPid', '0', '-SoundEnabled', '0'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
let log = ''
child.stdout.on('data', (d) => { log += d; process.stdout.write(`[out] ${d}`) })
child.stderr.on('data', (d) => { log += d; process.stdout.write(`[err] ${d}`) })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const shoot = (name) => {
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tray], { stdio: 'pipe' })
  const dest = path.join(root, 'test', name)
  fs.copyFileSync(path.join(root, 'test/tray.png'), dest)
  return dest
}

await sleep(6000)
const before = shoot('proof-clear.png')
child.stdin.write('set 3\n')
await sleep(1800)
const after = shoot('proof-badge3.png')
child.stdin.write('clear\n')
await sleep(1200)
child.stdin.write('quit\n')
await sleep(1200)
console.log(JSON.stringify({ before, after }))
