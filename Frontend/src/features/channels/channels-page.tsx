import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { errorMessage } from '@/lib/api/api-error'
import { formatPhone } from '@/lib/phone'
import { REMOVABLE, channelsApi, channelsQueryKey, useChannels, type Channel } from './api'
import { CreateChannelDialog, TestMessageDialog } from './channel-form-dialogs'
import { ChannelStatusBadge } from './channel-status-badge'
import { statusReasonLabel } from './status-reason'
import { ConnectChannelDialog } from './connect-channel-dialog'

export function ChannelsPage() {
  const queryClient = useQueryClient()
  const channels = useChannels()
  const [creating, setCreating] = useState(false)
  const [pairingId, setPairingId] = useState<string | null>(null)
  const [testing, setTesting] = useState<Channel | null>(null)
  const [disconnecting, setDisconnecting] = useState<Channel | null>(null)
  const [removing, setRemoving] = useState<Channel | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })

  const connect = useMutation({
    mutationFn: (channel: Channel) => channelsApi.connect(channel.id),
    onSuccess: (_, channel) => {
      void refresh()
      setPairingId(channel.id)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const disconnect = useMutation({
    mutationFn: (channel: Channel) => channelsApi.disconnect(channel.id),
    onSuccess: () => {
      toast.success('Canal desconectado.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const remove = useMutation({
    mutationFn: (channel: Channel) => channelsApi.remove(channel.id),
    onSuccess: () => {
      toast.success('Canal removido.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <PageHeader
        title="Canais"
        description="Números de WhatsApp conectados ao atendimento."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            Novo canal
          </Button>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.isPending && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {channels.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground py-8 text-center">
                  Nenhum canal ainda. Crie um para conectar seu WhatsApp.
                </TableCell>
              </TableRow>
            )}
            {channels.data?.map((channel) => {
              const connected = channel.status === 'connected'
              const reason = connected ? null : statusReasonLabel(channel)
              return (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">{channel.name}</TableCell>
                  <TableCell>
                    {channel.phoneNumber ? formatPhone(channel.phoneNumber) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <ChannelStatusBadge status={channel.status} />
                      {reason && <span className="text-muted-foreground text-xs">{reason}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label="Ações">
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {connected ? (
                          <DropdownMenuItem onSelect={() => setTesting(channel)}>
                            Enviar mensagem de teste
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => connect.mutate(channel)}>
                            Conectar (QR code)
                          </DropdownMenuItem>
                        )}
                        {channel.status !== 'logged_out' && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDisconnecting(channel)}
                          >
                            Desconectar
                          </DropdownMenuItem>
                        )}
                        {REMOVABLE.has(channel.status) && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setRemoving(channel)}
                          >
                            Remover canal
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <CreateChannelDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(channel) => setPairingId(channel.id)}
      />
      <ConnectChannelDialog channelId={pairingId} onOpenChange={() => setPairingId(null)} />
      <TestMessageDialog channel={testing} onOpenChange={() => setTesting(null)} />

      <AlertDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar {disconnecting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O número deixa de receber e enviar mensagens por aqui. Para reconectar, será preciso
              escanear um novo QR code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnecting && disconnect.mutate(disconnecting)}>
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o canal {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O canal sai da lista e a sessão do WhatsApp guardada é apagada. Para usar o número de
              novo, crie outro canal e escaneie um novo QR code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => removing && remove.mutate(removing)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
