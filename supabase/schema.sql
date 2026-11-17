-- rodar no SQL Editor do Supabase

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null default 'Outros',
  preco numeric(10,2) not null default 0 check (preco >= 0),
  unidade text not null default 'un',
  controla_estoque boolean not null default true,
  estoque_atual numeric(12,3) not null default 0,
  estoque_minimo numeric(12,3) not null default 0,
  foto text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint estoque_nao_negativo check (estoque_atual >= 0)
);

create table if not exists public.comandas (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  identificacao text not null,
  status text not null default 'aberta' check (status in ('aberta', 'fechada', 'cancelada')),
  forma_pagamento text,
  total numeric(10,2),
  aberta_em timestamptz not null default now(),
  fechada_em timestamptz,
  aberta_por uuid default auth.uid()
);

create table if not exists public.comanda_itens (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references public.comandas (id) on delete cascade,
  produto_id uuid references public.produtos (id) on delete set null,
  nome text not null,
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  quantidade numeric(12,3) not null check (quantidade > 0),
  obs text,
  criado_em timestamptz not null default now()
);

create table if not exists public.movimentos_estoque (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid not null references public.produtos (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'saida', 'ajuste', 'venda', 'estorno')),
  quantidade numeric(12,3) not null, -- variação com sinal: positivo entra, negativo sai
  motivo text,
  comanda_id uuid references public.comandas (id) on delete set null,
  usuario uuid default auth.uid(),
  criado_em timestamptz not null default now()
);

create index if not exists comandas_status_idx on public.comandas (status, fechada_em);
create index if not exists comanda_itens_comanda_idx on public.comanda_itens (comanda_id);
create index if not exists movimentos_produto_idx on public.movimentos_estoque (produto_id, criado_em desc);

-- atualiza o saldo do produto a cada movimento e barra saldo negativo
create or replace function public.tg_movimento_aplica_saldo()
returns trigger language plpgsql set search_path = public as $$
declare
  v_saldo numeric;
  v_nome text;
begin
  select estoque_atual, nome into v_saldo, v_nome
    from produtos where id = new.produto_id for update;

  if v_saldo + new.quantidade < 0 then
    if v_saldo <= 0 then
      raise exception 'Acabou o estoque de %.', v_nome;
    end if;
    raise exception 'Só restam % de % em estoque.', trim_scale(v_saldo), v_nome;
  end if;

  update produtos set estoque_atual = estoque_atual + new.quantidade where id = new.produto_id;
  return null;
end $$;

drop trigger if exists movimento_aplica_saldo on public.movimentos_estoque;
create trigger movimento_aplica_saldo
  after insert on public.movimentos_estoque
  for each row execute function public.tg_movimento_aplica_saldo();

-- item de comanda mexe no estoque (e nao deixa vender o que acabou)
create or replace function public.tg_item_movimenta_estoque()
returns trigger language plpgsql set search_path = public as $$
declare
  v_delta numeric;
  v_produto uuid;
  v_comanda uuid;
  v_saldo numeric;
  v_nome text;
  v_controla boolean;
begin
  if tg_op = 'INSERT' then
    v_delta := -new.quantidade; v_produto := new.produto_id; v_comanda := new.comanda_id;
  elsif tg_op = 'UPDATE' then
    v_delta := old.quantidade - new.quantidade; v_produto := new.produto_id; v_comanda := new.comanda_id;
  else
    v_delta := old.quantidade; v_produto := old.produto_id; v_comanda := old.comanda_id;
  end if;

  if not exists (select 1 from comandas where id = v_comanda and status = 'aberta') then
    raise exception 'Esta comanda já foi fechada e não pode ser alterada.';
  end if;

  if v_produto is not null and v_delta <> 0 then
    select estoque_atual, nome, controla_estoque into v_saldo, v_nome, v_controla
      from produtos where id = v_produto for update;

    if v_controla then
      if v_delta < 0 and v_saldo + v_delta < 0 then
        if v_saldo <= 0 then
          raise exception 'Acabou o estoque de %.', v_nome;
        end if;
        raise exception 'Só restam % de % em estoque.', trim_scale(v_saldo), v_nome;
      end if;

      insert into movimentos_estoque (produto_id, tipo, quantidade, motivo, comanda_id)
      values (v_produto, case when v_delta < 0 then 'venda' else 'estorno' end, v_delta, 'Comanda', v_comanda);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists item_movimenta_estoque on public.comanda_itens;
create trigger item_movimenta_estoque
  after insert or update of quantidade or delete on public.comanda_itens
  for each row execute function public.tg_item_movimenta_estoque();

-- cancelar devolve os itens pro estoque
create or replace function public.cancelar_comanda(p_comanda uuid)
returns void language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from comandas where id = p_comanda and status = 'aberta') then
    raise exception 'Só é possível cancelar uma comanda aberta.';
  end if;
  delete from comanda_itens where comanda_id = p_comanda;
  update comandas set status = 'cancelada', total = 0, fechada_em = now() where id = p_comanda;
end $$;

-- RLS: so usuario logado
alter table public.produtos enable row level security;
alter table public.comandas enable row level security;
alter table public.comanda_itens enable row level security;
alter table public.movimentos_estoque enable row level security;

drop policy if exists "equipe produtos" on public.produtos;
create policy "equipe produtos" on public.produtos
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe comandas leitura" on public.comandas;
create policy "equipe comandas leitura" on public.comandas
  for select to authenticated using (true);
drop policy if exists "equipe comandas abre" on public.comandas;
create policy "equipe comandas abre" on public.comandas
  for insert to authenticated with check (true);
drop policy if exists "equipe comandas altera" on public.comandas;
create policy "equipe comandas altera" on public.comandas
  for update to authenticated using (true) with check (true);

drop policy if exists "equipe itens" on public.comanda_itens;
create policy "equipe itens" on public.comanda_itens
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe movimentos leitura" on public.movimentos_estoque;
create policy "equipe movimentos leitura" on public.movimentos_estoque
  for select to authenticated using (true);
drop policy if exists "equipe movimentos lança" on public.movimentos_estoque;
create policy "equipe movimentos lança" on public.movimentos_estoque
  for insert to authenticated with check (true);

revoke execute on function public.cancelar_comanda(uuid) from public, anon;
grant execute on function public.cancelar_comanda(uuid) to authenticated;

-- realtime
do $$
declare t text;
begin
  foreach t in array array['produtos', 'comandas', 'comanda_itens', 'movimentos_estoque'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- bancos criados antes desta versao: rodar tambem
-- alter table public.produtos add column if not exists foto text;
-- update public.produtos set estoque_atual = 0 where estoque_atual < 0;
-- alter table public.produtos add constraint estoque_nao_negativo check (estoque_atual >= 0);
