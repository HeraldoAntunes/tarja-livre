# Dados de teste do Tarja Livre

Tudo aqui é inventado para os testes. Nenhum documento real entra no projeto.

- `gerar_pdf_teste.py` gera, byte a byte, `tarja-teste.pdf` (o documento de teste), `tarja-teste-dados.pdf` (a
  máscara: só os dados pessoais, no mesmo lugar) e `tarja-teste.json` (o que a procura deve achar). Nunca edite os
  PDFs à mão: mude o script e rode de novo.

## Como os dados de exemplo foram escolhidos

| Dado | Regra | Por que é seguro |
|---|---|---|
| Telefone | DDD 00, como `(00) 91234-5678` | não existe DDD 00 no Brasil |
| CEP | começa com 000, como `00012-345` | os CEPs do Brasil começam em 01 (São Paulo); não há CEP começando em 000 |
| E-mail | domínio `.test`, como `fulano.teste@exemplo.test` | `.test` é reservado para testes (RFC 2606 e 6761) e nunca é usado na internet |
| RG | número com zeros na frente, como `00.000.123-4` | não segue numeração real de nenhum estado |
| CPF | `831.975.872-60`, `514.334.988-55`, `833.311.475-08`, `834.068.419-10` | sorteados em 27/10/2026, com dígito verificador válido para a procura achar |
| CNPJ | `19.808.456/0001-00` | sorteado em 27/10/2026, idem |

CPF e CNPJ não têm faixa reservada para exemplo: qualquer número com dígito verificador válido pode, por acaso, ter
sido emitido para alguém. Os da tabela foram sorteados e nunca ligados a nenhum nome real. O teste
`tests/ficticios.test.mjs` reprova o projeto se aparecer CPF ou CNPJ válido fora desta lista, telefone com outro
DDD, CEP fora da faixa 000 ou e-mail fora do domínio `.test`.
