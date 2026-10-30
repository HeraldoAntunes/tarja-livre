// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Janela própria do Tarja Livre: o mesmo HTML montado (com OCR) dentro do WebView2, sem nenhuma ponte entre a página
// e este programa. A página continua com a CSP dela (connect-src 'none'); aqui o motor ainda recebe uma regra que faz
// nenhum endereço da internet resolver, a navegação fica presa ao próprio programa e só o endereço de versões do
// Tarja sai para o navegador padrão.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod instalacao;
mod orfao;

use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{WebviewUrl, WindowEvent};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;

const SITE: &str = "https://github.com/HeraldoAntunes/tarja-livre/";
const WEBVIEW2: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";
// Ao fechar, dispara na página o mesmo aviso de saída do navegador: a página o cancela quando há PDF sem salvar, e
// aí ela pergunta. O WebView2 não mostra o "Sair do site?" quando a janela fecha, por isso a pergunta é feita assim.
// Em dois passos: a consulta (rápida, com prazo: a página travada não responde) e, se há o que perder, a pergunta
// (sem prazo: a pessoa pode demorar para responder).
const PODE_FECHAR: &str = "(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); \
    return e.defaultPrevented ? 'perguntar' : 'livre'; })()";
const PERGUNTA_FECHAR: &str = "confirm('Há PDF aberto que ainda não foi salvo. Fechar mesmo assim?' + \
    (document.getElementById('guardarAndamento')?.checked ? ' As marcas ficam guardadas, e o Tarja Livre oferece \
recuperar quando o mesmo PDF for aberto de novo.' : ' O que não foi salvo se perde.'))";

