Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Tb {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindowW(string cls, string title);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
}
'@
[Tb]::SetProcessDPIAware() | Out-Null
$out = $PSScriptRoot

$tray = [Tb]::FindWindowW('Shell_TrayWnd', $null)
$r = New-Object Tb+RECT
[Tb]::GetWindowRect($tray, [ref]$r) | Out-Null
Write-Output ("tray=" + $r.Left + "," + $r.Top + "," + $r.Right + "," + $r.Bottom)

$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.Left, $r.Top, 0, 0, (New-Object System.Drawing.Size $w, $h))
$bmp.Save((Join-Path $out 'tray.png'), [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("saved " + $w + "x" + $h)
