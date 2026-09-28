import { formatPhone } from '@/lib/phone'
import type { Conversation, Message } from './api'

const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const longDate = new Intl.DateTimeFormat('pt-BR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function daysAgo(date: Date): number {
  return Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS)
}

/** Horário na lista de conversas: hoje → 14:05; ontem; na semana → quarta; depois → 12/03/26. */
export function listTime(iso: string): string {
  const date = new Date(iso)
  const days = daysAgo(date)
  if (days === 0) return time.format(date)
  if (days === 1) return 'Ontem'
  if (days < 7) return weekday.format(date)
  return shortDate.format(date)
}

export function messageTime(iso: string): string {
  return time.format(new Date(iso))
}

/** Separador de dia no chat. */
export function dayLabel(iso: string): string {
  const date = new Date(iso)
  const days = daysAgo(date)
  if (days === 0) return 'Hoje'
  if (days === 1) return 'Ontem'
  return longDate.format(date)
}

export function isSameDay(a: string, b: string): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b))
}

/** Nome do contato; sem nome, o telefone formatado. */
export function contactLabel(contact: Conversation['contact']): string {
  return contact.name ?? (contact.phone ? formatPhone(contact.phone) : 'Contato')
}

export function contactInitials(contact: Conversation['contact']): string {
  if (!contact.name) return '#'
  return contact.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Conteúdo que ainda não exibimos (mídia chega no passo 7). */
const KIND_LABELS: Record<string, string> = {
  image: '📷 Imagem',
  video: '🎥 Vídeo',
  audio: '🎤 Áudio',
  document: '📄 Documento',
  sticker: 'Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  unsupported: 'Mensagem não suportada',
}

export function kindLabel(message: Message): string | null {
  return KIND_LABELS[message.kind] ?? null
}

const SEND_ERRORS: Record<string, string> = {
  not_connected: 'Não enviada: o canal está desconectado.',
  not_on_whatsapp: 'Não enviada: o número não tem WhatsApp.',
  enqueue_failed: 'Não enviada: falha ao falar com o servidor.',
  media_not_found: 'Não enviada: o arquivo não foi encontrado.',
}

export function sendErrorLabel(error: string | null): string {
  return (error && SEND_ERRORS[error]) ?? 'Não enviada.'
}
