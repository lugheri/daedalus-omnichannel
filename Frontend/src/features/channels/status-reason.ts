import type { Channel } from './api'

/** Motivo técnico da última mudança, em linguagem de gente. */
export function statusReasonLabel(
  channel: Pick<Channel, 'status' | 'statusReason'>,
): string | null {
  const reason = channel.statusReason
  // Só explica quedas; ao reconectar, o motivo antigo não interessa mais.
  if (!reason || (channel.status !== 'disconnected' && channel.status !== 'logged_out')) return null
  if (reason === 'qr_timeout') return 'O QR code não foi escaneado a tempo.'
  if (reason === 'requested') return 'Desconectado por um usuário.'
  if (reason === 'loggedOut') return 'Desconectado pelo celular.'
  if (reason === 'connectionReplaced') return 'O número foi conectado em outro lugar.'
  return 'A conexão caiu; tentando reconectar.'
}
