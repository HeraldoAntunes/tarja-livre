# Resultados (gerado por analisar.mjs)

Regra simulada: a proposta (tests/estudo-ocr/regra.mjs)

E-mails lidos: 9606, em 966 páginas. Contraexemplos: 10764 (9624 lidos pelo OCR, 97 escritos à mão, 1043 linhas dos textos do repositório).

## Leituras do @ por frequência

| Leitura (␣ = espaço) | Vezes | % | % acumulado | A regra aceita? |
|---|---:|---:|---:|---:|
| `&` | 1910 | 19,9% | 19,9% | sim |
| `G` | 973 | 10,1% | 30,0% | não |
| `Q` | 639 | 6,7% | 36,7% | sim |
| `(D` | 574 | 6,0% | 42,6% | sim |
| `O` | 446 | 4,6% | 47,3% | não |
| `g` | 423 | 4,4% | 51,7% | não |
| `t` | 323 | 3,4% | 55,0% | não |
| `(Q` | 223 | 2,3% | 57,4% | sim |
| `(O` | 219 | 2,3% | 59,7% | sim |
| `(&` | 171 | 1,8% | 61,4% | sim |
| `&Q` | 168 | 1,7% | 63,2% | sim |
| `␣&` | 155 | 1,6% | 64,8% | sim |
| `Q&` | 154 | 1,6% | 66,4% | sim |
| `␣Q` | 123 | 1,3% | 67,7% | não |
| `E` | 117 | 1,2% | 68,9% | não |
| `␣O` | 116 | 1,2% | 70,1% | não |
| `&G` | 103 | 1,1% | 71,2% | sim |
| `G&` | 96 | 1,0% | 72,2% | sim |
| `&g` | 96 | 1,0% | 73,2% | sim |
| `t&` | 85 | 0,9% | 74,1% | sim |
| `ê` | 80 | 0,8% | 74,9% | sim |
| `d` | 78 | 0,8% | 75,7% | não |
| `&D` | 73 | 0,8% | 76,5% | sim |
| `e` | 72 | 0,7% | 77,2% | não |
| `␣G` | 60 | 0,6% | 77,8% | não |
| `0` | 55 | 0,6% | 78,4% | não |
| `O&` | 54 | 0,6% | 79,0% | sim |
| `&M` | 52 | 0,5% | 79,5% | sim |
| `␣` | 52 | 0,5% | 80,1% | não |
| `gG` | 51 | 0,5% | 80,6% | não |
| `&&` | 45 | 0,5% | 81,1% | sim |
| `(&D` | 42 | 0,4% | 81,5% | sim |
| `(o` | 41 | 0,4% | 81,9% | sim |
| `&␣` | 36 | 0,4% | 82,3% | sim |
| `C` | 36 | 0,4% | 82,7% | não |
| `(d` | 34 | 0,4% | 83,0% | sim |
| `f` | 34 | 0,4% | 83,4% | não |
| `B` | 33 | 0,3% | 83,7% | não |
| `␣E` | 32 | 0,3% | 84,1% | não |
| `(P` | 30 | 0,3% | 84,4% | sim |

Leituras aceitas pela regra: 5633 de 9606 (58,6%).

Leituras diferentes: 473. As 40 mais comuns somam 84,4%.

## Leituras sem os espaços em volta

