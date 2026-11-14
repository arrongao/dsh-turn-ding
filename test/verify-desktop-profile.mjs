// Boot the CURRENT desktop profile configuration in a cloned profile directory,
// to prove the live desktop profile still starts after the plugin install.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

// Machine-specific paths are supplied via environment variables so the test
// harness contains no personal or installation-specific information.
const DSH = process.env.DSH_CLI || 'dsh.cmd'
const home = process.env.USERPROFILE || process.env.HOME || ''
const src = process.env.DSH_PROFILE_DIR || path.join(home, '.dsh/profiles/desktop')
const dst = path.join(path.dirname(src), 'desktopverify')

fs.rmSync(dst, { recursive: true, force: true })
fs.mkdirSync(dst, { recursive: true })
for (const f of ['package.json', 'pnpm-workspace.yaml', 'cordis.yml', 'cordis.patch.yml', 'pnpm-lock.yaml']) {
  const p = path.join(src, f)
  if (fs.existsSync(p)) fs.copyFileSync(p, path.join(dst, f))
}
console.log('cloned config files')

// node_modules cannot be junctioned on this machine; copy the tree instead.
execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `Copy-Item -LiteralPath '${src}\\node_modules' -Destination '${dst}\\node_modules' -Recurse -Force -ErrorAction Stop`],
  { stdio: 'inherit', maxBuffer: 64 * 1024 * 1024 })
console.log('copied node_modules')

const log = path.join(dst, 'boot.log')
const out = fs.openSync(log, 'w')
const child = spawn(`"${DSH}"`, ['--profile', 'desktopverify', '--port', '0', '--no-open'], { stdio: ['ignore', out, out], windowsHide: true, shell: true })
console.log('boot pid', child.pid)

await new Promise((r) => setTimeout(r, 45000))

// Did OUR helper start, and is the web server listening?
const ps = execFileSync('powershell.exe', ['-NoProfile', '-Command',
  `$p = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*badge-server*' }; ` +
  `if ($p) { $p | ForEach-Object { $_.ProcessId.ToString() + ' ' + $_.CommandLine } } else { 'no-helper' }`],
  { encoding: 'utf8' })
console.log('helper:', ps.trim().slice(0, 300))

try { child.kill() } catch { /* gone */ }
await new Promise((r) => setTimeout(r, 3000))
const text = fs.readFileSync(log, 'utf8')
console.log('--- boot.log ---')
console.log(text.split('\n').slice(0, 14).join('\n'))
console.log('--- url? ---', /dsh web: (http\S+)/.exec(text)?.[1] ?? 'none')
console.log('--- failures? ---', (text.match(/did not activate/g) || []).length)
