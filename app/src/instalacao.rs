// Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE)
// SPDX-FileCopyrightText: 2026 Heraldo Antunes
// SPDX-License-Identifier: MIT
//
// Instalação sem instalador (modelo: Bancada Livre): o próprio TarjaLivre.exe se copia para a pasta de programas da
// conta, cria os atalhos (com o mesmo AppUserModelID da janela) e se registra em Aplicativos instalados, dentro de
// HKCU. Não pede administrador e não toca fora da conta do usuário.
// Uso: aberto de fora da pasta de instalação, pergunta se instala; `--instalar` instala em silêncio (testes e CI);
// `--sem-instalar` só usa, sem perguntar (pendrive, testes);
// `--desinstalar` (chamado por Aplicativos instalados) remove o programa e pergunta se apaga também o que o Tarja
// guardou; `--desinstalar --silencioso` remove sem perguntar e deixa o guardado.
use crate::largo;
use std::ffi::c_void;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub const VERSAO: &str = env!("CARGO_PKG_VERSION");
pub const CHAVE: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\TarjaLivre";
/// Mesmo AppUserModelID da janela (main.rs): fixado na barra de tarefas, fica o Tarja Livre com o ícone dele.
pub const APP_ID: &str = "HeraldoAntunes.TarjaLivre";
const ATALHO: &str = "Tarja Livre.lnk";
const EXE: &str = "TarjaLivre.exe";
/// Pasta do WebView2 e do que a página guarda (escolhas, lista de nomes, andamento): o identificador do tauri.conf.json.
const DADOS: &str = "br.tarjalivre.app";

// arquivos que vão junto: as licenças e o guia
const ARQUIVOS: [(&str, &[u8]); 3] = [
    ("LICENSE", include_bytes!("../../LICENSE")),
    ("THIRD-PARTY-NOTICES.md", include_bytes!("../../THIRD-PARTY-NOTICES.md")),
    ("README.md", include_bytes!("../../README.md")),
];

/// Onde a instalação fica. Os testes usam pastas e chave próprias.
pub struct Destino {
    pub programa: PathBuf,
    pub menu: PathBuf,
    pub area: PathBuf,
    pub dados: PathBuf,
    pub chave: String,
    /// para onde vai o exe que não pode ser apagado (aberto), na ordem: a pasta temporária e, se ela estiver em outro
    /// disco (o Windows não move entre discos), uma pasta ao lado da do programa
    pub sobras: Vec<PathBuf>,
    /// quantas vezes tentar tirar o exe do lugar, de 0,25 s em 0,25 s
    pub tentativas: u32,
}

impl Destino {
    pub fn da_conta() -> Option<Destino> {
        let local = std::env::var_os("LOCALAPPDATA").map(PathBuf::from)?;
        Some(Destino {
            programa: local.join("Programs").join("Tarja Livre"),
            menu: pasta_conhecida(&FOLDERID_PROGRAMS)?,
            area: pasta_conhecida(&FOLDERID_DESKTOP)?,
            dados: local.join(DADOS),
            chave: CHAVE.to_string(),
            sobras: vec![std::env::temp_dir(), local.join("Programs").join(PASTA_SOBRAS)],
            tentativas: 40,
        })
    }
    fn exe(&self) -> PathBuf { self.programa.join(EXE) }
}

pub enum Seguir { Abrir, Sair }

/// `--instalar` e `--desinstalar`: fazem o trabalho (em silêncio ou com as perguntas da desinstalação) e encerram.
pub fn comandos() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let tem = |a: &str| args.iter().any(|x| x == a);
    if !tem("--instalar") && !tem("--desinstalar") { return; }
    let (Ok(atual), Some(destino)) = (std::env::current_exe(), Destino::da_conta()) else { std::process::exit(1) };
    let r = if tem("--instalar") { instalar(&destino, &atual) } else { desinstalar(&destino, &atual, tem("--silencioso")) };
    std::process::exit(if r.is_ok() { 0 } else { 1 });
}

