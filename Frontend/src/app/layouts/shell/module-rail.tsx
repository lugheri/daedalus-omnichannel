import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavModule } from '../../navigation'

/**
 * Trilho de módulos. Nasce com o nome embaixo do ícone (ícone sozinho se
 * decora, não se lê); o modo só-ícone fica no botão do rodapé, para quem já
 * sabe de cor — e aí o nome aparece ao passar o mouse.
 */
export function ModuleRail({
  modules,
  current,
  compact,
  onCompactChange,
  onSelect,
}: {
  modules: NavModule[]
  current: string | undefined
  compact: boolean
  onCompactChange: (compact: boolean) => void
  onSelect: (module: NavModule) => void
}) {
  return (
    <nav
      aria-label="Módulos"
      className={cn(
        'bg-rail-2 flex h-full shrink-0 flex-col items-center gap-0.5 overflow-y-auto py-2',
        compact ? 'w-13' : 'w-[78px]',
      )}
    >
      {modules.map((module) => {
        const Icon = module.icon
        const active = module.key === current
        return (
          <button
            key={module.key}
            type="button"
            onClick={() => onSelect(module)}
            aria-current={active ? 'page' : undefined}
            title={compact ? module.label : module.description}
            className={cn(
              'text-rail-foreground group relative flex flex-col items-center justify-center gap-1 rounded-lg hover:bg-white/12 hover:text-white',
              compact ? 'size-10' : 'min-h-12 w-[66px] px-1 py-1.5',
              active &&
                'bg-white/18 text-white before:absolute before:top-2 before:bottom-2 before:-left-1.5 before:w-[3px] before:rounded-r before:bg-white',
            )}
          >
            <Icon className="size-[18px]" />
            {compact ? (
              <span className="sr-only">{module.label}</span>
            ) : (
              <span className="line-clamp-2 text-center text-[10px] leading-tight">
                {module.label}
              </span>
            )}
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => onCompactChange(!compact)}
        title={compact ? 'Mostrar os nomes' : 'Só os ícones'}
        className="mt-auto flex items-center justify-center rounded-md p-2 text-white/40 hover:bg-white/10 hover:text-white"
      >
        {compact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
        <span className="sr-only">{compact ? 'Mostrar os nomes' : 'Só os ícones'}</span>
      </button>
    </nav>
  )
}
