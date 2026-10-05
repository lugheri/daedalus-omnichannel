import { useQuery } from '@tanstack/react-query'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { authApi } from '@/features/auth/api'
import { useMe, useSession } from '@/features/auth/session-context'
import { errorMessage } from '@/lib/api/api-error'

/**
 * A conta em que se está, e a troca para outra (quem pertence a mais de
 * uma). Trocar volta para o Início: a tela aberta é dado da conta anterior.
 */
export function AccountSwitcher() {
  const me = useMe()
  const { switchAccount } = useSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const accounts = useQuery({
    queryKey: ['me', 'accounts'],
    queryFn: authApi.accounts,
    enabled: open,
  })

  const choose = async (tenantId: string) => {
    if (tenantId === me.tenant.id) return
    setSwitching(true)
    try {
      navigate('/')
      await switchAccount(tenantId)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setSwitching(false)
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={switching}
        title="Trocar de conta"
        className="text-rail-foreground flex max-w-56 min-w-0 items-center gap-1.5 rounded-md px-2 py-1 text-[13px] outline-none hover:bg-white/12 hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Building2 className="size-4 shrink-0 opacity-70" />
        <span className="sr-only truncate font-semibold text-white sm:not-sr-only">
          {me.tenant.name}
        </span>
        {me.tenant.status === 'trial' && (
          <Badge variant="secondary" className="hidden h-4 px-1.5 text-[10px] sm:inline-flex">
            Teste
          </Badge>
        )}
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Suas contas</DropdownMenuLabel>
        <p className="text-muted-foreground px-2 pb-1.5 text-xs sm:hidden">
          Agora em {me.tenant.name}
        </p>
        <DropdownMenuSeparator />
        {accounts.isPending && <DropdownMenuItem disabled>Carregando…</DropdownMenuItem>}
        {accounts.isError && (
          <DropdownMenuItem disabled>Não foi possível carregar as contas.</DropdownMenuItem>
        )}
        {accounts.data?.map((tenant) => (
          <DropdownMenuItem key={tenant.id} onSelect={() => void choose(tenant.id)}>
            <span className="min-w-0 flex-1 truncate">{tenant.name}</span>
            {tenant.status === 'trial' && <Badge variant="secondary">Teste</Badge>}
            {tenant.id === me.tenant.id && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
        {accounts.data?.length === 1 && (
          <p className="text-muted-foreground px-2 pt-1 pb-2 text-xs">
            Você só tem acesso a esta conta.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
