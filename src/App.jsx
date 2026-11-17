import { useCallback, useEffect, useRef, useState } from 'react'
import { configurado, supabase } from './lib/supabase.js'
import * as api from './lib/api.js'
import { estoqueBaixo } from './lib/formato.js'
import Login from './components/Login.jsx'
import Comandas from './components/Comandas.jsx'
import ComandaDetalhe from './components/ComandaDetalhe.jsx'
import Estoque from './components/Estoque.jsx'
import Sheet from './components/Sheet.jsx'

export default function App() {
  const [sessao, setSessao] = useState(undefined)

  useEffect(() => {
    if (!configurado) return
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSessao(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!configurado) return <SemConfiguracao />
  if (sessao === undefined) return <div className="carregando">Carregando…</div>
  if (!sessao) return <Login />
  return <Painel email={sessao.user.email} />
}

function SemConfiguracao() {
  return (
    <main className="entrada">
      <img className="selo" src="/logo.png" alt="Kasartes Gastrobar" />
      <h1 className="marca">Falta ligar o banco</h1>
      <p className="apoio">
        Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente
        (Vercel ou arquivo <code>.env</code>) e publique de novo.
      </p>
    </main>
  )
}

function Painel({ email }) {
  const [aba, setAba] = useState('comandas')
  const [produtos, setProdutos] = useState([])
  const [comandas, setComandas] = useState([])
  const [comandaId, setComandaId] = useState(null)
  const [pronto, setPronto] = useState(false)
  const [erro, setErro] = useState('')
  const [contaAberta, setContaAberta] = useState(false)
  const pendente = useRef(null)

  const carregar = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api.listarProdutos(), api.listarComandas()])
      setProdutos(p)
      setComandas(c)
    } catch (e) {
      setErro(`Não foi possível carregar os dados: ${e.message}`)
    } finally {
      setPronto(true)
    }
  }, [])

  // roda a acao e recarrega tudo depois
  const executar = useCallback(
    async (acao) => {
      try {
        setErro('')
        const resultado = await acao()
        await carregar()
        return resultado ?? true
      } catch (e) {
        setErro(e.message)
        await carregar()
        return false
      }
    },
    [carregar]
  )

  useEffect(() => {
    carregar()
    const agendar = () => {
      clearTimeout(pendente.current)
      pendente.current = setTimeout(carregar, 250)
    }
    const canal = supabase
      .channel('kasartes')
      .on('postgres_changes', { event: '*', schema: 'public' }, agendar)
      .subscribe()
    const aoVoltar = () => document.visibilityState === 'visible' && carregar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      clearTimeout(pendente.current)
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [carregar])

  const comanda = comandas.find((c) => c.id === comandaId)
  const alertas = produtos.filter(estoqueBaixo).length

  return (
    <div className="app">
      <header className="topo">
        <img className="topo-logo" src="/logo.png" alt="" />
        <span className="topo-nome">Kasartes</span>
        <button className="botao-texto" onClick={() => setContaAberta(true)}>
          Conta
        </button>
      </header>

      {erro && (
        <div className="aviso-erro" role="alert">
          <span>{erro}</span>
          <button onClick={() => setErro('')} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      <main className="conteudo">
        {!pronto ? (
          <p className="vazio">Carregando…</p>
        ) : comanda ? (
          <ComandaDetalhe
            comanda={comanda}
            produtos={produtos}
            executar={executar}
            voltar={() => setComandaId(null)}
          />
        ) : aba === 'comandas' ? (
          <Comandas comandas={comandas} executar={executar} abrir={setComandaId} />
        ) : (
          <Estoque produtos={produtos} executar={executar} />
        )}
      </main>

      {!comanda && (
        <nav className="abas" aria-label="Seções">
          <button className={aba === 'comandas' ? 'aba ativa' : 'aba'} onClick={() => setAba('comandas')}>
            Comandas
          </button>
          <button className={aba === 'estoque' ? 'aba ativa' : 'aba'} onClick={() => setAba('estoque')}>
            Estoque
            {alertas > 0 && <span className="contador">{alertas}</span>}
          </button>
        </nav>
      )}

      {contaAberta && (
        <Sheet titulo="Conta" fechar={() => setContaAberta(false)}>
          <p className="apoio">Você entrou como {email}.</p>
          <button className="botao secundario" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </Sheet>
      )}
    </div>
  )
}