| Sequência | Vezes | % | A regra aceita? |
|---|---:|---:|---:|
| `&` | 2128 | 22,2% | sim |
| `G` | 1033 | 10,8% | não |
| `Q` | 772 | 8,0% | sim |
| `(D` | 580 | 6,0% | sim |
| `O` | 577 | 6,0% | não |
| `g` | 425 | 4,4% | não |
| `t` | 324 | 3,4% | não |
| `(Q` | 226 | 2,4% | sim |
| `(O` | 223 | 2,3% | sim |
| `(&` | 180 | 1,9% | sim |
| `&Q` | 178 | 1,9% | sim |
| `E` | 162 | 1,7% | não |
| `Q&` | 158 | 1,6% | sim |
| `&G` | 104 | 1,1% | sim |
| `G&` | 97 | 1,0% | sim |
| `&g` | 96 | 1,0% | sim |
| `t&` | 85 | 0,9% | sim |
| `ê` | 80 | 0,8% | sim |
| `d` | 78 | 0,8% | não |
| `(nada)` | 77 | 0,8% | não |
| `e` | 75 | 0,8% | não |
| `&D` | 74 | 0,8% | sim |
| `O&` | 62 | 0,6% | sim |
| `0` | 56 | 0,6% | não |
| `C` | 55 | 0,6% | não |
| `&M` | 52 | 0,5% | sim |
| `gG` | 51 | 0,5% | não |
| `&&` | 45 | 0,5% | sim |
| `(&D` | 42 | 0,4% | sim |
| `(o` | 41 | 0,4% | sim |

## Onde cada sequência aparece

Para cada sequência aceita: quantas vezes ela aparece entre duas partes com cara de e-mail (no lugar do @) e quantas vezes aparece no texto lido dos contraexemplos (como palavra solta ou dentro de palavra).

| Sequência da lista | No lugar do @ (sem os espaços em volta) | Linhas de contraexemplo que a contêm | Contraexemplos que viraram e-mail com a regra |
|---|---:|---:|---:|
| `&` | 3678 | 1641 | 2 |
| `&&` | 56 | 0 | 0 |
| `(D` | 587 | 5 | 0 |
| `(Q` | 251 | 1 | 0 |
| `(O` | 252 | 7 | 0 |
| `(o` | 43 | 17 | 0 |
| `(d` | 34 | 9 | 1 |
| `(P` | 42 | 4 | 0 |
| `(E` | 23 | 0 | 0 |
| `(&` | 255 | 3 | 0 |
| `ê` | 120 | 64 | 0 |

## Leituras que só aparecem no lugar do @

Para as 30 leituras mais comuns (sem os espaços em volta): quantos contraexemplos têm a mesma sequência no mesmo formato, colada entre uma parte com cara de usuário e uma parte com cara de domínio (`algo` + sequência + `dominio.xx`).

| Sequência | No lugar do @ | Contraexemplos com a sequência nesse formato | Exemplo |
|---|---:|---:|---:|
| `&` | 2128 | 4 | `G&Q-emexemplo.test` |
| `G` | 1033 | 2 | `meuGov.gov.br` |
| `Q` | 772 | 1 | `ARQUITETURA.md` |
| `(D` | 580 | 0 |  |
| `O` | 577 | 4 | `SistemaOnline.edu.br` |
| `g` | 425 | 9 | `Original.pdf` |
| `t` | 324 | 305 | `relatorio.final.pdf` |
| `(Q` | 226 | 0 |  |
| `(O` | 223 | 1 | `Ata(Original.pdf` |
| `(&` | 180 | 0 |  |
| `&Q` | 178 | 0 |  |
| `E` | 162 | 10 | `portalEducacao.gov.br` |
| `Q&` | 158 | 0 |  |
| `&G` | 104 | 0 |  |
| `G&` | 97 | 0 |  |
| `&g` | 96 | 0 |  |
| `t&` | 85 | 0 |  |
| `ê` | 80 | 0 |  |
| `d` | 78 | 14 | `edital.pdf` |
| `e` | 75 | 1551 | `exemplo.edu.br` |
| `&D` | 74 | 0 |  |
| `O&` | 62 | 0 |  |
| `0` | 56 | 0 |  |
| `C` | 55 | 8 | `TarjaLivre-OCR-1.2.1.html` |
| `&M` | 52 | 0 |  |
| `gG` | 51 | 0 |  |
| `&&` | 45 | 0 |  |
| `(&D` | 42 | 0 |  |
| `(o` | 41 | 0 |  |
| `B` | 35 | 1 | `CONTRIBUTING.md` |

## Taxa de acerto, antes e depois da regra

"Inteiro": a sugestão é o e-mail inteiro, letra por letra. "Algum": houve alguma sugestão de e-mail na linha (pode cobrir só parte dele, quando o OCR errou outra letra).

