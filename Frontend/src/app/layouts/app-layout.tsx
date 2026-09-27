import { LogOut, MessagesSquare } from 'lucide-react'
import { NavLink, Outlet, useMatches, useNavigate } from 'react-router'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useMe, usePermissions, useSession } from '@/features/auth/session-context'
import { RealtimeProvider } from '@/features/realtime/realtime-provider'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '../navigation'

/** Moldura das telas logadas: menu lateral (filtrado por permissão) + cabeçalho. */
export function AppLayout() {
  const me = useMe()
  const { canAny } = usePermissions()
  const { end } = useSession()
  const navigate = useNavigate()
  // Telas que ocupam a área inteira (ex.: caixa de entrada) declaram handle: { fullBleed: true }.
  const fullBleed = useMatches().some(
    (match) => (match.handle as RouteHandle | undefined)?.fullBleed,
  )
  const items = NAV_ITEMS.filter((item) => item.anyOf.length === 0 || canAny(...item.anyOf))

  const logOut = async () => {
    await end()
    navigate('/login', { replace: true })
  }

  return (
    <RealtimeProvider>
      <div className="flex h-svh">
        <aside className="bg-muted/40 hidden w-60 shrink-0 flex-col border-r md:flex">
          <div className="flex h-14 items-center gap-2 border-b px-4 font-semibold">
            <MessagesSquare className="text-primary size-5" />
            Omnichannel
          </div>
          <nav className="flex flex-col gap-1 p-2">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                    isActive && 'bg-accent text-accent-foreground font-medium',
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center justify-between gap-4 border-b px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate font-medium">{me.tenant.name}</span>
              {me.tenant.status === 'trial' && <Badge variant="secondary">Teste</Badge>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="size-7">
                    <AvatarFallback>{initials(me.user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden text-sm sm:inline">{me.user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col">
                  <span>{me.user.name}</span>
                  <span className="text-muted-foreground text-xs font-normal">{me.user.email}</span>
                  <span className="text-muted-foreground text-xs font-normal">{me.role.name}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void logOut()}>
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main
            className={cn(
              'min-h-0 flex-1',
              fullBleed ? 'flex flex-col' : 'overflow-y-auto p-4 md:p-6',
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </RealtimeProvider>
  )
}

/** Metadados que uma rota pode declarar em `handle`. */
export interface RouteHandle {
  fullBleed?: boolean
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
