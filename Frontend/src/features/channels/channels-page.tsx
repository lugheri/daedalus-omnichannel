import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, MessageCircle, MessagesSquare, MoreHorizontal, Plus } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
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
import { ChannelTeamDialog } from './channel-team-dialog'
import { ConnectChannelDialog } from './connect-channel-dialog'
import { WebChatDialog } from './web-chat-dialog'

export function ChannelsPage() {
  const queryClient = useQueryClient()
  const channels = useChannels()
  const [creating, setCreating] = useState<'whatsapp' | 'web_chat' | null>(null)
  const [configuring, setConfiguring] = useState<Channel | null>(null)
  const [pairingId, setPairingId] = useState<string | null>(null)
  const [testing, setTesting] = useState<Channel | null>(null)
  const [disconnecting, setDisconnecting] = useState<Channel | null>(null)
  const [removing, setRemoving] = useState<Channel | null>(null)
  const [teamOf, setTeamOf] = useState<Channel | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: channelsQueryKey, exact: true })

  const connect = useMutation({
    mutationFn: (channel: Channel) => channelsApi.connect(channel.id),
    onSuccess: (_, channel) => {
      void refresh()
      if (channel.provider === 'web_chat') toast.success('Chat ligado: o widget volta ao site.')
      else setPairingId(channel.id)
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const disconnect = useMutation({
    mutationFn: (channel: Channel) => channelsApi.disconnect(channel.id),
    onSuccess: (_, channel) => {
      toast.success(channel.provider === 'web_chat' ? 'Chat desligado.' : 'Canal desconectado.')
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
        description="Por onde os clientes falam com a equipe: números de WhatsApp e o chat do site."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus />
                Novo canal
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCreating('whatsapp')}>
                <MessageCircle />
                WhatsApp
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setCreating('web_chat')}>
                <MessagesSquare />
                Chat do site
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Número</TableHead>
              <TableHead>Equipe</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.isPending && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8" />
                </TableCell>
              </TableRow>
            )}
            {channels.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                  Nenhum canal ainda. Conecte um WhatsApp ou crie o chat do site.
                </TableCell>
              </TableRow>
            )}
            {channels.data?.map((channel) => {
              const connected = channel.status === 'connected'
              const webChat = channel.provider === 'web_chat'
              const reason = connected || webChat ? null : statusReasonLabel(channel)
              return (
                <TableRow key={channel.id}>
                  <TableCell className="font-medium">{channel.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {webChat ? (
                        <MessagesSquare className="size-4" />
                      ) : (
                        <MessageCircle className="size-4" />
                      )}
                      {webChat ? 'Chat do site' : 'WhatsApp'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {channel.phoneNumber ? formatPhone(channel.phoneNumber) : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {channel.teamName ?? 'Fila geral'}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {webChat ? (
                        <Badge variant={connected ? 'success' : 'secondary'}>
                          {connected ? 'Ligado' : 'Desligado'}
                        </Badge>
                      ) : (
                        <ChannelStatusBadge status={channel.status} />
                      )}
                      {reason && <span className="text-muted-foreground text-xs">{reason}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" aria-label={`Ações de ${channel.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {webChat ? (
                          <>
                            <DropdownMenuItem onSelect={() => setConfiguring(channel)}>
                              Configurar e código do site
                            </DropdownMenuItem>
                            {!connected && (
                              <DropdownMenuItem onSelect={() => connect.mutate(channel)}>
                                Ligar
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : connected ? (
                          <DropdownMenuItem onSelect={() => setTesting(channel)}>
                            Enviar mensagem de teste
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => connect.mutate(channel)}>
                            Conectar (QR code)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setTeamOf(channel)}>
                          Definir equipe
                        </DropdownMenuItem>
                        {channel.status !== 'logged_out' && (!webChat || connected) && (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setDisconnecting(channel)}
                          >
                            {webChat ? 'Desligar' : 'Desconectar'}
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
        type={creating}
        onOpenChange={(open) => !open && setCreating(null)}
        onCreated={(channel) =>
          channel.provider === 'web_chat' ? setConfiguring(channel) : setPairingId(channel.id)
        }
      />
      {configuring && (
        <WebChatDialog
          key={configuring.id}
          channel={configuring}
          onOpenChange={(open) => !open && setConfiguring(null)}
        />
      )}
      <ConnectChannelDialog channelId={pairingId} onOpenChange={() => setPairingId(null)} />
      <TestMessageDialog channel={testing} onOpenChange={() => setTesting(null)} />
      <ChannelTeamDialog channel={teamOf} onOpenChange={() => setTeamOf(null)} />

      <AlertDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {disconnecting?.provider === 'web_chat' ? 'Desligar' : 'Desconectar'}{' '}
              {disconnecting?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {disconnecting?.provider === 'web_chat'
                ? 'O botão do chat some dos sites e novas mensagens não chegam. As conversas continuam na caixa de entrada.'
                : 'O número deixa de receber e enviar mensagens por aqui. Para reconectar, será preciso escanear um novo QR code.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => disconnecting && disconnect.mutate(disconnecting)}>
              {disconnecting?.provider === 'web_chat' ? 'Desligar' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover o canal {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.provider === 'web_chat'
                ? 'O canal sai da lista e o código colado nos sites para de funcionar. As conversas continuam na caixa de entrada.'
                : 'O canal sai da lista e a sessão do WhatsApp guardada é apagada. Para usar o número de novo, crie outro canal e escaneie um novo QR code.'}
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