/// Aberto de fora da pasta de instalação, pergunta se instala (ou atualiza). `Sair`: a cópia instalada foi aberta
/// ou a pessoa cancelou.
pub fn ao_abrir() -> Seguir {
    if std::env::args().any(|a| a == "--sem-instalar") { return Seguir::Abrir; }
    let Ok(atual) = std::env::current_exe() else { return Seguir::Abrir };
    let Some(destino) = Destino::da_conta() else { return Seguir::Abrir };
    limpar_sobras(&destino);
    if mesmo_arquivo(&atual, &destino.exe()) { return Seguir::Abrir; }
    let instalada = ler_texto(HKCU, &destino.chave, "DisplayVersion");
    let pergunta = match instalada.as_deref() {
        None => format!("Instalar o Tarja Livre {VERSAO} neste computador?\n\nSim: instala só para a sua conta (não \
            pede administrador), cria os atalhos no menu Iniciar e na Área de Trabalho e abre o programa.\nNão: só usa \
            agora, sem instalar.\nCancelar: fecha."),
        Some(v) if mais_nova(VERSAO, v) => format!("Atualizar o Tarja Livre da versão {v} para a {VERSAO}?\n\nAs \
            escolhas e o andamento guardados continuam.\n\nSim: atualiza e abre o programa.\nNão: só usa esta versão \
            agora, sem instalar.\nCancelar: fecha."),
        // a mesma versão ou uma mais nova já instalada: só abre esta cópia
        Some(_) => return Seguir::Abrir,
    };
    match perguntar(&pergunta, 0x3 | 0x20) {       // Sim/Não/Cancelar, pergunta
        6 => match instalar(&destino, &atual) {
            Ok(()) => {
                if std::process::Command::new(destino.exe()).spawn().is_ok() {
                    return Seguir::Sair;
                }
                Seguir::Abrir
            }
            Err(e) => {
                perguntar(&format!("Não foi possível instalar o Tarja Livre.\n\n{e}\n\nO programa vai abrir assim \
                    mesmo, sem instalar."), 0x10);
                Seguir::Abrir
            }
        },
        7 => Seguir::Abrir,
        _ => Seguir::Sair,
    }
}

/// "1.2.1" é mais nova que "1.2.0". Versão que não se entende conta como antiga (vale atualizar por cima).
pub fn mais_nova(esta: &str, outra: &str) -> bool {
    let partes = |v: &str| -> Option<Vec<u32>> { v.trim().split('.').map(|p| p.parse().ok()).collect() };
    match (partes(esta), partes(outra)) {
        (Some(a), Some(b)) => a > b,
        (Some(_), None) => true,
        _ => false,
    }
}

fn mesmo_arquivo(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(x), Ok(y)) => x.to_string_lossy().eq_ignore_ascii_case(&y.to_string_lossy()),
        _ => false,
    }
}

pub fn instalar(destino: &Destino, origem: &Path) -> io::Result<()> {
    let atualizacao = ler_texto(HKCU, &destino.chave, "DisplayVersion").is_some();
    fs::create_dir_all(&destino.programa)?;
    // o programa: copia para um nome provisório e só então troca. Se a versão antiga estiver aberta, o Windows não
    // deixa apagá-la, mas deixa movê-la: ela vai para a pasta temporária e segue aberta até ser fechada.
    let exe = destino.exe();
    if !mesmo_arquivo(origem, &exe) {
        let novo = destino.programa.join(format!("{EXE}.novo"));
        fs::copy(origem, &novo)?;
        // o antigo vai para um nome de reserva na mesma pasta (o Windows deixa renomear até o exe aberto) e só sai
        // depois que o novo está confirmado no lugar; se a troca falhar, a reserva volta e a instalação continua
        // inteira (auditoria da rc.1, N-C2). Sempre fica ao menos uma cópia que abre (auditoria da rc.2, N-R1).
        let reserva = destino.programa.join(format!("{EXE}.antigo"));
        // recuperação pendente: uma troca anterior parou com o exe fora do lugar e só a reserva. Ela volta antes de
        // tudo; nunca é apagada nesse estado.
        if !exe.exists() && reserva.exists() {
            if let Err(e) = restaurar(&reserva, &exe) {
                let _ = fs::remove_file(&novo);
                return Err(sem_volta(e, &reserva));
            }
        }
        // com o exe no lugar, uma reserva que sobrou de antes é só sobra
        if reserva.exists() { let _ = tirar_do_caminho(&reserva, destino); }
        let tinha = exe.exists();
        if tinha {
            if let Err(e) = mover_com_tentativas(&exe, &reserva, destino.tentativas) {
                let _ = fs::remove_file(&novo);
                return Err(e);
            }
        }
        let tamanho = fs::metadata(&novo).map(|m| m.len())?;
        let trocou = promover(&novo, &exe)
            .and_then(|()| if fs::metadata(&exe).map(|m| m.len()).ok() == Some(tamanho) { Ok(()) }
                           else { Err(io::Error::other("o programa novo não ficou inteiro no lugar")) });
        if let Err(e) = trocou {
            let _ = fs::remove_file(&novo);
            if tinha {
                let _ = fs::remove_file(&exe);   // o que entrou pela metade
                if let Err(v) = restaurar(&reserva, &exe) {
                    return Err(sem_volta(io::Error::other(format!("{e}; e a volta do anterior também falhou: {v}")), &reserva));
                }
            }
            return Err(e);
        }
        if tinha { let _ = tirar_do_caminho(&reserva, destino); }
    }
    for (nome, dados) in ARQUIVOS {
        fs::write(destino.programa.join(nome), dados)?;
    }
    // atalhos: o do menu Iniciar sempre; o da Área de Trabalho na instalação nova, ou na atualização se já existia
    let area = destino.area.join(ATALHO);
    let com_area = !atualizacao || area.exists();
    {
        let _com = Com::iniciar();
        criar_atalho(&destino.menu.join(ATALHO), &exe, &destino.programa)?;
        if com_area { criar_atalho(&area, &exe, &destino.programa)?; }
    }
    registrar(destino, &exe)?;
    unsafe { SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null()) };   // SHCNE_ASSOCCHANGED: refaz ícones
    Ok(())
}

