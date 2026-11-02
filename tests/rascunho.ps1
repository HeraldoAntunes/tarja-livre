# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Limpeza das pastas de rascunho dos testes .ps1 (perfil do WebView2 e afins), chamada no finally, também quando o
# teste falha ou é interrompido: cada perfil ocupa uns 0,5 GB, e a %TEMP% encheu o C: com as sobras (30/10/2026).
# Fecha o exe e os processos do WebView2 que usam a pasta (só esses: o nome da pasta é único, e a busca é pelo nome,
# porque a linha de comando pode trazer o caminho curto, como RUNNER~1) e apaga, tentando de novo enquanto algum
# processo ainda a segura. Uso: . (Join-Path $PSScriptRoot 'rascunho.ps1'); Remover-Rascunho $pasta [-Processo $p]
function Remover-Rascunho([string]$Pasta, $Processo = $null) {
  if (-not $Pasta) { return }
  if ($Processo) { Stop-Process -Id $Processo.Id -Force -ErrorAction SilentlyContinue }
  $nome = Split-Path $Pasta -Leaf
  for ($k = 0; $k -lt 10 -and (Test-Path $Pasta); $k++) {
    Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like "*$nome*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
    Remove-Item $Pasta -Recurse -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $Pasta) { Write-Warning "rascunho não apagado: $Pasta" }
}
