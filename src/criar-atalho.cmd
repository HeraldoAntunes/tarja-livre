@echo off
rem Tarja Livre - (c) 2026 Heraldo Antunes - Licenca MIT (ver LICENSE)
rem SPDX-FileCopyrightText: 2026 Heraldo Antunes
rem SPDX-License-Identifier: MIT
rem Cria o atalho do Tarja Livre com o icone dele, para fixar na barra de tarefas.
rem Deixe este arquivo na mesma pasta do TarjaLivre-x.y.z.html e de dois cliques nele.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$f='%~f0'; iex ((Get-Content -LiteralPath $f -Raw -Encoding UTF8) -split ('#--POWER'+'SHELL--#'),2)[1]"
echo.
pause
exit /b
#--POWERSHELL--#
# O que vem abaixo é PowerShell, lido pela linha acima. Não usa a internet e não instala nada: abre o Tarja numa
# janela própria do Edge, lê a identidade que o Edge dá a essa janela e cria um atalho com o ícone do Tarja e essa
# mesma identidade. Assim o ícone fixado na barra de tarefas e a janela aberta ficam juntos.
$ErrorActionPreference = 'Stop'
$pasta = Split-Path -Parent $f
$icone64 = '__ICONE_BASE64__'

$htmls = @(Get-ChildItem -LiteralPath $pasta -Filter 'TarjaLivre*.html' | Sort-Object LastWriteTime -Descending)
if ($htmls.Count -eq 0) {
  Write-Host 'Não achei o arquivo do Tarja Livre (TarjaLivre-...html) nesta pasta.'
  Write-Host 'Ponha este arquivo na mesma pasta dele e dê dois cliques de novo.'
  return
}
$html = $htmls[0]
if ($htmls.Count -gt 1) {
  Write-Host 'Achei mais de um arquivo do Tarja Livre nesta pasta:'
  for ($i = 0; $i -lt $htmls.Count; $i++) { Write-Host "  $($i + 1)) $($htmls[$i].Name)" }
  $n = "$(Read-Host 'Digite o número do que o atalho deve abrir e tecle Enter')".Trim()
  if ($n -notmatch '^\d+$' -or [int]$n -lt 1 -or [int]$n -gt $htmls.Count) { Write-Host 'Número inválido. Nada foi feito.'; return }
  $html = $htmls[[int]$n - 1]
}
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") |
  Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edge) { Write-Host 'Não achei o Microsoft Edge neste computador. O atalho precisa dele.'; return }

