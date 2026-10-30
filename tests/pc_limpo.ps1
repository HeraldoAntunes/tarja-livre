# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# "PC limpo": roda o exe portátil como um professor rodaria e confere três cenários, com captura de tela de cada um.
#   normal        o exe abre, fica vivo e mostra a janela do Tarja; mede as conexões de todos os processos dele.
#   sem-internet  (só com -BloquearRede, numa máquina descartável) o mesmo, com o exe e o WebView2 barrados no firewall.
#   sem-webview2  o carregador do WebView2 aponta para uma pasta vazia: a pessoa tem de ver a mensagem que explica o
#                 que falta e oferece o HTML, e não uma janela que some.
#   instalar      (só com -Instalar, numa máquina descartável) `--instalar`: pasta em %LOCALAPPDATA%\Programs, atalhos
#                 no menu Iniciar e na Área de Trabalho, Aplicativos instalados; o instalado abre a janela; e
#                 `--desinstalar --silencioso` tira tudo isso.
# Os três primeiros abrem com `--sem-instalar`, sem a pergunta de instalar.
# Uso: powershell -File tests/pc_limpo.ps1 -Exe <exe> -Saida <pasta> [-Segundos 60] [-BloquearRede] [-Instalar]
param([Parameter(Mandatory)] [string]$Exe, [Parameter(Mandatory)] [string]$Saida, [int]$Segundos = 60, [switch]$BloquearRede,
  [switch]$Instalar)
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force $Saida | Out-Null
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class PcLimpo {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc f, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static string Classe(IntPtr h) { var s = new StringBuilder(64); GetClassName(h, s, 64); return s.ToString(); }
  [StructLayout(LayoutKind.Sequential)] public struct Ret { public int L, T, R, B; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out Ret r);
  // o texto de uma caixa de mensagem fica nos controles filhos dela
  public static string Textos(IntPtr h) {
    var l = new List<string>();
    EnumChildWindows(h, (c, p) => { var s = new StringBuilder(2048); GetWindowText(c, s, 2048); if (s.Length > 0) l.Add(s.ToString()); return true; }, IntPtr.Zero);
    return string.Join(" | ", l);
  }
}
"@

