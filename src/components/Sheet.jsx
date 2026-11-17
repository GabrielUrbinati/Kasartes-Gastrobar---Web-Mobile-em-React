import { useEffect } from 'react'

export default function Sheet({ titulo, fechar, children }) {
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && fechar()
    document.addEventListener('keydown', aoTeclar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', aoTeclar)
      document.body.style.overflow = ''
    }
  }, [fechar])

  return (
    <div className="sheet-fundo" onClick={fechar}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-topo">
          <h2>{titulo}</h2>
          <button className="botao-texto" onClick={fechar}>
            Fechar
          </button>
        </header>
        <div className="sheet-corpo">{children}</div>
      </section>
    </div>
  )
}