$ico = Join-Path $pasta 'TarjaLivre.ico'
[IO.File]::WriteAllBytes($ico, [Convert]::FromBase64String($icone64))

Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class TarjaAtalho {
  public delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [StructLayout(LayoutKind.Sequential)] public struct PROPERTYKEY { public Guid fmtid; public uint pid; }
  [StructLayout(LayoutKind.Explicit)] public struct PROPVARIANT { [FieldOffset(0)] public ushort vt; [FieldOffset(8)] public IntPtr p; [FieldOffset(16)] public IntPtr p2; }
  [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPropertyStore { [PreserveSig] int GetCount(out uint c); [PreserveSig] int GetAt(uint i, out PROPERTYKEY k); [PreserveSig] int GetValue(ref PROPERTYKEY k, out PROPVARIANT v); [PreserveSig] int SetValue(ref PROPERTYKEY k, ref PROPVARIANT v); [PreserveSig] int Commit(); }
  [ComImport, Guid("0000010b-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  public interface IPersistFile { void GetClassID(out Guid g); [PreserveSig] int IsDirty(); void Load([MarshalAs(UnmanagedType.LPWStr)] string f, uint m); void Save([MarshalAs(UnmanagedType.LPWStr)] string f, bool r); void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string f); void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string f); }
  [DllImport("shell32.dll")] public static extern int SHGetPropertyStoreForWindow(IntPtr h, ref Guid riid, out IPropertyStore ps);
  static PROPERTYKEY Chave() { PROPERTYKEY k = new PROPERTYKEY(); k.fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"); k.pid = 5; return k; }
  // identidade (AppUserModelID) que a barra de tarefas usa para juntar janela e atalho
  public static string Identidade(IntPtr h) {
    Guid g = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"); IPropertyStore ps;
    if (SHGetPropertyStoreForWindow(h, ref g, out ps) != 0) return null;
    PROPERTYKEY k = Chave(); PROPVARIANT v;
    if (ps.GetValue(ref k, out v) != 0 || v.vt != 31) return null;
    return Marshal.PtrToStringUni(v.p);
  }
  public static void GravarNoAtalho(string lnk, string id) {
    object o = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("00021401-0000-0000-C000-000000000046")));
    ((IPersistFile)o).Load(lnk, 2);
    IPropertyStore ps = (IPropertyStore)o;
    PROPERTYKEY k = Chave(); PROPVARIANT v = new PROPVARIANT(); v.vt = 31; v.p = Marshal.StringToCoTaskMemUni(id);
    Marshal.ThrowExceptionForHR(ps.SetValue(ref k, ref v)); Marshal.ThrowExceptionForHR(ps.Commit());
    ((IPersistFile)o).Save(lnk, true);
  }
}
"@

function JanelasDoEdge {
  $lista = New-Object System.Collections.ArrayList
  [TarjaAtalho]::EnumWindows({ param($h, $p)
    if ([TarjaAtalho]::IsWindowVisible($h)) {
      $procId = 0; [void][TarjaAtalho]::GetWindowThreadProcessId($h, [ref]$procId)
      if ((Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName -eq 'msedge') { [void]$lista.Add($h) }
    }
    $true }, [IntPtr]::Zero) | Out-Null
  $lista
}

$url = ([Uri]$html.FullName).AbsoluteUri
$antes = @{}; foreach ($h in JanelasDoEdge) { $antes[[string]$h] = $true }
Write-Host "Abrindo o $($html.Name) numa janela própria do Edge..."
Start-Process -FilePath $edge -ArgumentList "--app=$url"
$id = $null
for ($i = 0; $i -lt 80 -and -not $id; $i++) {
  Start-Sleep -Milliseconds 250
  foreach ($h in JanelasDoEdge) {
    if ($antes[[string]$h]) { continue }
    $x = [TarjaAtalho]::Identidade($h)
    if ($x -and $x -like 'MSEdge._*') { $id = $x; break }
  }
}

$nome = if ($html.Name -like 'TarjaLivre-OCR*') { 'Tarja Livre com OCR' } else { 'Tarja Livre' }
$destinos = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))
$sh = New-Object -ComObject WScript.Shell
foreach ($d in $destinos) {
  $lnk = Join-Path $d "$nome.lnk"
  $a = $sh.CreateShortcut($lnk)
  $a.TargetPath = $edge
  $a.Arguments = "--app=$url"
  $a.IconLocation = "$ico,0"
  $a.WorkingDirectory = $pasta
  $a.Description = 'Tarja Livre: tarjar dados pessoais em PDF, sem internet'
  $a.Save()
  if ($id) { [TarjaAtalho]::GravarNoAtalho($lnk, $id) }
}

Write-Host ''
Write-Host "Pronto: o atalho ""$nome"" está na Área de Trabalho e no menu Iniciar."
if (-not $id) {
  Write-Host 'Aviso: não consegui ler a identidade da janela. O atalho abre o Tarja, mas na barra de tarefas a janela'
  Write-Host 'pode aparecer como Edge. Feche as janelas do Tarja e rode este arquivo de novo.'
}
Write-Host 'Para fixar na barra de tarefas: clique com o botão direito no atalho, depois em "Mostrar mais opções"'
Write-Host 'e em "Fixar na barra de tarefas".'
Write-Host 'Se mudar o arquivo do Tarja de pasta, rode este arquivo de novo na pasta nova.'
