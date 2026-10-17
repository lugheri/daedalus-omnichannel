import { useState } from 'react'
import { DealDialog } from './deal-dialogs'
import { useConversationDeals } from './api'

/** "Vendas › Proposta" — os negócios em aberto da conversa (abrem o negócio). */
export function DealLinks({ conversationId }: { conversationId: string }) {
  const deals = useConversationDeals(conversationId)
  const [open, setOpen] = useState<string | null>(null)
  if (!deals.data?.length) return null
  return (
    <>
      <p
        className="text-muted-foreground truncate text-xs"
        title={deals.data.map((d) => `${d.board.name} › ${d.column.name}`).join(' · ')}
      >
        {deals.data.map((deal, index) => (
          <span key={deal.id}>
            {index > 0 && ' · '}
            <button type="button" className="hover:underline" onClick={() => setOpen(deal.id)}>
              {deal.board.name} › {deal.column.name}
            </button>
          </span>
        ))}
      </p>
      {open && <DealDialog dealId={open} onOpenChange={() => setOpen(null)} />}
    </>
  )
}
