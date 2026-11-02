# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Bateria com janela da candidata, DENTRO da VM de testes (guia VM-WINDOWS.md; modelo: roteiro da Bancada 2.1.2).
# Roda no Windows PowerShell 5.1 do convidado, pelo executar-na-vm.ps1. Lê \\VBOXSVR\entrada\tarja\<rodada> e grava
# em \\VBOXSVR\resultados\tarja\<rodada>. Abre janelas só no convidado. Sai com 1 se algo falhar.
#   e2e    tests/e2e.mjs dentro do exe (TARJA_EXE), com o node.exe portátil da rodada
#   a      A1 a A4: a versão anterior instalada, a nova por cima (respondendo Sim na pergunta), Aplicativos
#          instalados, desinstalar
#   c4     conexões: 5 aberturas de 10 min no perfil normal da conta do convidado (tests/conexoes_repetidas.ps1)
#   offline  abre e procura com o cabo da VM desligado (o cabo é desligado no host antes; aqui só confere e mede)
# Uso: testar-na-vm.ps1 -Rodada <rodada> -Fase e2e|a|c4|offline -Versao 1.2.2 -Anterior 1.2.1
param([string]$Rodada = 'rc1-122', [ValidateSet('e2e', 'a', 'c4', 'offline')][string]$Fase = 'e2e',
      [string]$Versao = '1.2.2', [string]$Anterior = '1.2.1')
$ErrorActionPreference = 'Stop'
if ((Get-CimInstance Win32_ComputerSystem).Model -ne 'VirtualBox') { throw 'Teste permitido somente dentro da VM VirtualBox.' }

