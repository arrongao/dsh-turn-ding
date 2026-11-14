param(
  [Parameter(Mandatory = $true)][int]$TargetPid,
  [string]$Sound = 'C:\Windows\Media\Windows Notify System Generic.wav',
  [int]$ClearOnFocus = 1,
  [int]$SoundEnabled = 1,
  [int]$BadgeEnabled = 1
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

namespace DshBadge {
  [ComImport, Guid("56FDF344-FD6D-11d0-958A-006097C9A090")]
  public class TaskbarListCoclass { }

  [ComImport, Guid("ea1afb91-9e28-4b86-90e9-9e9f8a5eefaf"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface ITaskbarList3 {
    void HrInit();
    void AddTab(IntPtr hwnd);
    void DeleteTab(IntPtr hwnd);
    void ActivateTab(IntPtr hwnd);
    void SetActiveAlt(IntPtr hwnd);
    void MarkFullscreenWindow(IntPtr hwnd, bool fFullscreen);
    void SetProgressValue(IntPtr hwnd, ulong completed, ulong total);
    void SetProgressState(IntPtr hwnd, int flags);
    void RegisterTab(IntPtr hwndTab, IntPtr hwndMdi);
    void UnregisterTab(IntPtr hwndTab);
    void SetTabOrder(IntPtr hwndTab, IntPtr hwndInsertBefore);
    void SetTabActive(IntPtr hwndTab, IntPtr hwndMdi, uint reserved);
    void ThumbBarAddButtons(IntPtr hwnd, uint cButtons, IntPtr pButtons);
    void ThumbBarUpdateButtons(IntPtr hwnd, uint cButtons, IntPtr pButtons);
    void ThumbBarSetImageList(IntPtr hwnd, IntPtr himl);
    void SetOverlayIcon(IntPtr hwnd, IntPtr hIcon, [MarshalAs(UnmanagedType.LPWStr)] string description);
    void SetThumbnailTooltip(IntPtr hwnd, [MarshalAs(UnmanagedType.LPWStr)] string tip);
  }

  public static class Api {
    static ITaskbarList3 list;

    static ITaskbarList3 List() {
      if (list == null) {
        object coclass = new TaskbarListCoclass();
        list = (ITaskbarList3)coclass;
        list.HrInit();
      }
      return list;
    }

    public static void Apply(long hwndValue, int count, string tip) {
      IntPtr hwnd = new IntPtr(hwndValue);
      if (count <= 0) {
        List().SetOverlayIcon(hwnd, IntPtr.Zero, "");
        return;
      }
      IntPtr hicon = Render(count);
      try { List().SetOverlayIcon(hwnd, hicon, tip == null ? "" : tip); }
      finally { DestroyIcon(hicon); }
    }

    // 32x32 ARGB: red disc, white rim, bold white numeral -- the shape Windows
    // itself uses for unread counts on a taskbar button.
    public static IntPtr Render(int count) {
      int s = 32;
      Bitmap bmp = new Bitmap(s, s, System.Drawing.Imaging.PixelFormat.Format32bppArgb);
      using (Graphics g = Graphics.FromImage(bmp)) {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        g.Clear(Color.Transparent);
        float pad = s * 0.04f;
        using (SolidBrush fill = new SolidBrush(Color.FromArgb(255, 209, 52, 56)))
        using (Pen edge = new Pen(Color.FromArgb(255, 255, 255, 255), s * 0.06f)) {
          g.FillEllipse(fill, pad, pad, s - 2 * pad, s - 2 * pad);
          g.DrawEllipse(edge, pad, pad, s - 2 * pad, s - 2 * pad);
        }
        string text = count > 99 ? "99+" : count.ToString();
        float em = s * (text.Length > 2 ? 0.40f : text.Length > 1 ? 0.52f : 0.68f);
        using (Font f = new Font("Segoe UI", em, FontStyle.Bold, GraphicsUnit.Pixel)) {
          StringFormat sf = new StringFormat();
          sf.Alignment = StringAlignment.Center;
          sf.LineAlignment = StringAlignment.Center;
          g.DrawString(text, f, Brushes.White, new RectangleF(0, s * 0.02f, s, s), sf);
        }
      }
      return bmp.GetHicon();
    }

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);
  }
}
'@

function Write-Line([string]$text) {
  [Console]::Out.WriteLine($text)
  [Console]::Out.Flush()
}

# The DSH window is owned by the Electron main process -- our parent process.
# Fall back to any process carrying a DSH main window if that lookup fails.
function Find-Window {
  if ($TargetPid -gt 0) {
    $p = Get-Process -Id $TargetPid -ErrorAction SilentlyContinue
    if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) { return $p.MainWindowHandle }
  }
  foreach ($n in @('DeepSeek Harness', 'DSH')) {
    $c = Get-Process -Name $n -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
      Sort-Object StartTime | Select-Object -First 1
    if ($c) { return $c.MainWindowHandle }
  }
  return [IntPtr]::Zero
}

function Play-Ding {
  if ($SoundEnabled -ne 1) { return }
  if (-not (Test-Path -LiteralPath $Sound)) { return }
  try {
    $player = New-Object System.Media.SoundPlayer -ArgumentList $Sound
    $player.Play()
  } catch { }
}

function Show-Badge([int]$n) {
  if ($BadgeEnabled -ne 1 -or $n -le 0) { return }
  if ($target -eq [IntPtr]::Zero) { return }
  $tip = if ($n -eq 1) { '1 个会话已完成' } else { "$n 个会话已完成" }
  try { [DshBadge.Api]::Apply($target.ToInt64(), $n, $tip) } catch { }
}

$target = Find-Window
$count = 0
$ticks = 0
$wasFocused = ($target -ne [IntPtr]::Zero) -and ([DshBadge.Api]::GetForegroundWindow() -eq $target)
$focusedTicks = 0
$reader = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), (New-Object System.Text.UTF8Encoding($false)))
Write-Line ("ready hwnd=" + $target.ToInt64() + " pid=" + $TargetPid)

