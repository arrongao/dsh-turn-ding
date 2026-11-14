import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const script = path.join(root, 'lib/badge-server.ps1')
const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetPid', '0'], { stdio: ['pipe', 'pipe', 'pipe'] })
child.stdout.setEncoding('utf8')
child.stderr.setEncoding('utf8')
child.stdout.on('data', (d) => process.stdout.write(`[out] ${d}`))
child.stderr.on('data', (d) => process.stdout.write(`[err] ${d}`))
child.on('exit', (c) => console.log('[exit]', c))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await sleep(5000)
child.stdin.write('ping\n'); await sleep(500)
child.stdin.write('set 4\n'); await sleep(800)
child.stdin.write('notify\n'); await sleep(800)
child.stdin.write('set 12\n'); await sleep(800)
child.stdin.write('notify\n'); await sleep(800)
child.stdin.write('clear\n'); await sleep(800)
child.stdin.write('quit\n'); await sleep(1500)
console.log('done')