|  | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| Todos | 9606 | 6,8% | 7,0% | 54,6% | 56,1% |

Teto: se o OCR lesse o @ certo e o resto do e-mail como leu, a procura de hoje acharia o e-mail inteiro em 8802 de 9606 (91,6%). O que falta até o teto é o @ lido como outra coisa que a regra não aceita; o que falta depois do teto são erros do OCR em outras letras do e-mail.

### Por desenho

| desenho | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| navegador | 3000 | 6,4% | 6,4% | 55,7% | 56,6% |
| pil | 6600 | 7,0% | 7,3% | 54,1% | 55,9% |
| reproducao | 6 | 33,3% | 33,3% | 50,0% | 50,0% |

### Por fonte

| fonte | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| Bitstream Charter | 300 | 9,3% | 9,7% | 83,3% | 84,7% |
| Caladea | 451 | 2,0% | 2,0% | 90,7% | 92,0% |
| Carlito | 451 | 7,1% | 7,1% | 44,1% | 45,9% |
| Courier 10 Pitch | 300 | 0,0% | 0,0% | 33,7% | 34,0% |
| DejaVu Sans | 451 | 3,1% | 3,1% | 72,5% | 72,5% |
| DejaVu Sans Mono | 450 | 0,0% | 0,2% | 2,4% | 2,7% |
| DejaVu Serif | 451 | 5,3% | 5,3% | 76,1% | 77,2% |
| FreeMono | 450 | 0,0% | 0,0% | 23,8% | 24,7% |
| FreeSans | 451 | 9,1% | 9,5% | 78,3% | 80,5% |
| FreeSerif | 450 | 0,2% | 0,2% | 33,3% | 37,6% |
| Inter | 450 | 31,1% | 31,1% | 81,1% | 82,7% |
| JetBrains Mono | 450 | 2,0% | 2,7% | 5,1% | 5,8% |
| Liberation Mono | 450 | 2,7% | 3,1% | 23,1% | 25,8% |
| Liberation Sans | 451 | 7,8% | 8,0% | 73,2% | 74,1% |
| Liberation Serif | 450 | 0,4% | 0,7% | 92,7% | 93,1% |
| Noto Sans | 450 | 2,2% | 2,2% | 69,6% | 70,9% |
| Noto Sans Mono | 450 | 0,2% | 0,2% | 23,8% | 24,7% |
| Noto Serif | 450 | 5,8% | 6,0% | 70,2% | 70,7% |
| Open Sans | 450 | 4,7% | 4,7% | 68,0% | 69,1% |
| Roboto | 450 | 20,2% | 21,8% | 81,1% | 87,3% |
| Ubuntu | 450 | 32,7% | 33,1% | 68,7% | 71,6% |
| Ubuntu Mono | 450 | 2,4% | 2,7% | 8,9% | 9,6% |

### Por tipo de fonte

| tipo de fonte | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| mono | 3000 | 1,1% | 1,3% | 16,4% | 17,4% |
| sem serifa | 4054 | 13,1% | 13,4% | 70,7% | 72,7% |
| serifa | 2552 | 3,5% | 3,6% | 73,9% | 75,4% |

### Por tamanho (pt)

| tamanho (pt) | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| 8 | 1920 | 6,6% | 7,1% | 53,7% | 55,9% |
| 10 | 1920 | 6,1% | 6,3% | 54,5% | 56,1% |
| 12 | 1920 | 7,3% | 7,4% | 56,3% | 57,2% |
| 14 | 1920 | 7,0% | 7,1% | 55,3% | 56,7% |
| 16 | 1920 | 6,9% | 7,2% | 53,3% | 54,8% |
| 17.28 | 6 | 33,3% | 33,3% | 50,0% | 50,0% |

### Por dpi

| dpi | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| 150 | 3206 | 4,2% | 4,5% | 54,1% | 56,4% |
| 200 | 3200 | 7,7% | 8,0% | 54,6% | 56,0% |
| 300 | 3200 | 8,5% | 8,7% | 55,0% | 56,0% |

### Por estado

