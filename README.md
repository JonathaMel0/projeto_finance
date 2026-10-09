# Despesas

Controle financeiro pessoal para duas pessoas: lançamentos de despesas e
entradas por um **bot do Telegram** (em grupo ou privado), dados guardados no
**Google Sheets** e um **dashboard web** protegido por login. Custo alvo: R$ 0
(Vercel + Google Sheets + Telegram), sem LLM — o texto é interpretado por um
parser de regras.

## Como funciona

```
Telegram ──► /api/telegram/webhook ──► parser ──► confirmação por botões
                                                       │
                                                       ▼
Navegador ──► login ──► dashboard ◄── FinanceRepository ──► Google Sheets
```

- **Telegram:** `padaria 54,90` → o bot mostra o resumo → **Confirmar** grava.
  Também há `/ultimos`, `editar`, `excluir`, data (`ontem`, `dia 5`) e forma de
  pagamento (`pix`, `crédito`…). Detalhes em [`docs/telegram.md`](docs/telegram.md)
  e [`docs/parser.md`](docs/parser.md).
- **Dashboard (`/`):** resumo do mês (entradas, despesas, saldo, poupança,
  investido), orçamento 50/30/20 com "quanto ainda posso gastar", gráficos por
  categoria, evolução mensal e gasto acumulado no mês, filtros (mês, ano, tipo,
  categoria, pagamento) e tabela de lançamentos. É somente leitura: editar e
  excluir é pelo Telegram.
- **Login:** usuário único, senha com hash scrypt e sessão em cookie assinado
  ([`docs/autenticacao.md`](docs/autenticacao.md)).
- **Orçamento:** percentuais e classificação das categorias (necessidade,
  desejo, objetivo) configuráveis na aba `configuracoes`
  ([`docs/google-sheets.md`](docs/google-sheets.md)).

## Stack

Next.js 15 (App Router), React 19, TypeScript (`strict`), Tailwind CSS,
Vitest, API do Google Sheets (`googleapis`).

## Estrutura de pastas

```
app/            Páginas e rotas (dashboard, login, /api/auth, /api/telegram)
components/     Componentes do dashboard
lib/
  auth/           Login, sessão, rate limit
  budget/         Orçamento 50/30/20 (configuração e cálculo)
  dashboard/      Agregações e formatação do dashboard
  finance/        FinanceRepository (porta) e implementação em Sheets
  google-sheets/  Cliente da API, esquema das abas, mapeadores
  parser/         Parser determinístico de mensagens
  telegram/       Webhook, fluxo de confirmação, edição/exclusão
types/          Tipos compartilhados
tests/          Testes (Vitest)
scripts/        gerar-credenciais.mjs (hash de senha e AUTH_SECRET)
docs/           Documentação por tema
```

O restante da aplicação só usa `getFinanceRepository()` (`lib/finance`), nunca
a implementação concreta, para permitir trocar o armazenamento no futuro.

## Executar localmente

Pré-requisito: Node.js 20 ou superior.

```bash
npm install
cp .env.example .env.local   # preencha os valores (tabela abaixo)
npm run dev
```

Acesse <http://localhost:3000>. **Depois de editar o `.env.local`, reinicie o
`npm run dev`** (o middleware guarda as variáveis em cache e o login pode
falhar sem erro visível).

### Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` / `npm run start` | build e servidor de produção |
| `npm run lint` | ESLint |
| `npm test` | testes (Vitest) |
| `npx tsc --noEmit` | checagem de tipos |
| `node scripts/gerar-credenciais.mjs` | pede a senha e gera `ADMIN_PASSWORD_HASH` |
| `node scripts/gerar-credenciais.mjs --secret` | gera um `AUTH_SECRET` |

Rode `npx tsc --noEmit`, `npm test` e `npm run lint` antes de cada commit.

## Variáveis de ambiente

Modelo em [`.env.example`](.env.example). **Nunca** commite valores reais
(`.env.local` e `melo-finance.json` estão no `.gitignore`).

