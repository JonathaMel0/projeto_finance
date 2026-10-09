# Configurando o Google Sheets

Este projeto usa uma planilha do Google Sheets como banco de dados inicial.
A aplicação acessa a planilha através de uma *service account* do Google
Cloud — nenhuma conta pessoal de usuário é usada.

## 1. Criar a planilha

1. Crie uma planilha nova no [Google Sheets](https://sheets.google.com).
2. Renomeie as abas (sheets) exatamente como abaixo — os nomes são usados
   pelo código para localizar cada aba:
   - `despesas`
   - `entradas`
   - `categorias`
   - `configuracoes`
   - `usuarios`
   - `logs`
   - `pendentes` (lançamentos aguardando confirmação no Telegram)
3. Na **primeira linha** de cada aba, adicione os cabeçalhos exatamente
   nesta ordem (uma coluna por célula):

   **despesas**
   ```
   id | data | hora | descricao | valor | categoria | forma_pagamento | observacao | origem | telegram_user_id | created_at | updated_at
   ```

   **entradas**
   ```
   id | data | hora | descricao | valor | categoria | observacao | origem | telegram_user_id | created_at | updated_at
   ```

   **categorias**
   ```
   tipo | categoria | palavras_chave | ativa
   ```

   **configuracoes**
   ```
   chave | valor
   ```
   Opcional; sem ela vale o padrão 50/30/20. O orçamento do mês incide sobre
   o **saldo em conta** (mais o que já foi gasto no mês, para os limites não
   encolherem ao gastar), não sobre as entradas do mês. Chaves reconhecidas:
   - `saldo_inicial`: saldo da conta antes do primeiro lançamento (ex.:
     `2500,00`). O "Saldo em conta" do dashboard é esse valor + todas as
     entradas − todas as despesas até hoje, para bater com o banco. Ajuste
     este valor se o saldo do site diferir do da conta.
   - `orcamento_necessidades`, `orcamento_desejos`, `orcamento_objetivos`:
     percentuais da renda (ex.: `60`, `20`, `20`); precisam somar 100.
   - `classificacao_<categoria>`: `necessidade`, `desejo` ou `objetivo`
     (ex.: chave `classificacao_Lazer`, valor `desejo`). Categoria sem
     classificação conta como desejo.

   Entradas inválidas são ignoradas e aparecem como aviso no dashboard.

   **usuarios**
   ```
   telegram_user_id | nome | ativo | created_at
   ```

   **logs**
   ```
   id | data_hora | nivel | operacao | detalhes
   ```

   **pendentes**
   ```
   id | dados
   ```
   O bot grava aqui o lançamento entre a sua mensagem e o clique em
   "Confirmar" (a linha é apagada ao confirmar ou cancelar; itens sem
   resposta expiram em 24h e podem ser apagados manualmente).

   > Dica: deixe o formato das colunas como "Texto simples" (ou apenas não
   > mexa nele). A aplicação grava os valores como texto/número puro (`RAW`)
   > e lê sem formatação, então o idioma da planilha não afeta os dados.

4. Copie o ID da planilha a partir da URL:
   `https://docs.google.com/spreadsheets/d/<ESTE_É_O_ID>/edit`

## 2. Criar a service account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto (ou use um existente).
3. Em **APIs e serviços > Biblioteca**, habilite a **Google Sheets API**.
4. Em **APIs e serviços > Credenciais**, crie uma **conta de serviço**
   (service account).
5. Na conta de serviço criada, vá em **Chaves > Adicionar chave > Criar
   nova chave**, formato **JSON**, e baixe o arquivo.
6. Anote o `client_email` do JSON — você vai precisar dele no próximo
   passo.

## 3. Compartilhar a planilha com a service account

1. Abra a planilha criada no passo 1.
2. Clique em **Compartilhar** e adicione o `client_email` da service
   account como **Editor**.
3. Sem esse passo, a API retorna erro de permissão (403) para qualquer
   leitura ou escrita.

## 4. Configurar as variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=<ID da planilha>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email do JSON>
GOOGLE_PRIVATE_KEY="<private_key do JSON>"
```

O campo `private_key` do JSON baixado contém quebras de linha reais. Ao
colar no `.env.local`, substitua as quebras de linha por `\n` literal e
mantenha tudo em uma única linha entre aspas, por exemplo:

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
```

O código já faz a conversão de `\n` de volta para quebras de linha reais
(`lib/google-sheets/env.ts`).

## 5. Testando a configuração

Com as variáveis configuradas, rode a aplicação e, temporariamente, chame
`getFinanceRepository()` (de `lib/finance`) em uma rota ou script para
criar/ler um lançamento de teste. Os testes automatizados do repositório
(`npm test`) **não** acessam a planilha real — eles usam um cliente fake
em memória, justamente para não depender de credenciais no CI/local.
