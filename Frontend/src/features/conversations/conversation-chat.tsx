import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRightLeft,
  CheckCheck,
  Hand,
  Paperclip,
  RotateCcw,
  SendHorizontal,
  Timer,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe, usePermissions } from '@/features/auth/session-context'
import { useMemberNames } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { formatPhone } from '@/lib/phone'
import {
  conversationKeys,
  conversationsApi,
  useConversation,
  useMessages,
  type ConversationStatus,
  type Message,
} from './api'
import { contactInitials, contactLabel, dayLabel, isSameDay } from './format'
import { MAX_ATTACHMENT_BYTES, fileSizeLabel } from './media-kind'
import { MessageBubble } from './message-bubble'
import { TransferDialog } from './transfer-dialog'

type MessagePages = InfiniteData<{ items: Message[]; nextCursor: string | null }>

const STATUS_LABEL: Record<ConversationStatus, string> = {
  open: 'Aberta',
  pending: 'Aguardando cliente',
  resolved: 'Resolvida',
}

/** Coluna da direita: cabeçalho com ações, mensagens e caixa de resposta. */
export function ConversationChat({ id, backTo }: { id: string; backTo: string }) {
  const queryClient = useQueryClient()
  const conversation = useConversation(id)
  const messages = useMessages(id)
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [transferring, setTransferring] = useState(false)
  const me = useMe()
  const { can } = usePermissions()
  const nameOf = useMemberNames()

  const refresh = () => queryClient.invalidateQueries({ queryKey: conversationKeys.all })

  // Abriu (ou chegou mensagem com ela aberta): zera as não lidas.
  const unread = conversation.data?.unreadCount ?? 0
  useEffect(() => {
    if (unread === 0) return
    void conversationsApi
      .markRead(id)
      .then(() => queryClient.invalidateQueries({ queryKey: conversationKeys.all }))
  }, [id, unread, queryClient])

  const send = useMutation({
    mutationFn: (text: string) => conversationsApi.send(id, text),
    onMutate: (text) => addOptimistic(queryClient, id, text),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => void refresh(),
  })

  const changeStatus = useMutation({
    mutationFn: (status: ConversationStatus) => conversationsApi.changeStatus(id, status),
    onSuccess: (_, status) => {
      toast.success(status === 'resolved' ? 'Conversa resolvida.' : 'Status atualizado.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const claim = useMutation({
    mutationFn: () => conversationsApi.claim(id),
    onSuccess: () => {
      toast.success('Conversa atribuída a você.')
      void refresh()
    },
    onError: (error) => toast.error(errorMessage(error)),
  })

  const sendFile = useMutation({
    mutationFn: ({ file, caption }: { file: File; caption: string }) =>
      conversationsApi.sendAttachment(id, file, caption),
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => void refresh(),
  })

  const pickFile = (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('Arquivo grande demais (máximo 25 MB).')
      return
    }
    setAttachment(file)
  }

  const submit = () => {
    const text = draft.trim()
    if (attachment) {
      if (sendFile.isPending) return
      // O texto digitado vai como legenda do anexo.
      sendFile.mutate({ file: attachment, caption: text })
      setAttachment(null)
      setDraft('')
      return
    }
    if (!text || send.isPending) return
    send.mutate(text)
    setDraft('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envia; Shift+Enter quebra linha (e não interrompe acentuação/IME).
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  if (conversation.isError) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-6 text-sm">
        {errorMessage(conversation.error)}
      </div>
    )
  }

  const data = conversation.data
  // Da mais recente para a mais antiga: a lista usa flex-col-reverse, então a
  // mais recente fica embaixo e o scroll começa no fim, como num chat.
  const items = messages.data?.pages.flatMap((page) => page.items) ?? []
  const channelRemoved = data && data.channel.name === null

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-3 py-2 md:px-4">
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label="Voltar">
          <Link to={backTo}>
            <ArrowLeft />
          </Link>
        </Button>
        {data ? (
          <>
            <Avatar className="size-9">
              <AvatarFallback>{contactInitials(data.contact)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-medium">
                {can('contacts:view') ? (
                  <Link
                    to={`/contacts/${data.contact.id}`}
                    className="hover:underline"
                    title="Ver ficha do contato"
                  >
                    {contactLabel(data.contact)}
                  </Link>
                ) : (
                  contactLabel(data.contact)
                )}
              </h2>
              <p className="text-muted-foreground truncate text-xs">
                {data.contact.name && data.contact.phone && `${formatPhone(data.contact.phone)} · `}
                {data.channel.name ?? 'Canal removido'}
                {data.team && ` · ${data.team.name}`}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {data.assigneeId === me.membershipId
                  ? 'Responsável: você'
                  : data.assigneeId
                    ? `Responsável: ${nameOf(data.assigneeId) ?? 'outro membro'}`
                    : 'Sem responsável'}
              </p>
            </div>
            {!data.assigneeId && (
              <Button
                variant="outline"
                size="sm"
                disabled={claim.isPending}
                onClick={() => claim.mutate()}
              >
                <Hand />
                Assumir
              </Button>
            )}
            {can('conversations:assign') && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Transferir"
                title="Transferir"
                onClick={() => setTransferring(true)}
              >
                <ArrowRightLeft />
              </Button>
            )}
            <Badge variant="outline" className="hidden sm:inline-flex">
              {STATUS_LABEL[data.status]}
            </Badge>
            {data.status === 'resolved' ? (
              <Button
                variant="outline"
                size="sm"
                disabled={changeStatus.isPending}
                onClick={() => changeStatus.mutate('open')}
                aria-label="Reabrir"
              >
                <RotateCcw />
                <span className="hidden sm:inline">Reabrir</span>
              </Button>
            ) : (
              <>
                {data.status === 'open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={changeStatus.isPending}
                    onClick={() => changeStatus.mutate('pending')}
                    title="Aguardando resposta do cliente"
                    aria-label="Marcar como pendente"
                  >
                    <Timer />
                    <span className="hidden lg:inline">Pendente</span>
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={changeStatus.isPending}
                  onClick={() => changeStatus.mutate('resolved')}
                  aria-label="Resolver"
                >
                  <CheckCheck />
                  <span className="hidden sm:inline">Resolver</span>
                </Button>
              </>
            )}
          </>
        ) : (
          <Skeleton className="h-9 flex-1" />
        )}
      </header>

      <div
        role="log"
        aria-label="Mensagens"
        className="bg-muted/30 flex min-h-0 flex-1 flex-col-reverse gap-2 overflow-y-auto p-3 md:p-4"
      >
        {items.map((message, index) => {
          const older = items[index + 1]
          return (
            <Fragment key={message.id}>
              <MessageBubble
                message={message}
                senderName={
                  message.senderMembershipId === me.membershipId ||
                  message.senderMembershipId === 'me'
                    ? 'Você'
                    : nameOf(message.senderMembershipId)
                }
              />
              {(!older || !isSameDay(older.sentAt, message.sentAt)) && (
                <div className="text-muted-foreground my-2 self-center rounded-full bg-background px-3 py-0.5 text-xs shadow-xs">
                  {dayLabel(message.sentAt)}
                </div>
              )}
            </Fragment>
          )
        })}
        {messages.isPending && <Skeleton className="h-16 w-2/3" />}
        {messages.hasNextPage && (
          <Button
            variant="ghost"
            size="sm"
            className="self-center"
            disabled={messages.isFetchingNextPage}
            onClick={() => void messages.fetchNextPage()}
          >
            {messages.isFetchingNextPage ? 'Carregando…' : 'Carregar mensagens anteriores'}
          </Button>
        )}
      </div>

      {data && transferring && (
        <TransferDialog conversation={data} open onOpenChange={setTransferring} />
      )}

      {attachment && (
        <div className="flex items-center gap-2 border-t px-3 pt-2 text-sm">
          <Paperclip className="text-muted-foreground size-4" />
          <span className="min-w-0 flex-1 truncate">
            {attachment.name}{' '}
            <span className="text-muted-foreground">({fileSizeLabel(attachment.size)})</span>
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Remover anexo"
            onClick={() => setAttachment(null)}
          >
            <X />
          </Button>
        </div>
      )}
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          aria-label="Arquivo para anexar"
          onChange={(event) => {
            pickFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Anexar arquivo"
          disabled={channelRemoved}
          onClick={() => fileInput.current?.click()}
        >
          <Paperclip />
        </Button>
        <Textarea
          aria-label="Mensagem"
          placeholder={
            channelRemoved
              ? 'O canal desta conversa foi removido.'
              : attachment
                ? 'Legenda (opcional)… Enter envia o anexo'
                : 'Escreva uma mensagem… (Enter envia, Shift+Enter quebra linha)'
          }
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={channelRemoved}
          maxLength={4096}
          rows={1}
          className="max-h-40 min-h-10 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Enviar"
          disabled={(!draft.trim() && !attachment) || channelRemoved || sendFile.isPending}
        >
          <SendHorizontal />
        </Button>
      </form>
    </div>
  )
}

/** Mostra a mensagem na hora, como "enviando"; o refetch traz a versão do servidor. */
function addOptimistic(queryClient: QueryClient, conversationId: string, text: string) {
  const optimistic: Message = {
    id: `optimistic-${crypto.randomUUID()}`,
    conversationId,
    direction: 'outbound',
    kind: 'text',
    text,
    status: 'pending',
    error: null,
    senderMembershipId: 'me',
    sentAt: new Date().toISOString(),
    media: null,
  }
  queryClient.setQueryData<MessagePages>(conversationKeys.messages(conversationId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page, i) =>
            i === 0 ? { ...page, items: [optimistic, ...page.items] } : page,
          ),
        }
      : data,
  )
}
