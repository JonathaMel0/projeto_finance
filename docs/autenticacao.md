# Autenticação do site (Fase 7)

Login simples de **um único usuário** (o dono). O bot do Telegram tem a sua
própria autorização (`AUTHORIZED_TELEGRAM_USERS`) e **não** passa por este
login.

## Como funciona

- `middleware.ts` protege todas as rotas, exceto `/login`, `/api/auth/*` e
  `/api/telegram/*`. Sem sessão válida, páginas redirecionam para `/login` e
  rotas `/api/*` respondem `401`.
- `POST /api/auth/login` confere usuário e senha e grava o cookie `sessao`:
  `HttpOnly`, `SameSite=Lax`, `Secure` em produção, validade de 7 dias.
- O cookie é um token assinado com HMAC-SHA256 (`AUTH_SECRET`), sem estado no
  servidor. Trocar o `AUTH_SECRET` invalida todas as sessões.
- `POST /api/auth/logout` apaga o cookie (só POST, para não ser acionável por
  link).
- A senha fica só como hash **scrypt** com salt (`lib/auth/password.ts`) e é
  comparada em tempo constante. O usuário também é comparado em tempo
  constante e a senha é verificada mesmo com usuário errado.
- Após 5 tentativas erradas do mesmo IP em 15 min o login é bloqueado. É em
  memória (por instância serverless), ou seja, proteção de melhor esforço.
- O parâmetro `next` só aceita caminhos internos (sem redirecionar para outro
  site).
- Sem `AUTH_SECRET` configurado, o site fica **fechado** (nunca aberto).

## Variáveis de ambiente

| Variável | O que é |
|---|---|
| `AUTH_SECRET` | Segredo de assinatura da sessão, mínimo 32 caracteres. |
| `ADMIN_USERNAME` | Nome de usuário do login. |
| `ADMIN_PASSWORD_HASH` | Hash da senha, formato `scrypt:N:salt:hash`. |

## Gerar os valores

```bash
node scripts/gerar-credenciais.mjs --secret   # imprime AUTH_SECRET=...
node scripts/gerar-credenciais.mjs            # pede a senha (sem eco) e imprime ADMIN_PASSWORD_HASH=...
```

Nada é gravado em disco: copie as linhas para o `.env.local` e para
Settings → Environment Variables da Vercel (marque Production) e faça um novo
deploy. O hash usa `:` e não `$` de propósito, porque o Next expande `$VAR`
em arquivos `.env`.

Para trocar a senha, gere um novo hash, atualize `ADMIN_PASSWORD_HASH` e
faça redeploy. Para deslogar todos os dispositivos, troque o `AUTH_SECRET`.

## Limitações

- Um único usuário, sem recuperação de senha por e-mail (rode o script de novo).
- O limite de tentativas não é compartilhado entre instâncias.
- Sessão de 7 dias fixos, sem renovação automática.
