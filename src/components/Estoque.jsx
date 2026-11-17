import { useEffect, useState } from 'react'
import * as api from '../lib/api.js'
import { dataHora, dinheiro, esgotado, estoqueBaixo, lerNumero, quantidade } from '../lib/formato.js'
import Sheet from './Sheet.jsx'

const VAZIO = {
  nome: '',
  categoria: '',
  preco: '',
  unidade: 'un',
  controla_estoque: true,
  estoque_minimo: '',
  estoque_inicial: '',
}

const TIPOS = [
  { id: 'entrada', rotulo: 'Entrada', campo: 'Quantidade que entrou' },
  { id: 'saida', rotulo: 'Saída', campo: 'Quantidade que saiu' },
  { id: 'ajuste', rotulo: 'Contagem', campo: 'Quantidade contada agora' },
]

const NOME_TIPO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Contagem', venda: 'Venda', estorno: 'Estorno' }

export default function Estoque({ produtos, executar }) {
  const [busca, setBusca] = useState('')
  const [soBaixos, setSoBaixos] = useState(false)
  const [produtoId, setProdutoId] = useState(null)
  const [formulario, setFormulario] = useState(null)

  const baixos = produtos.filter(estoqueBaixo)
  const visiveis = (soBaixos ? baixos : produtos).filter((p) =>
    p.nome.toLowerCase().includes(busca.trim().toLowerCase())
  )
  const produto = produtos.find((p) => p.id === produtoId)

  return (
    <>
      <input
        className="busca"
        type="search"
        placeholder="Buscar produto"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div className="filtros">
        <button className={!soBaixos ? 'filtro ativo' : 'filtro'} onClick={() => setSoBaixos(false)}>
          Todos ({produtos.length})
        </button>
        <button className={soBaixos ? 'filtro ativo' : 'filtro'} onClick={() => setSoBaixos(true)}>
          Repor ({baixos.length})
        </button>
      </div>

      {visiveis.length === 0 ? (
        <p className="vazio">
          {produtos.length === 0
            ? 'Nenhum produto cadastrado. Cadastre o primeiro no botão abaixo.'
            : soBaixos && !busca
              ? 'Nada para repor. Todos os produtos estão acima do mínimo.'
              : 'Nenhum produto encontrado.'}
        </p>
      ) : (
        <ul className="lista">
          {visiveis.map((p) => (
            <li key={p.id}>
              <button className="linha" onClick={() => setProdutoId(p.id)}>
                <img className={p.foto ? 'miniatura' : 'miniatura sem-foto'} src={p.foto || '/logo.png'} alt="" loading="lazy" />
                <span className="linha-texto">
                  <strong>{p.nome}</strong>
                  <small>
                    {p.categoria}, {dinheiro(p.preco)}
                  </small>
                </span>
                {p.controla_estoque ? (
                  <span className={estoqueBaixo(p) ? 'saldo baixo' : 'saldo'}>
                    <strong>{quantidade(p.estoque_atual)}</strong>
                    <small>
                      {esgotado(p) ? 'esgotado' : `${p.unidade}${estoqueBaixo(p) ? ', repor' : ''}`}
                    </small>
                  </span>
                ) : (
                  <span className="saldo">
                    <small>sem controle</small>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button className="botao flutuante" onClick={() => setFormulario(VAZIO)}>
        Cadastrar produto
      </button>

      {produto && !formulario && (
        <Movimentar
          produto={produto}
          executar={executar}
          fechar={() => setProdutoId(null)}
          editar={() =>
            setFormulario({
              ...produto,
              preco: String(produto.preco).replace('.', ','),
              estoque_minimo: String(produto.estoque_minimo).replace('.', ','),
            })
          }
        />
      )}

      {formulario && (
        <FormularioProduto
          inicial={formulario}
          categorias={[...new Set(produtos.map((p) => p.categoria))].sort()}
          executar={executar}
          fechar={() => {
            setFormulario(null)
            setProdutoId(null)
          }}
        />
      )}
    </>
  )
}

function Movimentar({ produto, executar, fechar, editar }) {
  const [tipo, setTipo] = useState('entrada')
  const [valor, setValor] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [movimentos, setMovimentos] = useState(null)

  useEffect(() => {
    let vivo = true
    api
      .listarMovimentos(produto.id)
      .then((m) => vivo && setMovimentos(m))
      .catch(() => vivo && setMovimentos([]))
    return () => {
      vivo = false
    }
  }, [produto.id, produto.estoque_atual])

  async function salvar(e) {
    e.preventDefault()
    const n = lerNumero(valor)
    if (!Number.isFinite(n) || n < 0 || (tipo !== 'ajuste' && n === 0)) {
      setErro('Digite uma quantidade válida, como 12 ou 2,5.')
      return
    }
    if (tipo === 'saida' && n > Number(produto.estoque_atual)) {
      setErro(
        Number(produto.estoque_atual) <= 0
          ? 'Não há nada em estoque para dar saída.'
          : `Só restam ${quantidade(produto.estoque_atual)} ${produto.unidade} em estoque.`
      )
      return
    }
    const delta = tipo === 'entrada' ? n : tipo === 'saida' ? -n : n - Number(produto.estoque_atual)
    if (delta === 0) {
      setErro('A contagem é igual ao saldo atual. Nada a ajustar.')
      return
    }
    setErro('')
    setSalvando(true)
    const ok = await executar(() => api.movimentarEstoque(produto.id, tipo, delta, motivo.trim()))
    setSalvando(false)
    if (ok) {
      setValor('')
      setMotivo('')
    }
  }

  const atual = TIPOS.find((t) => t.id === tipo)

  return (
    <Sheet titulo={produto.nome} fechar={fechar}>
      {produto.controla_estoque ? (
        <>
          <p className={estoqueBaixo(produto) ? 'saldo-grande baixo' : 'saldo-grande'}>
            {quantidade(produto.estoque_atual)} <small>{produto.unidade}</small>
          </p>
          <p className="apoio">
            {esgotado(produto)
              ? 'Estoque acabou: o item fica bloqueado na comanda até uma nova entrada.'
              : `Aviso de reposição em ${quantidade(produto.estoque_minimo)}${estoqueBaixo(produto) ? '. Está na hora de repor.' : '.'}`}
          </p>

          <form className="formulario" onSubmit={salvar}>
            <div className="opcoes">
              {TIPOS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={tipo === t.id ? 'opcao ativa' : 'opcao'}
                  aria-pressed={tipo === t.id}
                  onClick={() => setTipo(t.id)}
                >
                  {t.rotulo}
                </button>
              ))}
            </div>
            <label className="campo">
              <span>
                {atual.campo} ({produto.unidade})
              </span>
              <input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required />
            </label>
            <label className="campo">
              <span>Motivo (opcional)</span>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Compra, quebra, cortesia…"
                maxLength={80}
              />
            </label>
            {erro && (
              <p className="erro-campo" role="alert">
                {erro}
              </p>
            )}
            <button className="botao" disabled={salvando}>
              {salvando ? 'Salvando…' : `Registrar ${atual.rotulo.toLowerCase()}`}
            </button>
          </form>

          <h3 className="subtitulo">Últimas movimentações</h3>
          {movimentos === null ? (
            <p className="apoio">Carregando…</p>
          ) : movimentos.length === 0 ? (
            <p className="apoio">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="historico">
              {movimentos.map((m) => (
                <li key={m.id}>
                  <span>
                    {NOME_TIPO[m.tipo] || m.tipo}
                    {m.motivo && m.motivo !== 'Comanda' ? `, ${m.motivo}` : ''}
                    <small>{dataHora(m.criado_em)}</small>
                  </span>
                  <strong className={Number(m.quantidade) < 0 ? 'negativo' : 'positivo'}>
                    {Number(m.quantidade) > 0 ? '+' : ''}
                    {quantidade(m.quantidade)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="apoio">Este produto é vendido sem controle de estoque.</p>
      )}

      <button className="botao secundario" onClick={editar}>
        Editar produto
      </button>
    </Sheet>
  )
}

function FormularioProduto({ inicial, categorias, executar, fechar }) {
  const [f, setF] = useState(inicial)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const editando = Boolean(inicial.id)
  const mudar = (campo) => (e) =>
    setF({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function salvar(e) {
    e.preventDefault()
    const preco = lerNumero(f.preco)
    const minimo = f.estoque_minimo === '' ? 0 : lerNumero(f.estoque_minimo)
    const inicialQtd = f.estoque_inicial ? lerNumero(f.estoque_inicial) : 0
    if (!Number.isFinite(preco) || preco < 0) return setErro('Digite um preço válido, como 18,90.')
    if (![minimo, inicialQtd].every((n) => Number.isFinite(n) && n >= 0)) {
      return setErro('As quantidades de estoque precisam ser números, como 6 ou 1,5.')
    }
    setErro('')
    setSalvando(true)
    const ok = await executar(() =>
      api.salvarProduto(
        {
          id: inicial.id,
          nome: f.nome.trim(),
          categoria: f.categoria.trim() || 'Outros',
          preco,
          unidade: f.unidade.trim() || 'un',
          controla_estoque: f.controla_estoque,
          estoque_minimo: minimo,
        },
        inicialQtd
      )
    )
    setSalvando(false)
    if (ok) fechar()
  }

  async function arquivar() {
    if (!window.confirm(`Tirar ${inicial.nome} do cardápio e do estoque? O histórico é mantido.`)) return
    if (await executar(() => api.arquivarProduto(inicial.id))) fechar()
  }

  return (
    <Sheet titulo={editando ? 'Editar produto' : 'Cadastrar produto'} fechar={fechar}>
      <form className="formulario" onSubmit={salvar}>
        <label className="campo">
          <span>Nome</span>
          <input value={f.nome} onChange={mudar('nome')} maxLength={60} required autoFocus={!editando} />
        </label>
        <div className="dupla">
          <label className="campo">
            <span>Categoria</span>
            <input
              value={f.categoria}
              onChange={mudar('categoria')}
              list="categorias"
              placeholder="Drinks, Cervejas, Petiscos…"
              maxLength={30}
            />
            <datalist id="categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="campo">
            <span>Preço (R$)</span>
            <input inputMode="decimal" value={f.preco} onChange={mudar('preco')} placeholder="0,00" required />
          </label>
        </div>
        <label className="marcador">
          <input type="checkbox" checked={f.controla_estoque} onChange={mudar('controla_estoque')} />
          <span>Controlar estoque deste produto</span>
        </label>
        {f.controla_estoque && (
          <div className="dupla">
            <label className="campo">
              <span>Unidade</span>
              <input value={f.unidade} onChange={mudar('unidade')} placeholder="un, garrafa, kg" maxLength={12} />
            </label>
            <label className="campo">
              <span>Avisar quando chegar em</span>
              <input inputMode="decimal" value={f.estoque_minimo} onChange={mudar('estoque_minimo')} placeholder="0" />
            </label>
            {!editando && (
              <label className="campo">
                <span>Quantidade em estoque hoje</span>
                <input
                  inputMode="decimal"
                  value={f.estoque_inicial}
                  onChange={mudar('estoque_inicial')}
                  placeholder="0"
                />
              </label>
            )}
          </div>
        )}
        {erro && (
          <p className="erro-campo" role="alert">
            {erro}
          </p>
        )}
        <button className="botao" disabled={salvando}>
          {salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Cadastrar produto'}
        </button>
      </form>
      {editando && (
        <button className="botao-texto perigo" onClick={arquivar}>
          Remover produto
        </button>
      )}
    </Sheet>
  )
}
