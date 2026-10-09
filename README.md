# Despesas

Aplicação de controle financeiro pessoal.

Este repositório está em fase inicial. Já implementado:

- estrutura base do projeto;
- persistência financeira via Google Sheets (`FinanceRepository`);
- webhook do Telegram (`POST /api/telegram/webhook`) com validação de segredo,
  usuários autorizados, idempotência e comandos `/start` e `/ajuda`
  (veja [`docs/telegram.md`](docs/telegram.md)).

- parser determinístico de mensagens (`lib/parser`, veja
  [`docs/parser.md`](docs/parser.md)).

- confirmação por botões no Telegram e gravação no Google Sheets, com
  idempotência (`lib/telegram/fluxo.ts`).

Edição/exclusão, autenticação, dashboard e orçamento serão adicionados em
etapas futuras.

## Stack

- [Next.js](https://nextjs.org/) (App Router)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/) (modo `strict`)
- [Tailwind CSS](https://tailwindcss.com/)
- [ESLint](https://eslint.org/)

Hospedagem planejada: [Vercel](https://vercel.com/).

## Estrutura de pastas

```
app/          Rotas e páginas (App Router)
components/   Componentes de UI reutilizáveis
lib/          Lógica de domínio e integrações
  telegram/     Integração com o Telegram (futuro)
  google-sheets/ Integração com Google Sheets (futuro)
  parser/       Parser de lançamentos financeiros (futuro)
  finance/      Regras de negócio financeiras (futuro)
  auth/         Autenticação (futuro)
types/        Tipos TypeScript compartilhados
tests/        Testes automatizados
public/       Arquivos estáticos
```

## Como executar localmente

Pré-requisitos: [Node.js](https://nodejs.org/) 20 ou superior.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

## Scripts disponíveis

- `npm run dev` — inicia o servidor de desenvolvimento
- `npm run build` — gera o build de produção
- `npm run start` — inicia o servidor em modo produção
- `npm run lint` — executa o ESLint
- `npm test` — executa os testes automatizados (Vitest)

## Variáveis de ambiente

Veja `.env.example` para a lista de variáveis esperadas. Nenhuma credencial
deve ser commitada no repositório; use `.env.local` (ignorado pelo Git) para
valores reais.

## Persistência (Google Sheets)

O armazenamento inicial é uma planilha do Google Sheets, acessada apenas
através da interface `FinanceRepository` (`lib/finance/repository.ts`). O
restante da aplicação deve sempre importar `getFinanceRepository()` de
`lib/finance` — nunca a implementação concreta — para que o armazenamento
possa ser trocado (Postgres, Supabase, etc.) sem alterar o resto do código.

Veja [`docs/google-sheets.md`](docs/google-sheets.md) para o passo a passo
de criação da planilha e da service account do Google Cloud.
