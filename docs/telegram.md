# Configuração do Telegram

## 1. Criar o bot

1. No Telegram, converse com [@BotFather](https://t.me/BotFather) e envie `/newbot`.
2. Guarde o token em `TELEGRAM_BOT_TOKEN` (`.env.local` / variáveis da Vercel).
3. Para uso em grupo: `/setprivacy` → escolha o bot → `Disable`, para que ele
   receba as mensagens do grupo (não só comandos).

## 2. Descobrir seu ID de usuário

Envie qualquer mensagem para [@userinfobot](https://t.me/userinfobot). Coloque o
número em `AUTHORIZED_TELEGRAM_USERS` (vários IDs separados por vírgula).
Sem essa variável, **ninguém** é autorizado.

## 3. Definir o segredo do webhook

Gere uma string aleatória (apenas `A-Z a-z 0-9 _ -`) e coloque em
`TELEGRAM_WEBHOOK_SECRET`.

## 4. Registrar o webhook

O Telegram só aceita HTTPS. Em produção use a URL da Vercel; localmente use um
túnel (ex.: `ngrok http 3000`).

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://<seu-dominio>/api/telegram/webhook","secret_token":"<TELEGRAM_WEBHOOK_SECRET>","allowed_updates":["message","callback_query"]}'
```

Para conferir: `https://api.telegram.org/bot<TOKEN>/getWebhookInfo`.

## Comportamento atual

- Requisições sem o header de segredo correto recebem `401`.
- **Autorização:** só IDs em `AUTHORIZED_TELEGRAM_USERS`. No privado, quem não
  está na lista recebe "Você não possui autorização…"; **em grupo o bot fica em
  silêncio** (o ID da pessoa aparece no log do servidor: `usuário não
  autorizado <id>`). Para autorizar a esposa, adicione o ID dela separado por
  vírgula e reinicie/redeploy.
- **Lançamento:** `padaria 54,90` → o bot mostra o resumo com botões
  Confirmar / Cancelar → só ao confirmar grava em `despesas` ou `entradas` e
  responde com os totais do dia e do mês. Em grupo o bot responde à própria
  mensagem do lançamento.
- **Tipo incerto** (ex.: `pix joao 200`): o bot pergunta Entrada ou Despesa
  por botões e depois pede a confirmação.
- **Conversa comum em grupo** (`bom dia`, `oi`) é ignorada; no privado o bot
  explica o que faltou (valor, descrição, data inválida…).
- **Idempotência:** o ID do lançamento é o do pendente, então clicar duas vezes
  em Confirmar nunca duplica. Reentregas do mesmo `update_id` também são
  ignoradas (em memória, por instância).
- Lançamentos sem resposta expiram em 24h.
- Falhas (ex.: Sheets fora do ar) não vazam detalhes: o usuário recebe "Não
  consegui salvar seu lançamento agora. Tente novamente em alguns instantes."
  e os botões continuam válidos para tentar de novo.
- Ainda não existem: botão Editar, `/editar`, `/excluir`, `/ultimos`, `/saldo`
  (Fase 6 em diante).
