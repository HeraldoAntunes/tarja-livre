<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Como contribuir

Obrigado pelo interesse! O Tarja Livre é software livre (MIT), feito para tarjar dados pessoais em PDF antes de
compartilhar documentos.

- **Relatar um problema:** abra uma *issue* com a versão (janela **Ajuda e Sobre**), o navegador, o passo a passo e,
  se possível, um print. **Nunca anexe documento real nem dado pessoal de ninguém:** reproduza com um PDF feito só
  para o teste. Problemas de segurança vão pelo caminho descrito em [SECURITY.md](SECURITY.md).
- **Propor uma melhoria:** descreva a situação em que ela ajuda (secretaria, coordenação, sala de aula...).
- **Enviar código:**
  1. Para entender o código, leia `docs/ARQUITETURA.md`. A procura de dados pessoais (`src/achados.js`) não depende
     da interface e tem testes próprios: mudança nela vem com teste.
  2. Sem dependência nova sem discutir antes numa *issue*. O resultado precisa continuar sendo um único arquivo HTML
     que funciona offline e não acessa a rede.
  3. Mudança que toque na tarja, na procura ou no PDF salvo precisa passar no teste do PDF de teste
     (`tests/e2e_pdf_teste.mjs`), que confere a cobertura pixel a pixel. Caso novo entra em
     `tests/fixtures/gerar_pdf_teste.py`.
  4. Dados de exemplo só fictícios, nas faixas de `tests/fixtures/LEIA-ME.md` (o teste `tests/ficticios.test.mjs`
     reprova o resto).
  5. Antes do *pull request*, rode `python scripts/montar.py`, `node --test tests/achados.test.mjs
     tests/montar.test.mjs tests/ficticios.test.mjs` e os testes de ponta a ponta, todos de uma vez, com `python -X utf8 tests/todos.py` (precisam
     do Microsoft Edge; com `TARJA_EXE=<exe>`, rodam dentro do `.exe`).
     Mudança de comportamento vem com teste que falha sem ela.
  6. Textos da interface em português do Brasil, com acentuação correta e sem travessão.
  7. Todo arquivo de código novo começa com o cabeçalho de autoria e licença (`SPDX-License-Identifier: MIT`).

Ao contribuir, você concorda em licenciar a sua contribuição sob a licença MIT do projeto e em seguir o
[Código de Conduta](CODE_OF_CONDUCT.md).

## Uso de IA generativa

Assistentes de programação de IA podem ser usados como ferramenta, inclusive pelo autor do projeto. A regra segue a
prática de projetos como o kernel do Linux:

- **A responsabilidade é de quem envia.** A pessoa revisa e entende todo o código, confere que nada foi copiado de
  fonte com licença incompatível com a MIT e responde pela contribuição. A IA não é autora nem coautora.
- **Declare o uso no commit**, com a linha final `Assisted-by: <ferramenta>:<modelo>`, por exemplo
  `Assisted-by: Claude:claude-opus-5-5`. Não use `Co-authored-by` para ferramentas: ele é reservado a pessoas.
- **Diga no *pull request*** o que a ferramenta fez e o que foi verificado (testes rodados, comportamento conferido).
  Relato de falha encontrado com ajuda de IA precisa de passo a passo que reproduza o problema.
