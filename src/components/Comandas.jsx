import { useState } from 'react'
import * as api from '../lib/api.js'
import { dinheiro, hora, itensDaComanda, tempoDesde, totalDaComanda } from '../lib/formato.js'
import Sheet from './Sheet.jsx'

export default function Comandas({ comandas, executar, abrir }) {
  const [filtro, setFiltro] = useState('aberta')
  const [nova, setNova] = useState(false)
  const [identificacao, setIdentificacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const abertas = comandas.filter((c) => c.status === 'aberta')
  const fechadas = comandas.filter((c) => c.status === 'fechada')
  const lista = filtro === 'aberta' ? abertas : fechadas
  const vendidoHoje = fechadas.reduce((s, c) => s + Number(c.total || 0), 0)

  async function criar(e) {
    e.preventDefault()
    const nome = identificacao.trim()
    if (!nome || salvando) return
    setSalvando(true)
    const criada = await executar(() => api.abrirComanda(nome))
    setSalvando(false)
    if (criada) {
      setNova(false)
      setIdentificacao('')
      abrir(criada.id)
    }
  }

  return (
    <>
      <div className="seletor" role="tablist">
        <button role="tab" aria-selected={filtro === 'aberta'} onClick={() => setFiltro('aberta')}>
          Abertas ({abertas.length})
        </button>
        <button role="tab" aria-selected={filtro === 'fechada'} onClick={() => setFiltro('fechada')}>
          Fechadas hoje ({fechadas.length})
        </button>
      </div>

      {filtro === 'fechada' && fechadas.length > 0 && (
        <p className="resumo">
          Vendido hoje <strong>{dinheiro(vendidoHoje)}</strong>
        </p>
      )}

      {lista.length === 0 ? (
        <p className="vazio">
          {filtro === 'aberta'
            ? 'Nenhuma comanda aberta. Abra a primeira da noite no botão abaixo.'
            : 'Nenhuma comanda fechada hoje.'}
        </p>
      ) : (
        <ul className="lista">
          {lista.map((c) => (
            <li key={c.id}>
              <button className="linha" onClick={() => abrir(c.id)}>
                <span className={c.status === 'aberta' ? 'lua' : 'lua apagada'}>{c.numero}</span>
                <span className="linha-texto">
                  <strong>{c.identificacao}</strong>
                  <small>
                    {itensDaComanda(c)} {itensDaComanda(c) === 1 ? 'item' : 'itens'},{' '}
                    {c.status === 'aberta'
                      ? `aberta ${tempoDesde(c.aberta_em)}`
                      : `fechada às ${hora(c.fechada_em)} no ${c.forma_pagamento || 'caixa'}`}
                  </small>
                </span>
                <span className="linha-valor">
                  {dinheiro(c.status === 'aberta' ? totalDaComanda(c) : c.total)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="botao flutuante" onClick={() => setNova(true)}>
        Abrir comanda
      </button>

      {nova && (
        <Sheet titulo="Abrir comanda" fechar={() => setNova(false)}>
          <form className="formulario" onSubmit={criar}>
            <label className="campo">
              <span>Mesa ou nome do cliente</span>
              <input
                autoFocus
                value={identificacao}
                onChange={(e) => setIdentificacao(e.target.value)}
                placeholder="Mesa 4, Balcão, Marina…"
                maxLength={40}
                required
              />
            </label>
            <button className="botao" disabled={salvando}>
              {salvando ? 'Abrindo…' : 'Abrir comanda'}
            </button>
          </form>
        </Sheet>
      )}
    </>
  )
}
