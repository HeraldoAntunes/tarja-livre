# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Conexões do exe com o rigor que a pesquisa da gestão pediu (WEBVIEW2-REDE.md, 29/10/2026): várias aberturas, cada
# uma com janela longa, no perfil normal do Tarja, com o exe já aberto uma vez antes. A cada leitura (0,7 s), o
# processo principal do WebView2 tem de ser filho do exe medido; se não for (outra instância no mesmo perfil), a
# rodada é marcada como contaminada. Antes de cada rodada, confere que nenhum WebView2 usa o perfil.
# Uso: tests/conexoes_repetidas.ps1 -Exe <exe> [-Repeticoes 5] [-Minutos 10]
param([Parameter(Mandatory)] [string]$Exe, [int]$Repeticoes = 5, [int]$Minutos = 10)
$perfil = 'br.tarjalivre.app\EBWebView'
function DoPerfil { @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like "*$perfil*" }) }

# uma abertura curta antes, para o exe não ser "recém-copiado" nas medidas
$p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru; Start-Sleep 15; Stop-Process -Id $p.Id -Force; Start-Sleep 5

for ($k = 1; $k -le $Repeticoes; $k++) {
  for ($t = 0; $t -lt 30 -and (DoPerfil).Count; $t++) { Start-Sleep 1 }
  if ((DoPerfil).Count) { "rodada ${k}: PULADA, outro WebView2 usa o perfil"; continue }
  $p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
  $t0 = Get-Date; $fim = $t0.AddMinutes($Minutos)
  $primeira = $null; $enderecos = @{}; $contaminada = $false
  while ((Get-Date) -lt $fim) {
    Start-Sleep -Milliseconds 700
    $motor = DoPerfil
    $principal = @($motor | Where-Object { $_.CommandLine -notmatch '--type=' })
    if ($principal | Where-Object { $_.ParentProcessId -ne $p.Id }) { $contaminada = $true }
    $ids = @($p.Id) + @($motor | ForEach-Object { [int]$_.ProcessId })
    foreach ($c in @(Get-NetTCPConnection -OwningProcess $ids -ErrorAction SilentlyContinue | Where-Object { $_.RemotePort -eq 443 -and $_.State -eq 'Established' })) {
      $enderecos["$($c.RemoteAddress)"] = 1
      if (-not $primeira) { $primeira = [int]((Get-Date) - $t0).TotalSeconds }
    }
  }
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep 5
  $txt = if ($primeira) { "conectou, a primeira aos $primeira s ($($enderecos.Keys -join ', '))" } else { "nenhuma conexão em $Minutos min" }
  "rodada ${k}: $txt" + $(if ($contaminada) { ' [CONTAMINADA: processo principal de outra instância]' } else { '' })
}
