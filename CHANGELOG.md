# Histórico de versões

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e numeração em
[Versionamento Semântico](https://semver.org/lang/pt-BR/). Escrito para quem usa o programa.

## Não publicado

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
