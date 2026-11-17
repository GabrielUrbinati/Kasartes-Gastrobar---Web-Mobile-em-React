const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const qtd = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })

export const dinheiro = (v) => brl.format(Number(v) || 0)
export const quantidade = (v) => qtd.format(Number(v) || 0)

// aceita virgula ou ponto
export function lerNumero(texto) {
  const t = String(texto ?? '').trim()
  if (t === '') return NaN
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t)
}

export function tempoDesde(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `há ${h} h ${m} min` : `há ${h} h`
}

export const hora = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dataHora = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export const totalDaComanda = (comanda) =>
  (comanda.comanda_itens || []).reduce((s, i) => s + Number(i.preco_unit) * Number(i.quantidade), 0)

export const itensDaComanda = (comanda) =>
  (comanda.comanda_itens || []).reduce((s, i) => s + Number(i.quantidade), 0)

export const estoqueBaixo = (p) =>
  p.controla_estoque && Number(p.estoque_atual) <= Number(p.estoque_minimo)

// sem saldo para vender nem uma unidade
export const esgotado = (p) => p.controla_estoque && Number(p.estoque_atual) < 1
