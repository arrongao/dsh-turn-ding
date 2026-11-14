param([switch]$Focus)
# Reports the foreground HWND and the DSH window HWND so the autoclear comparison
# can be checked against reality instead of guessed.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr h, uint flags);
  public static string Title(IntPtr h) {
    var sb = new System.Text.StringBuilder(512);
    GetWindowTextW(h, sb, 512);
    return sb.ToString();
  }
}
'@

$dsh = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
  Sort-Object StartTime | Select-Object -First 1
if (-not $dsh) { Write-Output 'no-dsh-window'; exit 0 }

$target = $dsh.MainWindowHandle
if ($Focus) {
  [Fg]::ShowWindow($target, 9) | Out-Null
  [Fg]::SetForegroundWindow($target) | Out-Null
  Start-Sleep -Milliseconds 800
}

$fg = [Fg]::GetForegroundWindow()
[uint32]$fgPid = 0
[void][Fg]::GetWindowThreadProcessId($fg, [ref]$fgPid)
$root = [Fg]::GetAncestor($fg, 2)   # GA_ROOT
Write-Output ("target=0x{0:X} title={1}" -f $target.ToInt64(), [Fg]::Title($target))
Write-Output ("foreground=0x{0:X} pid={1} title={2}" -f $fg.ToInt64(), $fgPid, [Fg]::Title($fg))
Write-Output ("fg-root=0x{0:X} match={1}" -f $root.ToInt64(), ($root -eq $target))
