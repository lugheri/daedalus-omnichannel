import { ChevronsLeft } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { itemsOf, type NavModule } from '../../navigation'

/** Painel com as telas do módulo aberto, por grupo. */
export function ModulePanel({
  module,
  onCollapse,
  onNavigate,
}: {
  module: NavModule
  /** Ausente na gaveta do celular (lá quem fecha é o fundo escurecido). */
  onCollapse?: () => void
  onNavigate?: () => void
}) {
  const count = itemsOf(module).length

  return (
    <nav
      aria-label={`Telas de ${module.label}`}
      className="bg-sidebar border-sidebar-border flex h-full w-60 shrink-0 flex-col border-r"
    >
      <div className="border-sidebar-border border-b px-3 pt-3 pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight">
            {module.label}
          </h2>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              title="Recolher painel"
              className="text-faint hover:bg-muted hover:text-foreground rounded p-1"
            >
              <ChevronsLeft className="size-4" />
              <span className="sr-only">Recolher painel</span>
            </button>
          )}
        </div>
        <p className="text-faint text-xs">
          {count} {count === 1 ? 'tela' : 'telas'} · {module.description}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pt-2 pb-4">
        {module.groups.map((group) => (
          <div key={group.label ?? '-'} className="mb-1">
            {group.label && (
              <div className="text-faint px-1.5 pt-2 pb-1 text-[10px] font-bold tracking-[0.07em] uppercase">
                {group.label}
              </div>
            )}
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]',
                    isActive &&
                      'bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground font-semibold',
                  )
                }
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                <span className="truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </div>
    </nav>
  )
}
