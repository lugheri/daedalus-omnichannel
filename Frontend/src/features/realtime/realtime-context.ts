import { createContext, useContext } from 'react'

export type RealtimeStatus =
  | 'connecting' // primeira conexão em andamento
  | 'connected'
  | 'reconnecting' // caiu; tentando de novo (a tela se atualiza por polling enquanto isso)

export const RealtimeContext = createContext<RealtimeStatus>('connecting')

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(RealtimeContext)
}

/** Com tempo real ativo, as telas dispensam a atualização periódica. */
export function useRealtimeLive(): boolean {
  return useRealtimeStatus() === 'connected'
}