pub fn desinstalar(destino: &Destino, atual: &Path, silencioso: bool) -> io::Result<()> {
    let apagar_dados = if silencioso {
        false
    } else {
        // Sim/Não/Cancelar: Cancelar não remove nada
        match perguntar("Remover o Tarja Livre deste computador?\n\nApagar também o que ele guardou aqui (escolhas, \
            lista de nomes, se foi guardada, e o andamento)? Em computador dividido com outros professores, escolha \
            Sim.\n\nSim: remove e apaga tudo.\nNão: remove o programa e deixa o guardado.\nCancelar: não remove.",
            0x3 | 0x20) {
            6 => true,
            7 => false,
            _ => return Ok(()),
        }
    };
    // primeiro o exe, que é o que pode falhar (o antivírus segura por instantes o exe recém-aberto): se não sair do
    // lugar, nada mais é mexido e a instalação continua inteira (auditoria de 29/10/2026, rodada 2)
    let _ = atual;
    if let Err(e) = tirar_do_caminho(&destino.exe(), destino) {
        if !silencioso {
            perguntar(&format!("Não foi possível remover o Tarja Livre agora: o arquivo do programa está em uso. Nada \
                foi mexido. Feche o Tarja Livre, espere alguns segundos e tente de novo.\n\n({e})"), 0x10);
        }
        return Err(e);
    }
    for p in [destino.menu.join(ATALHO), destino.area.join(ATALHO)] {
        let _ = fs::remove_file(p);
    }
    apagar_chave(HKCU, &destino.chave);
    for (nome, _) in ARQUIVOS { let _ = fs::remove_file(destino.programa.join(nome)); }
    let _ = fs::remove_file(destino.programa.join(format!("{EXE}.novo")));
    let _ = tirar_do_caminho(&destino.programa.join(format!("{EXE}.antigo")), destino);
    // só some se ficou vazia: nada que o usuário tenha posto lá é apagado
    let _ = fs::remove_dir(&destino.programa);
    // a pasta de dados é só do Tarja (o WebView2 dele e o que a página guardou)
    let dados_ficaram = apagar_dados && fs::remove_dir_all(&destino.dados).is_err() && destino.dados.exists();
    unsafe { SHChangeNotify(0x0800_0000, 0, std::ptr::null(), std::ptr::null()) };
    if !silencioso {
        let fim = if dados_ficaram {
            format!("O Tarja Livre foi removido, mas não foi possível apagar a pasta {}. Feche o Tarja Livre e apague \
                essa pasta à mão.", destino.dados.display())
        } else if apagar_dados {
            "O Tarja Livre foi removido, e o que ele guardou foi apagado.".to_string()
        } else {
            "O Tarja Livre foi removido. As escolhas e o andamento continuam guardados.".to_string()
        };
        perguntar(&fim, 0x40);
    }
    Ok(())
}

// cópias antigas do programa, movidas por uma atualização ou desinstalação com ele aberto
const PREFIXO_SOBRA: &str = "TarjaLivre-antigo-";
const PASTA_SOBRAS: &str = "Tarja Livre (cópias antigas, pode apagar)";

fn nome_de_sobra() -> String {
    let n = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{PREFIXO_SOBRA}{}-{n}.exe", std::process::id())
}

// nos testes, a troca do exe novo pelo nome instalado pode falhar de propósito
#[cfg(test)]
thread_local! { static FALHAR_TROCA: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }

fn promover(novo: &Path, exe: &Path) -> io::Result<()> {
    #[cfg(test)]
    if FALHAR_TROCA.with(|f| f.get()) { return Err(io::Error::from(io::ErrorKind::PermissionDenied)); }
    fs::rename(novo, exe)
}

// nos testes, a volta da reserva também pode falhar de propósito
#[cfg(test)]
thread_local! { static FALHAR_VOLTA: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }

fn restaurar(reserva: &Path, exe: &Path) -> io::Result<()> {
    #[cfg(test)]
    if FALHAR_VOLTA.with(|f| f.get()) { return Err(io::Error::from(io::ErrorKind::PermissionDenied)); }
    fs::rename(reserva, exe)
}

// erro de quando a cópia anterior não voltou ao lugar: diz onde ela está, para a pessoa (ou o suporte) recuperar
fn sem_volta(e: io::Error, reserva: &Path) -> io::Error {
    io::Error::other(format!("{e}. O programa anterior continua guardado em {}: renomeie para {EXE} para usar de \
        novo.", reserva.display()))
}

