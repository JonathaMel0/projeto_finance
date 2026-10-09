# Parser de mensagens

`parseMensagem(texto, { hoje?, config? })` em [lib/parser/](../lib/parser/) transforma
mensagens como `padaria 54,90` em um lançamento. É 100% determinístico (sem LLM).

## Resultados

| `status` | Significado |
|---|---|
| `ok` | Tipo, categoria, valor e descrição identificados com segurança. |
| `tipo_incerto` | Valor e descrição ok, mas não dá para saber se é entrada ou despesa. O bot deve perguntar (1 - Entrada / 2 - Despesa) e chamar `completarRascunho(rascunho, tipo)`. |
| `invalido` | Não cria lançamento. `motivo`: `vazio`, `muito_longo`, `consulta`, `sem_valor`, `varios_valores`, `sem_descricao`, `data_invalida`, `varias_datas`. |

## Regras

- **Valor:** `54`, `54,90`, `54.90`, `1.500` (= 1500), `1.500,50`, `1500.50`, `R$ 54,90`.
  `1,500` é ambíguo e não é aceito. Com vários números, só decide se exatamente um
  tiver `R$` ou centavos (`uber 99 27,50`); senão `varios_valores`.
- **Tipo/categoria:** palavras-chave de [config.ts](../lib/parser/config.ts). Expressões
  mais longas são consumidas primeiro (`pagamento recebido` não vira despesa por
  causa de `pagamento`). Termos de entrada e de despesa na mesma mensagem, ou nenhum
  termo, resultam em `tipo_incerto`. A ordem das categorias no config é a prioridade
  em conflitos (ex.: `conta de luz` → Moradia, não Contas).
- **Forma de pagamento (só despesas):** Pix, Cartão de crédito/débito, Dinheiro,
  Transferência, Boleto; `cartão` sozinho → Outros; ausente → `não informado`.
- **Datas:** `hoje`, `ontem`, `anteontem`, `amanhã`, `dia X` (mês atual), `DD/MM`,
  `DD/MM/YYYY`. Datas inexistentes são rejeitadas. Sem data, `data` fica indefinida
  e o repositório usa a data/hora atuais.
- **Consultas** (`quanto gastei…`) retornam `invalido/consulta`; serão tratadas à parte.

## Decisões a conhecer

- `pix joao 200` retorna `tipo_incerto` (pode ser envio ou recebimento). Só
  `pix recebido …` é entrada automática.
- A descrição restaura acentos de palavras do dicionário (`salario` → `Salário`),
  mas nomes próprios ficam como digitados (`Joao`).
- Parcelamento (`10x`) ainda não é interpretado (pós-MVP).
- O dicionário pode ser trocado passando `config`; futuramente virá da aba `categorias`.