$entrada = "\\VBOXSVR\entrada\tarja\$Rodada"
$saida = "\\VBOXSVR\resultados\tarja\$Rodada\$Fase"
$base = "C:\TestesProgramas\Tarja-$Rodada-$Fase"
New-Item -ItemType Directory -Force $saida | Out-Null
if (Test-Path $base) { Remove-Item -Recurse -Force $base }
New-Item -ItemType Directory -Force $base | Out-Null
$linhas = New-Object System.Collections.Generic.List[string]
$script:falhas = 0
function anotar([string]$teste, [bool]$ok, [string]$detalhe) {
  $linhas.Add("| $teste | $(if ($ok) { 'passou' } else { '**falhou**' }) | $detalhe |")
  Write-Output "${teste}: $(if ($ok) { 'passou' } else { 'FALHOU' }) ($detalhe)"
  if (-not $ok) { $script:falhas++ }
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
function exeDoZip([string]$v) {
  $d = Join-Path $base "v$v"; New-Item -ItemType Directory -Force $d | Out-Null
  [IO.Compression.ZipFile]::ExtractToDirectory((Join-Path $entrada "Instalar-TarjaLivre-$v.zip"), $d)
  Join-Path $d "TarjaLivre-$v.exe"
}
$exe = exeDoZip $Versao
$hashes = @("$((Get-FileHash $exe).Hash)  TarjaLivre-$Versao.exe")

Add-Type -Namespace TV -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern System.IntPtr FindWindowEx(System.IntPtr p, System.IntPtr a, string c, string t);
[DllImport("user32.dll")] public static extern System.IntPtr PostMessage(System.IntPtr h, uint m, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(System.IntPtr h, out uint pid);
'@
# caixa de mensagem do processo: responde pelo código do botão (IDYES = 6, IDNO = 7), sem depender do texto
function responder([int]$processo, [int]$botao) {
  $h = [IntPtr]::Zero
  # [NullString]::Value: o $null do PowerShell vira texto vazio na chamada e só acharia caixa sem título (PC, 02/11/2026)
  while (($h = [TV.U]::FindWindowEx([IntPtr]::Zero, $h, '#32770', [NullString]::Value)) -ne [IntPtr]::Zero) {
    $dono = 0; [void][TV.U]::GetWindowThreadProcessId($h, [ref]$dono)
    if ($dono -eq $processo) { [void][TV.U]::PostMessage($h, 0x111, [IntPtr]$botao, [IntPtr]::Zero); return $true }
  }
  $false
}
function janela($p, [int]$segundos = 40) {
  for ($i = 0; $i -lt $segundos * 2 -and -not $p.HasExited; $i++) { $p.Refresh(); if ($p.MainWindowTitle -eq 'Tarja Livre') { return $true }; Start-Sleep -Milliseconds 500 }
  $false
}
# uma expressão na página do exe, pelo protocolo de depuração (modelo: roteiro da Bancada)
function pagina([int]$porta, [string]$expr) {
  $alvos = Invoke-RestMethod "http://127.0.0.1:$porta/json" -TimeoutSec 5
  $pg = @($alvos | Where-Object { $_.type -eq 'page' })[0]
  if (-not $pg) { throw 'a página do Tarja não apareceu' }
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [Threading.CancellationToken]::None
  $ws.ConnectAsync([Uri]$pg.webSocketDebuggerUrl, $ct).Wait()
  $msg = @{ id = 1; method = 'Runtime.evaluate'; params = @{ expression = $expr; awaitPromise = $true; returnByValue = $true } } | ConvertTo-Json -Depth 5 -Compress
  $b = [Text.Encoding]::UTF8.GetBytes($msg)
  $ws.SendAsync((New-Object 'ArraySegment[byte]' (,$b)), [Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf = New-Object byte[] 1048576; $ms = New-Object IO.MemoryStream
  do { $r = $ws.ReceiveAsync((New-Object 'ArraySegment[byte]' (,$buf)), $ct).Result; $ms.Write($buf, 0, $r.Count) } while (-not $r.EndOfMessage)
  $ws.Dispose()
  $resp = [Text.Encoding]::UTF8.GetString($ms.ToArray()) | ConvertFrom-Json
  if ($resp.result.exceptionDetails) { throw "$($resp.result.exceptionDetails.text)" }
  $resp.result.result.value
}
function doPerfil([string]$trecho) { @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($trecho) }) }
$abertos = @()

try {
  switch ($Fase) {
    'e2e' {
      # o e2e de sempre, com o node.exe portátil copiado para a rodada (o convidado não tem Node)
      $copia = Join-Path $base 'rodada'; Copy-Item -Recurse (Join-Path $entrada 'teste') $copia
      $env:TARJA_EXE = $exe
      $log = Join-Path $saida 'e2e.log'
      $p = Start-Process (Join-Path $copia 'ferramentas-teste\node.exe') -ArgumentList "`"$(Join-Path $copia 'tests\e2e.mjs')`"", "`"$(Join-Path $saida 'capturas')`"" `
        -RedirectStandardOutput $log -RedirectStandardError "$log.err" -PassThru -Wait -NoNewWindow
      $fim = (Get-Content $log -ErrorAction SilentlyContinue | Select-Object -Last 3) -join ' '
      anotar 'e2e dentro do exe (abrir, procurar, tarjar, carimbo, salvar, conferir o PDF salvo)' ($p.ExitCode -eq 0) "saída $($p.ExitCode): $fim"
      Remove-Item Env:TARJA_EXE
    }
    'a' {
      # A1-A4 na conta do convidado (descartável): a anterior instalada, a nova por cima pela pergunta, desinstalar
      $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TarjaLivre'
      $app = "$env:LOCALAPPDATA\Programs\Tarja Livre"
      $instalado = "$app\TarjaLivre.exe"
      $velho = exeDoZip $Anterior
      $u = Start-Process $velho -ArgumentList '--instalar' -PassThru -Wait
      $v0 = (Get-ItemProperty $chave -ErrorAction SilentlyContinue).DisplayVersion
      anotar "A0: a $Anterior instalada (--instalar)" ($u.ExitCode -eq 0 -and $v0 -eq $Anterior -and (Test-Path $instalado)) "código $($u.ExitCode); DisplayVersion $v0"
      # A1: a nova, aberta de fora da pasta de instalação, pergunta se atualiza; Sim troca o exe e abre a janela
      $p = Start-Process $exe -PassThru; $abertos += $p.Id
      $respondeu = $false; for ($i = 0; $i -lt 60 -and -not $respondeu; $i++) { Start-Sleep -Milliseconds 500; $respondeu = responder $p.Id 6 }
      Start-Sleep 8
      $novo = Get-Process -Name TarjaLivre -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $instalado } | Select-Object -First 1
      if ($novo) { $abertos += $novo.Id }
      $abriu = $novo -and (janela $novo)
      $mesmo = (Test-Path $instalado) -and ((Get-FileHash $instalado).Hash -eq (Get-FileHash $exe).Hash)
      $v1 = (Get-ItemProperty $chave -ErrorAction SilentlyContinue).DisplayVersion
      anotar "A1: a $Versao por cima da $Anterior, pela pergunta (Sim)" ($respondeu -and $mesmo -and $abriu) "pergunta respondida: $respondeu; exe instalado = o novo: $mesmo; janela: $abriu"
      if ($novo) { Stop-Process -Id $novo.Id -Force -ErrorAction SilentlyContinue; Start-Sleep 3 }
      # A2: "Ver versão nova" só abre a página de versões no navegador (o programa não usa rede); clique pela página,
      # com o protocolo de depuração do WebView2 (o convidado não tem Node)
      $env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = '--remote-debugging-port=9334'
      $p = Start-Process $instalado -PassThru; $abertos += $p.Id
      Remove-Item Env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS
      $clicou = $false
      for ($i = 0; $i -lt 60 -and -not $clicou; $i++) {
        Start-Sleep -Milliseconds 500
        try { $clicou = (pagina 9334 "document.getElementById('verVersaoNova') ? (document.getElementById('verVersaoNova').click(), true) : false") -eq $true } catch {}
      }
      Start-Sleep 5
      $navegador = @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like '*github.com/HeraldoAntunes/tarja-livre*' })
      anotar 'A2: "Ver versão nova" abre a página de versões no navegador' ($clicou -and $navegador.Count -gt 0) "clique: $clicou; processos com o endereço: $($navegador.Count)"
      $navegador | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
      Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; Start-Sleep 3
      anotar "A3: Aplicativos instalados mostra $Versao" ($v1 -eq $Versao) "DisplayVersion: $v1"
      $u = Start-Process $instalado -ArgumentList '--desinstalar', '--silencioso' -PassThru -Wait; Start-Sleep 3
      $atalhos = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Tarja Livre.lnk", "$env:USERPROFILE\Desktop\Tarja Livre.lnk") | Where-Object { Test-Path $_ }
      $restam = @(Get-Process -Name TarjaLivre -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $instalado })
      anotar 'A4: desinstalar (--desinstalar --silencioso)' ($u.ExitCode -eq 0 -and -not (Test-Path $app) -and -not (Test-Path $chave) -and -not $atalhos -and -not $restam) "código $($u.ExitCode); pasta: $(Test-Path $app); chave: $(Test-Path $chave); atalhos: $($atalhos.Count); processos: $($restam.Count)"
    }
    'c4' {
      # conexões, com o rigor da 1.2.1: o script do projeto, no perfil normal da conta do convidado
      $r = & (Join-Path $entrada 'teste\tests\conexoes_repetidas.ps1') -Exe $exe -Repeticoes 5 -Minutos 10
      $r | Set-Content (Join-Path $saida 'conexoes.txt') -Encoding UTF8
      $limpas = @($r | Where-Object { $_ -match 'nenhuma conexão' -and $_ -notmatch 'CONTAMINADA' }).Count
      anotar 'C4: 5 aberturas de 10 min sem conexão de rede' ($limpas -eq 5) (($r | ForEach-Object { "$_" }) -join '; ')
    }
    'offline' {
      # o cabo da VM já está desligado (no host): confere a falta de rede e que o programa abre e trabalha
      $rede = Test-NetConnection -ComputerName 1.1.1.1 -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
      anotar 'sem rede no convidado' (-not $rede) "TCP 1.1.1.1:443 respondeu: $rede"
      $perfil = Join-Path $base 'perfil'
      $env:WEBVIEW2_USER_DATA_FOLDER = $perfil
      $p = Start-Process $exe -ArgumentList '--sem-instalar' -PassThru; $abertos += $p.Id
      Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER
      $abriu = janela $p
      Start-Sleep 60
      $vivo = -not $p.HasExited
      $ids = @($p.Id) + @(doPerfil $perfil | ForEach-Object { [int]$_.ProcessId })
      $tentativas = @(Get-NetTCPConnection -OwningProcess $ids -ErrorAction SilentlyContinue | Where-Object { $_.RemoteAddress -notmatch '^(127\.|::1|0\.0\.0\.0|::)' })
      anotar 'C4 sem internet: abre, fica 60 s, nenhuma conexão tentada' ($abriu -and $vivo -and -not $tentativas) "janela: $abriu; vivo: $vivo; conexões: $($tentativas.Count)"
    }
  }
} catch {
  anotar 'execução' $false "$_"
} finally {
  foreach ($id in $abertos) { Get-Process -Id $id -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }
  doPerfil $base | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  $texto = @("## Tarja Livre $Versao na VM ($Rodada, fase $Fase), $(Get-Date -Format 'dd/MM/yyyy HH:mm')", '', 'Exe (SHA-256):', '') +
    ($hashes | ForEach-Object { "- $_" }) + @('', '| Teste | Resultado | Detalhe |', '|---|---|---|') + $linhas
  $texto | Set-Content (Join-Path $saida 'resultado.md') -Encoding UTF8
  Start-Sleep 2; Remove-Item -Recurse -Force $base -ErrorAction SilentlyContinue
}
if ($script:falhas) { exit 1 } else { exit 0 }
