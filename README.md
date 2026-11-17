# Kasartes Gastrobar

App web (mobile) de comandas e estoque pro Kasartes Gastrobar. Feito em React + Vite, com Supabase no backend e deploy na Vercel.

Por enquanto tem só o básico:

- comandas: abre por mesa ou nome, lança os itens, fecha a conta com a forma de pagamento
- estoque: cadastro de produtos, entrada/saída/contagem e aviso quando tá acabando

Quando lança um item na comanda o estoque já baixa sozinho (é um trigger no banco). Se tirar o item ou cancelar a comanda, volta.

## Rodando

```bash
npm install
cp .env.production .env
npm run dev
```

Precisa de um usuário criado no Supabase (Authentication > Users) pra conseguir logar.

O SQL das tabelas tá em `supabase/schema.sql`.

## Deploy

Vercel, direto do repositório. As variáveis do Supabase já estão no `.env.production`.

## Falta fazer

- relatório de vendas por período
- dividir conta
- permissões diferentes pra garçom e gerente
