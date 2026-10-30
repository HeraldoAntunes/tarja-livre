<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Testes de ponta a ponta no Linux, 3 rodadas seguidas

Este documento conta a segunda bateria dos 9 testes de ponta a ponta no Linux, em 30/10/2026, para ver se algum
teste é instável. O jeito de rodar e o que mudou na camada dos testes estão em
[E2E-MULTIPLATAFORMA.md](E2E-MULTIPLATAFORMA.md).

## O que foi testado

- **Commit testado:** `49d07c366dc37cb8116ae4a25a9ba2f055f93607`, no ramo `e2e-multiplataforma`. É o merge da
  `main` (`ecbfbae`, com a correção do `e2e_andamento`, que agora espera a oferta de recuperação) com o commit
  `9c0e23b` deste ramo. Nada em `src/` mudou.
- **Onde:** os mesmos de E2E-MULTIPLATAFORMA.md: Ubuntu 24.04.5 num contêiner sem tela, Chromium 153.0.8010.12 (o
  do Playwright 1.63.0) e Firefox 136.0, os dois sem janela; Node.js 22.22.0, Python 3.13.17, PyMuPDF 1.27.2.3 e
  numpy 2.5.3.
- **Como:** 3 rodadas seguidas. Em cada rodada, os 9 testes no Chromium e depois os 9 no Firefox, um teste de cada
  vez (`node tests/<teste>.mjs`, com `TARJA_NAVEGADOR`). Nenhum teste foi repetido nem pulado.

## Resultado

| Navegador | Rodada 1 | Rodada 2 | Rodada 3 |
|---|---|---|---|
| Chromium | 8 de 9 | 8 de 9 | 8 de 9 |
| Firefox | **7 de 9** | 8 de 9 | 8 de 9 |

O `e2e_ocr` falhou nas 6 vezes, como esperado, pelo defeito do @. Fora isso, houve **uma falha a mais, que não era
esperada**: o `e2e_varios` no Firefox, na rodada 1 (ver "Teste instável" abaixo).

**O "queda 1" não falhou nenhuma vez.** O `e2e_andamento` passou nas 6 vezes, nos dois navegadores, com as 4 quedas
no meio do trabalho e a queda no salvamento.

Depois de cada teste, nenhum navegador ficou aberto e nenhuma pasta temporária `tarja-e2e-*` ficou para trás.

### Cada teste, por rodada

Tempo em segundos entre parênteses.

| Teste | Chromium 1 | Chromium 2 | Chromium 3 | Firefox 1 | Firefox 2 | Firefox 3 |
|---|---|---|---|---|---|---|
| `e2e` | passou (11) | passou (5) | passou (6) | passou (24) | passou (9) | passou (9) |
| `e2e_pdf_teste` | passou (17) | passou (14) | passou (16) | passou (22) | passou (24) | passou (23) |
| `e2e_varios` | passou (4) | passou (5) | passou (5) | **falhou** (6) | passou (7) | passou (7) |
| `e2e_ocr` | falhou (3) | falhou (3) | falhou (3) | falhou (5) | falhou (5) | falhou (5) |
| `e2e_andamento` | passou (43) | passou (42) | passou (45) | passou (60) | passou (64) | passou (60) |
| `e2e_auditoria` | passou (5) | passou (5) | passou (5) | passou (7) | passou (7) | passou (6) |
| `e2e_auditoria2` | passou (28) | passou (29) | passou (29) | passou (35) | passou (36) | passou (35) |
| `e2e_export_real` | passou (8) | passou (7) | passou (8) | passou (8) | passou (9) | passou (8) |
| `e2e_telas` | passou (5) | passou (5) | passou (5) | passou (9) | passou (10) | passou (9) |

### As mensagens das falhas

`e2e_ocr`, nas 6 vezes, igual:

```
OCR FALHOU: E-mail 1 em 3 pendente(s): CPF 1, Telefone 1, Termo da lista 1
```

É o defeito do @ descrito em E2E-MULTIPLATAFORMA.md: com as fontes do Linux, o OCR lê o @ do e-mail como "O" e
parte o endereço em mais de uma palavra, e `corrigirOcr()` em `src/achados.js` não trata isso.

`e2e_varios`, Firefox, rodada 1:

```
vários arquivos FALHOU: console sem erro inesperado
+ [
+   'warning: miniatura não desenhada 2 [object Object]',
+   'TypeError: doc is null'
+ ]
- []
```

## Teste instável: `e2e_varios` no Firefox

Falhou 1 vez em 6 no Firefox (0 em 6 no Chromium, somando as rodadas desta bateria). Pelo que o console mostra,
**o defeito é do programa, e não do teste**. Não foi corrigido aqui (este trabalho não mexe em `src/`).

O que acontece: no fim, o teste fecha três abas em seguida (o X de uma aba e o botão **Fechar** duas vezes). Ao abrir
ou trocar de arquivo, `montarMiniaturas()` em `src/app.js` desenha as miniaturas uma de cada vez, num laço que lê
`doc.paginas.length` a cada volta:

```js
for (let i = 0; i < doc.paginas.length && minha === geracao; i++) await redesenharMiniatura(i);
```

Se o arquivo da tela é fechado enquanto esse laço está no meio, `doc` vira `null` antes de a condição ser lida de
novo. Aí:

1. a miniatura que estava sendo desenhada falha, porque o PDF já foi fechado (é o aviso "miniatura não desenhada 2");
2. o laço lê `doc.paginas.length` com `doc` nulo e estoura um `TypeError` não tratado ("doc is null" é como o
   Firefox escreve; o Chromium escreveria "Cannot read properties of null").

A condição até confere `minha === geracao`, mas depois de `doc.paginas.length`, então a conferência chega tarde. Depende
do tempo: só aparece quando o fechamento cai bem no meio do desenho das miniaturas. Por isso falhou uma vez só, e só no
Firefox, que nesta máquina é mais lento. Também pode acontecer no Chromium e no Windows, com outro ritmo. Para quem usa
o programa, o efeito é só um erro no console: a aba fecha normalmente.

Uma correção possível, para quem for mexer em `src/`: conferir `minha === geracao` (e `doc`) antes de
`doc.paginas.length`, ou guardar o documento numa variável local antes do laço. O teste não deve ser afrouxado para
aceitar esse erro: o "console sem erro inesperado" é o que pegou o defeito.

## Resumo

- Esperado: só o `e2e_ocr` falhando. Visto: o `e2e_ocr` nas 6 vezes, e o `e2e_varios` uma vez no Firefox, por uma
  corrida no programa ao fechar uma aba enquanto as miniaturas são desenhadas.
- O `e2e_andamento`, com a correção da `main`, passou nas 6 vezes; o "queda 1" não falhou nenhuma vez.
- Nada foi publicado: sem tag, sem release e sem mexer na `main`.
