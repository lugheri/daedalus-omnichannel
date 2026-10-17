import { useEffect, useState } from 'react'

interface Shown {
  /** Versão do pedido que gerou o que está na tela. */
  key: string
  html: string | null
  error: unknown
}

/**
 * Prévia que acompanha a edição: pede o HTML uma pausa depois da última
 * mudança e descarta respostas de pedidos antigos (a última versão vence).
 * `loading` é derivado: a prévia na tela é de outra versão do conteúdo.
 */
export function usePreview<T>(
  input: T,
  fetchHtml: (input: T) => Promise<{ html: string }>,
  delayMs = 600,
) {
  const key = JSON.stringify(input)
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    let current = true
    const timer = setTimeout(() => {
      fetchHtml(JSON.parse(key) as T)
        .then(({ html }) => {
          if (current) setShown({ key, html, error: null })
        })
        .catch((error: unknown) => {
          // Mantém a última prévia boa na tela, com o erro ao lado.
          if (current) setShown((previous) => ({ key, html: previous?.html ?? null, error }))
        })
    }, delayMs)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [key, fetchHtml, delayMs])

  return {
    html: shown?.html ?? null,
    error: shown?.key === key ? shown.error : null,
    loading: shown?.key !== key,
  }
}
