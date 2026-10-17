import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useMe, useSession } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'

/**
 * Aviso de acesso da conta-mãe: a pessoa está numa conta abaixo da dela (tudo
 * o que fizer aqui fica registrado) — com o atalho para voltar.
 */
export function DelegationBanner() {
  const me = useMe()
  const { switchAccount } = useSession()
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const from = me.delegatedFrom
  if (!from) return null

  const back = async () => {
    setLeaving(true)
    try {
      void navigate('/accounts')
      await switchAccount(from.id)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setLeaving(false)
    }
  }

  return (
    <div
      role="status"
      className="bg-warning-soft text-warning flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-sm"
    >
      <ShieldCheck className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">
        Você está em <strong>{me.tenant.name}</strong> como acesso de <strong>{from.name}</strong>.
        O que fizer aqui fica registrado para a conta.
      </span>
      <Button size="sm" variant="outline" disabled={leaving} onClick={() => void back()}>
        <ArrowLeft />
        Voltar para {from.name}
      </Button>
    </div>
  )
}
