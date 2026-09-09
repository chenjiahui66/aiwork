# 用法: powershell -ExecutionPolicy Bypass -File scripts/test-dify-key.ps1 -ApiKey "app-你的key"
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiKey
)

$ErrorActionPreference = 'Stop'

if ($ApiKey -notmatch '^app-') {
  Write-Host "[错误] Dify 工作流 API Key 必须以 'app-' 开头,你这个是: $($ApiKey.Substring(0,[Math]::Min(8,$ApiKey.Length)))" -ForegroundColor Red
  exit 1
}

$headers = @{
  Authorization  = "Bearer $ApiKey"
  'Content-Type' = 'application/json'
}
$body = '{"inputs":{"text":"hello"},"response_mode":"blocking","user":"key-test"}'

Write-Host ">>> 正在打 Dify: POST http://localhost/v1/workflows/run"
try {
  $r = Invoke-WebRequest -Uri 'http://localhost/v1/workflows/run' -Method POST -Headers $headers -Body $body -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
  Write-Host ">>> HTTP $($r.StatusCode) OK" -ForegroundColor Green
  Write-Host $r.Content
  Write-Host ""
  Write-Host "Key 验证通过!可以写进 .env.local 了" -ForegroundColor Green
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  Write-Host ">>> HTTP $code 失败" -ForegroundColor Red
  try { $stream = $_.Exception.Response.GetResponseStream(); $reader = New-Object System.IO.StreamReader($stream); Write-Host $reader.ReadToEnd() } catch { }
  Write-Host ""
  Write-Host "可能的原因:" -ForegroundColor Yellow
  Write-Host "  1) key 不对 / 复制错了"
  Write-Host "  2) 工作流还没发布(去 Dify 编辑页右上角点 '发布更新')"
  Write-Host "  3) key 是从其他 Dify 应用拿的,不是当前这个"
  exit 2
}
