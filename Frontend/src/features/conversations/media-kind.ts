/**
 * Espelho de `shared/domain/media-type.ts` do backend: só estes tipos são
 * exibidos na tela. Qualquer outro é documento (baixar, nunca abrir).
 */
const DISPLAYABLE: Record<string, 'image' | 'video' | 'audio'> = {
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'video/mp4': 'video',
  'video/3gpp': 'video',
  'audio/ogg': 'audio',
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/aac': 'audio',
  'audio/amr': 'audio',
  'audio/wav': 'audio',
  'audio/webm': 'audio',
}

export function displayKind(mimeType: string): 'image' | 'video' | 'audio' | 'document' {
  return DISPLAYABLE[mimeType.split(';')[0].trim().toLowerCase()] ?? 'document'
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Limite do backend (MEDIA_MAX_MB); conferido antes de enviar, para avisar na hora. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024
