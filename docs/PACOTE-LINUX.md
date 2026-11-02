<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Pacote Linux do Tarja Livre

Estudo e montagem de um pacote Linux para o Tarja Livre 1.2.1, feito em 02/11/2026 no ramo `pacote-linux` (a
partir da `main` em `dac03d7`). Nada foi publicado: não há tag nem release, e a `main` não mudou.

**Resumo:**
- **Pacote do HTML (`.deb` e `.tar.gz`): pronto e testado.** São o mesmo programa em HTML, com um comando que abre
  o navegador do computador e os atalhos no menu. Nenhuma linha do programa mudou.
- **Janela própria (Tauri, AppImage ou `.deb`): não montada.** O código de `app/` é feito para o Windows e não
  compila no Linux sem mudanças no programa. O experimento abaixo mostra o que essas mudanças teriam de cobrir.
  Um defeito aparece logo: na janela do Linux, o PDF tarjado **não é gravado**, mas o programa diz que salvou.

O Giz Livre (ramo `pacote-linux-1.16.0`, `docs/PACOTE-LINUX.md`) era a referência pedida, mas não foi lido:
o acesso àquele repositório não foi liberado nesta sessão. A forma do pacote aqui foi decidida sem ele.

## Os arquivos

| Arquivo | Tamanho | SHA-256 |
|---|---|---|
| `tarja-livre_1.2.1_all.deb` | 4.284.110 bytes | `96e101af56bf28bb9bfac6f57625e6505410e11a9f71f16a7ce696c7b6fae2e1` |
| `TarjaLivre-1.2.1-linux.tar.gz` | 4.279.749 bytes | `0299d1b582f6ef24f7fc9f63a1203795722139a6e65826fc9a47e1171ca16399` |

Os HTML dentro dos dois são os de `scripts/montar.py`, sem mudança:

| HTML | SHA-256 |
|---|---|
| `TarjaLivre.html` | `aaebc730624fb7cd34c3ce75906d3cf2bad9ef74d1e64b706250c4cfd6ade8dd` |
| `TarjaLivre-OCR.html` | `63833d056d91b9447c17d52580a7c65d23817d6db836f5472869e1dd4999608e` |

Montar:

```bash
python3 scripts/pacote_linux.py
```

Sai em `dist/linux/`, com o `SHA256SUMS-linux.txt`. O script é só Python (não usa `dpkg-deb` nem `tar`), então
também monta no Windows. Montando duas vezes, os dois pacotes saíram iguais byte a byte. Cada arquivo leva a data
da versão no CHANGELOG, dono root, ordem fixa e gzip sem data.

O `scripts/montar.py --release` **não** chama este script: pôr os pacotes Linux na release é decisão do professor.

### O `.deb` (com administrador)

Instala:

| Caminho | O quê |
|---|---|
| `/usr/bin/tarja-livre` | o comando que abre o programa (`tarja-livre --ocr` abre a versão com OCR) |
| `/usr/share/tarja-livre/` | os dois HTML |
| `/usr/share/applications/br.tarjalivre.TarjaLivre*.desktop` | os atalhos "Tarja Livre" e "Tarja Livre com OCR" no menu |
| `/usr/share/icons/hicolor/scalable/apps/tarja-livre.svg` | o ícone (o mesmo `docs/img/icone.svg`) |
| `/usr/share/doc/tarja-livre/` | licença, avisos de terceiros e o CHANGELOG |

O pacote não depende de nada: só recomenda o `xdg-utils` e sugere Firefox ou Chromium. Não tem script de
instalação nem de remoção (`postinst`, `prerm`). O menu e o ícone se atualizam pelos gatilhos do próprio sistema.

```bash
sudo apt install ./tarja-livre_1.2.1_all.deb
```

```bash
sudo apt purge tarja-livre
```

O `lintian` 2.117 (Ubuntu 24.04) não deu erro e deu dois avisos: falta a página de manual do comando
(`no-manual-page`), e ele lê o CHANGELOG do projeto como se fosse um changelog do Debian
(`syntax-error-in-debian-changelog`). Nenhum dos dois atrapalha instalar ou usar.

### O `.tar.gz` (por conta, sem administrador)

Traz os dois HTML, o comando, os atalhos, o ícone, `instalar.sh`, `desinstalar.sh`, `LEIA-ME.txt`, a licença e os
avisos de terceiros.

- Sem instalar: abrir um dos HTML no navegador.
- Instalar: o `./instalar.sh` copia tudo para `~/.local/share/tarja-livre` e põe os atalhos e o ícone em
  `~/.local/share`. Nada vai para fora da pasta pessoal.
- Desinstalar: `~/.local/share/tarja-livre/desinstalar.sh` tira tudo isso, inclusive as cópias feitas para
  navegador em snap.

