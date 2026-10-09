# Estado do projeto (retomada em outro computador)

Atualizado em 09/10/2026. Especificação completa: [`leia_prompt.txt`](../leia_prompt.txt).

> **Para o Claude Code ao retomar:** leia este arquivo, `leia_prompt.txt`, o
> `README.md` e a pasta `docs/`. Trabalhe fase a fase, como o prompt pede, e
> rode `npx tsc --noEmit`, `npm test` e `npm run lint` antes de cada commit.

## O que é

App pessoal de controle financeiro para duas pessoas (o dono e a esposa):
lançamentos de despesas/entradas por um **bot do Telegram em grupo**, dados no
**Google Sheets**, dashboard web em **Next.js** na **Vercel**. Custo alvo: R$ 0,
sem LLM (parser por regras).

## Fases (12 no total)

| Fase | Descrição | Estado |
|---|---|---|
| 1 | Estrutura Next.js + TypeScript + Tailwind | feita |
| 2 | Integração Google Sheets (`FinanceRepository`) | feita e **testada contra a planilha real** |
| 3 | Bot Telegram + webhook | feita (webhook ainda **não registrado**) |
| 4 | Parser determinístico | feita |
| 5 | Confirmação por botões + gravação + idempotência | feita (testada só com Sheets falso e no ciclo real do repositório; **falta teste no Telegram**) |
| 6 | Edição e exclusão (`/editar`, `/excluir`, `/ultimos`, botão Editar, log na aba `logs`) | feita e testada no Telegram |
| 7 | Autenticação do site (login, senha com hash, `AUTH_SECRET`) | feita e testada localmente; **falta configurar as variáveis na Vercel e testar lá** (após editar `.env.local`, reinicie o `npm run dev`) |
| 8 | Dashboard (resumo, gráficos, filtros, tabela de lançamentos) | feita e testada localmente com a planilha real (somente leitura) |
| 9 | Orçamento 50/30/20 configurável + "quanto ainda posso gastar" | feita (config na aba `configuracoes`, ver `docs/google-sheets.md`; **falta testar no deploy**) |
| 10 | Testes | parcial (177 testes passando) |
| 11 | Deploy na Vercel | **em andamento (próximo passo imediato)** |
| 12 | Documentação | parcial |

Pós-MVP (não feitos): parcelamento (`10x`), despesas recorrentes, metas,
consultas em linguagem natural (`quanto gastei…`), `/saldo`, `/mes`,
`/categorias`, `/config`, modo rápido, camada opcional de LLM.

## O que existe no código

- `lib/finance/` – `FinanceRepository` (porta) e implementação em Sheets.
- `lib/google-sheets/` – cliente da API (grava `RAW`, lê `UNFORMATTED_VALUE`,
  porque a planilha está em `pt_BR`), mapeadores e esquema das abas.
- `lib/parser/` – `parseMensagem` e `completarRascunho` (ver `docs/parser.md`).
- `lib/telegram/` – webhook seguro, autorização, idempotência por `update_id`,
  `fluxo.ts` (confirmação), `pending-store.ts` (aba `pendentes`).
- `app/api/telegram/webhook/route.ts` – único endpoint existente.
- `app/page.tsx` – dashboard (server component; lê tudo via `FinanceRepository`).
  Lógica pura em `lib/dashboard/`, componentes em `components/dashboard/`,
  gráficos em CSS/SVG (sem biblioteca). Mês/ano definem resumo e gráficos;
  tipo/categoria/pagamento filtram só a tabela. Sem ações de editar/excluir
  no site (isso continua no Telegram).
- `tests/` – Vitest (`npm test`).

## Decisões tomadas

- Lançamento só é gravado após clicar **Confirmar**; o ID do lançamento é o do
  pendente, então clique duplo nunca duplica.
- Estado entre mensagem e clique fica na aba `pendentes` (Vercel é serverless,
  sem memória confiável). Pendentes expiram em 24h.
- `pix joao 200` pergunta Entrada/Despesa (não adivinha); só `pix recebido…`
  é entrada automática.
- **Em grupo o bot ignora conversa comum e usuários não autorizados** (o ID de
  quem foi ignorado aparece no log: `usuário não autorizado <id>`). No privado
  ele responde com dicas/avisos.