/// Renomeia com novas tentativas, de 0,25 s em 0,25 s (o antivírus segura por instantes o exe recém-aberto).
fn mover_com_tentativas(de: &Path, para: &Path, tentativas: u32) -> io::Result<()> {
    let mut ultimo = io::Error::other("não tentou");
    for vez in 0..tentativas.max(1) {
        match fs::rename(de, para) {
            Ok(()) => return Ok(()),
            Err(e) => ultimo = e,
        }
        if vez + 1 < tentativas { std::thread::sleep(std::time::Duration::from_millis(250)); }
    }
    Err(ultimo)
}

/// Tira o exe do caminho: apaga, se ninguém o usa; senão (aberto), move para uma das pastas de sobras do mesmo disco.
/// Tenta de novo por alguns segundos, porque o antivírus costuma segurar por instantes o exe que acabou de abrir.
fn tirar_do_caminho(exe: &Path, destino: &Destino) -> io::Result<()> {
    let mut ultimo = io::Error::other("não tentou");
    for vez in 0..destino.tentativas.max(1) {
        if !exe.exists() { return Ok(()); }
        match fs::remove_file(exe) {
            Ok(()) => return Ok(()),
            Err(e) => ultimo = e,
        }
        for pasta in &destino.sobras {
            if fs::create_dir_all(pasta).is_err() { continue; }
            match fs::rename(exe, pasta.join(nome_de_sobra())) {
                Ok(()) => return Ok(()),
                Err(e) => ultimo = e,
            }
        }
        if vez + 1 < destino.tentativas { std::thread::sleep(std::time::Duration::from_millis(250)); }
    }
    Err(ultimo)
}

fn limpar_sobras(destino: &Destino) {
    for pasta in &destino.sobras {
        let Ok(lista) = fs::read_dir(pasta) else { continue };
        for item in lista.flatten() {
            let nome = item.file_name().to_string_lossy().to_string();
            if nome.starts_with(PREFIXO_SOBRA) && nome.ends_with(".exe") {
                let _ = fs::remove_file(item.path());      // a que ainda estiver aberta fica para a próxima
            }
        }
    }
    // a pasta ao lado da do programa só existe se precisou; vazia, some
    if let Some(ao_lado) = destino.sobras.get(1) { let _ = fs::remove_dir(ao_lado); }
}

fn registrar(destino: &Destino, exe: &Path) -> io::Result<()> {
    apagar_chave(HKCU, &destino.chave);
    let exe_txt = exe.display().to_string();
    let tamanho = (fs::metadata(exe).map(|m| m.len()).unwrap_or(0)
        + ARQUIVOS.iter().map(|(_, d)| d.len() as u64).sum::<u64>()) / 1024;
    let textos = [
        ("DisplayName", "Tarja Livre".to_string()),
        ("DisplayVersion", VERSAO.to_string()),
        ("Publisher", "Heraldo Antunes (projeto livre)".to_string()),
        ("DisplayIcon", format!("{exe_txt},0")),
        ("InstallLocation", format!("{}\\", destino.programa.display())),
        ("UninstallString", format!("\"{exe_txt}\" --desinstalar")),
        ("QuietUninstallString", format!("\"{exe_txt}\" --desinstalar --silencioso")),
        ("URLInfoAbout", "https://github.com/HeraldoAntunes/tarja-livre".to_string()),
    ];
    let numeros = [("NoModify", 1u32), ("NoRepair", 1), ("EstimatedSize", tamanho as u32)];
    let mut chave: isize = 0;
    let r = unsafe { RegCreateKeyExW(HKCU, largo(&destino.chave).as_ptr(), 0, std::ptr::null(), 0, 0x20006,
        std::ptr::null(), &mut chave, std::ptr::null_mut()) };
    if r != 0 { return Err(io::Error::from_raw_os_error(r)); }
    let mut erro = 0;
    for (nome, valor) in textos {
        let v = largo(&valor);
        erro |= unsafe { RegSetValueExW(chave, largo(nome).as_ptr(), 0, 1, v.as_ptr() as *const u8, (v.len() * 2) as u32) };
    }
    for (nome, valor) in numeros {
        erro |= unsafe { RegSetValueExW(chave, largo(nome).as_ptr(), 0, 4, &valor as *const u32 as *const u8, 4) };
    }
    unsafe { RegCloseKey(chave) };
    if erro != 0 { return Err(io::Error::other("não foi possível registrar em Aplicativos instalados")); }
    Ok(())
}

// ---- Windows ----
pub const HKCU: isize = 0x80000001u32 as i32 as isize;