### O comando `tarja-livre`

Os fontes estão em `linux/`. O comando escolhe o navegador nesta ordem:

1. o da variável `TARJA_NAVEGADOR`;
2. o primeiro instalado fora do snap, desta lista: Firefox, Firefox ESR, Chromium, Chrome, Edge, Brave, Vivaldi;
3. um navegador em snap. Como o snap não enxerga `/usr/share` nem as pastas ocultas da pasta pessoal, o HTML é
   copiado antes para `~/snap/<navegador>/common/tarja-livre`, a pasta do próprio snap;
4. o navegador padrão (`xdg-open`).

Sem navegador, ele avisa e sai com erro.

O que o programa guarda (escolhas, lista de nomes, andamento) fica dentro do navegador, como em qualquer uso do
HTML, e o desinstalar não alcança isso. Antes de desinstalar, use no programa o botão **Apagar tudo o que o Tarja
Livre guardou**.

## Testes

Cada sistema rodou num contêiner Docker limpo, com uma pessoa comum (`professor`) fazendo o uso e root só para o
`dpkg`. Para repetir:

```bash
CHROMIUM_DIR=/caminho/da/pasta/do/chromium tests/pacote_linux/rodar_conteineres.sh
```

Antes disso, rode `python3 scripts/pacote_linux.py` e `npm ci --ignore-scripts` em `tests/pacote_linux`. O
cabeçalho de `rodar_conteineres.sh` explica as outras variáveis (proxy e Node). Os registros desta rodada estão em
[`tests/pacote_linux/resultados/`](../tests/pacote_linux/resultados/).

Para cada pacote, o teste (`tests/pacote_linux/testar_pacote.sh`):

1. instala;
2. confere os atalhos com o `desktop-file-validate`;
3. testa o comando com navegadores de mentira (`testar_lancador.sh`);
4. abre pelo comando `tarja-livre`, que acha o Chromium com janela no Xvfb;
5. confere que a página aberta é a do pacote;
6. abre um PDF fictício gerado na hora (nome, CPF e e-mail inventados), procura, aceita, confere e salva;
7. lê o PDF salvo com o `pdftotext` e com `grep` nos bytes;
8. desinstala e compara a lista de tudo o que existe fora da pasta pessoal antes e depois.

O `.deb` foi testado também com `tarja-livre --ocr`.

| | Ubuntu 22.04.5 | Ubuntu 24.04.5 | Debian 12 |
|---|---|---|---|
| dpkg | 1.21.1ubuntu2.6 | 1.22.6ubuntu6.6 | 1.21.23 |
| `.deb`: instalar, comando no PATH, atalhos válidos | passou | passou | passou (sem `desktop-file-validate`) |
| comando com navegadores de mentira (5 verificações) | passou | passou | passou |
| `.deb`: abrir, tarjar e salvar, versão normal e com OCR | passou | passou | **não testado** |
| PDF salvo: página sem texto, nenhum dado no texto nem nos bytes, folha de conferência | passou | passou | **não testado** |
| `.deb`: desinstalar (`purge`) sem deixar nada novo fora da pasta pessoal | passou | passou | passou |
| `.tar.gz`: instalar e desinstalar na pasta pessoal, atalho com o caminho certo | passou | passou | passou |
| `.tar.gz`: abrir, tarjar e salvar | passou | passou | **não testado** |
| `.tar.gz`: nada mudou fora da pasta pessoal | passou | passou | passou |
| sem navegador: o comando avisa e sai com erro | não se aplica | não se aplica | passou |
| **verificações** | **33 de 33** | **33 de 33** | **19 de 19** |

A rodada completa foi feita duas vezes, com o mesmo resultado.

O navegador foi o Chromium "Chrome for Testing" 153.0.8010.12 (o do Playwright 1.63), com janela, no Xvfb.

**Debian 12:** a rede deste ambiente não alcança os servidores do Debian, então não deu para instalar o Xvfb, o
navegador nem o `pdftotext` no contêiner. Lá ficou testado só instalar, o comando e desinstalar. Abrir e tarjar
no Debian **não foi testado**.

### O que fica fora da pasta pessoal

- **`.deb`:** depois do `purge`, nenhum caminho novo. O único arquivo que nasce é o registro do próprio dpkg,
  `/var/log/dpkg.log`, no Debian limpo, onde ainda não existia. Mudaram de conteúdo os registros do dpkg
  (`/var/lib/dpkg/status` e companhia) e os índices do sistema (`/usr/share/applications/mimeinfo.cache`, pelo
  gatilho do `desktop-file-utils`), como em qualquer pacote. A lista está em `deb-modificados.txt`.
