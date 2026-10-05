import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPhone } from '@/lib/phone'
import { channelsQueryKey, useChannelConnection } from './api'
import { ChannelStatusBadge } from './channel-status-badge'
import { statusReasonLabel } from './status-reason'
import { QrCodeImage } from './qr-code-image'

/**
 * Pareamento: mostra o QR code enquanto o conector o publica e acompanha o
 * status até conectar. O QR se renova sozinho (~20 s) e expira em 3 min.
 */
export function ConnectChannelDialog({
  channelId,
  onOpenChange,
}: {
  channelId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const connection = useChannelConnection(channelId)
  const channel = connection.data
  const connected = channel?.status === 'connected'

  // Status mudou: a lista de canais também precisa refletir.
  useEffect(() => {
    if (channel?.status)
      void queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })
  }, [channel?.status, queryClient])

  return (
    <Dialog open={channelId !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp{channel && ` — ${channel.name}`}</DialogTitle>
          <DialogDescription>
            No celular, abra o WhatsApp › Configurações › Aparelhos conectados › Conectar um
            aparelho, e aponte a câmera para o código.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-72 flex-col items-center justify-center gap-3">
          {!channel && <Skeleton className="size-66" />}
          {channel && connected && (
            <>
              <CheckCircle2 className="size-12 text-success" />
              <p className="font-medium">
                Conectado{channel.phoneNumber && ` a ${formatPhone(channel.phoneNumber)}`}
              </p>
            </>
          )}
          {channel && !connected && channel.qrCode && <QrCodeImage value={channel.qrCode} />}
          {channel && !connected && !channel.qrCode && (
            <>
              <Skeleton className="size-66" />
              <p className="text-muted-foreground text-sm">
                {statusReasonLabel(channel) ?? 'Gerando QR code…'}
              </p>
            </>
          )}
          {channel && <ChannelStatusBadge status={channel.status} />}
        </div>

        <DialogFooter>
          <Button variant={connected ? 'default' : 'outline'} onClick={() => onOpenChange(false)}>
            {connected ? 'Concluir' : 'Fechar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
