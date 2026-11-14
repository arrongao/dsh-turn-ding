$p = Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
  Sort-Object StartTime | Select-Object -First 1
if (-not $p) { Write-Output 'none'; exit 1 }
Write-Output ($p.Id.ToString() + ' ' + $p.MainWindowHandle.ToInt64().ToString())
