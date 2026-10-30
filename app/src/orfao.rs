// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// WebView2 órfão (achado do Bancada e do Giz na Tela, 29/10/2026, modelo: Bancada Livre, sistema.rs): depois de uma
// queda do Tarja Livre (fechado à força, energia, travamento), o processo principal do WebView2 que ele abriu pode
// ficar vivo, órfão, segurando o perfil até o logoff; a próxima abertura não consegue criar a janela (0xc0000409 ou
// 0x80070578). Ao abrir, o programa encerra só esses processos: msedgewebview2.exe, processo principal (sem --type),
// com o perfil exato do Tarja na linha de comando e com o pai já morto. Nada de outro programa é tocado, nem o
// WebView2 de outra janela do Tarja aberta (o pai dela está vivo).

#[link(name = "kernel32")]
extern "system" {
    fn CreateToolhelp32Snapshot(flags: u32, pid: u32) -> isize;
    fn Process32FirstW(h: isize, e: *mut EntradaDeProcesso) -> i32;
    fn Process32NextW(h: isize, e: *mut EntradaDeProcesso) -> i32;
    fn OpenProcess(acesso: u32, herdar: i32, pid: u32) -> isize;
    fn TerminateProcess(h: isize, codigo: u32) -> i32;
    fn WaitForSingleObject(h: isize, ms: u32) -> u32;
    fn CloseHandle(h: isize) -> i32;
    fn GetLastError() -> u32;
}
#[link(name = "ntdll")]
extern "system" {
    fn NtQueryInformationProcess(h: isize, classe: u32, dados: *mut u8, tam: u32, devolvido: *mut u32) -> i32;
}
#[repr(C)]
struct EntradaDeProcesso {
    tam: u32, uso: u32, pid: u32, heap: usize, modulo: u32, threads: u32, pai: u32, prioridade: i32, flags: u32,
    nome: [u16; 260],
}

// O pai só conta como morto quando o Windows diz que esse processo não existe mais (ERROR_INVALID_PARAMETER). Sem
// acesso ou qualquer outra falha na consulta conta como vivo: na dúvida, nada é encerrado (auditoria da rc.1).
fn processo_vivo(pid: u32) -> bool {
    unsafe {
        let h = OpenProcess(0x0010_0000, 0, pid);      // SYNCHRONIZE
        if h == 0 { return GetLastError() != 87; }
        let vivo = WaitForSingleObject(h, 0) != 0;      // WAIT_OBJECT_0: terminou; WAIT_TIMEOUT ou falha: vivo
        CloseHandle(h);
        vivo
    }
}

// ProcessCommandLineInformation (60): um UNICODE_STRING (tamanho em bytes, espaço, e o endereço do texto, alinhado ao
// tamanho do ponteiro) seguido do texto, no próprio buffer. O endereço é conferido: tem de cair dentro do que o
// Windows devolveu, senão a linha não é lida.
fn linha_de_comando(h: isize) -> Option<String> {
    let mut buf = vec![0u8; 65536];
    let mut devolvido = 0u32;
    if unsafe { NtQueryInformationProcess(h, 60, buf.as_mut_ptr(), buf.len() as u32, &mut devolvido) } < 0 { return None; }
    let p = std::mem::size_of::<usize>();
    let fim = (devolvido as usize).min(buf.len());
    if fim < 2 * p { return None; }
    let bytes = u16::from_le_bytes([buf[0], buf[1]]) as usize;
    let endereco = usize::from_le_bytes(buf[p..2 * p].try_into().ok()?);
    let ini = endereco.checked_sub(buf.as_ptr() as usize)?;
    if ini < 2 * p || bytes % 2 != 0 || ini.checked_add(bytes)? > fim { return None; }
    let texto: Vec<u16> = buf[ini..ini + bytes].chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
    Some(String::from_utf16_lossy(&texto))
}

