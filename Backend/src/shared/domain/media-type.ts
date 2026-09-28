/**
 * Tipos de mídia que o sistema EXIBE (imagem, vídeo, áudio). Qualquer outro
 * tipo é tratado como documento: só baixado, nunca aberto no navegador — um
 * HTML ou SVG enviado por um cliente poderia rodar script na origem do app.
 */
export type MediaKind = 'image' | 'video' | 'audio' | 'document';

const DISPLAYABLE: Record<string, Exclude<MediaKind, 'document'>> = {
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
};

/** `audio/ogg; codecs=opus` → `audio/ogg`. */
export function baseMimeType(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase();
}

/** Como exibir (ou enviar ao WhatsApp) um arquivo deste tipo. */
export function mediaKindOf(mimeType: string): MediaKind {
  return DISPLAYABLE[baseMimeType(mimeType)] ?? 'document';
}

/** Tipo seguro para servir ao navegador: exibíveis mantêm o tipo; o resto vira binário. */
export function servedMimeType(mimeType: string): string {
  return mediaKindOf(mimeType) === 'document' ? 'application/octet-stream' : baseMimeType(mimeType);
}
