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

use tauri::webview::{NewWindowResponse, WebviewWindowBuilder};
use tauri::{WebviewUrl, WindowEvent};

const SITE: &str = "https://github.com/HeraldoAntunes/tarja-livre/";
const WEBVIEW2: &str = "https://developer.microsoft.com/microsoft-edge/webview2/";
// Ao fechar, dispara na página o mesmo aviso de saída do navegador: a página o cancela quando há PDF sem salvar, e
// aí ela pergunta. O resultado volta para cá (true = pode fechar). O WebView2 não mostra o "Sair do site?" quando a
// janela fecha, por isso a pergunta é feita assim.
const PODE_FECHAR: &str = "(() => { const e = new Event('beforeunload', { cancelable: true }); dispatchEvent(e); \
    return !e.defaultPrevented || confirm('Há PDF aberto que ainda não foi salvo. Fechar mesmo assim?' + \
    (document.getElementById('guardarAndamento')?.checked ? ' As marcas ficam guardadas, e o Tarja Livre oferece \
recuperar quando o mesmo PDF for aberto de novo.' : ' O que não foi salvo se perde.')); })()";

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
    tauri::Builder::default()
        .setup(|app| {
            let alca = app.handle().clone();
            let janela = WebviewWindowBuilder::new(app, "principal", WebviewUrl::App("index.html".into()))
                .title("Tarja Livre")
                .inner_size(1400.0, 900.0)
                .min_inner_size(900.0, 600.0)
                .maximized(true)
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
                .build()?;
            janela.on_window_event({
                let j = janela.clone();
                move |e| {
                    if let WindowEvent::CloseRequested { api, .. } = e {
                        api.prevent_close();
                        let a = alca.clone();
                        let _ = j.eval_with_callback(PODE_FECHAR, move |r| {
                            // sem resposta (página travada ou com erro) também fecha: a pessoa pediu para fechar
                            if r != "false" {
                                a.exit(0);
                            }
                        });
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Tarja Livre");
}