$task = $reader.ReadLineAsync()
while ($true) {
  $got = $task.AsyncWaitHandle.WaitOne(500)
  if ($got) {
    $line = $task.Result
    if ($null -eq $line) { break }
    $task = $reader.ReadLineAsync()
    $line = $line.Trim()
    if ($line.Length -eq 0) { continue }
    $parts = $line.Split(' ', [StringSplitOptions]::RemoveEmptyEntries)
    $cmd = $parts[0].ToLowerInvariant()
    if ($cmd -eq 'quit') { break }

    if ($target -eq [IntPtr]::Zero -or -not [DshBadge.Api]::IsWindow($target)) { $target = Find-Window }

    switch ($cmd) {
      'notify' {
        # A turn finished. Always counted: DSH is one window shared by several
        # chats, so "the window has focus" says nothing about whether the user is
        # watching *this* chat. Clearing happens on regaining focus instead.
        $count += 1
        Show-Badge $count
        Play-Ding
        Write-Line ("notify count=" + $count)
      }
      'set' {
        $n = 1
        if ($parts.Length -gt 1) { [int]::TryParse($parts[1], [ref]$n) | Out-Null }
        if ($n -le 0) { $n = 1 }
        $count = $n
        Show-Badge $count
        Write-Line ("set " + $count)
      }
      'clear' {
        $count = 0
        if ($target -ne [IntPtr]::Zero) { try { [DshBadge.Api]::Apply($target.ToInt64(), 0, "") } catch { } }
        Write-Line "clear"
      }
      'sound' {
        Play-Ding
        Write-Line "sound"
      }
      'ping' { Write-Line "pong" }
      default { Write-Line ("unknown " + $cmd) }
    }
    continue
  }

  $ticks += 1
  if ($target -eq [IntPtr]::Zero -or -not [DshBadge.Api]::IsWindow($target)) {
    $old = $target
    $target = Find-Window
    if ($target -ne [IntPtr]::Zero) {
      Write-Line ("rebind hwnd=" + $target.ToInt64())
      Show-Badge $count
    }
    continue
  }

  if ($count -gt 0) {
    # Clear on a background -> foreground transition (the usual "I came back"
    # case), or let a badge shown while already focused fade after ~10s so it
    # cannot stick to a window the user never left.
    $focusedNow = ($ClearOnFocus -eq 1) -and ([DshBadge.Api]::GetForegroundWindow() -eq $target)
    if ($focusedNow -and -not $wasFocused) {
      $count = 0
      $focusedTicks = 0
      try { [DshBadge.Api]::Apply($target.ToInt64(), 0, "") } catch { }
      Write-Line "autoclear"
    } elseif ($focusedNow -and $focusedTicks -ge 20) {
      $count = 0
      $focusedTicks = 0
      try { [DshBadge.Api]::Apply($target.ToInt64(), 0, "") } catch { }
      Write-Line "autofade"
    } else {
      if ($focusedNow) { $focusedTicks += 1 } else { $focusedTicks = 0 }
      if ($ticks % 12 -eq 0) {
        # Heal after Explorer restarts or a hide/show cycle drops the overlay.
        Show-Badge $count
      }
    }
    $wasFocused = $focusedNow
  } else {
    $wasFocused = ($ClearOnFocus -eq 1) -and ([DshBadge.Api]::GetForegroundWindow() -eq $target)
    $focusedTicks = 0
  }
}

if ($count -gt 0 -and $target -ne [IntPtr]::Zero) {
  try { [DshBadge.Api]::Apply($target.ToInt64(), 0, "") } catch { }
}
Write-Line "bye"
