import { Menu, Search } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { AccountSwitcher } from './account-switcher'
import { Kbd } from './command-palette'
import { UserMenu } from './user-menu'

/** Barra escura do topo: menu, marca, busca de telas, conta, tema e usuário. */
export function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  return (
    <header className="bg-rail flex h-12 shrink-0 items-center gap-2.5 overflow-hidden pr-2.5 pl-1.5 text-white">
      <button
        type="button"
        onClick={onMenu}
        title="Menu"
        className="text-rail-foreground flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-white/12 hover:text-white"
      >
        <Menu className="size-[18px]" />
        <span className="sr-only">Menu</span>
      </button>

      <div className="shrink-0 pr-1.5 text-sm font-extrabold tracking-[0.09em]">
        DAEDALUS
        <span className="ml-1.5 hidden text-[11px] font-medium tracking-normal opacity-50 sm:inline">
          Omnichannel
        </span>
      </div>

      {/* min-w-0: a busca encolhe em vez de empurrar o lado direito para fora da tela. */}
      <button
        type="button"
        onClick={onSearch}
        title="Buscar tela (Ctrl K)"
        className="text-rail-foreground ml-auto flex h-8 shrink-0 items-center gap-2 rounded-md border border-white/14 bg-white/10 px-2.5 text-[13px] hover:bg-white/15 sm:mx-auto sm:max-w-[520px] sm:min-w-0 sm:flex-1 sm:shrink"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="sr-only flex-1 truncate text-left sm:not-sr-only">Buscar tela…</span>
        <Kbd className="hidden sm:inline">Ctrl K</Kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1 sm:ml-auto">
        <AccountSwitcher />
        <ThemeToggle className="text-rail-foreground hover:bg-white/12 hover:text-white" />
        <UserMenu />
      </div>
    </header>
  )
}
