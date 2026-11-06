# Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
# SPDX-FileCopyrightText: 2026 Heraldo Antunes
# SPDX-License-Identifier: MIT
# Arrasto de verdade do Windows (OLE), como o do Explorador: uma janelinha .NET começa um DoDragDrop de um PDF
# (FileDrop) e o mouse, movido pelo SendInput, leva o arquivo até o ponto (X, Y) da tela e solta. É o caminho que o
# e2e pela porta de depuração não passa (ele entrega o arquivo direto à página). Só para a VM de testes: mexe no
# mouse do convidado. Sai escrevendo o efeito do arrasto (Copy, Move, None...).
# ATENÇÃO (05/11/2026): no notebook de testes (Windows 10 real), este arrasto simulado por SendInput começou o
# DoDragDrop e soltou o botão em cima da janela, mas o DoDragDrop não terminou nem no Edge com o HTML (o controle):
# o método ainda não é confiável e o resultado dele não vale como prova, nem para passar nem para falhar.
# Uso: arrastar_ole.ps1 -Pdf <arquivo.pdf> -X <px> -Y <px>
param([Parameter(Mandatory)][string]$Pdf, [Parameter(Mandatory)][int]$X, [Parameter(Mandatory)][int]$Y)
$ErrorActionPreference = 'Stop'
if ((Get-CimInstance Win32_ComputerSystem).Model -ne 'VirtualBox') { throw 'Teste permitido somente dentro da VM VirtualBox.' }
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Collections.Specialized;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
public static class ArrastoOle {
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint data, flags, time; public IntPtr extra; }
  // 40 bytes em 64 bits: a união do INPUT tem o tamanho do MOUSEINPUT (com mais campos, o SendInput dá erro 87)
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public MOUSEINPUT mi; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int i);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, int[] r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  const uint MOVE = 0x0001, DOWN = 0x0002, UP = 0x0004, ABS = 0x8000;
  public static System.Collections.Generic.List<string> Passos = new System.Collections.Generic.List<string>();
  public static string Registro = null;
  static void Anotar(string s) { var l = DateTime.Now.ToString("HH:mm:ss.fff") + " " + s; lock (Passos) { Passos.Add(l); if (Registro != null) System.IO.File.AppendAllText(Registro, l + Environment.NewLine); } }
  static void Mouse(uint flags, int x, int y) {
    var i = new INPUT { type = 0, mi = new MOUSEINPUT { dx = x * 65535 / (GetSystemMetrics(0) - 1), dy = y * 65535 / (GetSystemMetrics(1) - 1), flags = flags | ABS | MOVE } };
    var n = SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT)));
    if (n == 0) Anotar("SendInput recusado, erro " + Marshal.GetLastWin32Error());
  }
  // Arrasta o arquivo de uma janelinha .NET até (alvoX, alvoY) e solta. O DoDragDrop roda na janelinha; o mouse anda
  // numa thread à parte, porque o laço do DoDragDrop não deixa os relógios da janela dispararem. A thread solta o
  // botão no fim de qualquer jeito, para o mouse nunca ficar preso.
  public static string Arrastar(string pdf, int alvoX, int alvoY) {
    string efeito = "não começou";
    var f = new Form { Text = "Arrasto OLE (teste)", StartPosition = FormStartPosition.Manual, Left = 20, Top = 20, Width = 220, Height = 120, TopMost = true };
    f.Shown += (s, e) => {
      var c = f.PointToScreen(new System.Drawing.Point(f.ClientSize.Width / 2, f.ClientSize.Height / 2));
      var t = new Thread(() => {
        try {
          Thread.Sleep(1200);
          Mouse(0, c.X, c.Y); Thread.Sleep(300);
          Mouse(DOWN, c.X, c.Y); Anotar("botão apertado em " + c.X + "," + c.Y);
          Thread.Sleep(150);
          f.BeginInvoke((Action)(() => {
            var d = new DataObject();
            var lista = new StringCollection(); lista.Add(pdf);
            d.SetFileDropList(lista);
            Anotar("DoDragDrop começa");
            efeito = f.DoDragDrop(d, DragDropEffects.Copy).ToString();
            Anotar("DoDragDrop voltou: " + efeito);
            f.Close();
          }));
          Thread.Sleep(500);
          for (int k = 1; k <= 15; k++) { Mouse(0, c.X + (alvoX - c.X) * k / 15, c.Y + (alvoY - c.Y) * k / 15); Thread.Sleep(100); }
          Thread.Sleep(400);
          Mouse(UP, alvoX, alvoY); Anotar("botão solto em " + alvoX + "," + alvoY);
          Thread.Sleep(5000);
          if (!f.IsDisposed) f.BeginInvoke((Action)(() => { if (efeito == "não começou") efeito = "não voltou"; f.Close(); }));
        } catch (Exception ex) {
          Anotar("erro: " + ex.Message);
          Mouse(UP, alvoX, alvoY);
        }
      });
      t.IsBackground = true;
      t.Start();
    };
    Application.Run(f);
    return efeito;
  }
}
'@
[ArrastoOle]::Arrastar((Resolve-Path $Pdf).Path, $X, $Y)