#[link(name = "advapi32")]
extern "system" {
    fn RegCreateKeyExW(chave: isize, sub: *const u16, reservado: u32, classe: *const u16, opcoes: u32, acesso: u32,
        seguranca: *const u8, saida: *mut isize, disposicao: *mut u32) -> i32;
    fn RegSetValueExW(chave: isize, nome: *const u16, reservado: u32, tipo: u32, dados: *const u8, tam: u32) -> i32;
    fn RegDeleteTreeW(chave: isize, sub: *const u16) -> i32;
    fn RegCloseKey(chave: isize) -> i32;
    fn RegGetValueW(chave: isize, sub: *const u16, valor: *const u16, flags: u32, tipo: *mut u32, dados: *mut u16,
        tam: *mut u32) -> i32;
}
#[link(name = "shell32")]
extern "system" {
    fn SHGetKnownFolderPath(id: *const Guid, flags: u32, token: isize, saida: *mut *mut u16) -> i32;
    fn SHChangeNotify(evento: i32, flags: u32, a: *const c_void, b: *const c_void);
    fn SetCurrentProcessExplicitAppUserModelID(id: *const u16) -> i32;
}
#[link(name = "ole32")]
extern "system" {
    fn CoInitializeEx(reservado: *const c_void, modo: u32) -> i32;
    fn CoUninitialize();
    fn CoCreateInstance(clsid: *const Guid, externo: *const c_void, contexto: u32, iid: *const Guid,
        saida: *mut *mut c_void) -> i32;
    fn CoTaskMemFree(p: *const c_void);
}
#[link(name = "user32")]
extern "system" {
    fn MessageBoxW(hwnd: isize, texto: *const u16, titulo: *const u16, tipo: u32) -> i32;
}

/// A janela deste processo ganha o AppUserModelID dos atalhos. Nenhuma janela de outro programa é tocada.
pub fn marcar_programa() {
    let id = largo(APP_ID);
    unsafe { SetCurrentProcessExplicitAppUserModelID(id.as_ptr()) };
}

fn perguntar(texto: &str, tipo: u32) -> i32 {
    unsafe { MessageBoxW(0, largo(texto).as_ptr(), largo("Tarja Livre").as_ptr(), tipo) }
}

#[repr(C)]
struct Guid(u32, u16, u16, [u8; 8]);
#[repr(C)]
struct ChaveDePropriedade { fmtid: Guid, pid: u32 }
#[repr(C)]
struct Propvariant { vt: u16, r: [u16; 3], texto: *const u16, resto: usize }

