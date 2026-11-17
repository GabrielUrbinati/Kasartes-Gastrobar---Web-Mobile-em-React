import { useMemo, useState } from 'react'
import * as api from '../lib/api.js'
import { dataHora, dinheiro, estoqueBaixo, quantidade, totalDaComanda } from '../lib/formato.js'
import Sheet from './Sheet.jsx'

const PAGAMENTOS = ['Pix', 'Crédito', 'Débito', 'Dinheiro']

export default function ComandaDetalhe({ comanda, produtos, executar, voltar }) {
  const [painel, setPainel] = useState(null) // itens, fechar ou cancelar
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const [pagamento, setPagamento] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const aberta = comanda.status === 'aberta'
  const itens = [...(comanda.comanda_itens || [])].sort((a, b) => a.criado_em.localeCompare(b.criado_em))
  const total = aberta ? totalDaComanda(comanda) : Number(comanda.total || 0)

  const categorias = useMemo(() => [...new Set(produtos.map((p) => p.categoria))].sort(), [produtos])
  const visiveis = produtos.filter(
    (p) =>
      (!categoria || p.categoria === categoria) && p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  )
  const naComanda = (produtoId) =>
    itens.filter((i) => i.produto_id === produtoId).reduce((s, i) => s + Number(i.quantidade), 0)

  async function agir(acao) {
    if (ocupado) return false
    setOcupado(true)
    const resultado = await executar(acao)
    setOcupado(false)
    return resultado
  }

  async function fechar() {
    if (await agir(() => api.fecharComanda(comanda.id, total, pagamento))) voltar()
  }

  async function cancelar() {
    if (await agir(() => api.cancelarComanda(comanda.id))) voltar()
  }

  function observar(item) {
    const obs = window.prompt('Observação do item (ex.: sem gelo)', item.obs || '')
    if (obs !== null) agir(() => api.salvarObservacao(item, obs.trim()))
  }

  return (
    <>
      <button className="botao-texto voltar" onClick={voltar}>
        Voltar para comandas
      </button>

      <div className="cabecalho-comanda">
        <span className={aberta ? 'lua grande' : 'lua grande apagada'}>{comanda.numero}</span>
        <div>
          <h1>{comanda.identificacao}</h1>
          <p className="apoio">
            {aberta
              ? `Aberta em ${dataHora(comanda.aberta_em)}`
              : `Fechada em ${dataHora(comanda.fechada_em)}, pago no ${comanda.forma_pagamento || 'caixa'}`}
          </p>
        </div>
      </div>

      {itens.length === 0 ? (
        <p className="vazio">Comanda vazia. Lance o primeiro item.</p>
      ) : (
        <ul className="lista">
          {itens.map((i) => (
            <li key={i.id} className="item">
              <div className="linha-texto">
                <strong>{i.nome}</strong>
                <small>
                  {aberta ? `${dinheiro(i.preco_unit)} cada` : `${quantidade(i.quantidade)} × ${dinheiro(i.preco_unit)}`}
                  {i.obs ? `, ${i.obs}` : ''}
                </small>
              </div>
              {aberta && (
                <button className="botao-texto pequeno" onClick={() => observar(i)}>
                  {i.obs ? 'Editar observação' : 'Adicionar observação'}
                </button>
              )}
              {aberta && (
                <div className="passos">
                  <button
                    aria-label={`Tirar um ${i.nome}`}
                    disabled={ocupado}
                    onClick={() => agir(() => api.alterarQuantidade(i, Number(i.quantidade) - 1))}
                  >
                    −
                  </button>
                  <span>{quantidade(i.quantidade)}</span>
                  <button
                    aria-label={`Mais um ${i.nome}`}
                    disabled={ocupado}
                    onClick={() => agir(() => api.alterarQuantidade(i, Number(i.quantidade) + 1))}
                  >
                    +
                  </button>
                </div>
              )}
              <span className="linha-valor">{dinheiro(Number(i.preco_unit) * Number(i.quantidade))}</span>
            </li>
          ))}
        </ul>
      )}

      {aberta && (
        <button className="botao-texto perigo" onClick={() => setPainel('cancelar')}>
          Cancelar comanda
        </button>
      )}

      <footer className="rodape-comanda">
        <div className="total">
          <span>Total</span>
          <strong>{dinheiro(total)}</strong>
        </div>
        {aberta && (
          <div className="acoes">
            <button className="botao secundario" onClick={() => setPainel('itens')}>
              Lançar item
            </button>
            <button className="botao" disabled={itens.length === 0} onClick={() => setPainel('fechar')}>
              Fechar conta
            </button>
          </div>
        )}
      </footer>

      {painel === 'itens' && (
        <Sheet titulo="Lançar item" fechar={() => setPainel(null)}>
          {produtos.length === 0 ? (
            <p className="vazio">Nenhum produto cadastrado. Cadastre na aba Estoque.</p>
          ) : (
            <>
              <input
                className="busca"
                type="search"
                placeholder="Buscar produto"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <div className="filtros">
                <button className={!categoria ? 'filtro ativo' : 'filtro'} onClick={() => setCategoria('')}>
                  Tudo
                </button>
                {categorias.map((c) => (
                  <button
                    key={c}
                    className={categoria === c ? 'filtro ativo' : 'filtro'}
                    onClick={() => setCategoria(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <ul className="lista">
                {visiveis.map((p) => {
                  const lancados = naComanda(p.id)
                  return (
                    <li key={p.id}>
                      <button
                        className="linha"
                        disabled={ocupado}
                        onClick={() => agir(() => api.adicionarItem(comanda, p))}
                      >
                        <span className="linha-texto">
                          <strong>{p.nome}</strong>
                          <small className={estoqueBaixo(p) ? 'alerta' : ''}>
                            {p.controla_estoque
                              ? `${quantidade(p.estoque_atual)} em estoque`
                              : p.categoria}
                          </small>
                        </span>
                        {lancados > 0 && <span className="contador">{quantidade(lancados)}</span>}
                        <span className="linha-valor">{dinheiro(p.preco)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {visiveis.length === 0 && <p className="vazio">Nenhum produto encontrado.</p>}
            </>
          )}
        </Sheet>
      )}

      {painel === 'fechar' && (
        <Sheet titulo="Fechar conta" fechar={() => setPainel(null)}>
          <p className="total-fechamento">{dinheiro(total)}</p>
          <p className="apoio">Como o cliente pagou?</p>
          <div className="opcoes">
            {PAGAMENTOS.map((f) => (
              <button
                key={f}
                className={pagamento === f ? 'opcao ativa' : 'opcao'}
                aria-pressed={pagamento === f}
                onClick={() => setPagamento(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <button className="botao" disabled={!pagamento || ocupado} onClick={fechar}>
            {ocupado ? 'Fechando…' : 'Fechar conta'}
          </button>
        </Sheet>
      )}

      {painel === 'cancelar' && (
        <Sheet titulo="Cancelar comanda" fechar={() => setPainel(null)}>
          <p className="apoio">
            Os itens lançados voltam para o estoque e a comanda {comanda.numero} deixa de contar nas vendas.
            Não dá para desfazer.
          </p>
          <button className="botao perigo" disabled={ocupado} onClick={cancelar}>
            {ocupado ? 'Cancelando…' : 'Cancelar comanda'}
          </button>
        </Sheet>
      )}
    </>
  )
}
