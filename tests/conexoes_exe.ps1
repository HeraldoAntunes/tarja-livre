# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Abre o exe do Tarja com uma pasta de perfil própria e registra, a cada 5 s, as conexões TCP e UDP de todos os
# processos dele (o exe e os do motor WebView2 que usam essa pasta). Uso: tests/conexoes_exe.ps1 -Exe <exe> [-Segundos 240] [-PerfilNormal]
param([string]$Exe, [int]$Segundos = 240, [switch]$PerfilNormal)
$perfil = Join-Path $env:TEMP ("tarja-conexoes-" + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory $perfil | Out-Null
if ($PerfilNormal) { $perfil = Join-Path $env:LOCALAPPDATA "br.tarjalivre.app" } else { $env:WEBVIEW2_USER_DATA_FOLDER = $perfil }
$p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
$vistos = @{}
$fim = (Get-Date).AddSeconds($Segundos)
$motorMax = 0
while ((Get-Date) -lt $fim) {
  Start-Sleep 5
  $nome = Split-Path $perfil -Leaf
  $motor = @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like "*$nome*" })
  $motorMax = [Math]::Max($motorMax, $motor.Count)
  $pids = @($p.Id) + @($motor | ForEach-Object { [int]$_.ProcessId })
  $tipos = @{}; foreach ($m in $motor) { $tipos[[int]$m.ProcessId] = if ($m.CommandLine -match '--type=([\w-]+)') { $Matches[1] + $(if ($m.CommandLine -match '--utility-sub-type=([\w.]+)') { '/' + $Matches[1] } else { '' }) } else { 'principal' } }
  $tipos[$p.Id] = 'TarjaLivre.exe'
  foreach ($c in @(Get-NetTCPConnection -OwningProcess $pids -ErrorAction SilentlyContinue)) {
    $chave = "TCP $($tipos[[int]$c.OwningProcess]) $($c.RemoteAddress):$($c.RemotePort) $($c.State)"
    if (-not $vistos[$chave]) { $vistos[$chave] = (Get-Date -Format 'HH:mm:ss') }
  }
  foreach ($u in @(Get-NetUDPEndpoint -OwningProcess $pids -ErrorAction SilentlyContinue)) {
    $chave = "UDP $($tipos[[int]$u.OwningProcess]) local $($u.LocalAddress):$($u.LocalPort)"
    if (-not $vistos[$chave]) { $vistos[$chave] = (Get-Date -Format 'HH:mm:ss') }
  }
}
"processos do motor (máximo): $motorMax"
if ($vistos.Count -eq 0) { "nenhuma conexão TCP nem porta UDP em $Segundos s" }
else { $vistos.GetEnumerator() | Sort-Object Value | ForEach-Object { "$($_.Value)  $($_.Key)" } }
Stop-Process -Id $p.Id -Force
Start-Sleep 2
if (-not $PerfilNormal) { Remove-Item $perfil -Recurse -Force -ErrorAction SilentlyContinue }