| estado | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| limpa | 6306 | 6,6% | 6,8% | 54,4% | 55,7% |
| ruido | 3300 | 7,2% | 7,5% | 55,0% | 57,0% |

### Por final do domínio

| final do domínio | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| .com.br | 2400 | 6,5% | 6,8% | 53,2% | 54,4% |
| .edu.br | 2400 | 7,8% | 8,0% | 56,0% | 57,8% |
| .gov.br | 2400 | 4,7% | 4,9% | 59,3% | 60,8% |
| .test | 2406 | 8,3% | 8,5% | 49,9% | 51,6% |

### Por parte antes do @

| parte antes do @ | E-mails | Antes: inteiro | Antes: algum | Depois: inteiro | Depois: algum |
|---|---:|---:|---:|---:|---:|
| com hífen | 2700 | 6,7% | 6,9% | 62,9% | 63,6% |
| com número | 3300 | 5,1% | 5,4% | 43,5% | 46,3% |
| com ponto | 1806 | 9,2% | 9,4% | 61,1% | 62,5% |
| simples | 1800 | 7,7% | 7,8% | 56,0% | 56,6% |

## Comparação de listas de sequências

| Lista | E-mail inteiro sugerido | Contraexemplos que viram e-mail (todos) | Só os lidos pelo OCR |
|---|---:|---:|---:|
| hoje (só corrigirOcr) | 654 (6,8%) | 1 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta | 5245 (54,6%) | 3 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q (Q depois de um espaço, colado no domínio) | 5365 (55,9%) | 4 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q, ␣O, ␣G | 5531 (57,6%) | 5 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + letras sozinhas (G, g, O, E...) | 8239 (85,8%) | 1276 de 10764 (11,9%) | 1240 de 9624 (12,9%) |
| só "&" e "(D" | 4293 (44,7%) | 3 de 10764 (0,0%) | 0 de 9624 (0,0%) |
| a proposta + maiúsculas coladas entre minúsculas | 6871 (71,5%) | 7 de 10764 (0,1%) | 0 de 9624 (0,0%) |
| a proposta + ␣Q + maiúsculas coladas | 6991 (72,8%) | 8 de 10764 (0,1%) | 0 de 9624 (0,0%) |

Contraexemplos que viram e-mail com "a proposta + ␣Q (Q depois de um espaço, colado no domínio)" (3, até 12): `barros&lima.adv.br` → `barros&lima.adv.br`; `Silva&Souza.com.br` → `Silva&Souza.com.br`; `Acesse␣Qualidade.gov.br` → `Acesse␣Qualidade.gov.br`

Contraexemplos que viram e-mail com "a proposta + ␣Q, ␣O, ␣G" (4, até 12): `Portal␣Gov.br` → `Portal␣Gov.br`; `barros&lima.adv.br` → `barros&lima.adv.br`; `Silva&Souza.com.br` → `Silva&Souza.com.br`; `Acesse␣Qualidade.gov.br` → `Acesse␣Qualidade.gov.br`

Contraexemplos que viram e-mail com "a proposta + letras sozinhas (G, g, O, E...)" (1275, até 12): `Site:␣exemplo.edu.br/edital` → `exemplo.edu.br`; `Pesquisa␣&␣Extensão:␣exemplo.edu.br` → `exemplo.edu.br`; `Veja␣G&Q␣em␣exempio.test␣:␣;` → `em␣exempio.test`; `Consulte␣exemplo.gov.br␣ou␣exemplo.edu.br` → `Consulte␣exemplo.gov.br`, `ou␣exemplo.edu.br`; `Site:␣exemplo.edu.br/edital` → `exemplo.edu.br`; `Veja␣G&Q␣em␣exemplo.test` → `em␣exemplo.test`; `Acesse␣www.exemplo.gov.br` → `Acesse␣www.exemplo.gov.br`; `Pesquisa␣&␣Extensão:␣exemplo.edu.br` → `exemplo.edu.br`; `Consulte␣exemplo.gov.br␣ou␣exemplo.edu.br` → `Consulte␣exemplo.gov.br`, `ou␣exemplo.edu.br`; `Site:␣exemplo.edu.br/edital` → `exemplo.edu.br`; `Veja␣G&Q␣em␣exemplo.test␣:` → `em␣exemplo.test`; `Acesse␣www.exemplo.gov.br` → `Acesse␣www.exemplo.gov.br`

