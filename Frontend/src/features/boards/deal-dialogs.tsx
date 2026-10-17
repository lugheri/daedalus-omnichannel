import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Search, Trash2, Trophy, Undo2, X } from 'lucide-react'
import { useDeferredValue, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { FormError } from '@/components/form/form-error'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useMe } from '@/features/auth/session-context'
import { contactsApi } from '@/features/contacts/api'
import { useMemberDirectory } from '@/features/members/api'
import { errorMessage } from '@/lib/api/api-error'
import { formatMoney, moneyToInput, parseMoney } from '@/lib/money'
import { dealsApi, useBoards, useDeal, type Board, type DealContact } from './api'
import { DEAL_STATUS, dealContactLabel, refreshDeals } from './deal-format'

const NO_OWNER = 'none'

/** Responsável: os colegas ativos, ou ninguém (fica na fila de leads). */
function OwnerSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  const directory = useMemberDirectory()
  const known = directory.data?.some((m) => m.membershipId === value)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_OWNER}>Ninguém (fila de leads)</SelectItem>
        {directory.data?.map((m) => (
          <SelectItem key={m.membershipId} value={m.membershipId}>
            {m.name}
          </SelectItem>
        ))}
        {value !== NO_OWNER && !known && <SelectItem value={value}>Membro desativado</SelectItem>}
      </SelectContent>
    </Select>
  )
}

