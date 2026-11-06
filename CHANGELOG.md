# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e numeração em
[Versionamento Semântico](https://semver.org/lang/pt-BR/). Escrito para quem usa o programa.

## Não publicado

## [1.2.3] - 2026-11-06

### Pedidos do professor depois de usar a Tarja (04/11/2026)
- **Mão:** ferramenta nova, a escolhida ao abrir um PDF. Arrastar com ela anda pela página ampliada sem tarjar
  nada; o clique numa sugestão só a mostra. Segurar a barra de espaço vira Mão por um momento.
- **Sugestões à vista:** ao fim da procura o painel vai até a lista, que ganha três passos curtos de como usar; a
  barra de cima mostra quantas faltam conferir; a sugestão aberta ganha, junto dela na página, os botões Aceitar e
  Descartar.
- **Cores da tarja:** cinco cores, sempre opacas: preta, cinza-escura, azul-marinho, vinho e verde-escura. A
  sugestão aceita sai na cor escolhida.
- **Sem tarja branca:** numa página branca ela escondia que algo foi tirado. O andamento guardado por uma versão
  antiga com tarja branca volta com ela preta, e o aviso diz isso.
- **Procurar em destaque:** a seção "Sugerir tarjas" é a primeira do painel, com o botão grande **Procurar dados
  pessoais** no topo; os tipos de dado e a lista de nomes ficam em "Opções da procura", que abre e fecha e diz o que
  vai ser procurado. Depois da procura, a lista e os botões de aceitar ficam à vista sem rolar (1366x768).
- **Salvar durante a procura:** enquanto a procura roda, o Salvar e o "Revisei" ficam desligados, e a procura que traz
  sugestão nova desmarca o "Revisei". Antes, clicar em Salvar logo depois de Procurar gravava o PDF sem as tarjas.
- **Todo desenho conta:** linha de tabela, sublinhado, moldura e qualquer tinta que não seja texto, até a bem clara
  (amarelo-pálido, cinza 0,98), fazem a página sair com "confira". Página com tabela, linha ou desenho sempre pede conferência, porque o programa não distingue um desenho inofensivo de um dado desenhado.
- **Letras sósias e texto estranho:** a procura lê as letras cirílicas e gregas que se desenham como latinas (Ѕ, І,
  О, С...), os algarismos de largura total e os traços parecidos com o hífen como as letras comuns. A página cujo texto
  tem letra de outra escrita que não a latina (as letras gregas de fórmula não contam), caracteres de uso privado ou
  sem desenho conhecido, ou letras pintadas que não estão no texto do PDF (comum quando a fonte do PDF está com o mapa
  de letras errado) pede conferência
  como a de desenho: aviso, "confira" e visita obrigatória antes do Salvar. Se a fonte do PDF trocar uma letra latina por outra letra latina, ou fizer uma ou duas letras do dado virarem espaço no texto do PDF (o texto copiado sai diferente do que se vê), o programa não percebe: só uma comparação do OCR entre a imagem e o texto descobriria isso.
- **Letras gregas parecidas com latinas:** a procura lê α, γ, ε, η, ι, κ, μ, ν, ο, ρ, σ, τ, υ, χ e ω como as latinas
  parecidas, e a grega dessas junto de letra latina na mesma palavra ("mαriαnα", "εvα") pede conferência; "μm",
  "μS/cm", "Δt", "kΩ" e "πr²" continuam livres.
- **Nomes da lista sem pontuação:** a procura não liga para pontuação e espaços dos dois lados: "123.456.789-00" acha
  também "123.456.78900", quando o PDF tira o hífen do texto.
- **Só uma ajuda:** a seção da procura, os passos do "Conferir e aceitar" e o resultado da procura dizem que a parte
  automática é só uma ajuda e que nada dispensa olhar cada página; o "Nada encontrado" diz que isso não quer dizer que
  o documento não tem dados pessoais.
- **Aceitar à vista:** depois da procura, o botão verde **Conferir e aceitar (N)**, acima da lista, abre cada sugestão
  "confira" na página, uma por vez, com o motivo e os botões Aceitar e Descartar junto dela; sem "confira" pendente,
  ele vira **Aceitar todas (N)**. Os itens da lista ficam curtos ("p. 1 · CPF · confira"), o aviso das páginas com
  imagem ou desenho aparece uma vez acima da lista, e os botões de grupo ficam em "Mais opções".
- **Aceitar com "confira" nunca falha calado:** quando o Aceitar todas, o Aceitar desta página ou o Aceitar marcadas
  deixa sugestões "confira" de fora, o aviso diz quantas faltam e por quê, e a primeira abre na página com Aceitar e
  Descartar junto dela; aceitar ou descartar abre a próxima. A que abre sozinha não conta como conferida: só entra pelo
  Aceitar junto dela.
- **Cartão "Abra um PDF para começar":** o clique (e Enter ou espaço) abre a escolha de arquivo, e ele se destaca
  ao arrastar um arquivo por cima.

### Corrigido
- PDF digitalizado com camada de texto invisível (o OCR de impressora ou de outro programa) que não coincide com as
  letras da imagem: a tarja sugerida agora vai até as letras da imagem, também as cinza-claras. Antes ela seguia a
  camada e podia deixar o fim de um nome ou a metade de cima das letras à mostra. A tarja só cresce na linha das
  letras, até um limite; se a camada está longe das letras, a tarja vai para a palavra da mesma largura mais perto.
  Em fonte de largura fixa, a tarja atravessa o vão maior em volta das letras estreitas, como o I, e não para mais
  antes do fim da palavra.
- O texto escondido de outros jeitos também conta como camada invisível: transparente (opacidade zero), branco,
  recortado ou embaixo da imagem. Antes só os modos de pintura 3 e 7 contavam, e o texto transparente ganhava uma
  tarja no lugar da camada, longe da palavra da imagem, sem "confira". Agora o programa desenha a página com e sem o
  texto: o texto que não muda o desenho não aparece e ganha "confira", seja qual for o jeito de esconder, mesmo com
  outra palavra da imagem embaixo dele. Nesse caso o dado pode estar desenhado em outro lugar da página, que só você
  acha: a nota diz que o dado pode estar em outro ponto da página e manda procurar e tarjar à mão.
- O texto que aparece, mas com imagem embaixo ou perto dele, também ganha "confira" quando não tem o tamanho e o
  lugar das letras da imagem: a camada minúscula embaixo do dado grande da imagem, ou em cinza claro sobre outra
  palavra, com o dado na linha de cima. Antes a sugestão saía sem aviso e o dado da imagem ficava inteiro.
- Página com imagem ou desenho (foto, logotipo, carimbo, assinatura, texto em curvas ou em blocos, área pintada), em
  qualquer lugar e com sugestão ou sem: a página entra no aviso da procura, todas as sugestões dela saem com "confira"
  e a nota "esta página tem imagem ou desenho; o programa pode não ver dados que estejam nela; confira a página
  inteira", e o "Revisei" só libera depois que a pessoa passar de novo por ela. Na versão com OCR, essas páginas passam pelo OCR sem a camada de texto, e o dado lido
  no desenho vira sugestão. Sem OCR, o dado que só existe em imagem ou desenho não é lido, e o OCR pode não ler imagem
  muito clara ou girada; o Guia e o README dizem isso. Qualquer imagem na página conta, mesmo de tinta clara.
- Toda sugestão que o OCR leu numa página digitalizada sai com "confira" e a nota "lida pelo OCR, que pode errar letras
  ou não ler o dado pequeno, claro ou girado; confira a página inteira".
- Toda sugestão tirada dessa camada aparece na lista com "confira" e uma nota do que conferir (tarja ajustada à
  imagem e que pode não ser o dado, tarja que pode ter ficado curta, tarja que pode cobrir letras vizinhas, camada que não coincide com a imagem,
  ou letras não achadas: tarjar à mão). **Aceitar todas** e **Aceitar marcadas** deixam essas sugestões na lista até
  você clicar em cada uma para ver na página, e o **Salvar** não passa enquanto houver alguma não vista.
  **Descartar** com sugestão "confira" que você não abriu pergunta antes, avisando que esses dados continuam legíveis
  no PDF; dizendo não, nada é descartado.
- Fechar um arquivo no meio da procura não mostra mais "Nada encontrado" sobre o outro arquivo na tela, que ainda
  não foi procurado.
- Fechar a aba no meio da procura não deixa mais o botão **Procurar no documento** desligado até recarregar a página.
- **Fechar** clicado logo depois de escolher o arquivo, antes de ele aparecer, cancela a abertura. Antes o botão
  ficava desligado e o arquivo abria logo depois.
- Fechar a aba enquanto as miniaturas são desenhadas não deixa mais aviso no console.
- O aviso de arquivo que não abriu (PDF com senha, PDF com defeito) e de procura que falhou fica 10 segundos na tela,
  em vez de 4.

### Manutenção
- Testes novos: fechar a aba no meio da procura e das miniaturas (`tests/e2e_fechar_no_meio.mjs`), o ajuste da caixa
  às letras da imagem (`tests/tinta.test.mjs`), o "confira" e a procura cancelada (`tests/e2e_confira.mjs`) e a prova
  da tarja com 17 PDFs difíceis (`tests/prova_tarja`), trazida da validação de 03/11/2026, com os 3 cenários da
  revisão do Codex (letra cinza-clara, camada longe, letra vizinha colada). Os PDFs originais das revisões do Codex e
  8 jeitos de esconder a camada ficam em `tests/casos-codex` (`tests/e2e_prova_ocr.mjs` confere os pixels no PDF
  salvo), e `tests/e2e_procura_fechar.mjs` e os testes das miniaturas vêm da validação no Linux.

## [1.2.2] - 2026-11-02

### Corrigido
- As miniaturas param de desenhar sem erro quando a aba é fechada ou trocada no meio do desenho.
- Depois de **Recuperar** as marcas de antes, as miniaturas já mostram o número de marcas de cada página.
- A lista de nomes não volta sozinha ao recarregar a página no navegador (o Firefox a devolvia mesmo sem
  "Guardar a lista neste computador").
- A procura sugere mais e-mails em páginas digitalizadas quando o OCR lê o @ como &, (D, ê ou outras sequências
  previstas, inclusive entre duas palavras. Nomes de arquivo como ARQUITETURA.md não são convertidos em e-mail.
  A leitura ainda pode errar e precisa de conferência visual.

### Manutenção
- Os testes passam a limpar suas pastas temporárias ao terminar, inclusive em caminhos de falha tratados.
  Uma conferência separada compara a pasta temporária antes e depois dos testes sem janela e do Rust, sem apagar
  arquivos que já estavam lá.
- Novos testes de propriedades exercitam a procura com textos variados; testes de regressão conferem os e-mails
  do OCR e a interrupção do desenho das miniaturas. A suíte tem a opção de rodar sem iniciar navegador.
- Atualização do PDF.js usado apenas nos testes da auditoria e ajustes nos textos montados pelos testes para
  tratar os avisos do CodeQL. O PDF.js incorporado ao programa permanece na mesma versão.
- Os motivos das exceções de dependências do build Linux ficam registrados ao lado do Cargo.lock para a análise
  de dependências. Uma exceção documentada não significa que a dependência foi corrigida.
- O teste de recuperação espera a oferta aparecer antes de conferir a tela; o CI instala também a biblioteca de
  cálculo usada na conferência dos pixels.
- O teste do programa em PC limpo guarda mais diagnósticos da janela. Por enquanto, o teste de abrir PDF, tarjar e
  salvar dentro do exe roda só no windows-2022: o WebView2 do windows-latest não oferece a porta de depuração
  esperada por esse teste. Isso não representa uma correção aplicada à janela do programa.

### Documentação
- Roteiro para conferir o HTML no Linux e rascunho do manifesto da 1.2.1 para o winget. O manifesto ainda precisa
  da decisão de envio; o roteiro não certifica compatibilidade com todos os navegadores.
- Registro das correções e dispensas dos avisos do GitHub, com os motivos e as limitações de cada caso.

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
