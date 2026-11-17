import { supabase } from './supabase.js'

function ok({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}

export async function listarProdutos() {
  return ok(await supabase.from('produtos').select('*').eq('ativo', true).order('nome'))
}

export async function listarComandas() {
  const inicioDoDia = new Date()
  inicioDoDia.setHours(0, 0, 0, 0)
  const [abertas, fechadas] = await Promise.all([
    supabase.from('comandas').select('*, comanda_itens(*)').eq('status', 'aberta').order('aberta_em'),
    supabase
      .from('comandas')
      .select('*, comanda_itens(*)')
      .eq('status', 'fechada')
      .gte('fechada_em', inicioDoDia.toISOString())
      .order('fechada_em', { ascending: false }),
  ])
  return [...ok(abertas), ...ok(fechadas)]
}

export async function abrirComanda(identificacao) {
  return ok(await supabase.from('comandas').insert({ identificacao }).select('*, comanda_itens(*)').single())
}

export async function adicionarItem(comanda, produto) {
  const linha = (comanda.comanda_itens || []).find((i) => i.produto_id === produto.id && !i.obs)
  if (linha) {
    return ok(
      await supabase.from('comanda_itens').update({ quantidade: Number(linha.quantidade) + 1 }).eq('id', linha.id)
    )
  }
  return ok(
    await supabase.from('comanda_itens').insert({
      comanda_id: comanda.id,
      produto_id: produto.id,
      nome: produto.nome,
      preco_unit: produto.preco,
      quantidade: 1,
    })
  )
}

export async function alterarQuantidade(item, novaQuantidade) {
  if (novaQuantidade <= 0) {
    return ok(await supabase.from('comanda_itens').delete().eq('id', item.id))
  }
  return ok(await supabase.from('comanda_itens').update({ quantidade: novaQuantidade }).eq('id', item.id))
}

export async function salvarObservacao(item, obs) {
  return ok(await supabase.from('comanda_itens').update({ obs: obs || null }).eq('id', item.id))
}

export async function fecharComanda(id, total, formaPagamento) {
  return ok(
    await supabase
      .from('comandas')
      .update({ status: 'fechada', total, forma_pagamento: formaPagamento, fechada_em: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'aberta')
  )
}

export async function cancelarComanda(id) {
  return ok(await supabase.rpc('cancelar_comanda', { p_comanda: id }))
}

export async function salvarProduto(produto, estoqueInicial = 0) {
  const { id, ...campos } = produto
  if (id) return ok(await supabase.from('produtos').update(campos).eq('id', id))
  const novo = ok(await supabase.from('produtos').insert(campos).select().single())
  if (campos.controla_estoque && estoqueInicial > 0) {
    await movimentarEstoque(novo.id, 'entrada', estoqueInicial, 'Estoque inicial')
  }
  return novo
}

export async function arquivarProduto(id) {
  return ok(await supabase.from('produtos').update({ ativo: false }).eq('id', id))
}

// delta positivo = entrada, negativo = saida
export async function movimentarEstoque(produtoId, tipo, delta, motivo) {
  return ok(
    await supabase
      .from('movimentos_estoque')
      .insert({ produto_id: produtoId, tipo, quantidade: delta, motivo: motivo || null })
  )
}

export async function listarMovimentos(produtoId) {
  return ok(
    await supabase
      .from('movimentos_estoque')
      .select('*')
      .eq('produto_id', produtoId)
      .order('criado_em', { ascending: false })
      .limit(12)
  )
}