- **`.tar.gz`:** nada mudou fora da pasta pessoal. A única exceção são as travas que o próprio Chromium deixa em
  `/tmp` (`/tmp/org.chromium.Chromium.*`), em qualquer uso dele, com ou sem o Tarja.

### Observação

Numa das rodadas de preparo, no Ubuntu 24.04, a página aberta não contou como vista em 60 segundos (o contador
ficou em "0 de 1"). Isso aconteceu uma vez em sete aberturas e não foi investigado. Desde então, o teste clica na
miniatura da página antes de esperar, como fazem os testes do repositório.

## A janela própria (Tauri) no Linux

### O código de hoje não compila no Linux

Num contêiner Ubuntu 22.04 com WebKitGTK 4.1 e Rust 1.97, `cargo build --release --locked` em `app/` compila todas
as dependências (Tauri 2.12.5, wry 0.57.1, WebKitGTK) e para no próprio programa:

- `std::os::windows` e `share_mode` em `main.rs`, `instalacao.rs` e `orfao.rs`;
- `MessageBoxW` e `ShellExecuteW`, ligados ao `user32` e ao `shell32` do Windows;
- falta o `icons/icon.png`: o Tauri no Linux não usa o `.ico`.

Além disso, quase tudo de `instalacao.rs` (instalar, atalhos, desinstalar, registro do Windows) e de `orfao.rs`
(WebView2 órfão) só existe no Windows. A regra que faz nenhum endereço resolver (`--host-resolver-rules`) é do
WebView2 e não vale no WebKitGTK; a página continua com a CSP dela (`connect-src 'none'`).

### Experimento

Numa cópia fora do repositório, um `main.rs` mínimo foi feito só para o teste: a mesma janela, a mesma regra de
navegação e nada do Windows. Ele compilou (11,7 MB) e abriu no Xvfb.

Para testar, um script posto na página tarjou um PDF fictício e mandou salvar. Cada passo foi contado por uma
navegação recusada, que o programa anota. O que aconteceu:

1. A página carregou (`showSaveFilePicker` não existe no WebKitGTK; o IndexedDB existe). A procura achou o CPF, o
   e-mail e o nome da lista.
2. Ao salvar, o programa mostrou **"PDF salvo como ficha-ficticia-tarjado.pdf"**, mas **nenhum arquivo foi
   gravado**. O download sai como navegação para um endereço `blob:`, e a regra de navegação do programa (só
   `tauri://`) recusa. Nenhum evento de download chega ao programa, e a página não fica sabendo da falha.
3. Liberando `blob:` na regra de navegação, o download acontece. O arquivo foi para a pasta de trabalho do
   processo (`/tmp` no teste), sem perguntar onde salvar. O `pdftotext` não achou texto na página tarjada.

### O que um pacote da janela própria exigiria (não feito)

São mudanças no programa, por isso ficaram só descritas:

- separar o que é do Windows (`#[cfg(windows)]`) em `main.rs`, `instalacao.rs` e `orfao.rs`;
- trocar as caixas de mensagem e o abrir no navegador por equivalentes do Linux, como o diálogo do GTK e o `xdg-open`;
- liberar `blob:` na regra de navegação e tratar o download com `on_download`: escolher a pasta (Downloads ou uma
  caixa "Salvar como") e avisar a página quando a gravação falhar;
- pôr um `icon.png` em `app/icons` e no `tauri.conf.json`;
- testar de novo a pergunta ao fechar, que hoje usa a caixa do Windows quando a página não responde;
- montar com `cargo tauri build` (AppImage ou `.deb`). O `.deb` do Tauri depende do `libwebkit2gtk-4.1-0`; o
  AppImage leva as bibliotecas dentro e fica bem maior.

Como o pacote do HTML já cobre o uso no Linux sem mexer no programa, a recomendação é ficar com ele e só portar a
janela própria se houver um motivo claro.

## O que não foi testado

- **Abrir e tarjar no Debian 12** (só instalar, o comando e desinstalar).
- **Firefox** de verdade pelo pacote. O comando foi testado com o Chromium e com navegadores de mentira.
- **Navegador em snap** de verdade (o Firefox padrão do Ubuntu). A cópia para `~/snap/<navegador>/common` foi
  testada só com um "snap" de mentira, uma pasta chamada `snap/bin`.
- **Área de trabalho de verdade** (GNOME, KDE, Cinnamon): ver o atalho no menu, clicar no ícone, abrir com dois
  cliques. Os atalhos só passaram pelo `desktop-file-validate`.
- A caixa "Salvar como" do Chromium. No teste ela foi desligada, e o PDF saiu por download.
- Atualizar de uma versão do pacote para outra.
- Outras distribuições (Linux Mint, Fedora etc.) e outras arquiteturas (ARM).