function Captura([string]$nome) {
  $tela = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bmp = New-Object System.Drawing.Bitmap $tela.Width, $tela.Height
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($tela.Left, $tela.Top, 0, 0, $bmp.Size)
  $bmp.Save((Join-Path $Saida $nome), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

# A janela está desenhada? Janela branca (a página não carregou) não conta (auditoria de 29/10/2026, rodada 2): pega
# a área da janela na tela e conta as cores de uma grade de pontos; a interface do Tarja tem a barra escura, botões e
# texto. Espera até $limite segundos e devolve as cores achadas e a fração de pontos que não são brancos.
function Desenhada($a, [int]$limite = 40) {
  $fim = (Get-Date).AddSeconds($limite)
  $r = $null
  while ((Get-Date) -lt $fim) {
    Start-Sleep 1
    $a.P.Refresh()
    if ($a.P.HasExited -or $a.P.MainWindowHandle -eq [IntPtr]::Zero) { continue }
    $q = New-Object PcLimpo+Ret
    [void][PcLimpo]::GetWindowRect($a.P.MainWindowHandle, [ref]$q)
    $w = $q.R - $q.L; $h = $q.B - $q.T
    if ($w -lt 200 -or $h -lt 200) { continue }
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($q.L, $q.T, 0, 0, $bmp.Size)
    $cores = @{}; $naoBrancos = 0; $total = 0
    for ($x = 10; $x -lt $w - 10; $x += [Math]::Max(1, [int]($w / 40))) {
      for ($y = 40; $y -lt $h - 10; $y += [Math]::Max(1, [int]($h / 40))) {
        $c = $bmp.GetPixel($x, $y); $total++
        $cores["$($c.R),$($c.G),$($c.B)"] = 1
        if ($c.R -lt 235 -or $c.G -lt 235 -or $c.B -lt 235) { $naoBrancos++ }
      }
    }
    $g.Dispose(); $bmp.Dispose()
    $r = [pscustomobject]@{ Cores = $cores.Count; NaoBrancos = [Math]::Round($naoBrancos / [Math]::Max(1, $total), 3) }
    if ($r.Cores -ge 6 -and $r.NaoBrancos -ge 0.03) { return $r }
  }
  $r
}
$desenhada = { param($r) $r -and $r.Cores -ge 6 -and $r.NaoBrancos -ge 0.03 }

# abre o exe com uma pasta de perfil só deste cenário e devolve o processo e essa pasta
function Abrir([string]$cenario, [hashtable]$ambiente = @{}, [string]$Programa = $Exe, [string[]]$Argumentos = @('--sem-instalar')) {
  $perfil = Join-Path $env:TEMP "tarja-pc-limpo-$cenario-$([guid]::NewGuid().ToString('N').Substring(0, 6))"
  New-Item -ItemType Directory $perfil | Out-Null
  $env:WEBVIEW2_USER_DATA_FOLDER = $perfil
  foreach ($k in $ambiente.Keys) { Set-Item "Env:$k" $ambiente[$k] }
  $p = if ($Argumentos.Count) { Start-Process $Programa -ArgumentList $Argumentos -PassThru } else { Start-Process $Programa -PassThru }
  foreach ($k in $ambiente.Keys) { Remove-Item "Env:$k" }
  Remove-Item Env:WEBVIEW2_USER_DATA_FOLDER
  [pscustomobject]@{ P = $p; Perfil = $perfil }
}

function Pids($a) {
  $nome = Split-Path $a.Perfil -Leaf
  @($a.P.Id) + @(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" |
    Where-Object { $_.CommandLine -like "*$nome*" } | ForEach-Object { [int]$_.ProcessId })
}

# observa por $Segundos: vivo o tempo todo, e quais conexões os processos do programa abriram
function Observar($a) {
  $conexoes = @{}; $motor = 0
  $fim = (Get-Date).AddSeconds($Segundos)
  while ((Get-Date) -lt $fim) {
    Start-Sleep 5
    $a.P.Refresh()
    if ($a.P.HasExited) { return [pscustomobject]@{ Vivo = $false; Motor = $motor; Conexoes = @($conexoes.Keys) } }
    $ids = Pids $a
    $motor = [Math]::Max($motor, $ids.Count - 1)
    foreach ($c in @(Get-NetTCPConnection -OwningProcess $ids -ErrorAction SilentlyContinue | Where-Object RemoteAddress -notin '0.0.0.0', '::', '127.0.0.1', '::1')) {
      $conexoes["$($c.RemoteAddress):$($c.RemotePort) $($c.State)"] = $true
    }
  }
  [pscustomobject]@{ Vivo = $true; Motor = $motor; Conexoes = @($conexoes.Keys) }
}

function Fechar($a) {
  if (-not $a.P.HasExited) { Stop-Process -Id $a.P.Id -Force }
  Start-Sleep 2
  Remove-Item $a.Perfil -Recurse -Force -ErrorAction SilentlyContinue
}

$relatorio = [ordered]@{ windows = (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + [Environment]::OSVersion.Version
  webview2 = (Get-ItemProperty 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}' -ErrorAction SilentlyContinue).pv
  exe = (Get-FileHash $Exe -Algorithm SHA256).Hash.ToLower() }
$falhas = @()

# 1) normal
$a = Abrir 'normal'
$tela = Desenhada $a
$a.P.Refresh()
$titulo = $a.P.MainWindowTitle
Captura 'pc-limpo-1-normal.png'
$o = Observar $a
$relatorio.normal = [ordered]@{ vivo = $o.Vivo; janela = $titulo; desenho = $tela; processosDoMotor = $o.Motor; conexoes = $o.Conexoes }
if (-not (& $desenhada $tela)) { $falhas += "normal: a janela não ficou desenhada (branca?): $($tela | ConvertTo-Json -Compress)" }
if (-not $o.Vivo) { $falhas += 'normal: o exe fechou sozinho' }
if ($titulo -notlike 'Tarja Livre*') { $falhas += "normal: janela '$titulo' em vez de Tarja Livre" }
if ($o.Motor -lt 1) { $falhas += 'normal: o motor WebView2 não subiu' }
Fechar $a

# 2) sem internet (firewall), só numa máquina descartável
if ($BloquearRede) {
  $regras = @(
    New-NetFirewallRule -DisplayName 'tarja-pc-limpo-exe' -Direction Outbound -Action Block -Program $Exe
    New-NetFirewallRule -DisplayName 'tarja-pc-limpo-webview2' -Direction Outbound -Action Block -Program (
      Get-ChildItem "${env:ProgramFiles(x86)}\Microsoft\EdgeWebView\Application\*\msedgewebview2.exe" | Select-Object -First 1).FullName)
  try {
    $a = Abrir 'sem-internet'
    $tela = Desenhada $a
    $a.P.Refresh()
    $titulo = $a.P.MainWindowTitle
    Captura 'pc-limpo-2-sem-internet.png'
    $o = Observar $a
    $relatorio.semInternet = [ordered]@{ vivo = $o.Vivo; janela = $titulo; desenho = $tela; conexoes = $o.Conexoes }
    if (-not (& $desenhada $tela)) { $falhas += "sem internet: a janela não ficou desenhada (branca?)" }
    if (-not $o.Vivo) { $falhas += 'sem internet: o exe fechou sozinho' }
    if ($titulo -notlike 'Tarja Livre*') { $falhas += "sem internet: janela '$titulo'" }
    Fechar $a
  } finally { $regras | Remove-NetFirewallRule }
}

# 3) sem WebView2: a mensagem tem de aparecer e ficar
$vazia = Join-Path $env:TEMP 'tarja-pc-limpo-sem-webview2'
New-Item -ItemType Directory -Force $vazia | Out-Null
$a = Abrir 'sem-webview2' @{ WEBVIEW2_BROWSER_EXECUTABLE_FOLDER = $vazia }
Start-Sleep 6
$a.P.Refresh()
$vivo = -not $a.P.HasExited
$h = if ($vivo) { $a.P.MainWindowHandle } else { [IntPtr]::Zero }
$classe = if ($h -ne [IntPtr]::Zero) { [PcLimpo]::Classe($h) } else { '' }
$texto = if ($h -ne [IntPtr]::Zero) { [PcLimpo]::Textos($h) } else { '' }
Captura 'pc-limpo-3-sem-webview2.png'
$relatorio.semWebview2 = [ordered]@{ vivo = $vivo; classe = $classe; texto = $texto; processosDoMotor = (Pids $a).Count - 1 }
if (-not $vivo) { $falhas += 'sem WebView2: o exe sumiu sem mensagem' }
elseif ($classe -ne '#32770') { $falhas += "sem WebView2: em vez da mensagem, janela da classe '$classe'" }
elseif ($texto -notmatch 'WebView2' -or $texto -notmatch 'HTML') { $falhas += "sem WebView2: a mensagem não explica o WebView2 e o HTML: $texto" }
Fechar $a

# 4) instalar e desinstalar, só numa máquina descartável (grava na conta do usuário)
if ($Instalar) {
  $pasta = Join-Path $env:LOCALAPPDATA 'Programs\Tarja Livre'
  $instalado = Join-Path $pasta 'TarjaLivre.exe'
  $chave = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\TarjaLivre'
  $atalhos = @((Join-Path ([Environment]::GetFolderPath('Programs')) 'Tarja Livre.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Tarja Livre.lnk'))
  $r = Start-Process $Exe -ArgumentList '--instalar' -Wait -PassThru
  $reg = Get-ItemProperty $chave -ErrorAction SilentlyContinue
  $mesmo = (Test-Path $instalado) -and (Get-FileHash $instalado).Hash -eq (Get-FileHash $Exe).Hash
  $faltam = @($atalhos | Where-Object { -not (Test-Path $_) })
  $relatorio.instalar = [ordered]@{ saida = $r.ExitCode; mesmoArquivo = $mesmo; atalhosFaltando = $faltam
    versao = $reg.DisplayVersion; desinstalar = $reg.UninstallString }
  if ($r.ExitCode -ne 0) { $falhas += "instalar: saiu com $($r.ExitCode)" }
  if (-not $mesmo) { $falhas += 'instalar: o exe instalado não é igual ao baixado' }
  if ($faltam.Count) { $falhas += "instalar: faltam os atalhos $($faltam -join ', ')" }
  if (-not $reg -or $reg.UninstallString -notlike '*--desinstalar') { $falhas += 'instalar: não aparece em Aplicativos instalados' }
  if ($mesmo) {
    # o instalado já não pergunta nada: abre a janela direto
    $a = Abrir 'instalado' @{} $instalado @()
    $tela = Desenhada $a
    $a.P.Refresh()
    $titulo = $a.P.MainWindowTitle
    Captura 'pc-limpo-4-instalado.png'
    $relatorio.instalar.janela = $titulo
    $relatorio.instalar.desenho = $tela
    if (-not (& $desenhada $tela)) { $falhas += "instalado: a janela não ficou desenhada (branca?)" }
    if ($titulo -notlike 'Tarja Livre*') { $falhas += "instalado: janela '$titulo' em vez de Tarja Livre" }
    Fechar $a
    $r = Start-Process $instalado -ArgumentList '--desinstalar', '--silencioso' -Wait -PassThru
    $sobrou = @(@($pasta) + $atalhos | Where-Object { Test-Path $_ })
    $relatorio.desinstalar = [ordered]@{ saida = $r.ExitCode; sobrou = $sobrou; registro = [bool](Test-Path $chave) }
    if ($r.ExitCode -ne 0) { $falhas += "desinstalar: saiu com $($r.ExitCode)" }
    if ($sobrou.Count) { $falhas += "desinstalar: ficaram $($sobrou -join ', ')" }
    if (Test-Path $chave) { $falhas += 'desinstalar: continua em Aplicativos instalados' }
  }
}

$relatorio.falhas = $falhas
$relatorio | ConvertTo-Json -Depth 5 | Tee-Object (Join-Path $Saida 'pc-limpo.json')
if ($falhas) { Write-Host "PC LIMPO: FALHOU ($($falhas.Count))"; exit 1 }
Write-Host 'PC LIMPO: tudo certo'
