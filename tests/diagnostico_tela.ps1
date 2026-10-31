# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Retrato de quando o exe não responde no protocolo de depuração (tests/navegador.mjs chama antes de encerrar o exe):
# captura da tela inteira, as janelas com título, os processos do Tarja e do WebView2 com a linha de comando, e as
# portas que eles escutam. Só lê; não fecha nada. Uso: diagnostico_tela.ps1 -Saida <pasta>
param([Parameter(Mandatory)] [string] $Saida)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force $Saida | Out-Null

try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $area = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $imagem = New-Object System.Drawing.Bitmap $area.Width, $area.Height
    $g = [System.Drawing.Graphics]::FromImage($imagem)
    $g.CopyFromScreen($area.Left, $area.Top, 0, 0, $imagem.Size)
    $imagem.Save((Join-Path $Saida 'tela.png'), [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $imagem.Dispose()
} catch { "captura falhou: $_" | Out-File (Join-Path $Saida 'tela-erro.txt') -Encoding utf8 }

$texto = @()
$texto += '== janelas com título'
$texto += Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { "$($_.Id) $($_.ProcessName): $($_.MainWindowTitle)" }
$procs = Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(TarjaLivre|msedgewebview2)' }
$texto += ''
$texto += '== processos do Tarja e do WebView2'
$texto += $procs | ForEach-Object { "$($_.ProcessId) (pai $($_.ParentProcessId)) $($_.Name): $($_.CommandLine)" }
$texto += ''
$texto += '== portas escutando nesses processos'
$pids = @($procs | ForEach-Object { $_.ProcessId })
$texto += Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $pids -contains $_.OwningProcess } |
    ForEach-Object { "$($_.OwningProcess) $($_.LocalAddress):$($_.LocalPort)" }
$texto | Out-File (Join-Path $Saida 'processos.txt') -Encoding utf8
$texto
