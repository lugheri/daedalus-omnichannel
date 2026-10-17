import { Handshake, Plus } from 'lucide-react'
import { useState } from 'react'
import { CONVERSATION_SCOPES } from '@/app/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/features/auth/session-context'
import { useMemberNames } from '@/features/members/api'
import { formatMoney } from '@/lib/money'
import { useContactDeals, type DealContact } from './api'
import { DealDialog, NewDealDialog } from './deal-dialogs'
import { DEAL_STATUS } from './deal-format'

/**
 * Negócios do contato (ficha): em aberto primeiro, depois ganhos e perdidos.
 * A API devolve só os que o membro pode ver.
 */
export function ContactDeals({ contact }: { contact: DealContact }) {
  const { canAny } = usePermissions()
  const allowed = canAny(...CONVERSATION_SCOPES)
  const deals = useContactDeals(contact.id)
  const nameOf = useMemberNames()
  const [open, setOpen] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  if (!allowed) return null
  const items = deals.data ?? []

  return (
    <section aria-labelledby="deals-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="deals-title" className="font-semibold">
          Negócios
        </h2>
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <Plus />
          Novo negócio
        </Button>
      </div>
      {deals.isPending && <Skeleton className="h-16" />}
      {!deals.isPending && items.length === 0 && (
        <p className="text-muted-foreground text-sm">Nenhum negócio com este contato ainda.</p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((deal) => {
          const status = DEAL_STATUS[deal.status]
          return (
            <li key={deal.id}>
              <button
                type="button"
                onClick={() => setOpen(deal.id)}
                className="hover:bg-accent flex w-full gap-3 rounded-md border p-3 text-left"
              >
                <Handshake className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{deal.title}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {deal.valueCents !== null && (
                        <span className="text-sm font-semibold tabular-nums">
                          {formatMoney(deal.valueCents)}
                        </span>
                      )}
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {deal.board.name} › {deal.column.name} ·{' '}
                    {deal.ownerId
                      ? (nameOf(deal.ownerId) ?? 'Membro desativado')
                      : 'Sem responsável'}
                  </p>
                  {deal.status === 'lost' && deal.lostReason && (
                    <p className="text-muted-foreground truncate text-xs">
                      Motivo: {deal.lostReason}
                    </p>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      {open && <DealDialog dealId={open} onOpenChange={() => setOpen(null)} />}
      {creating && <NewDealDialog contact={contact} open onOpenChange={setCreating} />}
    </section>
  )
}