// O que a página respondeu ao pedido de fechar. Só valem os valores que os dois scripts devolvem; resposta vazia,
// null ou qualquer outra coisa (a avaliação que falhou: o wry entrega texto vazio) fica com a pergunta do próprio exe,
// nunca fecha sem perguntar (auditoria da rc.1, N-C1).
#[derive(Debug, PartialEq)]
enum Resposta { Livre, Perguntar, Nenhuma }
fn resposta_de_fechar(r: &str) -> Resposta {
    match r.trim().trim_matches('"') {
        "livre" => Resposta::Livre,
        "perguntar" => Resposta::Perguntar,
        _ => Resposta::Nenhuma,
    }
}
fn resposta_da_confirmacao(r: &str) -> Option<bool> {
    match r.trim() {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

// A página não respondeu ao pedido de fechar (travada, ou a avaliação falhou): o exe pergunta numa caixa do Windows.
fn fechar_sem_pagina() -> bool {
    let texto = "O Tarja Livre não respondeu ao pedido de fechar (a página pode estar ocupada com um PDF grande).

Fechar mesmo assim? O que não foi salvo pode se perder; se \"Guardar o andamento\" estiver ligado, as marcas gravadas até agora são oferecidas de novo quando o mesmo PDF for aberto.";
    // 0x4 | 0x30 | 0x100: Sim/Não com alerta, "Não" já escolhido; 6 = Sim
    unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Tarja Livre").as_ptr(), 0x4 | 0x30 | 0x100) == 6 }
}

fn interno(url: &tauri::Url) -> bool {
    url.host_str() == Some("tauri.localhost") || url.scheme() == "tauri"
}

#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(hwnd: isize, texto: *const u16, titulo: *const u16, tipo: u32) -> i32;
}
#[link(name = "shell32")]
extern "system" {
    fn ShellExecuteW(hwnd: isize, op: *const u16, arq: *const u16, par: *const u16, pasta: *const u16, mostrar: i32) -> isize;
}
fn largo(t: &str) -> Vec<u16> {
    t.encode_utf16().chain([0]).collect()
}
// abre o endereço no navegador padrão, pelo próprio Windows
fn abrir_no_navegador(url: &str) {
    let (op, u) = (largo("open"), largo(url));
    unsafe { ShellExecuteW(0, op.as_ptr(), u.as_ptr(), std::ptr::null(), std::ptr::null(), 1) };
}

// Sem o WebView2 (Windows 10 antigo, sem atualização), explica e oferece a página da Microsoft.
fn sem_webview2() {
    let texto = format!("Esta janela do Tarja Livre precisa do Microsoft Edge WebView2, que já vem no Windows 11 e \
no Windows 10 atualizado, e ele não foi encontrado neste computador.\n\nSem ele, use o arquivo TarjaLivre-{v}.html, da \
mesma página de download: ele abre no navegador e faz o mesmo, também sem internet.\n\nAbrir a página da Microsoft \
para baixar o WebView2? (Precisa de internet.)", v = env!("CARGO_PKG_VERSION"));
    // 0x4 | 0x30: Sim/Não com alerta; 6 = Sim
    if unsafe { MessageBoxW(0, largo(&texto).as_ptr(), largo("Tarja Livre").as_ptr(), 0x4 | 0x30) } == 6 {
        abrir_no_navegador(WEBVIEW2);
    }
}

// Redução da conexão do WebView2 com a Microsoft (pesquisa da gestão, WEBVIEW2-REDE.md, 29/10/2026): com o perfil já
// registrado no "Local State", o processo principal do WebView2 conecta em segundos ao abrir; sem esse arquivo, isso
// não aconteceu em 5 de 5 aberturas. Reduz, mas não zera: o texto de privacidade continua dizendo que a conexão pode
// acontecer. Só este arquivo, só na pasta do próprio Tarja, e só se nenhum WebView2 estiver usando o perfil (o
// "lockfile" fica preso enquanto está): com outro aberto, o arquivo volta de qualquer jeito. Não é recurso documentado
// da Microsoft; o tests/conexoes_exe.ps1 fica na bateria.
fn pasta_do_perfil() -> Option<std::path::PathBuf> {
    let base = match std::env::var_os("WEBVIEW2_USER_DATA_FOLDER") {
        Some(p) => std::path::PathBuf::from(p),
        None => std::path::PathBuf::from(std::env::var_os("LOCALAPPDATA")?).join("br.tarjalivre.app"),
    };
    Some(base.join("EBWebView"))
}

fn sem_registro_do_perfil(perfil: &std::path::Path) -> bool {
    use std::os::windows::fs::OpenOptionsExt;
    let trava = perfil.join("lockfile");
    // a trava fica presa até o Local State sair: um WebView2 que abrisse no meio não acharia o perfil livre
    let _segura = if trava.exists() {
        match std::fs::OpenOptions::new().read(true).write(true).share_mode(0).open(&trava) {
            Ok(f) => Some(f),
            Err(_) => return false,   // outro WebView2 usa o perfil
        }
    } else {
        None
    };
    std::fs::remove_file(perfil.join("Local State")).is_ok()
}

fn criar_janela(app: &tauri::App) -> Result<tauri::WebviewWindow, String> {
    // só na compilação de teste: TARJA_TESTE_FALHAR_JANELA=n faz as n primeiras tentativas falharem como o WebView2
    // falha às vezes, para o tests/e2e_janela.ps1
    #[cfg(debug_assertions)]
    {
        static FEITAS: AtomicU8 = AtomicU8::new(0);
        let falhar: u8 = std::env::var("TARJA_TESTE_FALHAR_JANELA").ok().and_then(|v| v.parse().ok()).unwrap_or(0);
        if FEITAS.fetch_add(1, Ordering::SeqCst) < falhar {
            return Err("failed to create webview: WebView2 error 0x80070578 (falha forçada pelo teste)".into());
        }
    }
    WebviewWindowBuilder::new(app, "principal", WebviewUrl::App("index.html".into()))
        .title("Tarja Livre")
        .inner_size(1400.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .visible(false)
        // sem isto o Tauri toma o arrastar de arquivos e a página não recebe o PDF
        .disable_drag_drop_handler()
        // os três primeiros são o padrão do wry; o último faz nenhum endereço da internet resolver
        .additional_browser_args(
            "--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection --host-resolver-rules=\"MAP * ~NOTFOUND\"",
        )
        .on_navigation(interno)
        .on_new_window(|url, _| {
            if url.as_str().starts_with(SITE) {
                abrir_no_navegador(url.as_str());
            }
            NewWindowResponse::Deny
        })
        .build()
        .map_err(|e| e.to_string())
}

// cada tentativa que falhou, com a hora (só o detalhe técnico; a pessoa vê a mensagem em português)
fn anotar_falha_da_janela(falhas: &[String]) {
    anotar(&format!("tentativa {} de criar a janela falhou: {}", falhas.len(), falhas.last().map(String::as_str).unwrap_or("")));
}

// uma linha no janelas.log da pasta do Tarja (a do perfil do WebView2, um nível acima do EBWebView), com a hora e a
// versão
fn anotar(texto: &str) {
    let Some(pasta) = pasta_do_perfil().and_then(|p| p.parent().map(|q| q.to_path_buf())) else { return };
    let segundos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
    let linha = format!("{segundos} (segundos desde 1970) versão {}: {texto}\n", env!("CARGO_PKG_VERSION"));
    let _ = std::fs::create_dir_all(&pasta);
    let _ = std::fs::OpenOptions::new().create(true).append(true).open(pasta.join("janelas.log"))
        .and_then(|mut f| std::io::Write::write_all(&mut f, linha.as_bytes()));
}

fn main() {
    instalacao::marcar_programa();
    // a pasta de trabalho fica fora da pasta do programa: assim a desinstalação consegue apagá-la com a janela aberta
    let _ = std::env::set_current_dir(std::env::temp_dir());
    instalacao::comandos();
    if tauri::webview_version().is_err() {
        sem_webview2();
        return;
    }
    if let instalacao::Seguir::Sair = instalacao::ao_abrir() {
        return;
    }
    if let Some(perfil) = pasta_do_perfil() {
        // depois de uma queda, o WebView2 da vez anterior pode ter ficado órfão segurando o perfil (orfao.rs); ele sai
        // antes, para o perfil ficar livre
        let (orfaos, falhas) = orfao::encerrar_webview2_orfao(&perfil);
        if orfaos > 0 {
            anotar(&format!("WebView2 órfão de uma queda anterior encerrado ({orfaos})"));
        }
        if falhas > 0 {
            anotar(&format!("WebView2 órfão de uma queda anterior não saiu ({falhas})"));
        }
        sem_registro_do_perfil(&perfil);
    }
    tauri::Builder::default()
        .setup(|app| {
            let alca = app.handle().clone();
            // O WebView2 às vezes falha ao criar a janela (0x80070578, "identificador da janela inválido"), por exemplo
            // com outro programa abrindo e fechando janelas ao mesmo tempo (achado do Giz Livre e do Giz na Tela,
            // 29/10/2026). A janela nasce invisível e só aparece pronta; se a criação falhar, tenta de novo (até 3
            // vezes) e, se não der, explica em português e fecha. O detalhe técnico vai para janelas.log, na pasta do
            // Tarja.
            let mut falhas: Vec<String> = Vec::new();
            let janela = loop {
                match criar_janela(app) {
                    Ok(j) => break j,
                    Err(e) => {
                        if let Some(w) = tauri::Manager::get_webview_window(app, "principal") { let _ = w.destroy(); }
                        falhas.push(e);
                        anotar_falha_da_janela(&falhas);
                        if falhas.len() >= 3 {
                            if std::env::var_os("TARJA_TESTE_FALHAR_JANELA").is_none() {
                                let texto = "O Tarja Livre não conseguiu abrir a janela dele agora.\n\nEspere alguns \
segundos e abra o Tarja Livre de novo. Se continuar, feche os outros programas abertos ou reinicie o computador.";
                                unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Tarja Livre").as_ptr(), 0x30) };
                            }
                            std::process::exit(1);
                        }
                        std::thread::sleep(std::time::Duration::from_millis(800 * falhas.len() as u64));
                    }
                }
            };
            janela.on_window_event({
                let j = janela.clone();
                move |e| {
                    if let WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        // quem responde primeiro decide: a página (0 → 1) ou, se ela não responder em 3 s ou a
                        // avaliação falhar, a pergunta do próprio exe (0 → 2) (auditoria de 29/10/2026, rodada 2)
                        let vez = Arc::new(AtomicU8::new(0));
                        let a = alca.clone();
                        let v = vez.clone();
                        let j2 = j.clone();
                        let pedido = j.eval_with_callback(PODE_FECHAR, move |r| {
                            if v.compare_exchange(0, 1, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                                return;
                            }
                            match resposta_de_fechar(&r) {
                                Resposta::Livre => {
                                    a.exit(0);
                                    return;
                                }
                                Resposta::Nenhuma => {
                                    if fechar_sem_pagina() { a.exit(0); }
                                    return;
                                }
                                Resposta::Perguntar => {}
                            }
                            let a2 = a.clone();
                            // se até a pergunta falhar, o exe pergunta: a pessoa pediu para fechar
                            let feita = j2.eval_with_callback(PERGUNTA_FECHAR, move |r| {
                                match resposta_da_confirmacao(&r) {
                                    Some(true) => a2.exit(0),
                                    Some(false) => {}
                                    None => if fechar_sem_pagina() { a2.exit(0) },
                                }
                            });
                            if feita.is_err() && fechar_sem_pagina() {
                                a.exit(0);
                            }
                        });
                        let a = alca.clone();
                        let espera = if pedido.is_err() { 0 } else { 3 };
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_secs(espera));
                            if vez.compare_exchange(0, 2, Ordering::SeqCst, Ordering::SeqCst).is_ok() && fechar_sem_pagina() {
                                a.exit(0);
                            }
                        });
                    }
                }
            });
            let _ = janela.maximize();
            let _ = janela.show();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Tarja Livre");
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::os::windows::fs::OpenOptionsExt;

    // auditoria da rc.1, N-C1: antes, qualquer resposta sem "perguntar" fechava (inclusive a vazia, que o wry entrega
    // quando a avaliação falha) e qualquer confirmação diferente de "false" também
    #[test]
    fn fechar_so_com_resposta_conhecida() {
        assert_eq!(resposta_de_fechar("\"livre\""), Resposta::Livre);
        assert_eq!(resposta_de_fechar("\"perguntar\""), Resposta::Perguntar);
        for r in ["", "null", "undefined", "\"\"", "{}", "\"livre agora\"", "erro"] {
            assert_eq!(resposta_de_fechar(r), Resposta::Nenhuma, "{r:?} não pode fechar sem perguntar");
        }
        assert_eq!(resposta_da_confirmacao("true"), Some(true));
        assert_eq!(resposta_da_confirmacao("false"), Some(false));
        for r in ["", "null", "undefined", "\"true\"", "1"] {
            assert_eq!(resposta_da_confirmacao(r), None, "{r:?} não é um Sim");
        }
    }

    #[test]
    fn local_state_so_sai_com_o_perfil_livre() {
        let perfil = std::env::temp_dir().join(format!("tarja-teste-perfil-{}", std::process::id())).join("EBWebView");
        std::fs::create_dir_all(perfil.join("Default")).unwrap();
        std::fs::write(perfil.join("Default").join("Preferences"), b"{}").unwrap();
        // sem ninguém usando: sai só o Local State
        std::fs::write(perfil.join("Local State"), b"{}").unwrap();
        assert!(sem_registro_do_perfil(&perfil));
        assert!(!perfil.join("Local State").exists() && perfil.join("Default").join("Preferences").exists());
        // perfil em uso (lockfile preso, como faz o WebView2 aberto): fica
        std::fs::write(perfil.join("Local State"), b"{}").unwrap();
        let preso = std::fs::OpenOptions::new().create(true).read(true).write(true).share_mode(0)
            .open(perfil.join("lockfile")).unwrap();
        assert!(!sem_registro_do_perfil(&perfil));
        assert!(perfil.join("Local State").exists());
        drop(preso);
        // o lockfile solto (sobra de uma queda): pode sair
        assert!(sem_registro_do_perfil(&perfil));
        // sem o arquivo: nada acontece, sem erro
        assert!(!sem_registro_do_perfil(&perfil));
        let _ = std::fs::remove_dir_all(perfil.parent().unwrap());
    }
}
