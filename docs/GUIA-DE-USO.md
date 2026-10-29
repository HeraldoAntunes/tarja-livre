<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Guia de uso do Tarja Livre

O Tarja Livre funciona sem internet e nenhum documento sai do computador. Há três arquivos, com o
mesmo programa:

- `TarjaLivre-x.y.z.exe` (Windows, cerca de 11 MB): abre numa janela própria, já com a leitura de PDF digitalizado;
- `TarjaLivre-x.y.z.html` (cerca de 2 MB): abre no navegador, em qualquer sistema;
- `TarjaLivre-OCR-x.y.z.html` (cerca de 8 MB): o mesmo no navegador, também lendo PDF digitalizado.

## 1. Abrir

- Abra o arquivo com dois cliques. No `.exe`, o Windows pode avisar na primeira vez que o editor é desconhecido:
  clique em **Mais informações** e em **Executar assim mesmo**. No `.html`, se o computador perguntar com qual
  programa abrir, escolha o Microsoft Edge, o Google Chrome ou o Mozilla Firefox.
- **Instalar o `.exe`:** na primeira vez, ele pergunta se instala. **Sim** instala só para a sua conta, sem pedir
  administrador: cria o atalho **Tarja Livre** no menu Iniciar e na Área de Trabalho, e o Tarja aparece em
  **Configurações > Aplicativos > Aplicativos instalados**. **Não** só usa agora, sem instalar (para pendrive).
  Abrir uma versão mais nova pergunta se atualiza; as escolhas e o andamento continuam.
- **Desinstalar:** em **Aplicativos instalados**, clique nos três pontos do Tarja Livre e em **Desinstalar**. Ele
  pergunta se apaga também o que guardou (escolhas, lista de nomes e andamento); em computador dividido, escolha **Sim**.
- Clique em **Abrir PDF** ou arraste os arquivos para a janela. Pode abrir **vários de uma vez** (até 20): cada um
  ganha uma aba em cima da página, com a situação dele: *a conferir*, *conferido* ou *salvo*.
- O painel da direita mostra o número de páginas e o **SHA-256 do original**, um código que identifica aquele
  arquivo. Ele serve para conferir depois de qual documento o PDF tarjado veio.
- PDF com senha, arquivo que não é PDF e PDF com página defeituosa são recusados com um aviso.

## 2. Tarjar

| Ferramenta | Para quê |
|---|---|
| **Tarja** | arraste um retângulo sobre o trecho |
| **Texto** | arraste do começo ao fim do trecho, como quem seleciona texto: a tarja cobre exatamente aquelas letras, uma faixa por linha (só em página com texto) |
| **Página inteira** | cobre a página toda com uma tarja, num clique |
| **Caneta** (fina, média, grossa) | trecho irregular, como uma assinatura |
| **Borracha** | clique numa tarja ou num traço para apagar |
| Cor **preta** ou **branca** | a branca cobre sem chamar atenção em fundo branco |
| **Desfazer** e **Refazer** | também por <kbd>Ctrl</kbd>+<kbd>Z</kbd> e <kbd>Ctrl</kbd>+<kbd>Y</kbd> |
| **−** e **+** | ampliam a página até 300%, para tarjar trecho pequeno |

Use as miniaturas da esquerda, os botões ‹ › ou as setas do teclado para trocar de página.

## 3. Sugerir tarjas

1. Marque os tipos de dado: CPF, CNPJ, RG, PIS/NIS, título de eleitor, CNH, e-mail, telefone, CEP e, se quiser,
   número de processo (vem desmarcado).
2. **Nomes e outros termos:** escreva um por linha (nome do aluno, do servidor, da rua), cole uma lista ou use
   **Importar .txt**. "Só palavra inteira" evita tarjar "Ana" dentro de "Banana"; "Ignorar maiúsculas e acentos"
   acha "JOAO" quando a lista diz "João". A lista também é dado pessoal: ela some ao fechar o programa, a não ser
   que você marque **Guardar a lista neste computador**. Desmarcar apaga.
3. Clique em **Procurar no documento** (ou **Procurar em todos os arquivos**, com vários abertos).
4. As sugestões aparecem com contorno laranja na página e numa lista no painel, com página, tipo e o trecho achado
   (o trecho só aparece na tela; não vai para a folha de conferência). Desmarque as erradas e use **Aceitar
   marcadas**, ou clique numa sugestão na página. Clicar numa linha da lista leva à página e destaca a sugestão. O
   Desfazer devolve as sugestões aceitas.

Limites da procura: ela lê o texto do PDF. CPF e CNPJ só são sugeridos com dígito verificador válido; PIS, título
e CNH, pelo formato ou pela palavra logo antes do número. Nomes só se estiverem na lista. **É uma ajuda: confira cada
página com os olhos.**

### PDF digitalizado (versão com OCR)