| Variável | Para quê |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token do @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | segredo do webhook (`A-Z a-z 0-9 _ -`) |
| `AUTHORIZED_TELEGRAM_USERS` | IDs numéricos autorizados, separados por vírgula |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID da planilha (na URL) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | e-mail da service account |
| `GOOGLE_PRIVATE_KEY` | chave privada em uma linha, com `\n` literais |
| `AUTH_SECRET` | assina a sessão (mínimo 32 caracteres) |
| `ADMIN_USERNAME` | usuário do login |
| `ADMIN_PASSWORD_HASH` | hash scrypt da senha (nunca a senha) |

## Configurar o Google Sheets

Crie a planilha com as 7 abas e cabeçalhos exatos, crie a service account e
compartilhe a planilha com ela como **Editor**. Passo a passo em
[`docs/google-sheets.md`](docs/google-sheets.md).

## Configurar o Telegram

Crie o bot no @BotFather, desative a privacidade de grupo (`/setprivacy` →
Disable), descubra os IDs autorizados e registre o webhook. Passo a passo em
[`docs/telegram.md`](docs/telegram.md).

## Deploy na Vercel

1. Importe o repositório do GitHub na Vercel (framework: Next.js, sem ajustes).
2. Em **Settings → Environment Variables**, cadastre todas as variáveis da
   tabela acima. Na Vercel, cole os valores **sem aspas**; a chave privada
   continua em uma linha, com `\n` literais.
3. Faça o deploy e confira que `https://<app>.vercel.app/login` abre.
4. Registre o webhook do Telegram apontando para
   `https://<app>.vercel.app/api/telegram/webhook`
   (comando em [`docs/telegram.md`](docs/telegram.md)).
5. Teste no grupo: `padaria 54,90` → Confirmar → conferir a linha em `despesas`
   e o valor no dashboard.

Alterou uma variável na Vercel? Faça **Redeploy** para ela valer. Para
autorizar mais alguém, acrescente o ID em `AUTHORIZED_TELEGRAM_USERS`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Login volta para `/login` sem mensagem | servidor iniciado antes de editar o `.env.local`; reinicie o `npm run dev` |
| "Login não configurado no servidor" | falta `AUTH_SECRET`, `ADMIN_USERNAME` ou `ADMIN_PASSWORD_HASH` |
| Dashboard: "Não foi possível ler a planilha" | variáveis do Google erradas, ou planilha não compartilhada com a service account (erro 403) |
| Bot não responde no grupo | privacidade do bot ativa, bot fora do grupo, usuário fora de `AUTHORIZED_TELEGRAM_USERS` (o ID aparece no log: `usuário não autorizado <id>`) |
| Bot não responde de forma alguma | webhook não registrado ou `secret_token` diferente de `TELEGRAM_WEBHOOK_SECRET` (confira com `getWebhookInfo`) |
| Falha ao gravar após trocar a chave do Google | `GOOGLE_PRIVATE_KEY` desatualizada na Vercel; atualize e faça Redeploy |
| Aviso amarelo no painel de orçamento | valor inválido na aba `configuracoes` (a mensagem diz qual) |

## Testes

`npm test` roda a suíte inteira sem acessar serviços externos: o Google Sheets
é substituído por um cliente em memória (`tests/helpers/fake-sheets-client.ts`)
e o Telegram por dublês. Cobertura por área: parser (valores brasileiros,
datas, pagamento, mensagens inválidas), fluxo do Telegram (confirmação,
edição, exclusão, idempotência), repositório, autenticação (senha, sessão,
middleware, rate limit), webhook, dashboard e orçamento.

## Limitações conhecidas

- A deduplicação por `update_id` e o limite de tentativas de login são em
  memória, por instância (a proteção forte contra lançamento duplicado é o ID
  do pendente).
- O tipo (despesa/entrada) de um lançamento gravado não é editável.
- O site não edita nem cria lançamentos; isso é feito pelo Telegram.
- Fora do escopo atual: parcelamento, despesas recorrentes, metas, consultas em
  linguagem natural, `/saldo`, `/mes`, modo escuro.

O estado atual e o histórico de decisões estão em
[`docs/ESTADO_DO_PROJETO.md`](docs/ESTADO_DO_PROJETO.md).
