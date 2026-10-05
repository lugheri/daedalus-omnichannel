import { useCallback, useState } from 'react'

/**
 * Preferência liga/desliga da moldura guardada no navegador (painel
 * recolhido, trilho só com ícones). É conveniência de quem usa: se o
 * armazenamento falhar (aba privada, bloqueio), vale o padrão.
 */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored === null ? fallback : stored === '1'
    } catch {
      return fallback
    }
  })

  const update = useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        localStorage.setItem(key, next ? '1' : '0')
      } catch {
        // sem armazenamento: vale só nesta visita
      }
    },
    [key],
  )

  return [value, update]
}