/** Busca de contato por nome, telefone ou e-mail. */
function ContactPicker({
  value,
  onChange,
}: {
  value: DealContact | null
  onChange: (contact: DealContact | null) => void
}) {
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim())
  const results = useQuery({
    queryKey: ['contacts', 'picker', deferred],
    queryFn: () => contactsApi.list({ q: deferred }),
    enabled: deferred.length >= 2,
    staleTime: 30_000,
  })

  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="truncate font-medium">{dealContactLabel(value)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Trocar contato"
          onClick={() => onChange(null)}
        >
          <X />
        </Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="text-faint pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          id="deal-contact"
          autoFocus
          className="pl-8"
          value={query}
          placeholder="Nome, telefone ou e-mail"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {deferred.length >= 2 && (
        <ul
          className="max-h-48 overflow-y-auto rounded-md border"
          aria-label="Contatos encontrados"
        >
          {results.isPending && <li className="text-muted-foreground p-2 text-sm">Buscando…</li>}
          {results.data?.items.length === 0 && (
            <li className="text-muted-foreground p-2 text-sm">Nenhum contato com esse nome.</li>
          )}
          {results.data?.items.slice(0, 8).map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                className="hover:bg-accent w-full px-3 py-1.5 text-left text-sm"
                onClick={() => onChange(contact)}
              >
                {dealContactLabel(contact)}
                {contact.name && contact.phone && (
                  <span className="text-faint ml-2 text-xs">{contact.phone}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Novo negócio. Funil e etapa podem vir fixos (botão da etapa) ou ser
 * escolhidos; o contato pode vir fixo (ficha, chat) ou ser buscado.
 */
export function NewDealDialog({
  board: fixedBoard,
  columnId: fixedColumn,
  contact: fixedContact,
  conversationId,
  open,
  onOpenChange,
}: {
  board?: Board
  columnId?: string
  contact?: DealContact
  /** Liga o negócio a esta conversa (vindo do chat). */
  conversationId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const me = useMe()
  const boards = useBoards()
  const [boardId, setBoardId] = useState(fixedBoard?.id ?? '')
  const [columnId, setColumnId] = useState(fixedColumn ?? '')
  const [contact, setContact] = useState<DealContact | null>(fixedContact ?? null)
  const [title, setTitle] = useState('')
  const [value, setValue] = useState('')
  const [owner, setOwner] = useState(me.membershipId)
  const board = fixedBoard ?? boards.data?.find((b) => b.id === boardId) ?? boards.data?.[0]
  const valueCents = parseMoney(value)

  const create = useMutation({
    mutationFn: () =>
      dealsApi.create({
        boardId: board!.id,
        columnId: columnId || undefined,
        contactId: contact?.id,
        conversationId,
        title: title.trim() || undefined,
        valueCents: valueCents ?? null,
        ownerId: owner === NO_OWNER ? null : owner,
      }),
    onSuccess: () => {
      toast.success(`Negócio criado em ${board?.name ?? 'funil'}.`)
      refreshDeals(queryClient)
      onOpenChange(false)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (board && (contact || conversationId) && valueCents !== undefined) create.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo negócio</DialogTitle>
          <DialogDescription>
            Uma oportunidade de venda para acompanhar no funil, da primeira conversa ao fechamento.
          </DialogDescription>
        </DialogHeader>
        <form id="deal-form" onSubmit={submit} noValidate>
          <FieldGroup>
            <FormError error={create.error} />
            {!fixedContact && (
              <Field>
                <FieldLabel htmlFor="deal-contact">Contato</FieldLabel>
                <ContactPicker value={contact} onChange={setContact} />
              </Field>
            )}
            {!fixedBoard && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="deal-board">Funil</FieldLabel>
                  <Select
                    value={board?.id ?? ''}
                    onValueChange={(v) => {
                      setBoardId(v)
                      setColumnId('')
                    }}
                  >
                    <SelectTrigger id="deal-board" className="w-full">
                      <SelectValue placeholder="Escolha…" />
                    </SelectTrigger>
                    <SelectContent>
                      {boards.data?.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {board && (
                  <Field>
                    <FieldLabel htmlFor="deal-column">Etapa</FieldLabel>
                    <Select value={columnId || board.columns[0].id} onValueChange={setColumnId}>
                      <SelectTrigger id="deal-column" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {board.columns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
            )}
            {boards.isSuccess && boards.data.length === 0 && !fixedBoard && (
              <p className="text-muted-foreground text-sm">
                A conta ainda não tem funil. Peça a um administrador para criar.
              </p>
            )}
            <Field>
              <FieldLabel htmlFor="deal-title">Título (opcional)</FieldLabel>
              <Input
                id="deal-title"
                maxLength={120}
                value={title}
                placeholder={contact ? dealContactLabel(contact) : 'O nome do contato'}
                onChange={(event) => setTitle(event.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={valueCents === undefined}>
                <FieldLabel htmlFor="deal-value">Valor (R$)</FieldLabel>
                <Input
                  id="deal-value"
                  inputMode="decimal"
                  value={value}
                  placeholder="Opcional"
                  aria-invalid={valueCents === undefined}
                  onChange={(event) => setValue(event.target.value)}
                />
                {valueCents === undefined && (
                  <FieldError>Use só números, como 1500 ou 1.500,00</FieldError>
                )}
              </Field>
              <Field>
                <FieldLabel htmlFor="deal-owner">Responsável</FieldLabel>
                <OwnerSelect id="deal-owner" value={owner} onChange={setOwner} />
              </Field>
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="deal-form"
            disabled={!board || (!contact && !conversationId) || create.isPending}
          >
            {create.isPending ? 'Criando…' : 'Criar negócio'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

/** Detalhe do negócio: editar, ganhar, perder (com motivo), reabrir, excluir. */
export function DealDialog({
  dealId,
  losing = false,
  onOpenChange,
}: {
  dealId: string
  /** Abre já pedindo o motivo da perda ("Perdeu…" no card). */
  losing?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const deal = useDeal(dealId)
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {deal.isError ? (
          <>
            <DialogHeader>
              <DialogTitle>Negócio</DialogTitle>
              <DialogDescription>{errorMessage(deal.error)}</DialogDescription>
            </DialogHeader>
          </>
        ) : !deal.data ? (
          <>
            <DialogHeader>
              <DialogTitle>Negócio</DialogTitle>
              <DialogDescription>Carregando…</DialogDescription>
            </DialogHeader>
            <Skeleton className="h-40" />
          </>
        ) : (
          <DealForm
            key={deal.data.id}
            deal={deal.data}
            startLosing={losing && deal.data.status === 'open'}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function DealForm({
  deal,
  startLosing,
  onClose,
}: {
  deal: NonNullable<ReturnType<typeof useDeal>['data']>
  startLosing: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(deal.title)
  const [value, setValue] = useState(moneyToInput(deal.valueCents))
  const [owner, setOwner] = useState(deal.ownerId ?? NO_OWNER)
  const [losing, setLosing] = useState(startLosing)
  const [reason, setReason] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const valueCents = parseMoney(value)
  const status = DEAL_STATUS[deal.status]

  const done = (message: string, close = true) => {
    toast.success(message)
    refreshDeals(queryClient)
    if (close) onClose()
  }

  const save = useMutation({
    mutationFn: () =>
      dealsApi.update(deal.id, {
        title,
        valueCents: valueCents ?? null,
        ownerId: owner === NO_OWNER ? null : owner,
      }),
    onSuccess: () => done('Negócio atualizado.'),
  })
  const setStatus = useMutation({
    mutationFn: (input: { status: 'won' | 'lost' | 'open'; lostReason?: string | null }) =>
      dealsApi.setStatus(deal.id, input),
    onSuccess: (updated) =>
      done(
        updated.status === 'won'
          ? 'Negócio ganho!'
          : updated.status === 'lost'
            ? 'Negócio marcado como perdido.'
            : 'Negócio reaberto.',
        updated.status !== 'open',
      ),
    onError: (error) => toast.error(errorMessage(error)),
  })
  const remove = useMutation({
    mutationFn: () => dealsApi.remove(deal.id),
    onSuccess: () => done('Negócio excluído.'),
    onError: (error) => toast.error(errorMessage(error)),
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="min-w-0 truncate">{deal.title}</span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </DialogTitle>
        <DialogDescription>
          {deal.board.name} › {deal.column.name}
          {deal.closedAt && ` · fechado em ${dateTime.format(new Date(deal.closedAt))}`}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link to={`/contacts/${deal.contactId}`} className="text-primary hover:underline">
          {dealContactLabel(deal.contact)}
        </Link>
        {deal.conversation ? (
          <Link
            to={`/conversations/${deal.conversation.id}?status=${deal.conversation.status}`}
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Abrir conversa
          </Link>
        ) : (
          <span className="text-muted-foreground">
            {deal.conversationId ? 'Conversa de outra equipe' : 'Sem conversa ainda'}
          </span>
        )}
      </div>
      {deal.status === 'lost' && deal.lostReason && (
        <p className="text-muted-foreground text-sm">Motivo da perda: {deal.lostReason}</p>
      )}

      <form
        id="deal-edit"
        onSubmit={(event) => {
          event.preventDefault()
          if (valueCents !== undefined && title.trim()) save.mutate()
        }}
        noValidate
      >
        <FieldGroup>
          <FormError error={save.error} />
          <Field>
            <FieldLabel htmlFor="deal-edit-title">Título</FieldLabel>
            <Input
              id="deal-edit-title"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={valueCents === undefined}>
              <FieldLabel htmlFor="deal-edit-value">Valor (R$)</FieldLabel>
              <Input
                id="deal-edit-value"
                inputMode="decimal"
                value={value}
                placeholder="Sem valor"
                aria-invalid={valueCents === undefined}
                onChange={(event) => setValue(event.target.value)}
              />
              {valueCents === undefined ? (
                <FieldError>Use só números, como 1500 ou 1.500,00</FieldError>
              ) : (
                valueCents !== null && (
                  <FieldDescription>{formatMoney(valueCents)}</FieldDescription>
                )
              )}
            </Field>
            <Field>
              <FieldLabel htmlFor="deal-edit-owner">Responsável</FieldLabel>
              <OwnerSelect id="deal-edit-owner" value={owner} onChange={setOwner} />
            </Field>
          </div>
        </FieldGroup>
      </form>

      {losing && (
        <Field>
          <FieldLabel htmlFor="deal-lost-reason">Por que perdeu? (opcional)</FieldLabel>
          <Textarea
            id="deal-lost-reason"
            rows={2}
            maxLength={500}
            autoFocus
            value={reason}
            placeholder="Ex.: achou caro, fechou com outro, sem resposta"
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLosing(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ status: 'lost', lostReason: reason || null })}
            >
              Marcar como perdido
            </Button>
          </div>
        </Field>
      )}

      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {deal.status === 'open' ? (
            <>
              <Button
                variant="outline"
                className="text-success"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ status: 'won' })}
              >
                <Trophy />
                Ganhou
              </Button>
              {!losing && (
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setLosing(true)}
                >
                  <X />
                  Perdeu
                </Button>
              )}
            </>
          ) : (
            <Button
              variant="outline"
              disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ status: 'open' })}
            >
              <Undo2 />
              Reabrir
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir negócio"
            title="Excluir negócio"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
        <Button
          type="submit"
          form="deal-edit"
          disabled={!title.trim() || valueCents === undefined || save.isPending}
        >
          Salvar
        </Button>
      </DialogFooter>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir o negócio {deal.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ele some do funil e da ficha do contato. Se a venda não aconteceu, prefira marcar como
              perdido — assim ela entra nas contas do funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