/// Encerra os processos principais do WebView2 órfãos deste perfil (a pasta EBWebView). Devolve quantos saíram de
/// fato (TerminateProcess aceito e o processo terminado em 3 s) e quantos não saíram.
pub fn encerrar_webview2_orfao(perfil: &std::path::Path) -> (usize, usize) {
    let marca = format!("--user-data-dir=\"{}\"", perfil.display()).to_lowercase();
    let mut encerrados = 0;
    let mut falhas = 0;
    unsafe {
        let foto = CreateToolhelp32Snapshot(0x2, 0);    // TH32CS_SNAPPROCESS
        if foto == -1 { return (0, 0); }
        let mut e: EntradaDeProcesso = std::mem::zeroed();
        e.tam = std::mem::size_of::<EntradaDeProcesso>() as u32;
        let mut tem = Process32FirstW(foto, &mut e) != 0;
        while tem {
            let fim = e.nome.iter().position(|&c| c == 0).unwrap_or(e.nome.len());
            let nome = String::from_utf16_lossy(&e.nome[..fim]).to_lowercase();
            if nome == "msedgewebview2.exe" && !processo_vivo(e.pai) {
                let h = OpenProcess(0x1000 | 0x0001 | 0x0010_0000, 0, e.pid);   // consulta, encerrar, esperar
                if h != 0 {
                    let cmd = linha_de_comando(h).unwrap_or_default().to_lowercase();
                    if cmd.contains(&marca) && !cmd.contains("--type=") {
                        if TerminateProcess(h, 1) != 0 && WaitForSingleObject(h, 3000) == 0 {
                            encerrados += 1;
                        } else {
                            falhas += 1;
                        }
                    }
                    CloseHandle(h);
                }
            }
            tem = Process32NextW(foto, &mut e) != 0;
        }
        CloseHandle(foto);
    }
    (encerrados, falhas)
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::os::windows::process::CommandExt;
    use std::path::{Path, PathBuf};

    // PIDs dos processos msedgewebview2.exe cuja linha de comando tem o texto
    fn pids_com(texto: &str) -> Vec<u32> {
        let mut achados = Vec::new();
        unsafe {
            let foto = CreateToolhelp32Snapshot(0x2, 0);
            let mut e: EntradaDeProcesso = std::mem::zeroed();
            e.tam = std::mem::size_of::<EntradaDeProcesso>() as u32;
            let mut tem = Process32FirstW(foto, &mut e) != 0;
            while tem {
                let fim = e.nome.iter().position(|&c| c == 0).unwrap_or(e.nome.len());
                if String::from_utf16_lossy(&e.nome[..fim]).eq_ignore_ascii_case("msedgewebview2.exe") {
                    let h = OpenProcess(0x1000, 0, e.pid);
                    if h != 0 {
                        if linha_de_comando(h).unwrap_or_default().contains(texto) { achados.push(e.pid); }
                        CloseHandle(h);
                    }
                }
                tem = Process32NextW(foto, &mut e) != 0;
            }
            CloseHandle(foto);
        }
        achados
    }

    // um "WebView2" de mentira: cópia do cmd.exe com o nome msedgewebview2.exe, que espera uns segundos com o perfil e
    // uma etiqueta na linha de comando. Com pai morto: aberto por um cmd que sai na hora (start).
    fn falso(exe: &Path, perfil: &Path, etiqueta: &str, pai_morto: bool) -> Option<std::process::Child> {
        let linha = format!(r#"/d /c ping -n 20 127.0.0.1 >nul & rem --user-data-dir="{}" {etiqueta}"#, perfil.display());
        if pai_morto {
            // o & e o > são do cmd de dentro: escapados para o de fora não os usar
            let dentro = linha.replace('&', "^&").replace('>', "^>");
            std::process::Command::new("cmd").raw_arg(format!(r#"/d /c start "" /b "{}" {dentro}"#, exe.display()))
                .stdout(std::process::Stdio::null()).status().unwrap();
            None
        } else {
            Some(std::process::Command::new(exe).raw_arg(linha).stdout(std::process::Stdio::null()).spawn().unwrap())
        }
    }

    fn esperar_pids(etiqueta: &str) -> Vec<u32> {
        for _ in 0..40 {
            let p = pids_com(etiqueta);
            if !p.is_empty() { return p; }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
        Vec::new()
    }

    // auditoria da rc.1: o encerramento de órfãos nunca tinha sido exercitado com um órfão de verdade
    #[test]
    fn encerra_so_o_orfao_do_perfil() {
        let base: PathBuf = std::env::temp_dir().join(format!("tarja-teste-orfao-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        let exe = base.join("msedgewebview2.exe");
        let cmd = Path::new(&std::env::var("SystemRoot").unwrap()).join("System32").join("cmd.exe");
        std::fs::copy(&cmd, &exe).unwrap();
        let perfil = base.join("Tarja").join("EBWebView");
        let outro = base.join("Outro").join("EBWebView");
        let id = std::process::id();
        falso(&exe, &perfil, &format!("etq-orfao-{id}"), true);
        let mut vivo = falso(&exe, &perfil, &format!("etq-pai-vivo-{id}"), false).unwrap();
        falso(&exe, &outro, &format!("etq-outro-perfil-{id}"), true);
        let orfao = esperar_pids(&format!("etq-orfao-{id}"));
        assert_eq!(orfao.len(), 1, "o órfão de mentira abriu");
        assert_eq!(esperar_pids(&format!("etq-pai-vivo-{id}")).len(), 1);
        assert_eq!(esperar_pids(&format!("etq-outro-perfil-{id}")).len(), 1);

        assert_eq!(encerrar_webview2_orfao(&perfil), (1, 0), "um encerrado, confirmado, nenhuma falha");
        assert!(pids_com(&format!("etq-orfao-{id}")).is_empty(), "o órfão do perfil saiu");
        assert_eq!(pids_com(&format!("etq-pai-vivo-{id}")).len(), 1, "o do mesmo perfil com o pai vivo ficou");
        assert_eq!(pids_com(&format!("etq-outro-perfil-{id}")).len(), 1, "o de outro perfil ficou");

        // limpeza: só os de mentira deste teste
        let _ = vivo.kill();
        let _ = vivo.wait();
        for pid in pids_com(&format!("etq-outro-perfil-{id}")) {
            unsafe {
                let h = OpenProcess(0x0001 | 0x0010_0000, 0, pid);
                if h != 0 { TerminateProcess(h, 1); WaitForSingleObject(h, 3000); CloseHandle(h); }
            }
        }
        let _ = std::fs::remove_dir_all(&base);
    }
}