Contraexemplos que viram e-mail com "só "&" e "(D"" (2, até 12): `barros&lima.adv.br` → `barros&lima.adv.br`; `Silva&Souza.com.br` → `Silva&Souza.com.br`

Contraexemplos que viram e-mail com "a proposta + maiúsculas coladas entre minúsculas" (6, até 12): `portalEducacao.gov.br` → `portalEducacao.gov.br`; `Acesse␣meuGov.gov.br` → `meuGov.gov.br`; `exemploDigital.com.br` → `exemploDigital.com.br`; `cursoOnline.exemplo.edu.br` → `cursoOnline.exemplo.edu.br`; `barros&lima.adv.br` → `barros&lima.adv.br`; `Silva&Souza.com.br` → `Silva&Souza.com.br`

Contraexemplos que viram e-mail com "a proposta + ␣Q + maiúsculas coladas" (7, até 12): `portalEducacao.gov.br` → `portalEducacao.gov.br`; `Acesse␣meuGov.gov.br` → `meuGov.gov.br`; `exemploDigital.com.br` → `exemploDigital.com.br`; `cursoOnline.exemplo.edu.br` → `cursoOnline.exemplo.edu.br`; `barros&lima.adv.br` → `barros&lima.adv.br`; `Silva&Souza.com.br` → `Silva&Souza.com.br`; `Acesse␣Qualidade.gov.br` → `Acesse␣Qualidade.gov.br`

## Os seis casos do defeito 3 (docs/LINUX.md)

| Fonte | Lido no docs/LINUX.md | Hoje | Proposta | + ␣Q | + ␣Q + maiúsculas | Lido na reprodução daqui | Hoje | Proposta | + ␣Q | + ␣Q + maiúsculas |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Liberation Sans | `fulano.teste␣WOexemplo.test` | não | não | não | não | `fulano.teste␣Qexemplo.test` | não | não | sim | sim |
| DejaVu Sans | `fulano.testeG&Qexemplo.test` | não | sim | sim | sim | `fulano.testegexemplo.test` | não | não | não | não |
| FreeSans | `fulano.testeQDexemplo.test` | sim | sim | sim | sim | `fulano.testeQexemplo.test` | sim | sim | sim | sim |
| Carlito | `fulano.teste␣Qexemplo.test` | não | não | sim | sim | `fulano.teste␣Qexemplo.test` | não | não | sim | sim |
| Caladea | `fulano.teste&Qexemplo.test` | não | sim | sim | sim | `fulano.teste&exemplo.test` | não | sim | sim | sim |
| DejaVu Serif | `fulano.testeQ&exemplo.test` | não | sim | sim | sim | `fulano.testeGQexemplo.test` | sim | sim | sim | sim |

## Falsos positivos

| Origem | Textos | Viram e-mail antes | Viram e-mail depois | Taxa depois |
|---|---:|---:|---:|---:|
| ocr | 9624 | 0 | 0 | 0,0% |
| escrito | 97 | 0 | 2 | 2,1% |
| repositorio | 1043 | 1 | 1 | 0,1% |

Contraexemplos que a regra transforma em e-mail (2):

- escrito: `barros&lima.adv.br` vira `barros&lima.adv.br`
- escrito: `Silva&Souza.com.br` vira `Silva&Souza.com.br`

Contraexemplos que já viram e-mail hoje, sem a regra (1):

- repositorio: `[docs/ARQUITETURA.md](docs/ARQUITETURA.md);␣como␣contribuir␣em␣[CONTRIBUTING.md](.github/CONTRIBUTING.md).` vira `AR＠UITETURA.md`

## E-mails que continuam sem sugestão inteira depois da regra

| Situação | Vezes |
|---|---:|
| sem sugestão | 4214 |
| sugestão parcial | 147 |

Exemplos (até 40):

- DejaVu Sans 8 pt 150 ppp limpa: esperado `fulano＠exemplo.com.br`, lido `E-mail:␣fulanoexemplo.com.br`
- DejaVu Sans 8 pt 150 ppp limpa: esperado `beltrana＠exemplo.gov.br`, lido `e-mail␣beltrana␣Bexemplo.gov.br`
- DejaVu Sans 8 pt 150 ppp limpa: esperado `ciclano.silva＠campus.exemplo.edu.br`, lido `ciclano.silva&campus.␣exemplo.edu.br`
- DejaVu Sans 8 pt 150 ppp limpa: esperado `ana.b.lima@mail2.exemplo.test`, lido `Contato:␣ana.b.limaemail2.exemplo.test`
- DejaVu Sans 8 pt 150 ppp ruido: esperado `joao-p.teste＠exemplo.gov.br`, lido `Dúvidas:␣joao-p.testeGexemplo.gov.br;␣telefone␣(00)␣91234-5678`
- DejaVu Sans 8 pt 150 ppp ruido: esperado `teste2026＠exemplo.edu.br`, lido `Responsável:␣Fulano␣de␣Teste,␣teste2026G0exemplo.edu.br␣=`
- DejaVu Sans 8 pt 150 ppp ruido: esperado `aluno123＠campus.exemplo.edu.br`, lido `Correio␣eletrônico␣aluno123Gcampus.exemplo.edu.br␣(institucional)`
- DejaVu Sans 8 pt 150 ppp ruido: esperado `turma-2b@mail2.exemplo.test`, lido `Envie␣para␣turma-2b(&mail2␣.exemplo.test␣até␣sexta.`
- DejaVu Sans 8 pt 150 ppp ruido: esperado `fulano＠teste.com.br`, lido `Contato:␣fulanoBteste␣com.br␣3`
- DejaVu Sans 8 pt 200 ppp limpa: esperado `fulana.de.tal@mail2.exemplo.test`, lido `Correio␣eletrônico␣fulana.de.talEkmail2.exemplo.test␣(institucional)`
- DejaVu Sans 8 pt 200 ppp limpa: esperado `beltrana-souza＠teste.com.br`, lido `Envie␣para␣beltrana-souzaEteste.com.br␣até␣sexta.`
- DejaVu Sans 8 pt 200 ppp ruido: esperado `maria.teste3@mail2.exemplo.test`, lido `Responsável:␣Fulano␣de␣Teste,␣maria.teste3Email2.exemplo.test`
- DejaVu Sans 8 pt 200 ppp ruido: esperado `turma-2b＠exemplo.com.br`, lido `Correio␣eletrônico␣turma-2bEexemplo.com.br␣(institucional)`
- DejaVu Sans 8 pt 200 ppp ruido: esperado `fulano＠exemplo.gov.br`, lido `fulanoGexemplo.gov.br`
- DejaVu Sans 8 pt 200 ppp ruido: esperado `ana.b.lima＠teste.com.br`, lido `Correio␣eletrônico␣ana.b.limaEteste.com.br(institucional)`
- DejaVu Sans 8 pt 300 ppp limpa: esperado `aluno123@mail2.exemplo.test`, lido `Dúvidas:␣aluno123Email2.exemplo.test;␣telefone␣(00)␣91234-5678`
- DejaVu Sans 8 pt 300 ppp limpa: esperado `turma-2b＠teste.com.br`, lido `Responsável:␣Fulano␣de␣Teste,␣turma-2bEteste.com.br`
- DejaVu Sans 8 pt 300 ppp ruido: esperado `fulano.teste@mail2.exemplo.test`, lido `Contato:␣fulano.testeGmail2.exemplo.test`
- DejaVu Sans 8 pt 300 ppp ruido: esperado `fulana.de.tal＠teste.com.br`, lido `Dúvidas:␣fulana.de.talGteste.com.br;␣telefone␣(00)␣91234-5678`
- DejaVu Sans 10 pt 150 ppp limpa: esperado `teste2026@mail2.exemplo.test`, lido `Envie␣para␣teste2026(&mail?2␣.exemplo.test␣até␣sexta.`
- DejaVu Sans 10 pt 150 ppp limpa: esperado `turma-2b＠exemplo.gov.br`, lido `Dúvidas:␣turma-2bEexemplo.gov.br;␣telefone␣(00)␣91234-5678`
- DejaVu Sans 10 pt 150 ppp limpa: esperado `secretaria@mail2.exemplo.test`, lido `secretaria&mail?.exemplo.test`
- DejaVu Sans 10 pt 150 ppp limpa: esperado `ciclano.silva＠teste.com.br`, lido `Contato:␣ciclano.silvaEPteste.com.br`
- DejaVu Sans 10 pt 150 ppp ruido: esperado `maria-clara@mail2.exemplo.test`, lido `y␣Correio␣eletrônico␣maria-claraEmail2␣.exemplo.test␣(institucional)`
- DejaVu Sans 10 pt 150 ppp ruido: esperado `teste2026＠exemplo.com.br`, lido `teste2026EPexemplo.com.br␣:␣:`
- DejaVu Sans 10 pt 150 ppp ruido: esperado `aluno123＠teste.com.br`, lido `Envie␣para␣aluno123Gteste.com.br␣até␣sexta,␣;␣:␣:`
- DejaVu Sans 10 pt 150 ppp ruido: esperado `turma-2b＠orgao-teste.gov.br`, lido `E-mail:␣turma-2bEorgao-teste.gov.br`
- DejaVu Sans 10 pt 200 ppp limpa: esperado `fulano＠campus.exemplo.edu.br`, lido `E-mail:␣fulanoOcampus.exemplo.edu.br`
- DejaVu Sans 10 pt 200 ppp limpa: esperado `beltrana@mail2.exemplo.test`, lido `e-mail␣beltrana␣Omail2.exemplo.test`
- DejaVu Sans 10 pt 200 ppp limpa: esperado `secretaria＠exemplo.com.br`, lido `Responsável:␣Fulano␣de␣Teste,␣secretaria␣Qexemplo.com.br`
- DejaVu Sans 10 pt 200 ppp ruido: esperado `ciclano@mail2.exemplo.test`, lido `E-mail:␣ciclanoQmail2.exemplo.test`
- DejaVu Sans 10 pt 300 ppp limpa: esperado `coord-ti@mail2.exemplo.test`, lido `Contato:␣coord-tikmail2.exemplo.test`
- DejaVu Sans 10 pt 300 ppp ruido: esperado `turma-2b＠campus.exemplo.edu.br`, lido `Correio␣eletrônico␣turma-2bEcampus.exemplo.edu.br␣(institucional)`
- DejaVu Sans 10 pt 300 ppp ruido: esperado `fulano@mail2.exemplo.test`, lido `fulanoEkmail2.exemplo.test`
- DejaVu Sans 12 pt 150 ppp limpa: esperado `beltrana-souza@mail2.exemplo.test`, lido `Correio␣eletrônico␣beltrana-souza␣Omail2.exemplo.test␣(institucional)`
- DejaVu Sans 12 pt 150 ppp limpa: esperado `coord-ti＠exemplo.com.br`, lido `coord-tigexemplo.com.br`
- DejaVu Sans 12 pt 150 ppp limpa: esperado `joao-p.teste＠teste.com.br`, lido `Envie␣para␣joao-p.testeOteste.com.br␣até␣sexta.`
- DejaVu Sans 12 pt 150 ppp limpa: esperado `ciclano＠teste.com.br`, lido `ciclanoOteste.com.br`
- DejaVu Sans 12 pt 150 ppp ruido: esperado `beltrana＠exemplo.gov.br`, lido `beltrana(&&exemplo:gov.br␣:`
- DejaVu Sans 12 pt 200 ppp limpa: esperado `turma-2b@mail2.exemplo.test`, lido `Dúvidas:␣turma-2bEkmail2.exemplo.test;␣telefone␣(00)␣91234-5678`
