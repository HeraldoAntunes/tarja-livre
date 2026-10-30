# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Reabrir logo depois de uma queda (achado do Bancada e do Giz na Tela, 29/10/2026): o exe é morto à força e aberto
# de novo na hora, $Vezes vezes, no mesmo perfil de rascunho. Em todas, a janela do Tarja tem de abrir, sem caixa de
# erro. Conta também quantas vezes ficou um WebView2 órfão (processo principal com o pai morto) segurando o perfil.
# Uso: tests/e2e_quedas.ps1 -Exe <exe> [-Vezes 10]
param([Parameter(Mandatory)] [string]$Exe, [int]$Vezes = 10)
$base = Join-Path $env:TEMP "tarja-quedas-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
New-Item -ItemType Directory $base | Out-Null
$perfil = Join-Path $base 'EBWebView'
function Orfaos {
  @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object {
    $_.CommandLine -like "*--user-data-dir=`"$perfil`"*" -and $_.CommandLine -notmatch '--type=' -and
    -not (Get-Process -Id $_.ParentProcessId -ErrorAction SilentlyContinue) })
}
$abriu = 0; $caixas = 0; $orfaosDepois = 0; $falhas = @()
for ($k = 1; $k -le $Vezes; $k++) {
  $env:WEBVIEW2_USER_DATA_FOLDER = $base
  $p = Start-Process $Exe -ArgumentList '--sem-instalar' -PassThru
  Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER
  $fim = (Get-Date).AddSeconds(30); $ok = $false
  while ((Get-Date) -lt $fim -and -not $p.HasExited) {
    Start-Sleep -Milliseconds 300; $p.Refresh()
    if ($p.MainWindowTitle -eq 'Tarja Livre') { $ok = $true; break }
  }
  # a caixa de erro também se chama "Tarja Livre": a janela do programa tem a classe do Tauri, a caixa é #32770
  Add-Type -Name C -Namespace Q -MemberDefinition '[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, System.Text.StringBuilder s, int n);' -ErrorAction SilentlyContinue
  $classe = New-Object System.Text.StringBuilder 64
  if ($ok) { [void][Q.C]::GetClassName($p.MainWindowHandle, $classe, 64) }
  if ($ok -and $classe.ToString() -ne '#32770') { $abriu++ } else { $falhas += "vez ${k}: não abriu (saiu: $($p.HasExited), título '$($p.MainWindowTitle)', classe '$classe')"; if ($classe.ToString() -eq '#32770') { $caixas++ } }
  Start-Sleep 2
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 300
  if ((Orfaos).Count) { $orfaosDepois++ }
}
Start-Sleep 2
# limpeza do teste: só os WebView2 deste perfil de rascunho
Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like "*$base*" } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$log = @(Get-Content (Join-Path $base 'janelas.log') -ErrorAction SilentlyContinue)
Start-Sleep 1
Remove-Item $base -Recurse -Force -ErrorAction SilentlyContinue
"abriu em $abriu de $Vezes; caixas de erro: $caixas; vezes com WebView2 órfão logo depois do kill: $orfaosDepois; linhas no janelas.log: $($log.Count)"
$log | Select-Object -Last 3
if ($falhas.Count) { $falhas | ForEach-Object { "FALHOU: $_" }; exit 1 }
'quedas: tudo certo'
