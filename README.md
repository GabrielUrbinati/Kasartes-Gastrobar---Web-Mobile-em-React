# Kasartes Gastrobar: comandas e estoque

Web app mobile em React (Vite) com Supabase. Versão de teste com duas áreas:

- **Comandas**: abrir por mesa ou nome, lançar itens, observações, fechar conta com forma de pagamento, cancelar, vendido no dia.
- **Estoque**: cadastro de produtos, entrada, saída, contagem, aviso de reposição e histórico por produto.

Cada item lançado numa comanda baixa o estoque sozinho (gatilho no banco); remover o item ou cancelar a comanda devolve.

## 1. Banco (Supabase)

Já criado: projeto `kasartes` (São Paulo), com as tabelas de `supabase/schema.sql` aplicadas.
A URL e a chave pública estão em `.env.production`.

Falta só o login da equipe: em **Authentication > Users > Add user**, crie um e-mail e senha
(marque "Auto Confirm User"). https://supabase.com/dashboard/project/xinbzuakmyqamqhboglg/auth/users

## 2. Publicar na Vercel

Dentro desta pasta:

```bash
npx vercel --prod
```

Na primeira vez ele pede login e confirma a criação do projeto; aceite os padrões (Vite é detectado).

## 3. Rodar no computador (opcional)

```bash
cp .env.production .env
npm install
npm run dev
```

## Estrutura

```
src/App.jsx                  sessão, carregamento e tempo real
src/components/Comandas.jsx  lista de comandas
src/components/ComandaDetalhe.jsx
src/components/Estoque.jsx   produtos e movimentações
src/lib/api.js               todas as chamadas ao Supabase
supabase/schema.sql          tabelas, gatilhos de estoque e RLS
```