const FOLDERID_PROGRAMS: Guid = Guid(0xA77F5D77, 0x2E2B, 0x44C3, [0xA6, 0xA2, 0xAB, 0xA6, 0x01, 0x05, 0x4A, 0x51]);
const FOLDERID_DESKTOP: Guid = Guid(0xB4BFCC3A, 0xDB2C, 0x424C, [0xB0, 0x29, 0x7F, 0xE9, 0x9A, 0x87, 0xC6, 0x41]);
const CLSID_SHELLLINK: Guid = Guid(0x00021401, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_ISHELLLINKW: Guid = Guid(0x000214F9, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_IPERSISTFILE: Guid = Guid(0x0000010B, 0, 0, [0xC0, 0, 0, 0, 0, 0, 0, 0x46]);
const IID_IPROPERTYSTORE: Guid = Guid(0x886D8EEB, 0x8CF2, 0x4446, [0x8D, 0x02, 0xCD, 0xBA, 0x1D, 0xBD, 0xCF, 0x99]);
const PKEY_APPUSERMODEL: Guid = Guid(0x9F4C2855, 0x9F79, 0x4B39, [0xA8, 0xD0, 0xE1, 0xD4, 0x2D, 0xE1, 0xD5, 0xF3]);

fn pasta_conhecida(id: &Guid) -> Option<PathBuf> {
    let mut p: *mut u16 = std::ptr::null_mut();
    if unsafe { SHGetKnownFolderPath(id, 0, 0, &mut p) } != 0 || p.is_null() { return None; }
    let texto = unsafe {
        let tam = (0..).take_while(|&i| *p.add(i) != 0).count();
        let t = String::from_utf16_lossy(std::slice::from_raw_parts(p, tam));
        CoTaskMemFree(p as *const c_void);
        t
    };
    Some(PathBuf::from(texto))
}

pub fn ler_texto(raiz: isize, sub: &str, valor: &str) -> Option<String> {
    let (sub, valor) = (largo(sub), largo(valor));
    let mut buf = [0u16; 260];
    let mut tam = (buf.len() * 2) as u32;
    let r = unsafe { RegGetValueW(raiz, sub.as_ptr(), valor.as_ptr(), 0x2, std::ptr::null_mut(), buf.as_mut_ptr(), &mut tam) };
    if r != 0 { return None; }
    Some(String::from_utf16_lossy(&buf[..(tam as usize / 2).min(buf.len()).saturating_sub(1)]))
}

fn apagar_chave(raiz: isize, sub: &str) {
    unsafe { RegDeleteTreeW(raiz, largo(sub).as_ptr()) };
}

/// COM aberto só enquanto os atalhos são criados.
struct Com(bool);
impl Com {
    fn iniciar() -> Com { Com(unsafe { CoInitializeEx(std::ptr::null(), 0x2) } >= 0) }   // apartamento único
}
impl Drop for Com {
    fn drop(&mut self) { if self.0 { unsafe { CoUninitialize() } } }
}

type Objeto = *mut *const usize;

/// Método `i` da tabela do objeto COM.
unsafe fn metodo<T: Copy>(obj: Objeto, i: usize) -> T { std::mem::transmute_copy(&*(*obj).add(i)) }

unsafe fn soltar(obj: Objeto) {
    let f: unsafe extern "system" fn(Objeto) -> u32 = metodo(obj, 2);
    f(obj);
}

/// Atalho para o programa com o AppUserModelID dele.
fn criar_atalho(lnk: &Path, exe: &Path, pasta: &Path) -> io::Result<()> {
    let falha = |o: &str| io::Error::other(format!("não foi possível criar o atalho {} ({o})", lnk.display()));
    if let Some(p) = lnk.parent() { fs::create_dir_all(p)?; }
    unsafe {
        let mut link: *mut c_void = std::ptr::null_mut();
        if CoCreateInstance(&CLSID_SHELLLINK, std::ptr::null(), 1, &IID_ISHELLLINKW, &mut link) < 0 || link.is_null() {
            return Err(falha("ShellLink"));
        }
        let link = link as Objeto;
        type Texto = unsafe extern "system" fn(Objeto, *const u16) -> i32;
        type Icone = unsafe extern "system" fn(Objeto, *const u16, i32) -> i32;
        type Pedir = unsafe extern "system" fn(Objeto, *const Guid, *mut *mut c_void) -> i32;
        let (exe_t, pasta_t) = (largo(&exe.display().to_string()), largo(&pasta.display().to_string()));
        let desc = largo("Tarjar dados pessoais em PDF, sem internet");
        let mut ok = metodo::<Texto>(link, 20)(link, exe_t.as_ptr()) >= 0               // SetPath
            && metodo::<Texto>(link, 9)(link, pasta_t.as_ptr()) >= 0                     // SetWorkingDirectory
            && metodo::<Texto>(link, 7)(link, desc.as_ptr()) >= 0                        // SetDescription
            && metodo::<Icone>(link, 17)(link, exe_t.as_ptr(), 0) >= 0;                  // SetIconLocation
        let pedir: Pedir = metodo(link, 0);                                              // QueryInterface
        let mut loja: *mut c_void = std::ptr::null_mut();
        if ok && pedir(link, &IID_IPROPERTYSTORE, &mut loja) >= 0 && !loja.is_null() {
            let loja = loja as Objeto;
            let id = largo(APP_ID);
            let chave = ChaveDePropriedade { fmtid: PKEY_APPUSERMODEL, pid: 5 };          // PKEY_AppUserModel_ID
            let v = Propvariant { vt: 31, r: [0; 3], texto: id.as_ptr(), resto: 0 };     // VT_LPWSTR
            let definir: unsafe extern "system" fn(Objeto, *const ChaveDePropriedade, *const Propvariant) -> i32 =
                metodo(loja, 6);
            let gravar: unsafe extern "system" fn(Objeto) -> i32 = metodo(loja, 7);
            ok = definir(loja, &chave, &v) >= 0 && gravar(loja) >= 0;
            soltar(loja);
        } else {
            ok = false;
        }
        let mut arquivo: *mut c_void = std::ptr::null_mut();
        if ok && pedir(link, &IID_IPERSISTFILE, &mut arquivo) >= 0 && !arquivo.is_null() {
            let arquivo = arquivo as Objeto;
            let salvar: unsafe extern "system" fn(Objeto, *const u16, i32) -> i32 = metodo(arquivo, 6);
            ok = salvar(arquivo, largo(&lnk.display().to_string()).as_ptr(), 1) >= 0;
            soltar(arquivo);
        } else {
            ok = false;
        }
        soltar(link);
        if ok { Ok(()) } else { Err(falha("gravação")) }
    }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn compara_versoes() {
        assert!(mais_nova("1.2.1", "1.2.0"));
        assert!(mais_nova("1.10.0", "1.9.9"));
        assert!(!mais_nova("1.2.0", "1.2.0"));
        assert!(!mais_nova("1.1.0", "1.2.0"));
        assert!(mais_nova("1.2.0", "versão estranha"));
    }

    #[link(name = "advapi32")]
    extern "system" {
        fn RegDeleteKeyW(chave: isize, sub: *const u16) -> i32;
    }
    // cada teste apaga só a própria chave (rodam ao mesmo tempo); a de cima some quando a última sai
    fn apagar_teste(d: &Destino) {
        apagar_chave(HKCU, &d.chave);
        unsafe { RegDeleteKeyW(HKCU, largo(r"Software\TarjaLivreTeste").as_ptr()) };
    }

    fn destino_de_teste(nome: &str) -> Destino {
        let base = std::env::temp_dir().join(format!("tarja-teste-instalacao-{nome}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        Destino {
            programa: base.join("Programs").join("Tarja Livre"),
            menu: base.join("Menu"),
            area: base.join("Area"),
            dados: base.join(DADOS),
            chave: format!(r"Software\TarjaLivreTeste\{nome}-{}", std::process::id()),
            sobras: vec![base.join("temp"), base.join("Programs").join(PASTA_SOBRAS)],
            tentativas: 4,
        }
    }

    // instala, atualiza e desinstala em pastas e chave próprias do teste (a chave de teste é apagada no fim)
    #[test]
    fn instala_atualiza_e_desinstala() {
        let d = destino_de_teste("ciclo");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        let origem = base.join("baixado").join("TarjaLivre-9.9.9.exe");
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa novo").unwrap();
        instalar(&d, &origem).unwrap();

        assert_eq!(fs::read(d.exe()).unwrap(), b"programa novo");
        assert!(d.programa.join("LICENSE").exists() && d.programa.join("THIRD-PARTY-NOTICES.md").exists());
        assert!(d.menu.join(ATALHO).exists() && d.area.join(ATALHO).exists());
        assert_eq!(ler_texto(HKCU, &d.chave, "DisplayVersion").as_deref(), Some(VERSAO));
        let desinstalar_cmd = ler_texto(HKCU, &d.chave, "UninstallString").unwrap();
        assert!(desinstalar_cmd.ends_with("--desinstalar") && desinstalar_cmd.contains(EXE));

        // atualização: quem tirou o atalho da Área de Trabalho não o ganha de volta
        fs::remove_file(d.area.join(ATALHO)).unwrap();
        fs::write(&origem, b"programa mais novo").unwrap();
        instalar(&d, &origem).unwrap();
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa mais novo");
        assert!(!d.area.join(ATALHO).exists());

        // silenciosa: um arquivo do usuário na pasta impede que ela suma, e só ele fica; os dados ficam
        fs::create_dir_all(&d.dados).unwrap();
        fs::write(d.dados.join("guardado"), b"x").unwrap();
        fs::write(d.programa.join("meu.pdf"), b"%PDF").unwrap();
        desinstalar(&d, &origem, true).unwrap();
        assert!(ler_texto(HKCU, &d.chave, "DisplayVersion").is_none());
        assert!(!d.menu.join(ATALHO).exists());
        let sobrou: Vec<_> = fs::read_dir(&d.programa).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(sobrou, vec![std::ffi::OsString::from("meu.pdf")]);
        assert!(d.dados.join("guardado").exists());
        apagar_teste(&d);
        let _ = fs::remove_dir_all(base);
    }

    // o exe instalado aberto (aqui, uma cópia do ping.exe do Windows rodando com o nome do Tarja) e a pasta temporária
    // em "outro disco" (aqui, um caminho onde não dá para criar pasta): ele vai para a pasta ao lado da do programa
    #[test]
    fn desinstala_com_o_exe_aberto_e_temp_noutro_disco() {
        let mut d = destino_de_teste("aberto");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        let origem = base.join("baixado").join("TarjaLivre-9.9.9.exe");
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa").unwrap();
        instalar(&d, &origem).unwrap();
        // a "pasta temporária" fica embaixo de um arquivo: não dá para criá-la, como um disco que não aceita a mudança
        fs::write(base.join("arquivo"), b"x").unwrap();
        d.sobras[0] = base.join("arquivo").join("temp");
        let ping = std::path::Path::new(&std::env::var("SystemRoot").unwrap()).join("System32").join("PING.EXE");
        fs::copy(&ping, d.exe()).unwrap();
        let mut aberto = std::process::Command::new(d.exe()).args(["-n", "30", "127.0.0.1"])
            .stdout(std::process::Stdio::null()).spawn().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(300));
        desinstalar(&d, &d.exe(), true).unwrap();
        assert!(!d.exe().exists(), "o exe aberto saiu da pasta do programa");
        assert!(ler_texto(HKCU, &d.chave, "DisplayVersion").is_none());
        let sobras: Vec<_> = fs::read_dir(&d.sobras[1]).unwrap().flatten().collect();
        assert_eq!(sobras.len(), 1, "a cópia aberta foi para a pasta ao lado, no mesmo disco");
        let _ = aberto.kill();
        let _ = aberto.wait();
        limpar_sobras(&d);
        assert!(!d.sobras[1].exists(), "na próxima vez, a cópia antiga e a pasta somem");
        apagar_teste(&d);
        let _ = fs::remove_dir_all(base);
    }

    // auditoria da rc.1, N-C2: a troca do exe novo pelo nome instalado falha depois que o antigo já saiu do lugar.
    // Antes, a pasta ficava sem o exe; agora o antigo volta, o .novo some e a versão registrada continua a mesma.
    #[test]
    fn troca_que_falha_volta_o_antigo() {
        let d = destino_de_teste("troca");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        let origem = base.join("baixado").join("TarjaLivre-9.9.9.exe");
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa antigo").unwrap();
        instalar(&d, &origem).unwrap();
        fs::write(&origem, b"programa novo").unwrap();
        FALHAR_TROCA.with(|f| f.set(true));
        assert!(instalar(&d, &origem).is_err(), "a troca falhou e a atualização avisa");
        FALHAR_TROCA.with(|f| f.set(false));
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa antigo", "o exe antigo voltou para o lugar");
        assert!(!d.programa.join(format!("{EXE}.novo")).exists() && !d.programa.join(format!("{EXE}.antigo")).exists());
        assert_eq!(ler_texto(HKCU, &d.chave, "DisplayVersion").as_deref(), Some(VERSAO), "continua em Aplicativos instalados");
        // sem a falha, a mesma atualização dá certo e não deixa a reserva
        instalar(&d, &origem).unwrap();
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa novo");
        assert!(!d.programa.join(format!("{EXE}.antigo")).exists());
        desinstalar(&d, &d.exe(), true).unwrap();
        apagar_teste(&d);
        let _ = fs::remove_dir_all(base);
    }

    // auditoria da rc.2, N-R1: a troca anterior parou com o exe fora do lugar e só a reserva. Antes, a nova tentativa
    // apagava a reserva primeiro; com a troca falhando de novo, não sobrava cópia nenhuma.
    #[test]
    fn retomada_nunca_fica_sem_copia() {
        let d = destino_de_teste("retomada");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        let origem = base.join("baixado").join("TarjaLivre-9.9.9.exe");
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa antigo").unwrap();
        instalar(&d, &origem).unwrap();
        let reserva = d.programa.join(format!("{EXE}.antigo"));
        let copia_valida = || [d.exe(), reserva.clone()].iter().any(|p| fs::read(p).ok().as_deref() == Some(b"programa antigo"));
        // estado de uma troca interrompida: o exe fora do lugar, só a reserva
        fs::rename(d.exe(), &reserva).unwrap();
        fs::write(&origem, b"programa novo").unwrap();
        FALHAR_TROCA.with(|f| f.set(true));
        for vez in 1..=3 {
            assert!(instalar(&d, &origem).is_err(), "tentativa {vez}: a troca falhou e a atualização avisa");
            assert!(copia_valida(), "tentativa {vez}: sobrou ao menos uma cópia que abre");
            assert_eq!(fs::read(d.exe()).unwrap(), b"programa antigo", "tentativa {vez}: o anterior voltou ao lugar");
        }
        FALHAR_TROCA.with(|f| f.set(false));
        // a volta da reserva falha: o erro diz onde está a cópia, e ela fica
        fs::rename(d.exe(), &reserva).unwrap();
        FALHAR_VOLTA.with(|f| f.set(true));
        let erro = instalar(&d, &origem).unwrap_err().to_string();
        FALHAR_VOLTA.with(|f| f.set(false));
        assert!(erro.contains(&reserva.display().to_string()), "o erro diz o caminho da cópia: {erro}");
        assert!(copia_valida());
        // sem falha: a retomada traz a reserva de volta e a troca vai até o fim, sem sobrar reserva
        instalar(&d, &origem).unwrap();
        assert_eq!(fs::read(d.exe()).unwrap(), b"programa novo");
        assert!(!reserva.exists() && !d.programa.join(format!("{EXE}.novo")).exists());
        desinstalar(&d, &d.exe(), true).unwrap();
        apagar_teste(&d);
        let _ = fs::remove_dir_all(base);
    }

    // o exe preso (aberto por outro programa sem deixar mover nem apagar): a desinstalação falha sem mexer em nada
    #[test]
    fn exe_preso_nao_deixa_desinstalacao_pela_metade() {
        use std::os::windows::fs::OpenOptionsExt;
        let d = destino_de_teste("preso");
        let base = d.programa.parent().unwrap().parent().unwrap().to_path_buf();
        let origem = base.join("baixado").join("TarjaLivre-9.9.9.exe");
        fs::create_dir_all(origem.parent().unwrap()).unwrap();
        fs::write(&origem, b"programa").unwrap();
        instalar(&d, &origem).unwrap();
        let preso = fs::OpenOptions::new().read(true).share_mode(0).open(d.exe()).unwrap();
        assert!(desinstalar(&d, &d.exe(), true).is_err(), "com o exe preso, a desinstalação avisa que falhou");
        assert!(d.exe().exists() && d.programa.join("LICENSE").exists(), "o programa continua inteiro");
        assert!(d.menu.join(ATALHO).exists() && d.area.join(ATALHO).exists(), "os atalhos continuam");
        assert_eq!(ler_texto(HKCU, &d.chave, "DisplayVersion").as_deref(), Some(VERSAO), "continua em Aplicativos instalados");
        drop(preso);
        desinstalar(&d, &d.exe(), true).unwrap();
        assert!(!d.exe().exists() && ler_texto(HKCU, &d.chave, "DisplayVersion").is_none(), "solto, desinstala");
        apagar_teste(&d);
        let _ = fs::remove_dir_all(base);
    }
}
