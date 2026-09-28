import { Download, FileText, ImageOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useMessageMedia, type Message } from './api'
import { displayKind, fileSizeLabel } from './media-kind'

/**
 * Anexo de uma mensagem. Só imagem, áudio e vídeo de tipos conhecidos são
 * exibidos; qualquer outro arquivo vira um botão de download — nunca aberto
 * no navegador (um HTML/SVG rodaria script na origem do app).
 */
export function MessageMedia({ message, outbound }: { message: Message; outbound: boolean }) {
  const media = message.media!
  const kind = displayKind(media.mimeType)
  // Mensagem otimista (ainda sem id do servidor): nada para baixar.
  const saved = !message.id.startsWith('optimistic-')
  const blob = useMessageMedia(message.conversationId, message.id, saved)
  const url = useObjectUrl(blob.data)
  const [zoomed, setZoomed] = useState(false)

  if (blob.isError) {
    return (
      <p className="flex items-center gap-1 text-xs italic opacity-80">
        <ImageOff className="size-3.5" /> Arquivo indisponível
      </p>
    )
  }

  if (kind === 'document') {
    const name = media.fileName ?? 'arquivo'
    return (
      <div className="flex items-center gap-2 py-1">
        <FileText className="size-8 shrink-0 opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs opacity-70">{fileSizeLabel(media.size)}</p>
        </div>
        <Button
          asChild={!!url}
          size="icon"
          variant={outbound ? 'secondary' : 'outline'}
          disabled={!url}
          aria-label={`Baixar ${name}`}
        >
          {url ? (
            <a href={url} download={name}>
              <Download />
            </a>
          ) : (
            <Download />
          )}
        </Button>
      </div>
    )
  }

  if (!url) return <Skeleton className={cn(kind === 'audio' ? 'h-10 w-60' : 'size-48')} />

  if (kind === 'audio') return <audio controls src={url} className="w-60 max-w-full" />
  if (kind === 'video') {
    return <video controls src={url} className="max-h-72 max-w-full rounded-lg" />
  }
  return (
    <>
      <button type="button" onClick={() => setZoomed(true)} aria-label="Ampliar imagem">
        <img
          src={url}
          alt={outbound ? 'Imagem enviada' : 'Imagem recebida'}
          className="max-h-72 max-w-full rounded-lg"
        />
      </button>
      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-[90vw] sm:max-w-4xl">
          <DialogTitle className="sr-only">Imagem</DialogTitle>
          <img src={url} alt="Imagem ampliada" className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}

/** URL local (blob:) para o arquivo baixado; liberada ao sair da tela. */
function useObjectUrl(blob: Blob | undefined): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob])
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url])
  return url
}