Na versão com OCR, deixe marcado **Ler páginas digitalizadas (OCR, mais lento)**. As páginas sem texto são lidas no
próprio computador (alguns segundos cada), e o que for achado vira sugestão, inclusive os nomes da lista. A leitura
pode errar letras de digitalização ruim: confira com mais cuidado. Na versão normal, página sem texto só pode ser
tarjada à mão.

## 4. Texto nas tarjas e carimbo

Em **Texto nas tarjas**, escreva, se quiser, algo como "dado pessoal omitido": vai no meio de cada tarja retangular,
quando couber.

Marque **Pôr carimbo LGPD**, edite o texto e arraste o carimbo na página. Ele pode ir em todas as páginas ou numa
só, com a data e o SHA-256 do original. Com vários arquivos abertos, o carimbo vale para todos; mudar o carimbo pede
nova conferência dos outros arquivos.

## 5. Conferir e salvar

1. Passe por todas as páginas: cada uma que aparece inteira na tela ganha um visto verde na miniatura.
2. Marque **Revisei todas as páginas**. Qualquer mudança depois disso desmarca a caixa, e é preciso conferir de novo.
3. Escolha o formato (PNG, mais nítido, ou JPEG, arquivo menor) e se quer a **folha de conferência** no fim.
4. Clique em **Salvar PDF tarjado**. No Edge, no Chrome e no `.exe`, abre a caixa **Salvar como** para escolher a
   pasta e o nome; nos outros navegadores, o PDF vai para a pasta de downloads. Cancelar a caixa não grava nada.
   Antes de terminar, o programa lê de novo o PDF gerado e só salva se não sobrar
   nenhum caractere de texto nas páginas refeitas; o resultado aparece no painel e na folha. O arquivo sai como
   `nome-tarjado.pdf`. Com vários arquivos, **Ir para o próximo arquivo** leva ao que falta salvar.
5. Abra o PDF salvo e confira mais uma vez antes de compartilhar.

O PDF salvo tem cada página como imagem: o texto coberto não existe mais no arquivo, mas também não dá para
selecionar nem pesquisar o texto. A folha de conferência registra data, SHA-256 do original, tarjas por página e
tipos procurados, sem mostrar nada do que foi coberto. O SHA-256 do PDF salvo aparece no painel.

## 6. Ícone na barra de tarefas (Windows)

O `.exe` já aparece com o ícone do Tarja: clique nele na barra com o botão direito e escolha **Fixar na barra de
tarefas** (instalado, o atalho do menu Iniciar também tem **Fixar na barra de tarefas**). O `.html`, aberto direto, aparece com o ícone do navegador. Para ter o ícone do Tarja com ele:

1. Baixe o `Criar-atalho-TarjaLivre.cmd` na página da versão e ponha na mesma pasta do `TarjaLivre-x.y.z.html`.
2. Dê dois cliques nele. Se o Windows pedir confirmação, confirme. Se houver mais de um arquivo do Tarja na pasta,
   ele pergunta qual usar.
3. O Tarja abre numa janela própria do Microsoft Edge, sem abas, e o atalho **Tarja Livre** aparece na Área de
   Trabalho e no menu Iniciar.
4. Clique no atalho com o botão direito, depois em **Mostrar mais opções** e em **Fixar na barra de tarefas**.

O atalho não usa a internet e não instala nada. Ele vale para a pasta onde o Tarja está: se mudar o arquivo de
lugar, rode o `Criar-atalho-TarjaLivre.cmd` de novo na pasta nova.

## 7. Se o programa fechar de repente

Se o Tarja fechar no meio do trabalho (falta de energia, computador reiniciado, programa travado), abra de novo o
**mesmo PDF**. No painel da direita aparece a oferta das marcas de antes:

- **Recuperar** traz de volta as tarjas, os traços e as páginas já vistas. Confira as páginas antes de salvar.
- **Descartar** apaga o que estava guardado.

O Tarja guarda só o lugar das marcas e as páginas vistas, ligados ao SHA-256 do PDF; nunca o PDF, o nome dele ou o
texto coberto. Isso some ao salvar, ao fechar o arquivo e depois de 7 dias. Para não guardar nada, desmarque
**Guardar o andamento** em **Ajustes**, na janela **Ajuda e Sobre**.

**Computador dividido** (sala dos professores, laboratório): não marque **Guardar a lista neste computador** e, ao
terminar, clique em **Apagar tudo o que o Tarja Livre guardou**, em **Ajustes**. Isso tira as escolhas, a lista
guardada e o andamento; o que está aberto continua na tela.

## 8. Ajustes e versão nova

Na janela **Ajuda e Sobre**, o botão **Ver se há versão nova** abre a página de versões no navegador, com a versão
instalada ao lado. Ele só abre a página: o programa não procura nada na internet sozinho.


Na janela **Ajuda e Sobre**, dá para desligar os avisos rápidos do rodapé. O formato, os tipos procurados e essa
escolha ficam guardados no navegador; nada do documento é guardado.
