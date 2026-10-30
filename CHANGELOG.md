# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e numeração em
[Versionamento Semântico](https://semver.org/lang/pt-BR/). Escrito para quem usa o programa.

## Não publicado

## [1.2.1] - 2026-10-29

### Corrigido
- **O carimbo volta a se mover ao arrastar.** Na 1.2.0, ele ficava parado no lugar (defeito introduzido por uma
  correção da própria 1.2.0).
- **"Apagar tudo o que o Tarja Livre guardou"** só diz "Apagado" quando apagou mesmo; se algo não sair, avisa o quê.
- **Recuperação depois de uma queda**: quem edita sem parar também tem o andamento guardado (no máximo 2 s depois da
  primeira mudança), e o programa avisa se não conseguir guardar.
- **Página vista com zoom**: só conta como vista quando a área inteira, com as margens, já apareceu na tela.
- **Salvar fica preso ao documento que o começou.** Na 1.2.0, trocar de aba com a caixa "Salvar como" aberta fazia
  sair o outro documento, com o nome do primeiro. Agora a tela trava já no clique em Salvar e, se o documento mudar
  mesmo assim, nada é gravado e um aviso explica. Um segundo pedido de salvar, com o primeiro em andamento, não faz
  nada.
- **Procura incompleta não diz mais "Nada encontrado".** Se os campos de formulário ou as anotações de uma página
  não puderem ser lidos, o aviso diz em que arquivo e páginas a procura ficou incompleta, para conferir à mão.
- **Recuperação mais firme**: andamento guardado estragado é descartado em vez de travar a oferta de recuperar, e uma
  falha passageira ao abrir o depósito do navegador não impede as gravações seguintes.
- **Abrir arquivos ao mesmo tempo** (o botão e arrastar, por exemplo) não cria mais duas abas do mesmo PDF nem passa
  do limite de 20 arquivos.
- **Fechar o `.exe`**: só fecha sem perguntar quando a página responde que não há nada por salvar; resposta vazia
  ou estranha (falha da página) faz o próprio Windows perguntar.
- **Atualizar o `.exe`**: se o programa novo não conseguir entrar no lugar, o antigo volta e continua instalado.
  Uma troca que parou no meio é retomada sem apagar a cópia anterior, e sempre sobra ao menos uma cópia que abre;
  se nem a volta der certo, o aviso diz onde a cópia ficou.
- **WebView2 órfão**: só é encerrado quando o Windows confirma que o programa que o abriu já fechou; na dúvida,
  fica. O que não sai é anotado no `janelas.log`.
- **Fechar o `.exe` com o programa ocupado**: se a página não responder em 3 s, o próprio Windows pergunta se fecha.
- **Desinstalar e atualizar o `.exe`**: o programa é tirado do lugar primeiro, com novas tentativas; se não der, nada é
  mexido e a instalação continua inteira. Funciona também com a pasta temporária em outro disco.
- **Abrir o `.exe` mais firme**: a janela só aparece pronta; se o Windows falhar ao criá-la, o programa tenta de novo e,
  se não der, explica em português o que fazer.
- O `.exe` diminui as conexões que o componente WebView2, da Microsoft, abre sozinho com a Microsoft ao abrir. Elas
  ainda podem acontecer (ver Privacidade).

## [1.2.0] - 2026-10-29

### Novo
- **Tarja Livre em janela própria para Windows** (`TarjaLivre-1.2.0.exe`, cerca de 11 MB, já com OCR). Abre sem
  depender do navegador do dia a dia, com o ícone do Tarja na barra de tarefas. Não precisa de
  internet: a página continua sem acesso à rede e o motor da janela não acha nenhum endereço; só o componente da
  Microsoft (WebView2) pode abrir sozinho uma conexão com a Microsoft, como contado na seção Privacidade do README. O
  arquivo HTML continua, para quem prefere o navegador ou usa outro sistema.
- **O `.exe` se instala sozinho**, sem instalador à parte e sem pedir administrador: na primeira vez, pergunta se
  instala para a sua conta, cria o atalho no menu Iniciar e na Área de Trabalho e aparece em **Aplicativos
  instalados**. Ao desinstalar, pergunta se apaga também o que o Tarja guardou. **Não** só usa, sem instalar.
- **Recuperar o trabalho depois de uma queda.** Se o programa fechar de repente, ao abrir o mesmo PDF de novo o Tarja
  oferece recuperar as tarjas e as páginas vistas. Guarda só a posição das marcas, nunca o PDF, o nome dele ou o texto
  coberto, e apaga ao salvar, ao fechar o arquivo, ao descartar e depois de 7 dias. Pode ser desligado em Ajustes.

- **Salvar como**: no Edge, no Chrome e no `.exe`, o Tarja pergunta onde gravar o PDF tarjado (antes ia sempre para
  Downloads). Nos outros navegadores, continua como download.
- **Computador dividido**: guardar a lista de nomes agora avisa que outra pessoa com o mesmo usuário do Windows vai
  vê-la, e há o botão **Apagar tudo o que o Tarja Livre guardou**, em Ajustes.

### Corrigido
- **Cobertura inteira** (auditoria independente de 29/10/2026): uma sugestão só deixa de ficar pendente quando fica
  inteira embaixo das tarjas. Antes, uma tarja sobre 90% dela já bastava, e letras do dado podiam ficar à vista.
- Página maior que 5,08 m (14.400 pt) de lado é recusada ao abrir, com aviso. Antes, saía cortada no PDF salvo.
- Trocar de página ou de arquivo no meio de um arrasto cancela o gesto. Antes, a tarja podia cair na outra página.
- Um gesto interrompido pelo sistema devolve o carimbo ao lugar de antes.
- Procura que falha avisa que não terminou, e não mais "Nada encontrado".
- Com zoom, a página só conta como vista depois de aparecer inteira na tela, rolando por ela.
- Ao fechar a janela com tarjas não salvas, o `.exe` pergunta antes de fechar.

## [1.1.0] - 2026-10-28

### Novo
- **Atalho com o ícone do Tarja**, para fixar na barra de tarefas do Windows. Baixe o `Criar-atalho-TarjaLivre.cmd`,
  ponha na mesma pasta do `TarjaLivre-1.1.0.html` e dê dois cliques. Ele cria o atalho na Área de Trabalho e no
  menu Iniciar. O atalho abre o Tarja numa janela própria do Microsoft Edge, sem abas, e a janela fica junto do
  ícone fixado. Não usa a internet e não instala nada.

### Documentação
- Seção "Privacidade" no README, com o que o programa faz e o que guarda no computador.

O programa em si não mudou.

## [1.0.0] - 2026-10-28

Primeira versão publicada.

### Para tarjar
- Um arquivo só (`TarjaLivre-1.0.0.html`, cerca de 2 MB) que abre no navegador com dois cliques e funciona sem
  internet. Nada sai do computador, e a página bloqueia qualquer acesso à rede.
- Abrir PDF pelo botão ou arrastando para a janela, com miniaturas das páginas e a página grande no centro.
- Vários PDFs de uma vez, até 20, cada um na sua aba, com a situação dele (a conferir, conferido, salvo). Cada um
  guarda a sua página, o zoom, o Desfazer e a conferência. Arquivo repetido não abre duas vezes.
- Tarja retangular preta ou branca; ferramenta "Texto", que cobre exatamente o trecho arrastado, uma faixa por
  linha; caneta em três espessuras; borracha; "Página inteira"; Desfazer e Refazer; ampliação até 300%.
- Texto opcional dentro das tarjas, como "dado pessoal omitido".
- Carimbo LGPD editável e arrastável, em todas as páginas ou numa só, com a data e o SHA-256 do original. Vale para
  todos os arquivos abertos.

### Para achar os dados
- Sugestão de tarjas no texto do PDF: CPF e CNPJ (com dígito verificador, para errar menos), RG, PIS/NIS, título de
  eleitor, CNH, número de processo (NUP), e-mail, telefone e CEP. Acha também texto girado, com letras espaçadas e
  dentro de campos de formulário. "Procurar em todos os arquivos" procura em todos os abertos.
- Lista de nomes e outros termos (nome do aluno, do servidor, da rua): digitada, colada ou importada de .txt, com
  "só palavra inteira" e "ignorar maiúsculas e acentos". A lista é dado pessoal: some ao fechar, a não ser que você
  marque "Guardar a lista neste computador".
- Revisão em lista: todas as sugestões do arquivo, com página, tipo e trecho; desmarque as erradas e aceite as
  marcadas. Clicar numa linha leva à página.
- Versão com leitura de PDF digitalizado (OCR), num segundo arquivo (`TarjaLivre-OCR-1.0.0.html`, cerca de 8 MB):
  as páginas sem texto são lidas no próprio computador, sem internet, e o que for achado vira sugestão.

### Para salvar com segurança
- Cada página é refeita como imagem (PNG ou JPEG), no tamanho original: o texto coberto deixa de existir no arquivo.
  Comentários, campos de formulário, metadados e JavaScript do original não passam para o salvo.
- Conferência automática: antes de terminar, o programa lê de novo o PDF gerado e só salva se não sobrar nenhum
  caractere de texto.
- "Revisei todas as páginas" só libera depois de ver cada página, e qualquer mudança desmarca. Enquanto salva, nada
  na tela muda, nem pelo teclado.
- Folha de conferência no fim do PDF (opcional): data, SHA-256 do original, tarjas por página, tipos procurados,
  quantos termos da lista e quantas páginas lidas por OCR, sem mostrar nada do que foi coberto.
- SHA-256 do original e do PDF salvo.
- Recusa com aviso arquivo que não é PDF, PDF com senha, página com defeito e PDF com mais de 1.000 páginas; página
  enorme sai inteira, com resolução menor, em vez de sair em branco. Página com unidade de medida própria
  (/UserUnit) recebe as sugestões no lugar certo.

### Outros
- Botão "Ver se há versão nova" na janela Ajuda e Sobre: só abre a página de versões no navegador.
- O texto completo das licenças (do programa e das bibliotecas) vai dentro do próprio arquivo, em "Ajuda e Sobre".
- Bibliotecas dentro do arquivo, sem CDN: PDF.js 4.10.38 (já sem a falha CVE-2024-4367), jsPDF 4.2.1 e, na versão
  com OCR, Tesseract.js 7.0.0 com os dados do português.
