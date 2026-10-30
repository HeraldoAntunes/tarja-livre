<!-- Tarja Livre — © 2026 Heraldo Antunes — Licença MIT (ver LICENSE) -->
# PDFs de teste da auditoria externa (29/10/2026)

Vieram da auditoria independente de 29/10/2026 (rodada 1, sobre a 1.1.0). O gerador original está em
`gerar_auditoria.py` (usa `reportlab` e `pypdf`; não roda nos testes, fica como registro de como foram feitos). Os dados
são todos fictícios: o e-mail usa o domínio `.test`, reservado para testes, e os textos "SEGREDO_..." são marcas para
conferir que nada do original passa para o PDF salvo.

| Arquivo | Para quê |
|---|---|
| `simple.pdf` | Uma página com o e-mail `sintetico@exemplo.test` e uma linha pública. Tem título e autor nos metadados, JavaScript, anexo e comentário, todos com a marca "SEGREDO_...". |
| `simple-original.pdf` | A mesma página, sem metadados, script, anexo nem comentário: referência para a conferência por pixel. |
| `wide-userunit.pdf` | Página de 1.000 × 50 com `/UserUnit 20`, ou seja, 20.000 × 1.000 pt de verdade: maior que o PDF salvo aceita. |
| `password.pdf` | `simple.pdf` com senha. |
| `1001-pages.pdf` | 1.001 páginas em branco, uma acima do limite. |

Usados em `tests/e2e_export_real.mjs`, com a conferência por pixel de `tests/conferir_pixels.py` (PyMuPDF).
