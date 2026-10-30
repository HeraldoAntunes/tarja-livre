# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Falha ao criar a janela (0x80070578, achada no Giz Livre e no Giz na Tela em 29/10/2026), forçada pela compilação
# de teste (cargo build, sem --release): TARJA_TESTE_FALHAR_JANELA=n faz as n primeiras tentativas falharem.
#   2 falhas: a terceira tentativa abre a janela, e o janelas.log tem as 2 falhas;
#   3 falhas: o programa sai com código 1, sem janela branca nem caixa técnica (a mensagem em português não aparece
#             no teste), e o janelas.log tem as 3.
# Perfil e pasta de rascunho (WEBVIEW2_USER_DATA_FOLDER). Uso: tests/e2e_janela.ps1 -Exe <exe de teste (debug)>
param([Parameter(Mandatory)] [string]$Exe)
$falhas = @()
function Rodar([int]$n) {
  $perfil = Join-Path $env:TEMP "tarja-janela-$n-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
  New-Item -ItemType Directory $perfil | Out-Null
  $env:WEBVIEW2_USER_DATA_FOLDER = $perfil
  $env:TARJA_TESTE_FALHAR_JANELA = "$n"
  $p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
  Remove-Item Env:TARJA_TESTE_FALHAR_JANELA, Env:WEBVIEW2_USER_DATA_FOLDER
  $fim = (Get-Date).AddSeconds(40)
  while ((Get-Date) -lt $fim -and -not $p.HasExited -and -not $p.MainWindowTitle) { Start-Sleep -Milliseconds 500; $p.Refresh() }
  Start-Sleep 1; $p.Refresh()
  $r = [pscustomobject]@{
    Saiu = $p.HasExited; Codigo = $(if ($p.HasExited) { $p.ExitCode } else { $null }); Janela = $p.MainWindowTitle
    Log = @(Get-Content (Join-Path $perfil 'janelas.log') -ErrorAction SilentlyContinue)
  }
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force; Start-Sleep 2 }
  Remove-Item $perfil -Recurse -Force -ErrorAction SilentlyContinue
  $r
}
$a = Rodar 2
"2 falhas: janela '$($a.Janela)', saiu $($a.Saiu), $($a.Log.Count) linha(s) no janelas.log"
if ($a.Janela -ne 'Tarja Livre') { $falhas += 'com 2 falhas, a terceira tentativa tinha de abrir a janela' }
if ($a.Log.Count -ne 2 -or $a.Log[1] -notmatch '0x80070578') { $falhas += "com 2 falhas, o janelas.log tinha de ter 2 linhas com o erro: $($a.Log -join ' / ')" }
$b = Rodar 3
"3 falhas: saiu $($b.Saiu) com $($b.Codigo), janela '$($b.Janela)', $($b.Log.Count) linha(s) no janelas.log"
if (-not $b.Saiu -or $b.Codigo -ne 1) { $falhas += 'com 3 falhas, o programa tinha de sair com código 1' }
if ($b.Janela) { $falhas += "com 3 falhas, não podia ficar janela: '$($b.Janela)'" }
if ($b.Log.Count -ne 3) { $falhas += "com 3 falhas, o janelas.log tinha de ter 3 linhas: $($b.Log.Count)" }
if ($falhas.Count) { $falhas | ForEach-Object { "FALHOU: $_" }; exit 1 }
'janela: tudo certo (nova tentativa abre; depois de 3, sai com aviso, sem janela branca)'
