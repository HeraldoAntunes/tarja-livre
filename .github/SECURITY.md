<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# Segurança e privacidade

## Como o Tarja Livre protege os documentos

- **A tarja não sai.** Ao salvar, cada página é desenhada como imagem já com as tarjas, e o PDF novo é feito só com
  essas imagens. O texto coberto, os comentários, os campos de formulário, os metadados e qualquer JavaScript do
  original não passam para o arquivo salvo. Os testes conferem isso pixel a pixel e byte a byte.
- **Funciona offline e não envia nada.** É um único arquivo HTML que roda no navegador. Não tem servidor, contas,
  telemetria, anúncios nem rastreamento. O documento nunca sai do computador.
- **Política de segurança no próprio arquivo.** O HTML traz uma `Content-Security-Policy` que só deixa rodar os
  scripts embutidos (cada um liberado pelo seu SHA-256) e bloqueia qualquer acesso à rede, imagens externas,
  formulários e plug-ins. O PDF.js abre os arquivos com `isEvalSupported: false` e sem scripts do PDF.
- **Arquivos hostis recusados com aviso:** arquivo que não é PDF, PDF com senha, página com defeito ou tamanho
  absurdo, PDF com mais de 1.000 páginas.
- **Bibliotecas embutidas e conferidas:** PDF.js 4.10.38 e jsPDF 4.2.1, sem falha conhecida aplicável na data da
  versão (lista em `THIRD-PARTY-NOTICES.md`).
- **Arquivo conferível.**
  - Cada versão vem com `SHA256SUMS.txt`.
  - Cada anexo da release vem com uma assinatura do Sigstore (`<arquivo>.sigstore.json`), feita pelo workflow
    `assinar-release.yml` deste repositório. Para conferir (com o
    [cosign](https://docs.sigstore.dev/cosign/system_config/installation/)):
    `cosign verify-blob --bundle <arquivo>.sigstore.json --certificate-identity-regexp "^https://github.com/HeraldoAntunes/tarja-livre/.github/workflows/assinar-release.yml@" --certificate-oidc-issuer https://token.actions.githubusercontent.com <arquivo>`
  - A release também traz um atestado de origem (SLSA), `tarja-livre-<versão>.intoto.jsonl`. Com o
    [GitHub CLI](https://cli.github.com/): `gh attestation verify <arquivo> --repo HeraldoAntunes/tarja-livre`

## O que o programa não garante

O Tarja Livre ajuda a cobrir dados pessoais, mas não garante anonimização perfeita nem conformidade jurídica com a
LGPD. A procura automática lê só o texto do PDF: não funciona em PDF digitalizado e não reconhece nomes nem
endereços. Quem salva confere cada página, e o PDF salvo deve ser revisto antes de compartilhar.

## Versões com suporte

Só a versão mais recente recebe correções de segurança. A versão em uso aparece na janela **Ajuda e Sobre**.

## Como relatar uma vulnerabilidade

Não abra uma *issue* pública com os detalhes da falha, e **nunca anexe um documento real**. Use o aviso privado do
GitHub: no repositório, aba **Security**, botão **Report a vulnerability**. Informe a versão, o navegador, o passo a
passo para reproduzir (com um PDF feito só para o teste) e o impacto. Falha em que um dado coberto continua
recuperável no PDF salvo é tratada como a mais grave.

O que esperar:
- confirmação de recebimento em até 7 dias;
- avaliação e plano de correção em até 30 dias;
- a correção sai numa versão nova, com a falha descrita no CHANGELOG e no aviso de segurança publicado depois da
  correção (divulgação coordenada). Quem relatou recebe crédito, se quiser.

Correções de segurança têm prioridade sobre qualquer outro trabalho no projeto.