- Sem data informada, vale a data/hora da **mensagem**, não a do clique.
- Valor `1.500` = 1500; `1,500` é rejeitado por ambiguidade; vários números só
  são aceitos se exatamente um tiver centavos ou `R$`.
- Prioridade de categorias = ordem em `lib/parser/config.ts`.

## Ambiente e segredos (NÃO estão no GitHub)

No novo PC é preciso recriar:

1. **Node.js 20+** (no PC antigo foi instalado o zip do Node 26 em
   `%LOCALAPPDATA%\nodejs`, sem admin). Depois: `npm install`.
2. **`.env.local`** (copie de `.env.example`):
   - `TELEGRAM_BOT_TOKEN` – do @BotFather. **O token antigo foi exposto numa
     conversa: gere um novo com `/revoke`** e use o novo.
   - `TELEGRAM_WEBHOOK_SECRET` – string aleatória (`A-Z a-z 0-9 _ -`).
   - `AUTHORIZED_TELEGRAM_USERS` – IDs numéricos separados por vírgula
     (dono já conhecido; **esposa ainda não configurada**: ela manda mensagem
     no grupo, vê-se o ID no log ou com @userinfobot / `/user` do GetIDsBot).
   - `GOOGLE_SHEETS_SPREADSHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
     `GOOGLE_PRIVATE_KEY` – do projeto **melo-finance** no Google Cloud.
   - `AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH` – login do site (Fase 7); gere com `node scripts/gerar-credenciais.mjs` (veja `docs/autenticacao.md`).
3. **Chave da service account (JSON):** o arquivo `melo-finance.json` ficou só
   no PC antigo (está no `.gitignore`). Baixe uma chave nova em Google Cloud →
   IAM → Contas de serviço → Chaves, e a planilha precisa continuar
   compartilhada como **Editor** com o e-mail da service account.
4. **Bot:** `@melo_finance_bot`, privacidade de grupo já **desativada**
   (`/setprivacy` → Disable). O bot precisa estar no grupo "Melo Finance".
5. **GitHub:** repositório `JonathaMel0/projeto_finance`, branch `main`.
   (No PC antigo houve login na conta errada do Git Credential Manager; se
   acontecer, apague a credencial em "Gerenciador de Credenciais do Windows".)

## Google Sheets

Planilha com 7 abas e cabeçalhos exatos descritos em `docs/google-sheets.md`
(`despesas`, `entradas`, `categorias`, `configuracoes`, `usuarios`, `logs`,
`pendentes`). **Pendência cosmética:** a aba `logs` tem colunas extras além de
`id | data_hora | nivel | operacao | detalhes`; apagar da coluna F em diante.

## Próximos passos, em ordem

1. **Deploy na Vercel** (Fase 11 antecipada): importar o repositório, cadastrar
   as variáveis acima em Settings → Environment Variables (a chave privada em
   uma linha com `\n` literais), fazer o deploy.
2. **Registrar o webhook** do Telegram apontando para
   `https://<app>.vercel.app/api/telegram/webhook` com `secret_token` igual a
   `TELEGRAM_WEBHOOK_SECRET` (comando em `docs/telegram.md`).
3. **Testar no grupo:** `padaria 54,90` → Confirmar → conferir a linha em
   `despesas`; testar `pix joao 200`, `almoço 35 ontem`, clique duplo.
4. **Autorizar a esposa** (adicionar o ID em `AUTHORIZED_TELEGRAM_USERS` na
   Vercel e redeploy).
5. Configurar login na Vercel (`AUTH_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`), depois Fases 8, 9 e fechar testes/documentação.

## Limitações conhecidas

- Deduplicação por `update_id` é em memória (por instância); a proteção
  forte contra duplicidade é o ID do pendente.
- A edição por mensagem de texto captura a próxima mensagem do usuário por até 10 min (há botão Cancelar).
- O tipo (despesa/entrada) de um lançamento gravado não é editável.
- O login do site será único (single-user), como no prompt.

## Estimativa de custo (se rodar o restante com Claude)

Estimativa inicial para o projeto todo: ~US$ 12–19 (Sonnet 5.5 / Opus 5.5) de
API; fases 1–5 consumiram uma fração pequena. Use `/cost` para o valor real e
`/clear` entre fases para manter o contexto curto.
